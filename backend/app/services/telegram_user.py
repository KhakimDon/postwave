"""MTProto (Telethon) — подключение СВОЕГО Telegram-аккаунта для CRM-инбокса.

Юзер авторизуется официально: телефон → код (→ 2FA-пароль при необходимости).
Пароль 2FA НЕ сохраняется. Сохраняется только session string (шифруется снаружи).

Слой устроен как менеджер соединений:
- На каждую session-строку держим ОДИН живой TelegramClient (одно MTProto-
  соединение). Подключение сериализовано локом — иначе две параллельные ручки
  (лавина аватарок при открытии инбокса) создадут два коннекта на одном auth-key,
  Telegram это считает дублем и убивает ключ => аккаунт «разлогинивается».
- Кэш сущностей (access_hash) прогреваем ОДИН раз на подключение (а не на каждый
  запрос), иначе свежий клиент «не знает» собеседника ("Could not find entity").
- Мёртвую сессию (ключ отозван/дубль) распознаём и отдаём наружу понятной ошибкой
  SessionRevokedError, чтобы фронт предложил переподключить аккаунт.
"""

import asyncio
import logging
import time
from collections import OrderedDict
from pathlib import Path

from telethon import TelegramClient, events
from telethon.errors import (
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    SessionPasswordNeededError,
)
from telethon.sessions import StringSession
from telethon.tl.functions.contacts import (
    AddContactRequest,
    DeleteContactsRequest,
)
from telethon.tl.functions.messages import GetPeerDialogsRequest
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.types import (
    InputDialogPeer,
    UserStatusLastMonth,
    UserStatusLastWeek,
    UserStatusOffline,
    UserStatusOnline,
    UserStatusRecently,
)
from telethon.tl.types import User as TLUser

from ..config import get_settings

log = logging.getLogger("postwave.telegram")
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


class TelegramUserError(Exception):
    pass


class SessionRevokedError(TelegramUserError):
    """Сессия Telegram недействительна — нужно переподключить аккаунт."""


def _is_dead_session(exc: Exception) -> bool:
    """Ошибки Telethon, означающие что session-ключ больше не валиден."""
    name = type(exc).__name__
    return any(
        k in name
        for k in (
            "AuthKey",  # AuthKeyUnregistered / AuthKeyDuplicated / AuthKeyInvalid
            "SessionRevoked",
            "SessionExpired",
            "Unauthorized",
            "UserDeactivated",
        )
    )


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


# ---------------- Вход ----------------
# login_id -> {client, phone, phone_code_hash, expires}
_logins: dict[str, dict] = {}
_LOGIN_TTL = 600  # 10 минут на завершение входа


def _gc() -> None:
    now = time.time()
    for lid in [k for k, v in _logins.items() if v["expires"] < now]:
        try:
            _logins[lid]["client"].disconnect()
        except Exception:  # noqa: BLE001
            pass
        _logins.pop(lid, None)


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


# ---------------- Вход по QR ----------------
async def start_qr_login(login_id: str) -> dict:
    """QR-вход: создаём клиент и токен. Возвращает {url} для отрисовки QR.
    Пользователь сканирует его в Telegram (Настройки → Устройства → Подключить
    устройство)."""
    _gc()
    _require_api()
    client = _new_client()
    await client.connect()
    qr = await client.qr_login()
    _logins[login_id] = {
        "client": client,
        "qr": qr,
        "expires": time.time() + _LOGIN_TTL,
    }
    return {"url": qr.url}


async def poll_qr_login(login_id: str) -> dict:
    """Опрос QR-входа: 'pending' (+обновлённый url) | 'password_needed' | 'ok'."""
    import datetime as _dt

    data = _logins.get(login_id)
    if not data or "qr" not in data:
        raise TelegramUserError("Сессия входа истекла, начните заново.")
    qr = data["qr"]
    try:
        res = await qr.wait(timeout=2)
        if res:
            return await _finalize(login_id)
    except SessionPasswordNeededError:
        return {"status": "password_needed"}
    except asyncio.TimeoutError:
        pass
    except Exception as e:  # noqa: BLE001
        raise TelegramUserError(f"Ошибка QR-входа: {e}")
    # токен живёт ~30 сек — по истечении пересоздаём, чтобы QR обновился
    try:
        if qr.expires and qr.expires <= _dt.datetime.now(_dt.timezone.utc):
            await qr.recreate()
            data["expires"] = time.time() + _LOGIN_TTL
    except Exception:  # noqa: BLE001
        pass
    return {"status": "pending", "url": qr.url}


