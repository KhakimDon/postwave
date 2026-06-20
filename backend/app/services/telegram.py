"""Публикация в Telegram-каналы через официальный Bot API.

Поток подключения (для UI):
  1. Пользователь создаёт бота у @BotFather и получает bot_token.
  2. Добавляет бота администратором в свой канал.
  3. Указывает @username канала (или числовой chat_id).
credentials = {"bot_token": "...", "chat_id": "@my_channel"}

ВАЖНО про медиа: мы НЕ отправляем Telegram ссылку на файл (Telegram не может
достучаться до localhost/приватных хостов → ошибка EXTERNAL_URL_INVALID).
Вместо этого скачиваем файл на стороне бэкенда и заливаем БАЙТЫ напрямую в
Telegram (multipart). Это работает и локально, и в проде без публичного хостинга.
"""

import json
import time
from pathlib import Path

import httpx

from ..config import get_settings

API = "https://api.telegram.org/bot{token}/{method}"
VIDEO_EXTS = (".mp4", ".mov", ".m4v")
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
RETRIES = 3  # повторы при разовых сетевых сбоях (DNS/reset)
CAPTION_MAX = 1024  # лимит подписи под медиа в Telegram
TEXT_MAX = 4096  # лимит обычного сообщения
settings = get_settings()


def _token(credentials: dict | None = None) -> str:
    """Токен бота: у аккаунта свой (старая схема) или единый бот Postwave."""
    if credentials and credentials.get("bot_token"):
        return credentials["bot_token"]
    if not settings.telegram_bot_token:
        raise TelegramError("Единый Telegram-бот не настроен (TELEGRAM_BOT_TOKEN).")
    return settings.telegram_bot_token


class TelegramError(Exception):
    pass


def _result(resp: httpx.Response) -> dict | list:
    data = resp.json()
    if not data.get("ok"):
        raise TelegramError(data.get("description", "unknown telegram error"))
    return data["result"]


def _request(method_func, *args, **kwargs) -> httpx.Response:
    """Выполняет HTTP-запрос с повторами при временных сетевых ошибках."""
    last_exc: Exception | None = None
    for attempt in range(RETRIES):
        try:
            return method_func(*args, **kwargs)
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            last_exc = exc
            if attempt < RETRIES - 1:
                time.sleep(1.5 * (attempt + 1))
    raise TelegramError(f"Сеть недоступна после {RETRIES} попыток: {last_exc}")


def _call_json(token: str, method: str, payload: dict) -> dict | list:
    url = API.format(token=token, method=method)
    return _result(_request(httpx.post, url, json=payload, timeout=30))


def _call_multipart(token: str, method: str, data: dict, files: dict) -> dict | list:
    url = API.format(token=token, method=method)
    return _result(_request(httpx.post, url, data=data, files=files, timeout=120))


def _download(url: str) -> bytes:
    """Возвращаем байты медиа.

    Если это наш собственный загруженный файл (.../media/<name>) — читаем прямо
    с диска (надёжнее и без лишнего HTTP-запроса к самому себе). Иначе качаем по
    сети.
    """
    if "/media/" in url:
        local = UPLOAD_DIR / url.split("/media/", 1)[1].split("?")[0]
        if local.is_file():
            return local.read_bytes()
    resp = _request(httpx.get, url, timeout=60, follow_redirects=True)
    resp.raise_for_status()
    return resp.content


def _is_video(url: str) -> bool:
    return url.lower().split("?")[0].endswith(VIDEO_EXTS)


def _filename(url: str) -> str:
    name = url.split("?")[0].rsplit("/", 1)[-1]
    return name or "media"


def _send_text(
    token: str,
    chat_id: str,
    text: str,
    silent: bool,
    parse_mode: str | None,
    no_preview: bool,
) -> str:
    """Отправка текста сообщением. Длиннее 4096 — режем на части."""
    if not text:
        return ""
    chunks = [text[i : i + TEXT_MAX] for i in range(0, len(text), TEXT_MAX)]
    first_id = ""
    for i, ch in enumerate(chunks):
        payload: dict = {"chat_id": chat_id, "text": ch, "disable_notification": silent}
        if no_preview:
            payload["link_preview_options"] = {"is_disabled": True}
        if parse_mode:
            payload["parse_mode"] = parse_mode
        res = _call_json(token, "sendMessage", payload)
        if i == 0:
            first_id = str(res.get("message_id", ""))
    return first_id


