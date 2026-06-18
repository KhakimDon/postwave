"""CRM-инбокс: подключение СВОЕГО Telegram-аккаунта (MTProto) и работа с чатами.

Вход: /login/start (телефон) -> /login/code (код) -> [/login/password (2FA)].
Данные: /{id}/dialogs, /{id}/dialogs/{peer}/messages, .../send.
"""

import json
import re
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import decode_token
from ..db import get_db
from ..deps import get_current_user
from ..models import Platform, SocialAccount, User
from ..schemas import AccountOut
from ..services import telegram_user as tu
from ..services.crypto import decrypt_credentials, encrypt_credentials

router = APIRouter(prefix="/api/telegram/user", tags=["telegram-user"])


class StartBody(BaseModel):
    phone: str


class CodeBody(BaseModel):
    login_id: str
    code: str


class PasswordBody(BaseModel):
    login_id: str
    password: str


class SendBody(BaseModel):
    text: str = ""
    media_url: str | None = None


def _save_account(db: Session, user: User, result: dict) -> SocialAccount:
    """Сохраняет аккаунт из результата входа (session шифруется)."""
    creds = {"session": result["session"]}
    name = result.get("display_name", "Telegram")
    account = SocialAccount(
        user_id=user.id,
        platform=Platform.telegram_user,
        display_name=name,
        credentials_enc=encrypt_credentials(creds),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _session_of(db: Session, user: User, account_id: int) -> str:
    acc = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.id == account_id,
            SocialAccount.user_id == user.id,
            SocialAccount.platform == Platform.telegram_user,
        )
        .first()
    )
    if not acc:
        raise HTTPException(404, "Аккаунт не найден")
    return decrypt_credentials(acc.credentials_enc)["session"]


@router.get("/status")
def status():
    """Настроен ли MTProto (api_id/api_hash)."""
    ok = bool(tu.settings.telegram_api_id and tu.settings.telegram_api_hash)
    return {"configured": ok}


@router.post("/login/start")
async def login_start(body: StartBody, user: User = Depends(get_current_user)):
    login_id = uuid.uuid4().hex
    try:
        await tu.start_login(login_id, body.phone.strip())
    except tu.TelegramUserError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Не удалось отправить код: {e}")
    return {"login_id": login_id}


@router.post("/login/code")
async def login_code(
    body: CodeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        result = await tu.submit_code(body.login_id, body.code.strip())
    except tu.TelegramUserError as e:
        raise HTTPException(400, str(e))
    if result["status"] == "password_needed":
        return {"status": "password_needed"}
    account = _save_account(db, user, result)
    return {"status": "ok", "account": AccountOut.model_validate(account).model_dump()}


@router.post("/login/password")
async def login_password(
    body: PasswordBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        result = await tu.submit_password(body.login_id, body.password)
    except tu.TelegramUserError as e:
        raise HTTPException(400, str(e))
    account = _save_account(db, user, result)
    return {"status": "ok", "account": AccountOut.model_validate(account).model_dump()}


@router.get("/{account_id}/dialogs")
async def dialogs(
    account_id: int,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = _session_of(db, user, account_id)
    try:
        return await tu.list_dialogs(session, limit=limit, offset=offset)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка чтения диалогов: {e}")


@router.get("/{account_id}/stream")
async def stream(
    account_id: int,
    token: str | None = None,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    # EventSource не шлёт заголовок -> токен принимаем в query (?token=)
    raw = token or (
        authorization.split(" ", 1)[1] if authorization and " " in authorization else None
    )
    uid = decode_token(raw) if raw else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Требуется вход")
    session = _session_of(db, user, account_id)

    async def gen():
        try:
            async for ev in tu.event_stream(session):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except tu.SessionRevokedError:
            yield f'data: {json.dumps({"type": "error", "reason": "session_revoked"})}\n\n'

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{account_id}/dialogs/{dialog_id}/status")
async def dialog_status(
    account_id: int,
    dialog_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = _session_of(db, user, account_id)
    try:
        return await tu.get_status(session, dialog_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка статуса: {e}")


@router.get("/{account_id}/profile/{dialog_id}")
async def profile(
    account_id: int,
    dialog_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = _session_of(db, user, account_id)
    try:
        return await tu.get_profile(session, dialog_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка профиля: {e}")


@router.get("/{account_id}/profile/{dialog_id}/photo/{index}")
async def profile_photo(
    account_id: int,
    dialog_id: int,
    index: int,
    token: str | None = None,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    raw = token or (
        authorization.split(" ", 1)[1] if authorization and " " in authorization else None
    )
    uid = decode_token(raw) if raw else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Требуется вход")
    session = _session_of(db, user, account_id)
    try:
        data = await tu.download_profile_photo_n(session, dialog_id, index)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка фото: {e}")
    if not data:
        raise HTTPException(404, "Нет фото")
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.get("/{account_id}/avatar/{dialog_id}")
async def avatar(
    account_id: int,
    dialog_id: int,
    token: str | None = None,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    # <img> не шлёт заголовок -> принимаем токен и в query (?token=)
    raw = token or (
        authorization.split(" ", 1)[1] if authorization and " " in authorization else None
    )
    uid = decode_token(raw) if raw else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Требуется вход")
    session = _session_of(db, user, account_id)
    try:
        data = await tu.download_avatar(session, dialog_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка аватара: {e}")
    if not data:
        raise HTTPException(404, "Нет аватара")
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.get("/{account_id}/dialogs/{dialog_id}/messages")
async def messages(
    account_id: int,
    dialog_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = _session_of(db, user, account_id)
    try:
        return await tu.get_messages(session, dialog_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка чтения сообщений: {e}")


@router.post("/{account_id}/dialogs/{dialog_id}/send")
async def send(
    account_id: int,
    dialog_id: int,
    body: SendBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = _session_of(db, user, account_id)
    try:
        return await tu.send_message(session, dialog_id, body.text, body.media_url)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка отправки: {e}")


@router.get("/{account_id}/media/{dialog_id}/{msg_id}")
async def media(
    account_id: int,
    dialog_id: int,
    msg_id: int,
    request: Request,
    token: str | None = None,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    # <img>/<video> не шлют заголовок -> принимаем токен и в query (?token=)
    raw = token or (
        authorization.split(" ", 1)[1] if authorization and " " in authorization else None
    )
    uid = decode_token(raw) if raw else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Требуется вход")
    session = _session_of(db, user, account_id)
    try:
        data, mime = await tu.download_media(session, dialog_id, msg_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка медиа: {e}")

    total = len(data)
    # Range-запросы: видео/аудио браузер тянет по кускам и без этого не играет/не мотает
    range_header = request.headers.get("range")
    m = re.match(r"bytes=(\d+)-(\d*)", range_header or "")
    if m:
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else total - 1
        end = min(end, total - 1)
        if start > end:
            start = 0
        chunk = data[start : end + 1]
        return Response(
            content=chunk,
            status_code=206,
            media_type=mime,
            headers={
                "Content-Range": f"bytes {start}-{end}/{total}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(len(chunk)),
                "Cache-Control": "private, max-age=3600",
            },
        )
    return Response(
        content=data,
        media_type=mime,
        headers={"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"},
    )
