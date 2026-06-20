import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .routers import (
    accounts,
    ai,
    auth,
    instagram_inbox,
    instagram_oauth,
    kanban,
    posts,
    scrape,
    telegram_userauth,
    uploads,
)
from .routers.uploads import UPLOAD_DIR
from .scheduler import start_scheduler, stop_scheduler
from .services import telegram_user

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    stop_scheduler()
    await telegram_user.disconnect_all()


app = FastAPI(title="SMM Platform API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    # Прод-фронт на Vercel (любой *.vercel.app поддомен превью/прод).
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(posts.router)
app.include_router(uploads.router)
app.include_router(instagram_oauth.router)
app.include_router(instagram_inbox.router)
app.include_router(telegram_userauth.router)
app.include_router(kanban.router)
app.include_router(scrape.router)
app.include_router(ai.router)

# Раздача загруженных медиафайлов
app.mount("/media", StaticFiles(directory=str(UPLOAD_DIR)), name="media")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def landing():
    return """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Postwave</title>
<style>body{font-family:system-ui,Arial,sans-serif;display:flex;min-height:100vh;
margin:0;align-items:center;justify-content:center;
background:linear-gradient(135deg,#5b3df5,#c13584);color:#fff;text-align:center}
.b{max-width:560px;padding:24px}h1{font-size:44px;margin:0 0 8px}
a{color:#fff}</style></head><body><div class="b">
<h1>Postwave</h1>
<p>Единый кабинет для публикаций и сообщений в Telegram и Instagram.</p>
<p><a href="/privacy">Политика конфиденциальности</a> ·
<a href="/terms">Пользовательское соглашение</a></p>
</div></body></html>"""


# Политика конфиденциальности — требуется Meta для публикации приложения.
_PRIVACY_HTML = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Postwave — Политика конфиденциальности</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a2e}h1{font-size:28px}h2{margin-top:28px;font-size:20px}small{color:#666}</style>
</head><body>
<h1>Политика конфиденциальности Postwave</h1>
<small>Обновлено: 2026</small>
<p>Postwave — это панель для управления публикациями и сообщениями в социальных
сетях (Telegram, Instagram). Настоящая политика описывает, какие данные мы
обрабатываем и как их защищаем.</p>
<h2>Какие данные мы обрабатываем</h2>
<ul>
<li>Токены доступа к подключённым аккаунтам соцсетей — они хранятся в
зашифрованном виде и используются только для публикации контента и обработки
сообщений по запросу пользователя.</li>
<li>Сообщения и диалоги Instagram/Telegram — для отображения в едином инбоксе и
ответов пользователю.</li>
<li>Пароли учётных записей соцсетей мы не запрашиваем и не храним.</li>
</ul>
<h2>Как используются данные</h2>
<p>Данные используются исключительно для предоставления функций приложения:
публикация постов, чтение и отправка сообщений, аналитика по запросу
пользователя. Мы не продаём и не передаём данные третьим лицам.</p>
<h2>Хранение и удаление</h2>
<p>Пользователь может в любой момент отключить аккаунт — связанные токены и
данные удаляются. Для запроса на удаление данных свяжитесь с нами по адресу
поддержки.</p>
<h2>Контакты</h2>
<p>По вопросам конфиденциальности: support@postwave.app</p>
</body></html>"""


@app.get("/privacy", response_class=HTMLResponse)
def privacy():
    return _PRIVACY_HTML


# Пользовательское соглашение — Meta тоже требует для публикации.
_TERMS_HTML = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Postwave — Пользовательское соглашение</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a2e}h1{font-size:28px}h2{margin-top:28px;font-size:20px}small{color:#666}</style>
</head><body>
<h1>Пользовательское соглашение Postwave</h1>
<small>Обновлено: 2026</small>
<p>Используя Postwave, вы соглашаетесь с настоящими условиями.</p>
<h2>Назначение сервиса</h2>
<p>Postwave предоставляет инструменты для управления публикациями и сообщениями
в социальных сетях (Telegram, Instagram) из единого интерфейса.</p>
<h2>Аккаунты и доступ</h2>
<p>Вы подключаете свои аккаунты соцсетей по официальным API. Вы отвечаете за
соблюдение правил соответствующих платформ. Токены доступа хранятся в
зашифрованном виде и используются только для функций приложения.</p>
<h2>Допустимое использование</h2>
<p>Запрещено использовать сервис для спама, рассылки нежелательных сообщений и
любых действий, нарушающих правила Instagram, Telegram или применимое
законодательство.</p>
<h2>Ответственность</h2>
<p>Сервис предоставляется «как есть». Мы не несём ответственности за действия
третьих платформ и за контент, публикуемый пользователями.</p>
<h2>Контакты</h2>
<p>По вопросам: support@postwave.app</p>
</body></html>"""


@app.get("/terms", response_class=HTMLResponse)
def terms():
    return _TERMS_HTML