def publish(
    credentials: dict,
    content: str,
    media_urls: list[str],
    options: dict | None = None,
) -> str:
    """Публикует пост. Возвращает external_id (message_id).

    options: {"silent": bool, "no_preview": bool, "parse_mode": "MarkdownV2"|"HTML"|None}
    """
    token = _token(credentials)
    chat_id = credentials["chat_id"]
    options = options or {}
    silent = bool(options.get("silent"))
    parse_mode = options.get("parse_mode") or None
    # «Оригинальное качество»: слать медиа как ДОКУМЕНТ — Telegram не пересжимает
    # файл (sendPhoto/sendVideo всегда ужимают). Минус: показывается как файл.
    as_file = bool(options.get("as_file"))

    no_preview = bool(options.get("no_preview"))

    # Без медиа — обычное текстовое сообщение (длинное разобьём по 4096)
    if not media_urls:
        return _send_text(token, chat_id, content, silent, parse_mode, no_preview)

    # Подпись на медиа ограничена 1024 символами. Если текст длиннее — медиа без
    # подписи, а полный текст отдельным сообщением (иначе Telegram его отбрасывает).
    cap = content if len(content) <= CAPTION_MAX else ""

    # Одно медиа — sendPhoto / sendVideo (или sendDocument в режиме оригинала)
    if len(media_urls) == 1:
        url = media_urls[0]
        data_bytes = _download(url)
        is_video = _is_video(url)
        if as_file:
            method, field = "sendDocument", "document"
        elif is_video:
            method, field = "sendVideo", "video"
        else:
            method, field = "sendPhoto", "photo"
        data = {"chat_id": chat_id, "caption": cap, "disable_notification": silent}
        if cap and parse_mode:
            data["parse_mode"] = parse_mode
        result = _call_multipart(
            token, method, data, {field: (_filename(url), data_bytes)}
        )
        mid = str(result.get("message_id", ""))
    elif as_file:
        # Режим оригинала: Telegram НЕ умеет группировать документы в альбом
        # (sendMediaGroup с type=document → "Wrong file identifier"). Поэтому шлём
        # каждый файл отдельным sendDocument — качество сохраняется 1:1.
        mid = ""
        for i, url in enumerate(media_urls[:10]):
            data = {"chat_id": chat_id, "disable_notification": silent}
            if i == 0 and cap:
                data["caption"] = cap
                if parse_mode:
                    data["parse_mode"] = parse_mode
            res = _call_multipart(
                token, "sendDocument", data, {"document": (_filename(url), _download(url))}
            )
            if i == 0:
                mid = str(res.get("message_id", ""))
    else:
        # Несколько медиа — альбом (sendMediaGroup), подпись на первом элементе.
        media: list[dict] = []
        files: dict = {}
        for i, url in enumerate(media_urls[:10]):
            key = f"file{i}"
            files[key] = (_filename(url), _download(url))
            item: dict = {
                "type": "video" if _is_video(url) else "photo",
                "media": f"attach://{key}",
            }
            if i == 0 and cap:
                item["caption"] = cap
                if parse_mode:
                    item["parse_mode"] = parse_mode
            media.append(item)
        result = _call_multipart(
            token,
            "sendMediaGroup",
            {
                "chat_id": chat_id,
                "media": json.dumps(media),
                "disable_notification": silent,
            },
            files,
        )
        first = result[0] if isinstance(result, list) and result else {}
        mid = str(first.get("message_id", ""))

    # длинная подпись не влезла в медиа — досылаем полный текст сообщением
    if content and not cap:
        _send_text(token, chat_id, content, silent, parse_mode, no_preview)
    return mid


def verify(credentials: dict) -> str:
    """Проверяет токен и доступ. Возвращает имя бота."""
    me = _call_json(_token(credentials), "getMe", {})
    return me.get("username", "")


def bot_username() -> str:
    """Username единого бота Postwave (для подсказки 'добавьте @X админом')."""
    if settings.telegram_bot_username:
        return settings.telegram_bot_username.lstrip("@")
    if not settings.telegram_bot_token:
        return ""
    try:
        me = _call_json(settings.telegram_bot_token, "getMe", {})
        return me.get("username", "")
    except Exception:  # noqa: BLE001
        return ""


def verify_channel(chat_id: str) -> str:
    """Проверяет, что единый бот добавлен АДМИНОМ в канал chat_id и может постить.
    Возвращает название канала. Бросает TelegramError с понятным текстом."""
    token = _token()  # единый бот
    me = _call_json(token, "getMe", {})
    bot_id = me["id"]

    try:
        chat = _call_json(token, "getChat", {"chat_id": chat_id})
    except TelegramError:
        raise TelegramError(
            "Не вижу такой канал. Проверьте @username и что бот уже добавлен в канал."
        )

    member = _call_json(
        token, "getChatMember", {"chat_id": chat_id, "user_id": bot_id}
    )
    status = member.get("status")
    if status != "administrator":
        raise TelegramError(
            "Бот не админ канала. Добавьте бота администратором с правом «Публикация сообщений»."
        )
    if member.get("can_post_messages") is False:
        raise TelegramError(
            "У бота нет права «Публикация сообщений». Включите его в настройках администратора."
        )
    return chat.get("title") or chat.get("username") or str(chat_id)
