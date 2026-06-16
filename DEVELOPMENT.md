# Postwave — документация для продолжения проекта

Гайд для того, кто (или что — например, новая сессия AI) продолжает разработку.
Здесь: текущее состояние, архитектура, как поднять с нуля, подводные камни и
дорожная карта.

---

## 1. Что это и текущий статус

**Postwave** — кабинет для соц-продаж: публикация постов в **Telegram** и
**Instagram** по расписанию из одного окна. В перспективе — единые входящие +
AI-ответы клиентам.

| Площадка | Статус |
|---|---|
| **Telegram (каналы)** | ✅ Работает полностью: текст, фото, альбом, расписание. Файлы заливаются байтами напрямую (публичный URL не нужен). |
| **Instagram (Business/Creator)** | ✅ OAuth-вход + публикация (лента/карусель/Reels/Stories). Требует публичный URL медиа (туннель в деве). Пока в Dev-режиме приложения Meta → только тестовые аккаунты; для публики нужен App Review. |

Готово: подключение аккаунтов, композер с живым превью (включая видео), контент-
календарь с drag&drop, фоновый планировщик, шифрование токенов.

---

## 2. Архитектура

```
frontend (React+TS+Vite+Mantine, :5173)
   │  proxy /api → :8000
backend (FastAPI, :8000)
   ├─ app/routers/      accounts, posts, uploads, instagram_oauth
   ├─ app/services/     telegram.py, instagram.py, publisher.py, crypto.py
   ├─ app/scheduler.py  фоновый поток: публикует посты по времени
   ├─ app/models.py     User, SocialAccount, Post, PostTarget (SQLAlchemy)
   └─ app/db.py         SQLite (dev) + лёгкие миграции
```

- **Модель данных:** один `Post` → несколько `PostTarget` (по аккаунту/площадке).
  `Post.platform_options` (JSON) хранит настройки под площадку
  (`telegram`: silent/parse_mode; `instagram`: post_type/location/tags/…).
- **Публикация:** `publisher.publish_target()` выбирает сервис по платформе и
  вызывает `telegram.publish()` / `instagram.publish()`.
- **Планировщик:** опрашивает БД каждые N секунд, публикует то, у чего
  `scheduled_at <= now` и статус `scheduled`.
- **Безопасность:** пароли не храним. Токены аккаунтов шифруются (Fernet,
  `SECRET_ENCRYPTION_KEY`). Время отдаётся в UTC (`+00:00`) — SQLite хранит naive.

**Фронт (страницы):** `/` обзор, `/publications` список+автообновление,
`/compose` композер (превью справа на 100vh, видео автоиграет), `/calendar`
месяц с drag&drop переносом, `/accounts` подключение.

---

## 3. Запуск с нуля

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt   # Python 3.14 ок (версии не пиннить жёстко)

copy .env.example .env
# сгенерировать ключ шифрования и вставить в SECRET_ENCRYPTION_KEY:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# ВАЖНО: запускать ИЗ папки backend (иначе создаст пустую smm.db не там).
# На Windows НЕ использовать --reload (зависает, держит старый код).
python -m uvicorn app.main:app --port 8000 --host 127.0.0.1
```
API-доки: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, проксирует /api на :8000
```

---

## 4. Подключение площадок

### Telegram (готово, просто)
1. @BotFather → `/newbot` → получить токен.
2. Добавить бота админом в канал (право «Публикация сообщений»).
3. В Postwave: Аккаунты → Telegram → токен + `@username` канала.

### Instagram (через OAuth «Instagram API with Instagram Login»)
Одноразовая настройка приложения Meta (бесплатно):
1. developers.facebook.com → создать приложение (Business).
2. Add Product → **Instagram** → **API setup with Instagram login**.
3. Скопировать **Instagram App ID** и **Instagram App Secret** → в `.env`
   (`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`). ⚠️ Это НЕ Facebook App ID.
4. **Business login settings** → OAuth redirect URIs → добавить
   `<PUBLIC_BASE_URL>/api/instagram/oauth/callback` (HTTPS!).
5. Roles → добавить свой Instagram как **тестировщика** → принять приглашение в
   Instagram (Settings → Apps and websites → Tester invites → Accept).
6. Аккаунт должен быть **Business/Creator**.

Пользователю потом — только кнопка «Войти через Instagram». Для публики нужен
**App Review** прав `instagram_business_content_publish`.

---

## 5. Подводные камни (важно!)

- **IG требует публичный URL медиа.** localhost он не видит. В деве поднимаем
  HTTPS-туннель к бэкенду (:8000) и кладём его адрес в `PUBLIC_BASE_URL`
  (и в `META_REDIRECT_URI`). `instagram.py._public()` переписывает локальные
  `/media/...` на этот адрес.
  ```bash
  cloudflared.exe tunnel --url http://localhost:8000   # даёт https://*.trycloudflare.com
  ```
  ⚠️ **Бесплатный quick-туннель меняет URL при каждом перезапуске** → ломается и
  redirect, и медиа. Для стабильности — **ngrok static domain** (1 бесплатный
  постоянный домен) или сразу деплой на HTTPS-домен.
- **Видео в IG обрабатывается асинхронно** — после создания контейнера ждём
  `status_code == FINISHED`, потом publish (см. `instagram._wait_ready`).
  Поэтому публикация Reels занимает ~10–60 сек.
- **Backend запускать из папки `backend`** и **без `--reload`** (Windows).
- **Python 3.14:** пакеты не пиннить жёстко (нет старых wheel'ов).
- **Время:** PostOut отдаёт UTC явно (field_serializer), иначе фронт примет за local.

---

## 6. Что дальше (дорожная карта)

1. **Стабильный HTTPS** для IG (ngrok static / деплой) — убрать боль с туннелем.
2. **Деплой**: бесплатные тарифы (Render/Oracle Cloud Always Free + Cloudflare R2
   для медиа + Neon/Supabase Postgres). На проде IG-redirect = постоянный домен.
3. **App Review** Instagram → публикация для любых клиентов (не только тестеров).
4. **Облачное хранилище медиа** (S3/R2) вместо локальной папки `uploads/`.
5. **Единые входящие + AI-ответы** (IG `instagram_business_manage_messages`,
   Telegram MTProto) — главная задумка продукта.
6. **Мультипользовательность**: сейчас один демо-юзер (`app/deps.py`),
   нужен полноценный вход (JWT-структура уже заложена).
7. PostgreSQL + Alembic вместо SQLite + самодельных миграций.
8. Монетизация: подписки, локальные оплаты (Payme/Click).

---

## 7. Безопасность секретов

`.env` в `.gitignore` — в репозиторий не попадает. Если секрет
(`INSTAGRAM_APP_SECRET`, ключи) где-то засветился — **ротировать** в дашборде/
перегенерировать и обновить `.env`.
