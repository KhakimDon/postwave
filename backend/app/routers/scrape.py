"""Стянуть карточку товара по ссылке (Uzum / Wildberries / Ozon и др.).

Тянем метаданные страницы: OpenGraph, Twitter-card и JSON-LD (schema.org/Product)
— заголовок, описание, картинки. Картинки скачиваем в uploads/ и отдаём
локальными /media-URL, чтобы они сразу встали в композер как обычные файлы.
Пользователь правит текст/медиа и публикует в свои каналы.
"""

import html as _html
import json
import re
import uuid
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..deps import get_current_user
from ..models import User
from .uploads import UPLOAD_DIR

router = APIRouter(prefix="/api/scrape", tags=["scrape"])

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
IMG_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMG = 10
MAX_IMG_BYTES = 30 * 1024 * 1024  # не режем качество


class ScrapeBody(BaseModel):
    url: str


def _u(s: str) -> str:
    return _html.unescape(s).strip()


def _meta(html: str, keys: list[str]) -> str | None:
    for key in keys:
        k = re.escape(key)
        for pat in (
            rf'<meta[^>]+(?:property|name)=["\']{k}["\'][^>]+content=["\']([^"\']*)["\']',
            rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']{k}["\']',
        ):
            m = re.search(pat, html, re.I)
            if m and m.group(1).strip():
                return _u(m.group(1))
    return None


def _all_meta(html: str, key: str) -> list[str]:
    k = re.escape(key)
    out: list[str] = []
    for pat in (
        rf'<meta[^>]+(?:property|name)=["\']{k}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{k}["\']',
    ):
        out += [_u(x) for x in re.findall(pat, html, re.I)]
    return out


_CUR = r"(?:so['ʼ`]?\s*['ʼ`]?m|so['ʼ`]?|сум|so['ʼ`]?m|uzs|руб\.?|rub|₽|\$|€|usd)"


def _strip_price(s: str) -> str:
    """Убираем хвостовую цену. Буквы прерывают «число», поэтому модель в середине
    (iPhone 17) не трогаем — режется только цена в самом конце."""
    if not s:
        return s
    # (a) число (возможно с пробелами/разделителями) + валюта в конце
    s = re.sub(
        rf"[\s,–—•|-]*\d[\d\s.,]*\s*{_CUR}\.?\s*$", "", s, flags=re.I
    ).strip()
    # (b) голое длинное число (4+ цифр) в конце — без валюты
    s = re.sub(r"[\s,–—•|-]*\d{4,}[\d\s.,]*$", "", s).strip()
    return s


def _title_tag(html: str) -> str | None:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    return _u(m.group(1)) if m else None


def _h1(html: str) -> str | None:
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not m:
        return None
    txt = re.sub(r"<[^>]+>", " ", m.group(1))
    txt = _u(re.sub(r"\s+", " ", txt))
    return txt or None


def _microdata(html: str) -> tuple[str | None, str | None, list[str]]:
    """schema.org microdata: itemprop name/description/image."""

    def prop(name: str) -> str | None:
        for pat in (
            rf'<meta[^>]+itemprop=["\']{name}["\'][^>]+content=["\']([^"\']+)["\']',
            rf'<[^>]+itemprop=["\']{name}["\'][^>]+content=["\']([^"\']+)["\']',
        ):
            m = re.search(pat, html, re.I)
            if m:
                return _u(m.group(1))
        return None

    imgs: list[str] = []
    for pat in (
        r'<[^>]+itemprop=["\']image["\'][^>]+(?:content|src|href)=["\']([^"\']+)["\']',
        r'<[^>]+(?:content|src|href)=["\']([^"\']+)["\'][^>]+itemprop=["\']image["\']',
    ):
        imgs += re.findall(pat, html, re.I)

    # name из текстового itemprop (не только meta)
    name = prop("name")
    if not name:
        m = re.search(
            r'<[^>]+itemprop=["\']name["\'][^>]*>(.*?)</', html, re.I | re.S
        )
        if m:
            t = _u(re.sub(r"<[^>]+>", " ", m.group(1)))
            name = t or None
    return name, prop("description"), [_u(x) for x in imgs]


