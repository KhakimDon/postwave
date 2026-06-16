"""Зависимости FastAPI.

ВРЕМЕННО (v1, dev): один демо-пользователь. Полноценный JWT-логин
добавим в фазе аутентификации — структура уже готова (User в БД).
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from .db import get_db
from .models import User

DEMO_EMAIL = "demo@smm.local"


def get_current_user(db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if not user:
        user = User(email=DEMO_EMAIL)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
