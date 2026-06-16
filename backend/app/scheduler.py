"""Фоновый воркер: периодически публикует посты, у которых наступило время.

Простой и надёжный для v1 подход — поллинг БД в отдельном потоке.
На проде заменим на Celery/RQ + Redis, когда вырастет нагрузка.
"""

import threading
import time
from datetime import datetime, timezone

from .config import get_settings
from .db import SessionLocal
from .models import Post, PostStatus, PostTarget
from .services.publisher import publish_target

_settings = get_settings()
_stop = threading.Event()


def _tick() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due = (
            db.query(PostTarget)
            .join(Post, PostTarget.post_id == Post.id)
            .filter(PostTarget.status == PostStatus.scheduled)
            .filter(Post.scheduled_at.is_not(None))
            .filter(Post.scheduled_at <= now)
            .all()
        )
        for target in due:
            publish_target(db, target)
    finally:
        db.close()


def _loop() -> None:
    while not _stop.is_set():
        try:
            _tick()
        except Exception as exc:  # noqa: BLE001
            print(f"[scheduler] tick error: {exc}")
        _stop.wait(_settings.scheduler_interval_seconds)


def start_scheduler() -> threading.Thread:
    _stop.clear()
    thread = threading.Thread(target=_loop, daemon=True, name="smm-scheduler")
    thread.start()
    return thread


def stop_scheduler() -> None:
    _stop.set()
