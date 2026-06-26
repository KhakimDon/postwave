from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer

from .models import Platform, PostStatus


def _iso_utc(dt: datetime | None) -> str | None:
    """Отдаём время явно в UTC (SQLite хранит naive — фронт иначе примет за local)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


# ---------- Social accounts ----------
class AccountCreate(BaseModel):
    platform: Platform
    display_name: str
    # произвольные креденшелы под площадку:
    #   telegram_bot -> {"bot_token": "...", "chat_id": "@channel"}
    #   instagram    -> {"ig_user_id": "...", "access_token": "..."}
    credentials: dict


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: Platform
    display_name: str
    is_active: bool
    created_at: datetime


# ---------- Posts ----------
class PostCreate(BaseModel):
    content: str = ""
    media_urls: list[str] = []
    scheduled_at: datetime | None = None
    account_ids: list[int] = []
    # {"telegram": {...}, "instagram": {...}}
    platform_options: dict = {}


class PostUpdate(BaseModel):
    # перенос на другую дату/время (drag & drop в календаре)
    scheduled_at: datetime | None = None
    content: str | None = None


class TargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    status: PostStatus
    external_id: str | None = None
    error: str | None = None
    published_at: datetime | None = None

    @field_serializer("published_at")
    def _ser_published(self, dt: datetime | None) -> str | None:
        return _iso_utc(dt)


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    media_urls: list[str]
    platform_options: dict = {}
    scheduled_at: datetime | None
    status: PostStatus
    created_at: datetime
    targets: list[TargetOut]

    @field_serializer("scheduled_at", "created_at")
    def _ser_dt(self, dt: datetime | None) -> str | None:
        return _iso_utc(dt)


# ---------- Kanban (CRM-инбокс) ----------
class KanbanColumn(BaseModel):
    id: str
    title: str
    color: str | None = None


class KanbanOut(BaseModel):
    columns: list[KanbanColumn] = []
    placements: dict[str, str] = {}


class ColumnsUpdate(BaseModel):
    columns: list[KanbanColumn]
    # необязательная переразметка чатов (используется при миграции id колонок)
    placements: dict[str, str] | None = None


class PlacementUpdate(BaseModel):
    dialog_id: str  # id чата (строкой — бывает большим/отрицательным)
    column_id: str


class KanbanBroadcast(BaseModel):
    column_id: str
    text: str = ""
    media_urls: list[str] = []
