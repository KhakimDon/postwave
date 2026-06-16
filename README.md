# Postwave

Единый кабинет для соц-продаж: публикации в **Telegram** и **Instagram** по
расписанию из одного окна. Фаза 2 — единые входящие + AI-ответы клиентам.

> Принцип безопасности: **пароли не храним**. Только токены/сессии, которые
> пользователь сам выдал (Telegram Bot API, Instagram Graph API) — и те шифруются.

## Стек

- **Backend:** Python · FastAPI · SQLAlchemy · фоновый планировщик
- **Frontend:** React · TypeScript · Vite · Mantine (адаптив + мобилки)
- **Интеграции:** Telegram Bot API, Instagram Graph API (официальные, бесплатные)

## Запуск (dev)

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt

# создать .env из примера и сгенерировать ключ шифрования
copy .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# вставить значение в SECRET_ENCRYPTION_KEY в .env

uvicorn app.main:app --reload --port 8000
```

API: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 (запросы `/api` проксируются на бэкенд)

## Как подключить аккаунты

- **Telegram-канал:** создайте бота у @BotFather → добавьте админом в канал →
  вставьте `bot_token` и `@username` канала.
- **Instagram:** Business/Creator аккаунт; пока вставляем `ig_user_id` +
  `access_token` Graph API. Кнопка «Войти через Instagram» (OAuth) — следующий шаг.

## Дорожная карта

- [x] Публикации по расписанию (Telegram + Instagram)
- [ ] OAuth-вход через Meta (вместо ручного токена)
- [ ] Карусели/видео/Stories/Reels
- [ ] Контент-календарь (drag & drop)
- [ ] Telegram MTProto (личные аккаунты) — для входящих
- [ ] Единые входящие + AI-ответы клиентам
- [ ] Аналитика, команды, оплаты (Payme/Click/Stripe)
