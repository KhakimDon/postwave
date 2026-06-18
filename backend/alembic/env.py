"""Alembic environment. Привязан к нашим Settings и моделям приложения.

URL БД и метаданные берём прямо из app, чтобы не дублировать конфиг:
- target_metadata = Base.metadata  -> autogenerate видит все модели
- url               = settings.database_url (тот же .env, что у приложения)
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.db import Base

# модели импортируем ради регистрации таблиц в Base.metadata
from app import models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# подставляем актуальный URL из настроек приложения
config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


def _is_sqlite() -> bool:
    return get_settings().database_url.startswith("sqlite")


def run_migrations_offline() -> None:
    """Генерация SQL без подключения к БД (alembic upgrade --sql)."""
    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=_is_sqlite(),
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Накат миграций с реальным подключением."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # SQLite не умеет ALTER TABLE полноценно -> batch mode
            # (Alembic пересоздаёт таблицу под капотом). Безопасно для dev.
            render_as_batch=_is_sqlite(),
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