def _link_image(html: str) -> list[str]:
    out: list[str] = []
    for pat in (
        r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)["\']',
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']image_src["\']',
    ):
        out += [_u(x) for x in re.findall(pat, html, re.I)]
    return out


def _jsonld(html: str) -> tuple[str | None, str | None, list[str]]:
    title = desc = None
    images: list[str] = []
    blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    )
    for block in blocks:
        try:
            data = json.loads(block.strip())
        except Exception:  # noqa: BLE001
            continue
        roots = data if isinstance(data, list) else [data]
        for root in roots:
            if not isinstance(root, dict):
                continue
            graph = root.get("@graph")
            nodes = graph if isinstance(graph, list) else [root]
            for nd in nodes:
                if not isinstance(nd, dict):
                    continue
                t = nd.get("@type")
                is_product = t == "Product" or (isinstance(t, list) and "Product" in t)
                if not (is_product or nd.get("name")):
                    continue
                title = title or nd.get("name")
                d = nd.get("description")
                if d and not desc:
                    desc = d
                img = nd.get("image")
                if isinstance(img, str):
                    images.append(img)
                elif isinstance(img, list):
                    for it in img:
                        if isinstance(it, str):
                            images.append(it)
                        elif isinstance(it, dict) and it.get("url"):
                            images.append(it["url"])
                elif isinstance(img, dict) and img.get("url"):
                    images.append(img["url"])
    return title, desc, images


@router.post("")
async def scrape(
    body: ScrapeBody,
    request: Request,
    user: User = Depends(get_current_user),
):
    url = body.url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url

    browser_headers = {
        "User-Agent": UA,
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
    }
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=20, headers=browser_headers
        ) as cl:
            resp = await cl.get(url)
            page = resp.text
            final_url = str(resp.url)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Не удалось открыть ссылку: {e}")

    title = _meta(page, ["og:title", "twitter:title"])
    desc = _meta(page, ["og:description", "twitter:description", "description"])

    jt, jd, jimg = _jsonld(page)
    mt, md, mimg = _microdata(page)
    title = title or jt or mt or _h1(page) or _title_tag(page)
    desc = desc or jd or md
    # JSON-LD / microdata-картинки идут первыми — они чаще в полном разрешении,
    # og:image у многих сайтов это уменьшенный соц-кроп.
    images = (
        jimg
        + mimg
        + _all_meta(page, "og:image:secure_url")
        + _all_meta(page, "og:image")
        + _all_meta(page, "og:image:url")
        + _all_meta(page, "twitter:image")
        + _all_meta(page, "twitter:image:src")
        + _link_image(page)
    )

    # абсолютные и уникальные
    seen: set[str] = set()
    abs_imgs: list[str] = []
    for im in images:
        if not im:
            continue
        full = urljoin(final_url, im)
        if full.startswith("http") and full not in seen:
            seen.add(full)
            abs_imgs.append(full)
    abs_imgs = abs_imgs[:MAX_IMG]

    # скачиваем картинки в uploads/
    base = str(request.base_url).rstrip("/")
    local: list[str] = []
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=25,
        headers={"User-Agent": UA, "Referer": final_url},
    ) as cl:
        for im in abs_imgs:
            try:
                ir = await cl.get(im)
                if ir.status_code >= 400:
                    continue
                ct = ir.headers.get("content-type", "").split(";")[0].strip().lower()
                ext = IMG_EXT.get(ct)
                if not ext:
                    continue
                data = ir.content
                if not data or len(data) > MAX_IMG_BYTES:
                    continue
                name = f"{uuid.uuid4().hex}{ext}"
                (UPLOAD_DIR / name).write_bytes(data)
                local.append(f"{base}/media/{name}")
            except Exception:  # noqa: BLE001
                continue

    if not title and not desc and not local:
        raise HTTPException(400, "Не удалось извлечь карточку по этой ссылке")

    # чистим цену из хвоста и убираем дубль (когда title == description)
    title = _strip_price(title or "")
    desc = _strip_price(desc or "")
    if desc and title:
        a, b = desc.strip().lower(), title.strip().lower()
        if a == b or a in b or b in a:
            desc = ""

    return {"title": title, "description": desc, "images": local}
