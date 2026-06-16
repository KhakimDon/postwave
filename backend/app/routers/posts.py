from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..deps import get_current_user
from ..db import get_db
from ..models import Post, PostStatus, PostTarget, SocialAccount, User
from ..schemas import PostCreate, PostOut, PostUpdate
from ..services.publisher import publish_target

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Post)
        .filter(Post.user_id == user.id)
        .order_by(Post.created_at.desc())
        .all()
    )


@router.post("", response_model=PostOut, status_code=201)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not payload.account_ids:
        raise HTTPException(400, "Выберите хотя бы один аккаунт для публикации")

    accounts = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.id.in_(payload.account_ids),
            SocialAccount.user_id == user.id,
        )
        .all()
    )
    if len(accounts) != len(set(payload.account_ids)):
        raise HTTPException(400, "Некоторые аккаунты не найдены")

    status = PostStatus.scheduled if payload.scheduled_at else PostStatus.draft
    post = Post(
        user_id=user.id,
        content=payload.content,
        media_urls=payload.media_urls,
        platform_options=payload.platform_options or {},
        scheduled_at=payload.scheduled_at,
        status=status,
    )
    db.add(post)
    db.flush()

    target_status = (
        PostStatus.scheduled if payload.scheduled_at else PostStatus.draft
    )
    for acc in accounts:
        db.add(PostTarget(post_id=post.id, account_id=acc.id, status=target_status))

    db.commit()
    db.refresh(post)
    return post


@router.patch("/{post_id}", response_model=PostOut)
def update_post(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Перенос/правка поста (drag & drop в календаре меняет дату)."""
    post = (
        db.query(Post).filter(Post.id == post_id, Post.user_id == user.id).first()
    )
    if not post:
        raise HTTPException(404, "Пост не найден")

    if payload.content is not None:
        post.content = payload.content

    if payload.scheduled_at is not None:
        post.scheduled_at = payload.scheduled_at
        # переносить уже опубликованные не имеет смысла; перепланируем остальные
        if post.status != PostStatus.published:
            post.status = PostStatus.scheduled
            for target in post.targets:
                if target.status != PostStatus.published:
                    target.status = PostStatus.scheduled
                    target.error = None

    db.commit()
    db.refresh(post)
    return post


@router.post("/{post_id}/publish-now", response_model=PostOut)
def publish_now(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = (
        db.query(Post)
        .filter(Post.id == post_id, Post.user_id == user.id)
        .first()
    )
    if not post:
        raise HTTPException(404, "Пост не найден")
    for target in post.targets:
        target.status = PostStatus.scheduled
        db.commit()
        publish_target(db, target)
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = (
        db.query(Post).filter(Post.id == post_id, Post.user_id == user.id).first()
    )
    if not post:
        raise HTTPException(404, "Пост не найден")
    db.delete(post)
    db.commit()
