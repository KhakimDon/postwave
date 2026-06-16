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

API = "https://api.telegram.org/bot{token}/{method}"
VIDEO_EXTS = (".mp4", ".mov", ".m4v")
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
RETRIES = 3  # повторы при разовых сетевых сбоях (DNS/reset)


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


def publish(
    credentials: dict,
    content: str,
    media_urls: list[str],
    options: dict | None = None,
) -> str:
    """Публикует пост. Возвращает external_id (message_id).

    options: {"silent": bool, "no_preview": bool, "parse_mode": "MarkdownV2"|"HTML"|None}
    """
    token = credentials["bot_token"]
    chat_id = credentials["chat_id"]
    options = options or {}
    silent = bool(options.get("silent"))
    parse_mode = options.get("parse_mode") or None

    # Без медиа — обычное текстовое сообщение
    if not media_urls:
        payload = {
            "chat_id": chat_id,
            "text": content,
            "disable_notification": silent,
        }
        if options.get("no_preview"):
            payload["link_preview_options"] = {"is_disabled": True}
        if parse_mode:
            payload["parse_mode"] = parse_mode
        result = _call_json(token, "sendMessage", payload)
        return str(result.get("message_id", ""))

    # Одно медиа — sendPhoto / sendVideo с загрузкой байтов
    if len(media_urls) == 1:
        url = media_urls[0]
        data_bytes = _download(url)
        is_video = _is_video(url)
        method = "sendVideo" if is_video else "sendPhoto"
        field = "video" if is_video else "photo"
        data = {"chat_id": chat_id, "caption": content, "disable_notification": silent}
        if parse_mode:
            data["parse_mode"] = parse_mode
        result = _call_multipart(
            token, method, data, {field: (_filename(url), data_bytes)}
        )
        return str(result.get("message_id", ""))

    # Несколько медиа — альбом (sendMediaGroup), подпись на первом элементе
    media: list[dict] = []
    files: dict = {}
    for i, url in enumerate(media_urls[:10]):
        key = f"file{i}"
        files[key] = (_filename(url), _download(url))
        item: dict = {
            "type": "video" if _is_video(url) else "photo",
            "media": f"attach://{key}",
        }
        if i == 0 and content:
            item["caption"] = content
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
    return str(first.get("message_id", ""))


def verify(credentials: dict) -> str:
    """Проверяет токен и доступ. Возвращает имя бота."""
    me = _call_json(credentials["bot_token"], "getMe", {})
    return me.get("username", "")
