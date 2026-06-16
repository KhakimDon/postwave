"""CRM-инбокс: подключение СВОЕГО Telegram-аккаунта (MTProto) и работа с чатами.

Вход: /login/start (телефон) -> /login/code (код) -> [/login/password (2FA)].
Данные: /{id}/dialogs, /{id}/dialogs/{peer}/messages, .../send.
"""

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Response
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
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = _session_of(db, user, account_id)
    try:
        return await tu.list_dialogs(session)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Ошибка чтения диалогов: {e}")


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
    return Response(content=data, media_type=mime)
