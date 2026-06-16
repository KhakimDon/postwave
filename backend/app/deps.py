"""Зависимости FastAPI: текущий пользователь по JWT (Authorization: Bearer)."""

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .auth import decode_token
from .db import get_db
from .models import User


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Требуется вход")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(401, "Сессия истекла, войдите снова")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(401, "Пользователь не найден")
    return user