# ---------------- Менеджер соединений ----------------
_clients: dict[str, TelegramClient] = {}
_client_locks: dict[str, asyncio.Lock] = {}
_warmed: set[int] = set()  # id(client), у которых уже прогрет кэш сущностей
_warm_lock = asyncio.Lock()


def _lock_for(session: str) -> asyncio.Lock:
    lock = _client_locks.get(session)
    if lock is None:
        lock = asyncio.Lock()
        _client_locks[session] = lock
    return lock


async def _drop(session: str) -> None:
    """Закрываем и забываем клиента (после отзыва ключа/при остановке)."""
    client = _clients.pop(session, None)
    if client is not None:
        _warmed.discard(id(client))
        _handlers.discard(id(client))
        try:
            await client.disconnect()
        except Exception:  # noqa: BLE001
            pass


async def _client_for(session: str) -> TelegramClient:
    """Живой авторизованный клиент на сессию. Подключение сериализовано локом."""
    client = _clients.get(session)
    if client is not None and client.is_connected():
        return client
    async with _lock_for(session):
        # повторная проверка под локом: пока ждали, другой запрос мог подключить
        client = _clients.get(session)
        if client is not None and client.is_connected():
            return client
        if client is None:
            client = _new_client(session)
        try:
            await client.connect()  # переподключение существующего хранит кэш сущностей
            if not await client.is_user_authorized():
                raise SessionRevokedError(
                    "Сессия Telegram недействительна — переподключите аккаунт."
                )
        except SessionRevokedError:
            await _drop(session)
            raise
        except Exception as e:  # noqa: BLE001
            if _is_dead_session(e):
                await _drop(session)
                raise SessionRevokedError(
                    "Сессия Telegram недействительна — переподключите аккаунт."
                ) from e
            raise
        _warmed.discard(id(client))  # свежее подключение — кэш сущностей холодный
        _clients[session] = client
        return client


async def _warm(client: TelegramClient) -> None:
    """Прогрев кэша сущностей (скан диалогов). Один раз на подключение."""
    if id(client) in _warmed:
        return
    async with _warm_lock:
        if id(client) in _warmed:  # лавина параллельных вызовов схлопывается
            return
        async for _ in client.iter_dialogs(limit=200):
            pass
        _warmed.add(id(client))


async def _run(session: str, op):
    """Выполнить op(client). На ValueError (нет сущности) — прогреть и повторить.
    Мёртвую сессию превращаем в SessionRevokedError, чтобы фронт переподключил."""
    client = await _client_for(session)
    try:
        try:
            return await op(client)
        except ValueError:
            await _warm(client)
            return await op(client)
    except TelegramUserError:
        raise
    except Exception as e:  # noqa: BLE001
        if _is_dead_session(e):
            await _drop(session)
            raise SessionRevokedError(
                "Сессия Telegram недействительна — переподключите аккаунт."
            ) from e
        raise


async def disconnect_all() -> None:
    """Аккуратно закрыть все соединения (на shutdown приложения)."""
    for session in list(_clients):
        await _drop(session)


# ---------------- Real-time: подписка на новые сообщения (SSE) ----------------
# session -> набор очередей подписчиков (по одной на открытый SSE-поток)
_subscribers: dict[str, set[asyncio.Queue]] = {}
_handlers: set[int] = set()  # id(client) с навешенным обработчиком обновлений


