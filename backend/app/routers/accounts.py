from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..deps import get_current_user
from ..db import get_db
from ..models import Platform, SocialAccount, User
from ..schemas import AccountCreate, AccountOut
from ..services import instagram, telegram
from ..services.crypto import encrypt_credentials

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return (
        db.query(SocialAccount).filter(SocialAccount.user_id == user.id).all()
    )


@router.post("", response_model=AccountOut, status_code=201)
def connect_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Проверяем креденшелы вызовом площадки до сохранения
    try:
        if payload.platform == Platform.telegram_bot:
            telegram.verify(payload.credentials)
        elif payload.platform == Platform.instagram:
            instagram.verify(payload.credentials)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Не удалось подключить аккаунт: {exc}")

    account = SocialAccount(
        user_id=user.id,
        platform=payload.platform,
        display_name=payload.display_name,
        credentials_enc=encrypt_credentials(payload.credentials),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = (
        db.query(SocialAccount)
        .filter(SocialAccount.id == account_id, SocialAccount.user_id == user.id)
        .first()
    )
    if not account:
        raise HTTPException(404, "Аккаунт не найден")
    db.delete(account)
    db.commit()
