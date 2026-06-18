"""Демо-наполнение: разнообразные публикации на разные дни — для просмотра всех
кейсов в UI (статусы, одна/несколько площадок, медиа/без, карусель/reels/stories,
частичные ошибки, черновики-бэклог). Привязка к существующим аккаунтам.

Запуск из backend/:  .venv/Scripts/python.exe seed_demo.py
"""

from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import Post, PostStatus, SocialAccount

IG = 2  # instagram billie.gan
TG = 3  # telegram_bot xl

now = datetime.now(timezone.utc)


def img(seed: str) -> str:
    return f"https://picsum.photos/seed/{seed}/640/640"


def tg_opts(silent=False, parse=None):
    return {"telegram": {"silent": silent, "no_preview": False, "parse_mode": parse}}


def ig_opts(post_type="feed", location="Tashkent"):
    return {
        "instagram": {
            "post_type": post_type,
            "location": location,
            "user_tags": [],
            "collaborators": [],
            "hide_likes": False,
            "disable_comments": False,
            "alt_text": "",
            "share_to_feed": True,
        }
    }


def both_opts(post_type="feed"):
    return {**tg_opts(), **ig_opts(post_type)}


# (content, media_urls, when, status, [(account_id, target_status, error)])
S = PostStatus
rows: list[tuple] = []


def add(content, media, when, status, targets, opts):
    rows.append((content, media, when, status, targets, opts))


# ---- Запланированные на ближайшие 2 недели (для недели и месяца) ----
add(
    "🚀 Запуск новой коллекции уже завтра! Готовьтесь к чему-то особенному.",
    [img("launch1")],
    now + timedelta(hours=3),
    S.scheduled,
    [(IG, S.scheduled, None)],
    ig_opts("feed"),
)
add(
    "📣 Напоминание: вебинар сегодня вечером. Ссылка в описании канала.",
    [],
    now + timedelta(hours=6),
    S.scheduled,
    [(TG, S.scheduled, None)],
    tg_opts(silent=True, parse="MarkdownV2"),
)
add(
    "Карусель образов недели 👗✨ Свайпай и выбирай любимый лук. #fashion #style #ootd",
    [img("car1"), img("car2"), img("car3"), img("car4")],
    now + timedelta(days=1, hours=2),
    S.scheduled,
    [(IG, S.scheduled, None), (TG, S.scheduled, None)],
    both_opts("carousel"),
)
add(
    "Reels: бэкстейдж со съёмки 🎬",
    [img("reel1")],
    now + timedelta(days=1, hours=20),
    S.scheduled,
    [(IG, S.scheduled, None)],
    ig_opts("reels"),
)
add(
    "Stories на сегодня 🔥",
    [img("story1")],
    now + timedelta(days=2, hours=4),
    S.scheduled,
    [(IG, S.scheduled, None)],
    ig_opts("stories"),
)
add(
    "Длинный пост о том, как мы пришли к идее бренда. История, ценности и планы на "
    "будущее — всё в одном лонгриде. Спасибо, что вы с нами на этом пути! 💜 "
    "Читайте до конца, в финале — приятный сюрприз для подписчиков.",
    [img("long1")],
    now + timedelta(days=2, hours=8),
    S.scheduled,
    [(TG, S.scheduled, None)],
    tg_opts(parse="HTML"),
)
add(
    "Акция выходного дня: -30% на всё 🛍️",
    [img("sale1"), img("sale2")],
    now + timedelta(days=3, hours=5),
    S.scheduled,
    [(IG, S.scheduled, None), (TG, S.scheduled, None)],
    both_opts("carousel"),
)
add(
    "Новый дроп аксессуаров уже в продаже 💎",
    [img("acc1")],
    now + timedelta(days=4, hours=7),
    S.scheduled,
    [(IG, S.scheduled, None)],
    ig_opts("feed"),
)
add(
    "Опрос: какой цвет выпустить следующим? Голосуйте в комментариях 👇",
    [],
    now + timedelta(days=5, hours=9),
    S.scheduled,
    [(TG, S.scheduled, None)],
    tg_opts(),
)
add(
    "Reels-туториал: 3 способа носить шарф 🧣",
    [img("reel2")],
    now + timedelta(days=6, hours=6),
    S.scheduled,
    [(IG, S.scheduled, None)],
    ig_opts("reels"),
)
add(
    "Анонс коллаборации 🤝 Скоро подробности!",
    [img("collab1")],
    now + timedelta(days=8, hours=10),
    S.scheduled,
    [(IG, S.scheduled, None), (TG, S.scheduled, None)],
    both_opts("feed"),
)
add(
    "Подборка отзывов клиентов ⭐⭐⭐⭐⭐",
    [img("rev1"), img("rev2"), img("rev3")],
    now + timedelta(days=10, hours=8),
    S.scheduled,
    [(IG, S.scheduled, None)],
    ig_opts("carousel"),
)
add(
    "Гайд по уходу за изделиями 🧼 (сохрани, чтобы не потерять)",
    [],
    now + timedelta(days=12, hours=7),
    S.scheduled,
    [(TG, S.scheduled, None)],
    tg_opts(parse="MarkdownV2"),
)

