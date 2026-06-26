"""AI-генерация продающего описания товара (Gemini).

Три режима по приоритету:
  1) url        — Gemini сам открывает ссылку товара (url_context);
  2) image_url  — генерация по фото товара (vision, первая картинка);
  3) text       — текст из поля подписи используется как промпт.
Пользователь правит результат и публикует.
"""

import base64
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..config import get_settings
from ..deps import get_current_user
from ..models import User

router = APIRouter(prefix="/api/ai", tags=["ai"])
settings = get_settings()

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

# Бесплатный фолбэк: когда Gemini недоступен (квота 429 / ошибка / нет ключа) —
# генерируем через Pollinations (бесплатный, OpenAI-совместимый эндпоинт).
POLLINATIONS_URL = "https://text.pollinations.ai/openai"
POLLINATIONS_MODEL = "openai"

LANG_NAMES = {
    "uz": "узбекском (oʻzbek tilida)",
    "ru": "русском",
    "en": "английском (English)",
}

EXAMPLE = """🔥 ADIDAS ORIGINAL KROSSOVKALARI 🔥

👟 Adidas GV7946 — zamonaviy dizayn, qulaylik va sifat bir joyda!

✅ Yengil va qulay
✅ Kundalik kiyish uchun ideal
✅ Mashhur Adidas sifati
✅ Erkaklar va oʻsmirlar uchun mos
✅ Sport va casual uslubga juda mos keladi

💥 Narxi: 599 000 soʻm 💥

📦 Yetkazib berish mavjud
📩 Buyurtma uchun Direct yoki Telegram orqali yozing!

#adidas #krossovka #sportstyle #adidasoriginal #uzum #sale #fashion #sneakers"""

SEP = "----------------"

# Жёсткая системная инструкция + маркеры — чтобы модель НЕ писала свои рассуждения
# ("I have browsed", "Product Name:", "Title:" и т.п.), а отдала только готовый пост.
SYSTEM = (
    "Ты генератор готовых постов для соцсетей. ВЫВОДИ ТОЛЬКО финальный текст "
    "поста, обёрнутый в маркеры: первая строка ровно <<<POST>>>, затем сам "
    "пост(ы), последняя строка ровно <<<END>>>. НИКАКИХ рассуждений, планов, "
    "переводов, фраз 'I have browsed', 'Product Name:', 'Features:', 'Title:', "
    "'Now I need' — вообще ничего вне маркеров и внутри них кроме самого поста."
)


def _style(languages: list[str]) -> str:
    names = [LANG_NAMES.get(x, x) for x in languages if x in LANG_NAMES]
    if len(names) > 1:
        lang_line = (
            "Сделай ОТДЕЛЬНЫЙ пост на КАЖДОМ из языков: "
            + ", ".join(names)
            + f". Между версиями ставь ровно такую строку-разделитель: {SEP}"
        )
    elif names:
        lang_line = f"Пиши на {names[0]}."
    else:
        lang_line = "Пиши на языке товара/страницы."

    return f"""{lang_line}

ФОРМАТ И ДЛИНА — строго как в этом примере (НЕ длиннее, не короче по структуре):
---пример---
{EXAMPLE}
---конец примера---

Правила:
- Заголовок ЗАГЛАВНЫМИ с эмодзи (🔥 и т.п.).
- Одна короткая строка-подводка с эмодзи (👟/✨) — суть товара.
- 4–6 ОЧЕНЬ КОРОТКИХ преимуществ (по 2–5 слов!), каждое со знаком ✅.
- Цена отдельной строкой, обёрнутая 💥 (если знаешь цену).
- Строка про доставку 📦 и строка с призывом заказать в Direct/Telegram 📩.
- 6–9 хэштегов в конце.
- Будь креативным, но КОРОТКО и ёмко — без длинных предложений и абзацев-простыней.
- Эмодзи в начале строк. БЕЗ markdown (никаких ** или *).

КРИТИЧЕСКИ ВАЖНО: НЕ описывай свой процесс, НЕ пиши "I have browsed", "The product is",
"На фото", "I will write". Оберни ВЕСЬ ответ в маркеры — первая строка <<<POST>>>,
последняя строка <<<END>>>, между ними только готовый пост(ы). Ничего вне маркеров."""


class DescribeBody(BaseModel):
    url: str = ""
    image_url: str = ""  # совместимость (одна картинка)
    image_urls: list[str] = []  # все картинки товара
    text: str = ""
    languages: list[str] = []


