"""Регистрация / вход в приложение по телефону + паролю."""

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import create_token, hash_password, verify_password
from ..db import get_db
from ..deps import get_current_user
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_EMAIL = "demo@smm.local"


class RegisterBody(BaseModel):
    phone: str
    password: str
    name: str | None = None


class LoginBody(BaseModel):
    phone: str
    password: str


class UserOut(BaseModel):
    id: int
    phone: str | None = None
    name: str | None = None


def _norm_phone(phone: str) -> str:
    p = re.sub(r"[^\d+]", "", phone or "")
    if not p:
        raise HTTPException(400, "Укажите номер телефона")
    return p


def _token_response(user: User) -> dict:
    return {
        "token": create_token(user.id),
        "user": UserOut(id=user.id, phone=user.phone, name=user.name).model_dump(),
    }


@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    phone = _norm_phone(body.phone)
    if len(body.password) < 6:
        raise HTTPException(400, "Пароль минимум 6 символов")

    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(400, "Пользователь с таким номером уже есть")

    # Первая регистрация «забирает» демо-рабочее пространство со всеми
    # подключёнными аккаунтами (чтобы не потерять уже подключённое).
    demo = (
        db.query(User)
        .filter(User.email == DEMO_EMAIL, User.phone.is_(None))
        .first()
    )
    total_users = db.query(func.count(User.id)).scalar() or 0

    if demo and total_users == 1:
        user = demo
        user.phone = phone
        user.password_hash = hash_password(body.password)
        user.name = body.name
    else:
        user = User(
            phone=phone,
            password_hash=hash_password(body.password),
            name=body.name,
        )
        db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    phone = _norm_phone(body.phone)
    user = db.query(User).filter(User.phone == phone).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный номер или пароль")
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, phone=user.phone, name=user.name)
