from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

# check_same_thread=False нужно для SQLite, т.к. фоновый воркер-планировщик
# работает в отдельном потоке от FastAPI.
connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # модели импортируются ради регистрации в метаданных
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _run_lightweight_migrations()


def _run_lightweight_migrations() -> None:
    """Простые аддитивные миграции для dev (SQLite): добавляем недостающие
    колонки без потери данных. На проде заменим на Alembic."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "posts" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("posts")}
    if "platform_options" not in cols:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE posts ADD COLUMN platform_options JSON DEFAULT '{}'")
            )

    if "users" in inspector.get_table_names():
        ucols = {c["name"] for c in inspector.get_columns("users")}
        with engine.begin() as conn:
            for col in ("phone", "password_hash", "name"):
                if col not in ucols:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} VARCHAR"))
