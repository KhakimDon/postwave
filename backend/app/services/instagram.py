"""Публикация в Instagram через Graph API (флоу Instagram Login).

Поддержка: feed (фото), carousel (2-10), reels (видео), stories (фото/видео).

Важно:
- Instagram сам СКАЧИВАЕТ медиа по URL -> нужен ПУБЛИЧНЫЙ адрес (PUBLIC_BASE_URL).
- Видео/Reels обрабатываются асинхронно: после создания контейнера нужно ждать
  status_code == FINISHED, и только потом публиковать.
"""

import time

import httpx

from ..config import get_settings

GRAPH = "https://graph.instagram.com/v21.0"
VIDEO_EXTS = (".mp4", ".mov", ".m4v")
settings = get_settings()


class InstagramError(Exception):
    pass


def _public(url: str) -> str:
    """Переписываем локальный media-URL на публичный (туннель/домен)."""
    base = settings.public_base_url.rstrip("/")
    if base and "/media/" in url:
        return f"{base}/media/{url.split('/media/', 1)[1]}"
    return url


def _is_video(url: str) -> bool:
    return url.lower().split("?")[0].endswith(VIDEO_EXTS)


def _post(path: str, payload: dict) -> dict:
    resp = httpx.post(f"{GRAPH}/{path}", data=payload, timeout=120)
    data = resp.json()
    if "error" in data:
        raise InstagramError(data["error"].get("message", "unknown ig error"))
    return data


def _create_container(ig_user_id: str, token: str, params: dict) -> str:
    return _post(f"{ig_user_id}/media", {**params, "access_token": token})["id"]


def _wait_ready(container_id: str, token: str, attempts: int = 40, delay: int = 3) -> None:
    """Ждём, пока медиа-контейнер обработается (нужно для видео/Reels)."""
    for _ in range(attempts):
        data = httpx.get(
            f"{GRAPH}/{container_id}",
            params={"fields": "status_code,status", "access_token": token},
            timeout=30,
        ).json()
        code = data.get("status_code")
        if code == "FINISHED":
            return
        if code == "ERROR":
            raise InstagramError(data.get("status") or "Ошибка обработки медиа")
        time.sleep(delay)
    raise InstagramError("Превышено время обработки медиа Instagram")


def _publish_container(ig_user_id: str, token: str, creation_id: str) -> str:
    published = _post(
        f"{ig_user_id}/media_publish",
        {"creation_id": creation_id, "access_token": token},
    )
    return str(published.get("id", ""))


def publish(
    credentials: dict,
    content: str,
    media_urls: list[str],
    options: dict | None = None,
) -> str:
    """Публикует пост в Instagram. Возвращает external_id (media id)."""
    ig_user_id = credentials["ig_user_id"]
    token = credentials["access_token"]
    options = options or {}
    post_type = options.get("post_type", "feed")
    urls = [_public(u) for u in media_urls]

    if not urls:
        raise InstagramError("Instagram требует хотя бы одно медиа (фото/видео).")

    common: dict = {"caption": content}
    if options.get("location_id"):
        common["location_id"] = options["location_id"]

    # --- Карусель ---
    if post_type == "carousel":
        children = []
        for url in urls[:10]:
            child = {"is_carousel_item": "true"}
            child["video_url" if _is_video(url) else "image_url"] = url
            cid = _create_container(ig_user_id, token, child)
            _wait_ready(cid, token)
            children.append(cid)
        parent = _create_container(
            ig_user_id,
            token,
            {"media_type": "CAROUSEL", "children": ",".join(children), **common},
        )
        _wait_ready(parent, token)
        return _publish_container(ig_user_id, token, parent)

    # --- Reels ---
    if post_type == "reels":
        params = {
            "media_type": "REELS",
            "video_url": urls[0],
            "share_to_feed": "true" if options.get("share_to_feed", True) else "false",
            **common,
        }
        if options.get("cover_url"):
            params["cover_url"] = _public(options["cover_url"])
        cid = _create_container(ig_user_id, token, params)
        _wait_ready(cid, token)
        return _publish_container(ig_user_id, token, cid)

    # --- Stories ---
    if post_type == "stories":
        url = urls[0]
        params = {"media_type": "STORIES"}
        params["video_url" if _is_video(url) else "image_url"] = url
        cid = _create_container(ig_user_id, token, params)
        _wait_ready(cid, token)
        return _publish_container(ig_user_id, token, cid)

    # --- Лента: фото или видео ---
    url = urls[0]
    if _is_video(url):
        cid = _create_container(
            ig_user_id, token, {"media_type": "REELS", "video_url": url, **common}
        )
    else:
        cid = _create_container(ig_user_id, token, {"image_url": url, **common})
    _wait_ready(cid, token)
    return _publish_container(ig_user_id, token, cid)


def verify(credentials: dict) -> str:
    """Проверяет токен. Возвращает username аккаунта."""
    resp = httpx.get(
        f"{GRAPH}/me",
        params={"fields": "username", "access_token": credentials["access_token"]},
        timeout=30,
    )
    data = resp.json()
    if "error" in data:
        raise InstagramError(data["error"].get("message", "unknown ig error"))
    return data.get("username", "")
