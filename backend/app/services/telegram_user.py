"""MTProto (Telethon) — подключение СВОЕГО Telegram-аккаунта для CRM-инбокса.

Юзер авторизуется официально: телефон → код (→ 2FA-пароль при необходимости).
Пароль 2FA НЕ сохраняется. Сохраняется только session string (шифруется снаружи).

Вход разбит на шаги, поэтому держим живой клиент в памяти между запросами
(login store). Telethon асинхронный — все функции корутины, вызываются из
async-эндпоинтов на общем event loop uvicorn.
"""

import time
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import (
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    SessionPasswordNeededError,
)
from telethon.sessions import StringSession

from ..config import get_settings

settings = get_settings()
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


def _media_type(m) -> str | None:
    if m.photo:
        return "photo"
    if m.video or m.video_note or m.gif:
        return "video"
    if m.voice or m.audio:
        return "audio"
    if m.sticker:
        return "sticker"
    if m.document:
        return "document"
    return None


def _local_path(media_url: str) -> str | None:
    """URL загруженного нами файла -> путь на диске (для отправки)."""
    if "/media/" in media_url:
        p = UPLOAD_DIR / media_url.split("/media/", 1)[1].split("?")[0]
        if p.is_file():
            return str(p)
    return None


# login_id -> {client, phone, phone_code_hash, expires}
_logins: dict[str, dict] = {}
_LOGIN_TTL = 600  # 10 минут на завершение входа


class TelegramUserError(Exception):
    pass


def _require_api() -> tuple[int, str]:
    if not settings.telegram_api_id or not settings.telegram_api_hash:
        raise TelegramUserError(
            "MTProto не настроен: задайте TELEGRAM_API_ID и TELEGRAM_API_HASH "
            "(my.telegram.org)."
        )
    return settings.telegram_api_id, settings.telegram_api_hash


def _new_client(session: str = "") -> TelegramClient:
    api_id, api_hash = _require_api()
    return TelegramClient(StringSession(session), api_id, api_hash)


def _gc() -> None:
    now = time.time()
    for lid in [k for k, v in _logins.items() if v["expires"] < now]:
        try:
            _logins[lid]["client"].disconnect()
        except Exception:  # noqa: BLE001
            pass
        _logins.pop(lid, None)


# ---------------- Вход ----------------
async def start_login(login_id: str, phone: str) -> None:
    """Шаг 1: отправляем код на телефон, держим клиент живым."""
    _gc()
    client = _new_client()
    await client.connect()
    sent = await client.send_code_request(phone)
    _logins[login_id] = {
        "client": client,
        "phone": phone,
        "phone_code_hash": sent.phone_code_hash,
        "expires": time.time() + _LOGIN_TTL,
    }


async def submit_code(login_id: str, code: str) -> dict:
    """Шаг 2: вводим код. Возвращает {status: 'ok'|'password_needed', session?, me?}."""
    data = _logins.get(login_id)
    if not data:
        raise TelegramUserError("Сессия входа истекла, начните заново.")
    client: TelegramClient = data["client"]
    try:
        await client.sign_in(
            phone=data["phone"], code=code, phone_code_hash=data["phone_code_hash"]
        )
    except SessionPasswordNeededError:
        return {"status": "password_needed"}
    except PhoneCodeInvalidError:
        raise TelegramUserError("Неверный код.")
    except PhoneCodeExpiredError:
        raise TelegramUserError("Код истёк, запросите новый.")
    return await _finalize(login_id)


async def submit_password(login_id: str, password: str) -> dict:
    """Шаг 3 (если включена 2FA): облачный пароль. Не сохраняется."""
    data = _logins.get(login_id)
    if not data:
        raise TelegramUserError("Сессия входа истекла, начните заново.")
    client: TelegramClient = data["client"]
    try:
        await client.sign_in(password=password)
    except Exception:  # noqa: BLE001
        raise TelegramUserError("Неверный облачный пароль (2FA).")
    return await _finalize(login_id)


async def _finalize(login_id: str) -> dict:
    data = _logins.pop(login_id)
    client: TelegramClient = data["client"]
    me = await client.get_me()
    session_str = client.session.save()
    await client.disconnect()
    name = (
        me.username
        or " ".join(filter(None, [me.first_name, me.last_name]))
        or str(me.id)
    )
    return {"status": "ok", "session": session_str, "display_name": name}


# ---------------- Работа с аккаунтом ----------------
# Постоянные клиенты на сессию: кэш сущностей (access_hash) живёт между запросами,
# иначе свежий клиент «не знает» собеседника ("Could not find the input entity").
_clients: dict[str, TelegramClient] = {}


async def _client_for(session: str) -> TelegramClient:
    client = _clients.get(session)
    if client is not None and client.is_connected():
        return client
    client = _new_client(session)
    await client.connect()
    _clients[session] = client
    return client


async def _warm(client: TelegramClient) -> None:
    """Прогреваем кэш сущностей, чтобы id чатов резолвились."""
    async for _ in client.iter_dialogs(limit=200):
        pass


async def list_dialogs(session: str, limit: int = 50) -> list[dict]:
    client = await _client_for(session)
    out = []
    async for d in client.iter_dialogs(limit=limit):
        out.append(
            {
                "id": d.id,
                "name": d.name or "",
                "is_user": d.is_user,
                "is_group": d.is_group,
                "is_channel": d.is_channel,
                "unread": d.unread_count,
                "last_message": (d.message.message if d.message else "") or "",
                "date": d.date.isoformat() if d.date else None,
            }
        )
    return out


async def get_messages(session: str, dialog_id: int, limit: int = 50) -> list[dict]:
    client = await _client_for(session)

    async def _fetch() -> list[dict]:
        out = []
        async for m in client.iter_messages(dialog_id, limit=limit):
            out.append(
                {
                    "id": m.id,
                    "text": m.message or "",
                    "out": m.out,  # True = отправлено нами
                    "date": m.date.isoformat() if m.date else None,
                    "media_type": _media_type(m),
                }
            )
        return list(reversed(out))  # от старых к новым

    try:
        return await _fetch()
    except ValueError:
        await _warm(client)  # подгрузим сущности и повторим
        return await _fetch()


async def send_message(
    session: str, dialog_id: int, text: str, media_url: str | None = None
) -> dict:
    client = await _client_for(session)

    async def _do():
        if media_url:
            path = _local_path(media_url)
            if not path:
                raise TelegramUserError("Файл не найден на сервере")
            return await client.send_file(dialog_id, path, caption=text or None)
        return await client.send_message(dialog_id, text)

    try:
        msg = await _do()
    except ValueError:
        await _warm(client)
        msg = await _do()
    return {"id": msg.id, "date": msg.date.isoformat() if msg.date else None}


async def download_media(session: str, dialog_id: int, msg_id: int) -> tuple[bytes, str]:
    """Скачивает медиа конкретного сообщения. Возвращает (bytes, mime_type)."""
    client = await _client_for(session)
    try:
        msg = await client.get_messages(dialog_id, ids=msg_id)
    except ValueError:
        await _warm(client)
        msg = await client.get_messages(dialog_id, ids=msg_id)
    if not msg or not msg.media:
        raise TelegramUserError("В сообщении нет медиа")
    data = await client.download_media(msg, file=bytes)
    mime = (msg.file.mime_type if msg.file else None) or "application/octet-stream"
    return data, mime
