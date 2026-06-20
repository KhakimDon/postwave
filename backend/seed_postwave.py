"""Наполнение демо-данными для пользователя +998915491754.

- Гарантирует наличие Instagram-аккаунта (фейковые креды — постить не будет, но
  для UI/календаря/списка достаточно).
- Создаёт много разнообразных постов на разные дни: прошлые (опубликованные/
  ошибки/частичные), будущие (запланированные на ~4 недели), черновики-бэклог,
  по несколько в один день. Покрывает все статусы и типы (feed/carousel/reels/
  stories, одна/несколько площадок, с медиа/без).

Запуск из backend/:  .venv/bin/python seed_postwave.py
"""

from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import Platform, Post, PostStatus, PostTarget, SocialAccount, User
from app.services.crypto import encrypt_credentials

PHONE = "+998915491754"
now = datetime.now(timezone.utc)
S = PostStatus


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


def get_user(db) -> User:
    u = db.query(User).filter(User.phone == PHONE).first()
    if not u:
        raise SystemExit(f"Пользователь {PHONE} не найден")
    return u


def ensure_instagram(db, user: User) -> SocialAccount:
    acc = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.user_id == user.id,
            SocialAccount.platform == Platform.instagram,
        )
        .first()
    )
    if acc:
        return acc
    acc = SocialAccount(
        user_id=user.id,
        platform=Platform.instagram,
        display_name="explat.shop",
        credentials_enc=encrypt_credentials(
            {"ig_user_id": "17841400000000000", "access_token": "DEMO_FAKE_TOKEN"}
        ),
        is_active=True,
    )
    db.add(acc)
    db.flush()
    return acc


def telegram_account(db, user: User) -> SocialAccount | None:
    return (
        db.query(SocialAccount)
        .filter(
            SocialAccount.user_id == user.id,
            SocialAccount.platform == Platform.telegram_bot,
        )
        .first()
    )