def _clean(text: str) -> str:
    """Вырезаем содержимое между маркерами и чистим markdown-мусор."""
    text = (text or "").strip()
    m = re.search(r"<<<\s*POST\s*>>>(.*?)<<<\s*END\s*>>>", text, re.S | re.I)
    if m:
        text = m.group(1)
    else:
        # фолбэк: режем всё до маркера POST
        text = re.split(r"<<<\s*POST\s*>>>", text, flags=re.I)[-1]
    text = re.sub(r"<<<\s*(POST|END)\s*>>>", "", text, flags=re.I)
    text = re.sub(r"\*+", "", text)
    return text.strip()


def _call_gemini(parts: list[dict]) -> str:
    payload = {
        "contents": [{"parts": parts}],
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "generationConfig": {"temperature": 0.9},
    }
    # url_context включаем только если в parts есть текстовая ссылка-инструкция
    if any("text" in p and "http" in p.get("text", "") for p in parts):
        payload["tools"] = [{"url_context": {}}]
    r = httpx.post(
        GEMINI_URL, headers={"x-goog-api-key": settings.gemini_api_key}, json=payload, timeout=90
    )
    if r.status_code >= 400:
        raise RuntimeError(f"gemini {r.status_code}: {r.text[:200]}")
    gen = r.json()["candidates"][0]["content"]["parts"]
    text = "".join(p.get("text", "") for p in gen).strip()
    if not text:
        raise RuntimeError("gemini empty")
    return _clean(text)


def _call_pollinations(user_content) -> str:
    """Бесплатная генерация через Pollinations (OpenAI-совместимый чат).
    user_content — строка либо список частей OpenAI-формата (text / image_url).
    Анонимный бесплатный сервис иногда отдаёт 500 — делаем несколько попыток."""
    payload = {
        "model": POLLINATIONS_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.9,
    }
    last = ""
    for _ in range(3):
        try:
            r = httpx.post(POLLINATIONS_URL, json=payload, timeout=120)
            if r.status_code < 400:
                text = (r.json()["choices"][0]["message"]["content"] or "").strip()
                if text:
                    return _clean(text)
                last = "empty"
            else:
                last = f"{r.status_code}: {r.text[:120]}"
        except Exception as e:  # noqa: BLE001
            last = str(e)[:120]
    raise RuntimeError(f"pollinations {last}")


def _generate(gemini_parts: list[dict], poll_content) -> str:
    """Сначала Gemini (если есть ключ), при любой ошибке/квоте — бесплатный Pollinations."""
    if settings.gemini_api_key:
        try:
            return _call_gemini(gemini_parts)
        except Exception:  # noqa: BLE001 — падаем на бесплатный фолбэк
            pass
    try:
        return _call_pollinations(poll_content)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"AI недоступен: {e}")


@router.post("/describe")
async def describe(body: DescribeBody, user: User = Depends(get_current_user)):
    url = body.url.strip()
    image_urls = [u.strip() for u in (body.image_urls or []) if u.strip()]
    if body.image_url.strip() and not image_urls:
        image_urls = [body.image_url.strip()]
    text = body.text.strip()
    style = _style(body.languages)
    hint = f"\nДополнительные пожелания/контекст: {text}" if text else ""

    # 1) по ссылке (Gemini открывает url через url_context; Pollinations — по тексту ссылки)
    if url:
        prompt = (
            f"Открой ссылку на товар и пойми, что это (название, особенности, цена): {url}{hint}\n\n"
            + style
        )
        return {"caption": _generate([{"text": prompt}], prompt)}

    # 2) по фото (vision) — отправляем ВСЕ картинки (до 10)
    if image_urls:
        gemini_parts: list[dict] = []
        poll_content: list[dict] = []
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as cl:
            for u in image_urls[:10]:
                try:
                    ir = await cl.get(u)
                    if ir.status_code >= 400:
                        continue
                    mime = ir.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                    if not mime.startswith("image/"):
                        mime = "image/jpeg"
                    b64 = base64.b64encode(ir.content).decode()
                    gemini_parts.append({"inlineData": {"mimeType": mime, "data": b64}})
                    poll_content.append(
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
                    )
                except Exception:  # noqa: BLE001
                    continue
        if not gemini_parts:
            raise HTTPException(400, "Не удалось загрузить картинки.")
        prompt = (
            "На фото — один и тот же товар (несколько ракурсов/фото). Изучи ВСЕ "
            "снимки, определи бренд/тип/особенности/цвет/детали и сделай продающий "
            f"пост.{hint}\n\n" + style
        )
        gemini_parts.append({"text": prompt})
        poll_content.insert(0, {"type": "text", "text": prompt})
        return {"caption": _generate(gemini_parts, poll_content)}

    # 3) по тексту-промпту
    if text:
        prompt = (
            f"Вот название/описание товара или пожелания пользователя: {text}\n\n"
            "Сделай продающий пост по этим данным.\n\n" + style
        )
        return {"caption": _generate([{"text": prompt}], prompt)}

    raise HTTPException(400, "Нет данных: дайте ссылку, картинку или текст.")
