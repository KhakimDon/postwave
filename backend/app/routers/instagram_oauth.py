"""Вход в Instagram через новый «Instagram API with Instagram Login» (бесплатно).

Без Facebook-страницы. Пароль пользователя не виден и не хранится — только токен.

Поток:
  1. Фронт -> GET /start -> отдаём URL https://www.instagram.com/oauth/authorize
  2. Пользователь логинится в Instagram и разрешает доступ.
  3. Instagram редиректит на /callback?code=...
  4. code -> короткий токен (api.instagram.com) -> long-lived (graph.instagram.com)
     -> узнаём username -> сохраняем SocialAccount.
"""

from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import get_current_user
from ..models import Platform, SocialAccount, User
from ..services.crypto import encrypt_credentials

router = APIRouter(prefix="/api/instagram/oauth", tags=["instagram-oauth"])

AUTH_URL = "https://www.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"
GRAPH = "https://graph.instagram.com"
SCOPES = ["instagram_business_basic", "instagram_business_content_publish"]

settings = get_settings()


def _app_id() -> str:
    return settings.instagram_app_id or settings.meta_app_id


def _app_secret() -> str:
    return settings.instagram_app_secret or settings.meta_app_secret


def _require_config() -> None:
    if not _app_id() or not _app_secret():
        raise HTTPException(
            400,
            "Instagram OAuth не настроен: задайте INSTAGRAM_APP_ID и "
            "INSTAGRAM_APP_SECRET в .env (Instagram → API setup with Instagram login).",
        )


@router.get("/start")
def oauth_start(user: User = Depends(get_current_user)):
    _require_config()
    params = {
        "client_id": _app_id(),
        "redirect_uri": settings.meta_redirect_uri,
        "scope": ",".join(SCOPES),
        "response_type": "code",
        "state": str(user.id),
    }
    return {"url": f"{AUTH_URL}?{urlencode(params)}"}


def _complete_oauth(code: str, db: Session, user: User) -> str:
    """Меняем code на токен, узнаём аккаунт, сохраняем. Возвращает username."""
    _require_config()
    # 1) code -> короткоживущий токен (+ user_id)
    token_resp = httpx.post(
        TOKEN_URL,
        data={
            "client_id": _app_id(),
            "client_secret": _app_secret(),
            "grant_type": "authorization_code",
            "redirect_uri": settings.meta_redirect_uri,
            "code": code,
        },
        timeout=30,
    ).json()

    # формат бывает плоский или {"data": [{...}]}
    if "data" in token_resp and token_resp["data"]:
        token_resp = token_resp["data"][0]
    short_token = token_resp.get("access_token")
    ig_user_id = str(token_resp.get("user_id", ""))
    if not short_token:
        raise RuntimeError(token_resp.get("error_message", "no access_token"))

    # 2) обмен на долгоживущий токен (60 дней)
    longl = httpx.get(
        f"{GRAPH}/access_token",
        params={
            "grant_type": "ig_exchange_token",
            "client_secret": _app_secret(),
            "access_token": short_token,
        },
        timeout=30,
    ).json()
    access_token = longl.get("access_token", short_token)

    # 3) узнаём username (и user_id, если не пришёл)
    me = httpx.get(
        f"{GRAPH}/me",
        params={"fields": "user_id,username", "access_token": access_token},
        timeout=30,
    ).json()
    ig_user_id = str(me.get("user_id") or ig_user_id)
    username = me.get("username", "Instagram")
    if not ig_user_id:
        raise RuntimeError("no ig_user_id")

    # 4) сохраняем (токен шифруется)
    creds = {"ig_user_id": ig_user_id, "access_token": access_token}
    existing = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.user_id == user.id,
            SocialAccount.platform == Platform.instagram,
            SocialAccount.display_name == username,
        )
        .first()
    )
    if existing:
        existing.credentials_enc = encrypt_credentials(creds)
        existing.is_active = True
    else:
        db.add(
            SocialAccount(
                user_id=user.id,
                platform=Platform.instagram,
                display_name=username,
                credentials_enc=encrypt_credentials(creds),
            )
        )
    db.commit()
    return username


@router.get("/exchange")
def oauth_exchange(
    code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Фронт получает ?code= на /accounts и присылает его сюда."""
    try:
        username = _complete_oauth(code, db, user)
        return {"status": "connected", "username": username}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Не удалось подключить Instagram: {exc}")


@router.get("/callback")
def oauth_callback(
    code: str | None = None,
    error: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    """Серверный колбэк от Instagram (без заголовка авторизации) — пользователя
    определяем по state (туда положили user.id в /start)."""
    front = settings.frontend_url.rstrip("/")
    if error or not code:
        return RedirectResponse(f"{front}/accounts?ig=error")
    user = db.get(User, int(state)) if state and state.isdigit() else None
    if not user:
        return RedirectResponse(f"{front}/accounts?ig=error")
    try:
        _complete_oauth(code, db, user)
        return RedirectResponse(f"{front}/accounts?ig=connected")
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(f"{front}/accounts?ig=error&msg={exc}")