def build_rows(IG: int, TG: int | None):
    """Возвращает список (content, media, when, status, targets, opts).

    targets: список (account_id, target_status, error|None).
    Если TG нет — посты, где была обе площадки, остаются только с IG.
    """
    rows: list[tuple] = []

    def add(content, media, when, status, targets, opts):
        # выкинуть таргеты на отсутствующий TG
        targets = [t for t in targets if t[0] is not None]
        if not targets:
            return
        rows.append((content, media, when, status, targets, opts))

    # ===== ПРОШЛОЕ: опубликованные (растянуто на ~3 недели назад) =====
    add("✅ Итоги месяца: спасибо за 10 000 подписчиков! 🎉", [img("p_done1")],
        now - timedelta(days=21, hours=3), S.published, [(IG, S.published, None)], ig_opts("feed"))
    add("Опубликованный анонс распродажи 🛒 -40% только сегодня", [img("p_done2")],
        now - timedelta(days=18, hours=5), S.published, [(TG, S.published, None)], tg_opts())
    add("Кейс: как мы выросли x2 за квартал 📈 (свайпай)", [img("p_done3"), img("p_done4"), img("p_done5")],
        now - timedelta(days=15, hours=6), S.published, [(IG, S.published, None), (TG, S.published, None)], both_opts("carousel"))
    add("Reels: бэкстейдж осенней съёмки 🎬", [img("p_reel_done")],
        now - timedelta(days=12, hours=2), S.published, [(IG, S.published, None)], ig_opts("reels"))
    add("Старое доброе фото из архива 📸 #throwback", [img("p_done6")],
        now - timedelta(days=9, hours=8), S.published, [(IG, S.published, None)], ig_opts("feed"))
    add("Пятничный дайджест новостей бренда 📰", [],
        now - timedelta(days=7, hours=4), S.published, [(TG, S.published, None)], tg_opts(parse="HTML"))
    add("Подборка отзывов клиентов ⭐⭐⭐⭐⭐", [img("p_rev1"), img("p_rev2")],
        now - timedelta(days=4, hours=7), S.published, [(IG, S.published, None)], ig_opts("carousel"))
    add("Вчерашний пост: новинки уже в наличии 💎", [img("p_done7")],
        now - timedelta(days=1, hours=10), S.published, [(IG, S.published, None), (TG, S.published, None)], both_opts("feed"))

    # ===== ПРОШЛОЕ: ошибки и частичный успех =====
    add("Пост, который не опубликовался в Instagram ❌", [img("p_fail1")],
        now - timedelta(days=5, hours=8), S.failed,
        [(IG, S.failed, "Instagram требует публичный URL медиа (Business-аккаунт)")], ig_opts("feed"))
    add("Частичный успех: в Telegram ок, в Instagram — ошибка", [img("p_part1")],
        now - timedelta(days=3, hours=9), S.failed,
        [(TG, S.published, None), (IG, S.failed, "Токен доступа истёк, переподключите аккаунт")], both_opts("feed"))
    add("Reels не прошёл модерацию формата ❌", [img("p_fail2")],
        now - timedelta(days=2, hours=3), S.failed,
        [(IG, S.failed, "Видео не соответствует требованиям Reels (соотношение сторон)")], ig_opts("reels"))

    # ===== ПУБЛИКУЕТСЯ ПРЯМО СЕЙЧАС =====
    add("Публикуется прямо сейчас… ⏳", [img("p_pub1")],
        now - timedelta(minutes=1), S.publishing, [(IG, S.publishing, None)], ig_opts("feed"))

    # ===== БЛИЖАЙШИЕ ЧАСЫ =====
    add("🚀 Запуск новой коллекции уже завтра! Готовьтесь к особенному.", [img("f_launch1")],
        now + timedelta(hours=3), S.scheduled, [(IG, S.scheduled, None)], ig_opts("feed"))
    add("📣 Напоминание: вебинар сегодня вечером. Ссылка в описании.", [],
        now + timedelta(hours=6), S.scheduled, [(TG, S.scheduled, None)], tg_opts(silent=True, parse="MarkdownV2"))
    add("Вечерние Stories дня 🔥", [img("f_story_today")],
        now + timedelta(hours=9), S.scheduled, [(IG, S.scheduled, None)], ig_opts("stories"))

    # ===== ЗАПЛАНИРОВАНО НА ~4 НЕДЕЛИ (разные дни) =====
    add("Карусель образов недели 👗✨ Свайпай и выбирай лук. #fashion #ootd",
        [img("f_car1"), img("f_car2"), img("f_car3"), img("f_car4")],
        now + timedelta(days=1, hours=2), S.scheduled, [(IG, S.scheduled, None), (TG, S.scheduled, None)], both_opts("carousel"))
    add("Reels: 3 способа носить шарф 🧣", [img("f_reel1")],
        now + timedelta(days=1, hours=20), S.scheduled, [(IG, S.scheduled, None)], ig_opts("reels"))
    add("Длинный лонгрид об истории бренда: ценности, путь и планы 💜 Дочитайте до сюрприза.",
        [img("f_long1")], now + timedelta(days=2, hours=8), S.scheduled, [(TG, S.scheduled, None)], tg_opts(parse="HTML"))
    add("Stories: закулисье нового дропа 🎒", [img("f_story1")],
        now + timedelta(days=2, hours=12), S.scheduled, [(IG, S.scheduled, None)], ig_opts("stories"))
    add("Акция выходного дня: -30% на всё 🛍️", [img("f_sale1"), img("f_sale2")],
        now + timedelta(days=3, hours=5), S.scheduled, [(IG, S.scheduled, None), (TG, S.scheduled, None)], both_opts("carousel"))
    add("Новый дроп аксессуаров уже в продаже 💎", [img("f_acc1")],
        now + timedelta(days=4, hours=7), S.scheduled, [(IG, S.scheduled, None)], ig_opts("feed"))
    add("Опрос: какой цвет выпустить следующим? Голосуйте 👇", [],
        now + timedelta(days=5, hours=9), S.scheduled, [(TG, S.scheduled, None)], tg_opts())
    add("Reels-туториал: как собрать капсульный гардероб 👚", [img("f_reel2")],
        now + timedelta(days=6, hours=6), S.scheduled, [(IG, S.scheduled, None)], ig_opts("reels"))
    add("Анонс коллаборации 🤝 Скоро подробности!", [img("f_collab1")],
        now + timedelta(days=8, hours=10), S.scheduled, [(IG, S.scheduled, None), (TG, S.scheduled, None)], both_opts("feed"))
    add("Подборка отзывов клиентов ⭐ (часть 2)", [img("f_rev1"), img("f_rev2"), img("f_rev3")],
        now + timedelta(days=10, hours=8), S.scheduled, [(IG, S.scheduled, None)], ig_opts("carousel"))
    add("Гайд по уходу за изделиями 🧼 (сохрани в избранное)", [],
        now + timedelta(days=12, hours=7), S.scheduled, [(TG, S.scheduled, None)], tg_opts(parse="MarkdownV2"))
    add("Большая распродажа сезона ❄️ Старт в полночь!", [img("f_bigsale")],
        now + timedelta(days=14, hours=0), S.scheduled, [(IG, S.scheduled, None), (TG, S.scheduled, None)], both_opts("feed"))
    add("Reels: лукбук новой коллекции 🎥", [img("f_reel3")],
        now + timedelta(days=16, hours=18), S.scheduled, [(IG, S.scheduled, None)], ig_opts("reels"))
    add("Розыгрыш среди подписчиков 🎁 Условия внутри.", [img("f_give1"), img("f_give2")],
        now + timedelta(days=18, hours=11), S.scheduled, [(IG, S.scheduled, None), (TG, S.scheduled, None)], both_opts("carousel"))
    add("Подведение итогов розыгрыша 🏆", [],
        now + timedelta(days=21, hours=13), S.scheduled, [(TG, S.scheduled, None)], tg_opts())
    add("Тизер следующей коллекции 👀", [img("f_teaser")],
        now + timedelta(days=24, hours=9), S.scheduled, [(IG, S.scheduled, None)], ig_opts("feed"))
    add("Финальный анонс месяца 🚀", [img("f_final")],
        now + timedelta(days=27, hours=10), S.scheduled, [(IG, S.scheduled, None), (TG, S.scheduled, None)], both_opts("feed"))

    # ===== НЕСКОЛЬКО ПОСТОВ В ОДИН ДЕНЬ (стопка в ячейке календаря) =====
    day7 = now + timedelta(days=7)
    add("Утренний пост ☀️ Доброе утро, подписчики!", [img("d7_m1")], day7.replace(hour=5), S.scheduled, [(IG, S.scheduled, None)], ig_opts())
    add("Дневной апдейт 🌤️ Что нового сегодня", [img("d7_m2")], day7.replace(hour=10), S.scheduled, [(TG, S.scheduled, None)], tg_opts())
    add("Дневные Stories 📸", [img("d7_m3")], day7.replace(hour=13), S.scheduled, [(IG, S.scheduled, None)], ig_opts("stories"))
    add("Вечерний Reels 🌙", [img("d7_m4")], day7.replace(hour=18), S.scheduled, [(IG, S.scheduled, None)], ig_opts("reels"))

    day9 = now + timedelta(days=9)
    add("Двойной пост утром (IG+TG) 🔁", [img("d9_a")], day9.replace(hour=8), S.scheduled, [(IG, S.scheduled, None), (TG, S.scheduled, None)], both_opts("feed"))
    add("И ещё один вечером того же дня 🌆", [img("d9_b")], day9.replace(hour=19), S.scheduled, [(TG, S.scheduled, None)], tg_opts())

    # ===== ЧЕРНОВИКИ БЕЗ ДАТЫ (бэклог) =====
    add("Черновик: идея поста про новинки 💡", [img("dr1")], None, S.draft, [(IG, S.draft, None)], ig_opts("feed"))
    add("Черновик без медиа — только текст, дополним позже.", [], None, S.draft, [(TG, S.draft, None)], tg_opts())
    add("Черновик карусели (медиа добавим) 🖼️", [img("dr2"), img("dr3")], None, S.draft, [(IG, S.draft, None), (TG, S.draft, None)], both_opts("carousel"))
    add("Черновик Reels-сценария 🎞️", [], None, S.draft, [(IG, S.draft, None)], ig_opts("reels"))
    add("Черновик: длинный анонс мероприятия (дата уточняется)", [img("dr4")], None, S.draft, [(IG, S.draft, None), (TG, S.draft, None)], both_opts("feed"))

    return rows


def main():
    db = SessionLocal()
    try:
        user = get_user(db)
        ig = ensure_instagram(db, user)
        tg = telegram_account(db, user)
        db.commit()
        print(f"User #{user.id} {user.phone} | IG account #{ig.id} '{ig.display_name}'"
              f" | TG account {'#'+str(tg.id)+' '+repr(tg.display_name) if tg else '— нет'}")

        rows = build_rows(IG=ig.id, TG=(tg.id if tg else None))
        created = 0
        for content, media, when, status, targets, opts in rows:
            post = Post(
                user_id=user.id,
                content=content,
                media_urls=media,
                platform_options=opts,
                scheduled_at=when,
                status=status,
                created_at=now,
            )
            db.add(post)
            db.flush()
            for acc_id, tstatus, err in targets:
                db.add(PostTarget(
                    post_id=post.id,
                    account_id=acc_id,
                    status=tstatus,
                    external_id=("demo123" if tstatus == PostStatus.published else None),
                    error=err,
                    published_at=(now if tstatus == PostStatus.published else None),
                ))
            created += 1
        db.commit()
        total = db.query(Post).count()
        print(f"Создано постов: {created}. Всего в БД: {total}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