def _attach_handler(session: str, client: TelegramClient) -> None:
    """Навешиваем обработчик новых сообщений (один раз на подключение клиента)."""
    if id(client) in _handlers:
        return

    @client.on(events.NewMessage)
    async def _on_new(event):  # noqa: ANN001
        try:
            msg = event.message
            payload = {
                "type": "message",
                "dialog_id": event.chat_id,
                "id": msg.id,
                "text": msg.message or "",
                "out": bool(msg.out),
                "date": msg.date.isoformat() if msg.date else None,
                "media_type": _media_type(msg),
            }
        except Exception:  # noqa: BLE001
            return
        for q in list(_subscribers.get(session, ())):
            try:
                q.put_nowait(payload)
            except Exception:  # noqa: BLE001
                pass

    @client.on(events.MessageRead)
    async def _on_read(event):  # noqa: ANN001
        # outbox=True — собеседник прочитал НАШИ сообщения (обновляем галочки)
        try:
            payload = {
                "type": "read",
                "dialog_id": event.chat_id,
                "max_id": event.max_id,
                "outbox": bool(event.outbox),
            }
        except Exception:  # noqa: BLE001
            return
        for q in list(_subscribers.get(session, ())):
            try:
                q.put_nowait(payload)
            except Exception:  # noqa: BLE001
                pass

    _handlers.add(id(client))


async def event_stream(session: str):
    """Асинхронный генератор событий инбокса для SSE. Держит соединение живым
    (ping раз в 15с) и переустанавливает обработчик после переподключения."""
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(session, set()).add(q)
    try:
        client = await _client_for(session)
        _attach_handler(session, client)
        yield {"type": "ready"}
        while True:
            try:
                item = await asyncio.wait_for(q.get(), timeout=15)
                yield item
            except asyncio.TimeoutError:
                # переподключение/keep-alive: гарантируем живого клиента с обработчиком
                try:
                    client = await _client_for(session)
                    _attach_handler(session, client)
                except SessionRevokedError:
                    yield {"type": "error", "reason": "session_revoked"}
                    return
                yield {"type": "ping"}
    finally:
        subs = _subscribers.get(session)
        if subs is not None:
            subs.discard(q)
            if not subs:
                _subscribers.pop(session, None)


# ---------------- Чтение/запись ----------------
async def list_dialogs(session: str, limit: int = 50, offset: int = 0) -> list[dict]:
    """Диалоги по убыванию свежести. offset — для бесконечной подгрузки."""

    import datetime as _dt

    async def op(client: TelegramClient):
        out = []
        i = 0
        now = _dt.datetime.now(_dt.timezone.utc)
        # archived=None → отдаёт и архив, и основную папку (помечаем флагом archived)
        async for d in client.iter_dialogs(limit=limit + offset, archived=None):
            if i < offset:
                i += 1
                continue
            # архив: folder_id == 1
            archived = getattr(d, "folder_id", None) == 1
            # mute: notify_settings.mute_until в будущем
            ns = getattr(getattr(d, "dialog", None), "notify_settings", None)
            mute_until = getattr(ns, "mute_until", None)
            muted = False
            if mute_until is not None:
                try:
                    muted = mute_until > now
                except TypeError:
                    muted = bool(mute_until)
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
                    "online": bool(d.is_user)
                    and isinstance(getattr(d.entity, "status", None), UserStatusOnline),
                    "archived": archived,
                    "muted": muted,
                }
            )
            i += 1
        return out

    return await _run(session, op)


# Аватар почти не меняется -> кэшируем в памяти (включая None = «фото нет»),
# чтобы повторные открытия инбокса были мгновенными и не грузили соединение.
_avatar_cache: dict[tuple, bytes | None] = {}
_AVATAR_CACHE_MAX = 500


async def download_avatar(session: str, dialog_id: int) -> bytes | None:
    """Аватар (фото профиля) собеседника. None — если фото нет."""
    key = (session, dialog_id)
    if key in _avatar_cache:
        return _avatar_cache[key]

    async def op(client: TelegramClient):
        return await client.download_profile_photo(dialog_id, file=bytes)

    data = await _run(session, op)
    _avatar_cache[key] = data
    if len(_avatar_cache) > _AVATAR_CACHE_MAX:
        _avatar_cache.pop(next(iter(_avatar_cache)))
    return data


