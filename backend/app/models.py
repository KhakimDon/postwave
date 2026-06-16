from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Platform(str, Enum):
    telegram_bot = "telegram_bot"  # постинг в каналы через Bot API
    telegram_user = "telegram_user"  # личный аккаунт через MTProto (фаза 2)
    instagram = "instagram"  # Graph API


class PostStatus(str, Enum):
    draft = "draft"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    accounts: Mapped[list["SocialAccount"]] = relationship(back_populates="user")
    posts: Mapped[list["Post"]] = relationship(back_populates="user")


class SocialAccount(Base):
    """Подключённый соц-аккаунт. Сами токены/сессии шифруются (см. services.crypto)."""

    __tablename__ = "social_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[Platform] = mapped_column(String(32))
    display_name: Mapped[str] = mapped_column(String(255))
    # зашифрованный JSON с креденшелами (bot_token+chat_id / ig_user_id+access_token)
    credentials_enc: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="accounts")
    targets: Mapped[list["PostTarget"]] = relationship(back_populates="account")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    media_urls: Mapped[list] = mapped_column(JSON, default=list)
    # Опции под каждую площадку: {"telegram": {...}, "instagram": {...}}
    platform_options: Mapped[dict] = mapped_column(JSON, default=dict)
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    status: Mapped[PostStatus] = mapped_column(String(32), default=PostStatus.draft)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="posts")
    targets: Mapped[list["PostTarget"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )


class PostTarget(Base):
    """Один пост может публиковаться сразу в несколько аккаунтов/площадок."""

    __tablename__ = "post_targets"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("social_accounts.id"), index=True)
    status: Mapped[PostStatus] = mapped_column(String(32), default=PostStatus.scheduled)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    post: Mapped["Post"] = relationship(back_populates="targets")
    account: Mapped["SocialAccount"] = relationship(back_populates="targets")
