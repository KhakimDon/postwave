"""CRM-канбан инбокса: колонки и раскладка чатов, общие для всех устройств.

Доска привязана к (пользователь, telegram_user-аккаунт). Раскладка — карта
dialog_id(str) -> column_id; чат без записи показывается в первой колонке.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import KanbanBoard, Platform, SocialAccount, User
from ..schemas import ColumnsUpdate, KanbanBroadcast, KanbanOut, PlacementUpdate
from ..services import telegram_user as tu
from ..services.crypto import decrypt_credentials

router = APIRouter(prefix="/api/kanban", tags=["kanban"])


def _require_account(db: Session, user: User, account_id: int) -> SocialAccount:
    acc = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.id == account_id,
            SocialAccount.user_id == user.id,
            SocialAccount.platform == Platform.telegram_user,
        )
        .first()
    )
    if not acc:
        raise HTTPException(404, "Аккаунт не найден")
    return acc


def _get_or_create(db: Session, user: User, account_id: int) -> KanbanBoard:
    board = (
        db.query(KanbanBoard)
        .filter(
            KanbanBoard.user_id == user.id,
            KanbanBoard.account_id == account_id,
        )
        .first()
    )
    if board is None:
        board = KanbanBoard(
            user_id=user.id, account_id=account_id, columns=[], placements={}
        )
        db.add(board)
        db.commit()
        db.refresh(board)
    return board


@router.get("/{account_id}", response_model=KanbanOut)
def get_board(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_account(db, user, account_id)
    board = (
        db.query(KanbanBoard)
        .filter(
            KanbanBoard.user_id == user.id,
            KanbanBoard.account_id == account_id,
        )
        .first()
    )
    if board is None:
        return KanbanOut(columns=[], placements={})
    return KanbanOut(columns=board.columns or [], placements=board.placements or {})


@router.put("/{account_id}/columns", response_model=KanbanOut)
def set_columns(
    account_id: int,
    payload: ColumnsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_account(db, user, account_id)
    board = _get_or_create(db, user, account_id)
    cols = [c.model_dump() for c in payload.columns]
    valid_ids = {c["id"] for c in cols}
    # источник раскладки: явная переразметка (миграция) либо текущая раскладка доски.
    # В любом случае выкидываем чаты, ссылающиеся на несуществующие колонки.
    source = payload.placements if payload.placements is not None else (board.placements or {})
    placements = {k: v for k, v in source.items() if v in valid_ids}
    board.columns = cols
    board.placements = placements
    db.commit()
    db.refresh(board)
    return KanbanOut(columns=board.columns, placements=board.placements)


@router.post("/{account_id}/broadcast")
async def broadcast(
    account_id: int,
    payload: KanbanBroadcast,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Массовая рассылка: всем чатам из колонки шлём публикацию (текст + медиа)."""
    acc = _require_account(db, user, account_id)
    text = payload.text.strip()
    media_urls = payload.media_urls or []
    if not text and not media_urls:
        raise HTTPException(400, "Пустая рассылка: добавьте текст или медиа")

    board = (
        db.query(KanbanBoard)
        .filter(
            KanbanBoard.user_id == user.id,
            KanbanBoard.account_id == account_id,
        )
        .first()
    )
    placements = (board.placements if board else None) or {}
    targets = [int(did) for did, cid in placements.items() if cid == payload.column_id]
    if not targets:
        return {"sent": 0, "failed": 0, "total": 0}

    session = decrypt_credentials(acc.credentials_enc)["session"]
    sent = failed = 0
    for did in targets:
        try:
            await tu.send_post(session, did, text, media_urls)
            sent += 1
        except Exception:  # noqa: BLE001 — одна ошибка не должна валить всю рассылку
            failed += 1
    return {"sent": sent, "failed": failed, "total": len(targets)}


@router.put("/{account_id}/placement", response_model=KanbanOut)
def set_placement(
    account_id: int,
    payload: PlacementUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_account(db, user, account_id)
    board = _get_or_create(db, user, account_id)
    # JSON-поле пересоздаём целиком, иначе SQLAlchemy не заметит мутацию dict
    placements = dict(board.placements or {})
    placements[payload.dialog_id] = payload.column_id
    board.placements = placements
    db.commit()
    db.refresh(board)
    return KanbanOut(columns=board.columns or [], placements=board.placements)