def invalidate_avatar(session: str, dialog_id: int) -> None:
    _avatar_cache.pop((session, dialog_id), None)


async def get_profile(session: str, dialog_id: int) -> dict:
    """Инфо о собеседнике: имя, @username, телефон, био, число фото профиля."""

    async def op(client: TelegramClient):
        ent = await client.get_entity(dialog_id)
        title = getattr(ent, "title", None)  # для групп/каналов
        name = (
            title
            or " ".join(
                filter(
                    None,
                    [getattr(ent, "first_name", None), getattr(ent, "last_name", None)],
                )
            )
            or getattr(ent, "username", None)
            or str(getattr(ent, "id", ""))
        )
        bio = None
        if isinstance(ent, TLUser):
            try:
                full = await client(GetFullUserRequest(ent))
                bio = getattr(full.full_user, "about", None)
            except Exception:  # noqa: BLE001
                bio = None
        try:
            photos = await client.get_profile_photos(ent)
            count = len(photos)
        except Exception:  # noqa: BLE001
            count = 0
        return {
            "name": name,
            "username": getattr(ent, "username", None),
            "phone": getattr(ent, "phone", None),
            "bio": bio,
            "photo_count": count,
            # поля для управления контактом (только для пользователей)
            "is_user": isinstance(ent, TLUser),
            "is_contact": bool(getattr(ent, "contact", False)),
            "first_name": getattr(ent, "first_name", None),
            "last_name": getattr(ent, "last_name", None),
        }

    return await _run(session, op)


async def save_contact(
    session: str,
    dialog_id: int,
    first_name: str,
    last_name: str = "",
    phone: str = "",
) -> dict:
    """Добавить/обновить контакт собеседника (имя/фамилия/телефон)."""

    async def op(client: TelegramClient):
        input_user = await client.get_input_entity(dialog_id)
        await client(
            AddContactRequest(
                id=input_user,
                first_name=(first_name or "").strip(),
                last_name=(last_name or "").strip(),
                phone=(phone or "").strip(),
                add_phone_privacy_exception=False,
            )
        )
        return None

    await _run(session, op)
    # вернём обновлённый профиль
    return await get_profile(session, dialog_id)


async def delete_contact(session: str, dialog_id: int) -> dict:
    """Удалить собеседника из контактов."""

    async def op(client: TelegramClient):
        input_user = await client.get_input_entity(dialog_id)
        await client(DeleteContactsRequest(id=[input_user]))
        return None

    await _run(session, op)
    return await get_profile(session, dialog_id)


async def get_status(session: str, dialog_id: int) -> dict:
    """Последняя активность собеседника (для шапки чата)."""

    async def op(client: TelegramClient):
        ent = await client.get_entity(dialog_id)
        if isinstance(ent, TLUser):
            if getattr(ent, "bot", False):
                return {"kind": "bot"}
            st = getattr(ent, "status", None)
            if isinstance(st, UserStatusOnline):
                return {"kind": "online"}
            if isinstance(st, UserStatusOffline):
                return {
                    "kind": "offline",
                    "was_online": st.was_online.isoformat() if st.was_online else None,
                }
            if isinstance(st, UserStatusRecently):
                return {"kind": "recently"}
            if isinstance(st, UserStatusLastWeek):
                return {"kind": "week"}
            if isinstance(st, UserStatusLastMonth):
                return {"kind": "month"}
            return {"kind": "unknown"}
        # группы/каналы — число участников
        return {"kind": "group", "members": getattr(ent, "participants_count", None)}

    return await _run(session, op)


async def download_profile_photo_n(
    session: str, dialog_id: int, index: int
) -> bytes | None:
    """N-е фото профиля (для слайдера во весь экран). None — если нет."""

    async def op(client: TelegramClient):
        ent = await client.get_entity(dialog_id)
        photos = await client.get_profile_photos(ent)
        if index < 0 or index >= len(photos):
            return None
        return await client.download_media(photos[index], file=bytes)

    return await _run(session, op)


