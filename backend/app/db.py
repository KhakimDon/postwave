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
    """Накатывает все непримененные миграции (alembic upgrade head).

    Заменяет прежний create_all + ручные ALTER: схема теперь версионируется в
    alembic/versions. Свежая БД строится с нуля, существующая — догоняется без
    потери данных. Новое изменение схемы:
        1) поправить модель в models.py
        2) alembic revision --autogenerate -m "что поменялось"
        3) перезапустить бэкенд (или alembic upgrade head) — миграция накатится
    """
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parent.parent  # .../backend
    cfg = Config(str(backend_dir / "alembic.ini"))
    # абсолютные пути — чтобы не зависеть от текущей рабочей директории
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(cfg, "head")
