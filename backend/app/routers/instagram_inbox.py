"""Инбокс Instagram Direct.

Входящие сообщения прилетают вебхуком от Meta (без авторизации — проверяем
verify-token). Исходящие отправляем через Graph API. Тред = igsid собеседника.

Требования Meta: продукт Instagram → Messaging, скоуп
`instagram_business_manage_messages`, подписка вебхука на поле `messages`.
Без App Review работает только на аккаунтах-тестировщиках приложения.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import get_current_user
from ..models import IgMessage, Platform, SocialAccount, User
from ..services.crypto import decrypt_credentials

router = APIRouter(prefix="/api/instagram", tags=["instagram-inbox"])
log = logging.getLogger("instagram.inbox")
settings = get_settings()


def _creds(acc: SocialAccount) -> dict:
    try:
        return decrypt_credentials(acc.credentials_enc)
    except Exception:  # noqa: BLE001
        return {}


def _find_ig_account_by_igid(db: Session, ig_business_id: str) -> SocialAccount | None:
    """Найти подключённый IG-аккаунт по его ig_user_id (id бизнес-аккаунта)."""
    accs = (
        db.query(SocialAccount)
        .filter(SocialAccount.platform == Platform.instagram)
        .all()
    )
    for a in accs:
        if str(_creds(a).get("ig_user_id")) == str(ig_business_id):
            return a
    return None


def _resolve_name(db: Session, acc: SocialAccount, igsid: str) -> str | None:
    """Имя собеседника по igsid: берём из ранее сохранённых сообщений, иначе
    тянем из Graph API (name/username) и кэшируем в этих сообщениях нет — вернём."""
    existing = (
        db.query(IgMessage)
        .filter(IgMessage.account_id == acc.id, IgMessage.igsid == igsid, IgMessage.name.isnot(None))
        .first()
    )
    if existing and existing.name:
        return existing.name
    token = _creds(acc).get("access_token")
    if not token:
        return None
    try:
        r = httpx.get(
            f"https://graph.instagram.com/{settings.instagram_graph_version}/{igsid}",
            params={"fields": "name,username", "access_token": token},
            timeout=15,
        )
        if r.status_code < 400:
            j = r.json()
            return j.get("name") or j.get("username")
    except Exception:  # noqa: BLE001
        pass
    return None


def _account_for_user(db: Session, account_id: int, user: User) -> SocialAccount:
    acc = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.id == account_id,
            SocialAccount.user_id == user.id,
            SocialAccount.platform == Platform.instagram,
        )
        .first()
    )
    if not acc:
        raise HTTPException(404, "Instagram-аккаунт не найден")
    return acc


# ----------------------------- Вебхук -----------------------------

@router.get("/webhook")
def webhook_verify(
    mode: str | None = Query(None, alias="hub.mode"),
    token: str | None = Query(None, alias="hub.verify_token"),
    challenge: str | None = Query(None, alias="hub.challenge"),
):
    """Проверка вебхука: Meta дёргает GET с challenge — эхо-ответ при совпадении."""
    _dump("GET verify", f"mode={mode} token={token} challenge={challenge}")
    if mode == "subscribe" and token == settings.instagram_verify_token:
        return PlainTextResponse(challenge or "")
    raise HTTPException(403, "verification failed")


def _dump(tag: str, text: str) -> None:
    """Пишем сырое тело вебхука в файл напрямую (logging до файла не доходит)."""
    try:
        with open("/tmp/ig_webhook_raw.log", "a") as f:
            f.write(f"--- {tag} ---\n{text}\n")
    except Exception:  # noqa: BLE001
        pass


@router.post("/webhook")
async def webhook_receive(request: Request, db: Session = Depends(get_db)):
    """Приём событий Instagram. Сохраняем входящие/эхо-сообщения в тред igsid."""
    raw = await request.body()
    _dump("POST", raw.decode("utf-8", "replace"))
    import json as _json

    try:
        data = _json.loads(raw or b"{}")
    except Exception:  # noqa: BLE001
        data = {}
    log.info("IG webhook доставка: %s", data)
    for entry in data.get("entry", []):
        biz_id = str(entry.get("id", ""))
        acc = _find_ig_account_by_igid(db, biz_id)
        # Meta шлёт сообщения в двух формах: entry[].messaging[] (реальные DM,
        # Messenger-стиль) и entry[].changes[]{field:"messages",value:{...}}
        # (формат кнопки «Тестировать» в дашборде). Поддерживаем обе.
        events = list(entry.get("messaging", []))
        for ch in entry.get("changes", []):
            if ch.get("field") == "messages" and ch.get("value"):
                events.append(ch["value"])
        if not events:
            continue
        if acc is None:
            log.warning("webhook: нет аккаунта для ig business id %s", biz_id)
            continue
        for ev in events:
            msg = ev.get("message") or {}
            if not msg or msg.get("is_deleted"):
                continue
            is_echo = bool(msg.get("is_echo"))
            sender = str((ev.get("sender") or {}).get("id", ""))
            recipient = str((ev.get("recipient") or {}).get("id", ""))
            # собеседник — это не наш бизнес-аккаунт
            igsid = recipient if is_echo else sender
            mid = msg.get("mid")
            # дубли по mid не пишем (Meta может ретраить доставку)
            if mid and db.query(IgMessage).filter(IgMessage.mid == mid).first():
                continue
            db.add(
                IgMessage(
                    account_id=acc.id,
                    igsid=igsid,
                    name=_resolve_name(db, acc, igsid),
                    text=msg.get("text") or "",
                    out=is_echo,
                    mid=mid,
                )
            )
    db.commit()
    return {"status": "ok"}


# ----------------------------- Диалоги / сообщения -----------------------------

@router.get("/{account_id}/dialogs")
def list_dialogs(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _account_for_user(db, account_id, user)
    rows = (
        db.query(IgMessage)
        .filter(IgMessage.account_id == account_id)
        .order_by(IgMessage.created_at.asc())
        .all()
    )
    threads: dict[str, dict] = {}
    for m in rows:
        t = threads.setdefault(
            m.igsid,
            {"igsid": m.igsid, "name": None, "last_message": "", "date": None, "unread": 0},
        )
        if m.name:
            t["name"] = m.name
        t["last_message"] = m.text
        t["date"] = m.created_at.isoformat() if m.created_at else None
        if not m.out:
            t["unread"] += 1
    # последние сверху
    return sorted(threads.values(), key=lambda x: x["date"] or "", reverse=True)


@router.get("/{account_id}/dialogs/{igsid}/messages")
def list_messages(
    account_id: int,
    igsid: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _account_for_user(db, account_id, user)
    rows = (
        db.query(IgMessage)
        .filter(IgMessage.account_id == account_id, IgMessage.igsid == igsid)
        .order_by(IgMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "text": m.text,
            "out": m.out,
            "date": m.created_at.isoformat() if m.created_at else None,
        }
        for m in rows
    ]


@router.post("/{account_id}/dialogs/{igsid}/send")
def send_message(
    account_id: int,
    igsid: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acc = _account_for_user(db, account_id, user)
    creds = _creds(acc)
    token = creds.get("access_token")
    ig_id = creds.get("ig_user_id")
    text = (body or {}).get("text", "").strip()
    if not token or not ig_id:
        raise HTTPException(400, "У аккаунта нет токена")
    if not text:
        raise HTTPException(400, "Пустое сообщение")

    url = f"https://graph.instagram.com/{settings.instagram_graph_version}/{ig_id}/messages"
    r = httpx.post(
        url,
        params={"access_token": token},
        json={"recipient": {"id": igsid}, "message": {"text": text}},
        timeout=30,
    )
    if r.status_code >= 400:
        raise HTTPException(400, f"Instagram: {r.text}")
    mid = None
    try:
        mid = r.json().get("message_id")
    except Exception:  # noqa: BLE001
        pass
    m = IgMessage(account_id=acc.id, igsid=igsid, text=text, out=True, mid=mid)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id}
