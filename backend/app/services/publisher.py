"""Диспетчер публикации: берёт PostTarget и постит в нужную площадку."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import Platform, PostStatus, PostTarget
from . import instagram, telegram
from .crypto import decrypt_credentials

_HANDLERS = {
    Platform.telegram_bot.value: telegram.publish,
    Platform.instagram.value: instagram.publish,
}

# к какому ключу в platform_options относится площадка
_OPTIONS_KEY = {
    Platform.telegram_bot.value: "telegram",
    Platform.telegram_user.value: "telegram",
    Platform.instagram.value: "instagram",
}


def publish_target(db: Session, target: PostTarget) -> None:
    account = target.account
    post = target.post
    handler = _HANDLERS.get(account.platform)

    target.status = PostStatus.publishing
    db.commit()

    if handler is None:
        target.status = PostStatus.failed
        target.error = f"Площадка {account.platform} пока не поддерживается"
        db.commit()
        return

    try:
        creds = decrypt_credentials(account.credentials_enc)
        options = (post.platform_options or {}).get(
            _OPTIONS_KEY.get(account.platform, ""), {}
        )
        external_id = handler(
            creds, post.content, list(post.media_urls or []), options
        )
        target.status = PostStatus.published
        target.external_id = external_id
        target.published_at = datetime.now(timezone.utc)
        target.error = None
    except Exception as exc:  # noqa: BLE001 — фиксируем любую ошибку площадки
        target.status = PostStatus.failed
        target.error = str(exc)
    finally:
        db.commit()
        _sync_post_status(db, post.id)


def _sync_post_status(db: Session, post_id: int) -> None:
    from ..models import Post

    post = db.get(Post, post_id)
    if not post:
        return
    statuses = {t.status for t in post.targets}
    if statuses <= {PostStatus.published}:
        post.status = PostStatus.published
    elif PostStatus.failed in statuses and PostStatus.scheduled not in statuses:
        post.status = PostStatus.failed
    db.commit()