# Несколько постов в один день — проверка стопки в ячейке
day7 = now + timedelta(days=7)
add("Утренний пост ☀️", [img("m1")], day7.replace(hour=5), S.scheduled, [(IG, S.scheduled, None)], ig_opts())
add("Дневной апдейт 🌤️", [img("m2")], day7.replace(hour=10), S.scheduled, [(TG, S.scheduled, None)], tg_opts())
add("Вечерний пост 🌙", [img("m3")], day7.replace(hour=15), S.scheduled, [(IG, S.scheduled, None)], ig_opts("reels"))

# ---- Опубликованные (прошлое) ----
add(
    "✅ Итоги месяца: спасибо за 10 000 подписчиков!",
    [img("done1")],
    now - timedelta(days=1, hours=3),
    S.published,
    [(IG, S.published, None)],
    ig_opts("feed"),
)
add(
    "Опубликованный анонс распродажи 🛒",
    [img("done2")],
    now - timedelta(days=2, hours=5),
    S.published,
    [(TG, S.published, None)],
    tg_opts(),
)
add(
    "Кейс: как мы выросли x2 за квартал 📈",
    [img("done3"), img("done4")],
    now - timedelta(days=3, hours=6),
    S.published,
    [(IG, S.published, None), (TG, S.published, None)],
    both_opts("carousel"),
)
add(
    "Старое доброе фото из архива 📸",
    [img("done5")],
    now - timedelta(days=6, hours=8),
    S.published,
    [(IG, S.published, None)],
    ig_opts("feed"),
)

# ---- Ошибка и частичный успех ----
add(
    "Пост, который не опубликовался в Instagram ❌",
    [img("fail1")],
    now - timedelta(days=1, hours=8),
    S.failed,
    [(IG, S.failed, "Instagram требует публичный URL медиа (Business-аккаунт)")],
    ig_opts("feed"),
)
add(
    "Частичный успех: в Telegram ок, в Instagram — ошибка",
    [img("part1")],
    now - timedelta(days=2, hours=9),
    S.failed,
    [(TG, S.published, None), (IG, S.failed, "Токен доступа истёк, переподключите аккаунт")],
    both_opts("feed"),
)

# ---- Публикуется прямо сейчас ----
add(
    "Публикуется прямо сейчас… ⏳",
    [img("pub1")],
    now - timedelta(minutes=1),
    S.publishing,
    [(IG, S.publishing, None)],
    ig_opts("feed"),
)

# ---- Черновики без даты (бэклог) ----
add(
    "Черновик: идея для поста про новинки 💡",
    [img("draft1")],
    None,
    S.draft,
    [(IG, S.draft, None)],
    ig_opts("feed"),
)
add(
    "Черновик без медиа — только текст, дополним позже.",
    [],
    None,
    S.draft,
    [(TG, S.draft, None)],
    tg_opts(),
)
add(
    "Черновик карусели (медиа добавим) 🖼️",
    [img("draft2"), img("draft3")],
    None,
    S.draft,
    [(IG, S.draft, None), (TG, S.draft, None)],
    both_opts("carousel"),
)


def main():
    db = SessionLocal()
    try:
        created = 0
        for content, media, when, status, targets, opts in rows:
            post = Post(
                user_id=1,
                content=content,
                media_urls=media,
                platform_options=opts,
                scheduled_at=when,
                status=status,
                created_at=now,
            )
            db.add(post)
            db.flush()
            from app.models import PostTarget

            for acc_id, tstatus, err in targets:
                published_at = now if tstatus == PostStatus.published else None
                ext = "demo123" if tstatus == PostStatus.published else None
                db.add(
                    PostTarget(
                        post_id=post.id,
                        account_id=acc_id,
                        status=tstatus,
                        external_id=ext,
                        error=err,
                        published_at=published_at,
                    )
                )
            created += 1
        db.commit()
        total = db.query(Post).count()
        print(f"Created posts: {created}. Total in DB: {total}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