async def get_messages(session: str, dialog_id: int, limit: int = 50) -> list[dict]:
    async def op(client: TelegramClient):
        # сколько наших исходящих собеседник уже прочитал
        read_max = 0
        try:
            peer = await client.get_input_entity(dialog_id)
            res = await client(GetPeerDialogsRequest(peers=[InputDialogPeer(peer=peer)]))
            if res.dialogs:
                read_max = getattr(res.dialogs[0], "read_outbox_max_id", 0) or 0
        except Exception:  # noqa: BLE001
            read_max = 0

        # отмечаем входящие прочитанными: собеседник увидит, что мы прочитали,
        # и наш счётчик непрочитанных по диалогу сбрасывается
        try:
            await client.send_read_acknowledge(dialog_id)
        except Exception:  # noqa: BLE001
            pass

        out = []
        async for m in client.iter_messages(dialog_id, limit=limit):
            out.append(
                {
                    "id": m.id,
                    "text": m.message or "",
                    "out": m.out,  # True = отправлено нами
                    "date": m.date.isoformat() if m.date else None,
                    "media_type": _media_type(m),
                    "read": bool(m.out) and m.id <= read_max,
                    "grouped_id": m.grouped_id,
                }
            )
        return list(reversed(out))  # от старых к новым

    return await _run(session, op)


async def send_post(
    session: str, dialog_id: int, text: str, media_urls: list[str] | None = None
) -> None:
    """Отправить «публикацию» (текст + 0..N медиа). Несколько медиа — альбомом."""

    async def op(client: TelegramClient):
        paths = [p for p in (_local_path(u) for u in (media_urls or [])) if p]
        if paths:
            target = paths if len(paths) > 1 else paths[0]
            await client.send_file(dialog_id, target, caption=text or None)
        else:
            await client.send_message(dialog_id, text)

    await _run(session, op)


async def send_message(
    session: str, dialog_id: int, text: str, media_url: str | None = None
) -> dict:
    async def op(client: TelegramClient):
        if media_url:
            path = _local_path(media_url)
            if not path:
                raise TelegramUserError("Файл не найден на сервере")
            msg = await client.send_file(dialog_id, path, caption=text or None)
        else:
            msg = await client.send_message(dialog_id, text)
        return {"id": msg.id, "date": msg.date.isoformat() if msg.date else None}

    return await _run(session, op)


# Кэш медиа: видео/аудио браузер тянет range-запросами (по кускам), без кэша
# каждый кусок = повторное скачивание из Telegram. Лимит по СУММАРНОЙ памяти, а не
# по числу файлов: пара больших видео иначе раздули бы RAM.
_media_cache: "OrderedDict[tuple, tuple[bytes, str]]" = OrderedDict()
_media_bytes = 0
_MEDIA_CACHE_BYTES = 256 * 1024 * 1024  # 256 МБ


async def download_media(session: str, dialog_id: int, msg_id: int) -> tuple[bytes, str]:
    """Скачивает медиа конкретного сообщения. Возвращает (bytes, mime_type)."""
    global _media_bytes
    key = (session, dialog_id, msg_id)
    hit = _media_cache.get(key)
    if hit is not None:
        _media_cache.move_to_end(key)
        return hit

    async def op(client: TelegramClient):
        msg = await client.get_messages(dialog_id, ids=msg_id)
        if not msg or not msg.media:
            raise TelegramUserError("В сообщении нет медиа")
        data = await client.download_media(msg, file=bytes)
        mime = (msg.file.mime_type if msg.file else None) or "application/octet-stream"
        return data, mime

    data, mime = await _run(session, op)

    _media_cache[key] = (data, mime)
    _media_cache.move_to_end(key)
    _media_bytes += len(data)
    while _media_bytes > _MEDIA_CACHE_BYTES and len(_media_cache) > 1:
        _, (old_data, _m) = _media_cache.popitem(last=False)
        _media_bytes -= len(old_data)
    return data, mime
