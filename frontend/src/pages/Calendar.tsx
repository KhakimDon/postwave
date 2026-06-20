import { useEffect, useMemo, useState } from "react";
import { useComposer } from "../composer";
import {
  Box,
  Group,
  Text,
  Button,
  ActionIcon,
  Paper,
  Tooltip,
  ScrollArea,
  ThemeIcon,
  Badge,
  SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconBrandTelegram,
  IconBrandInstagram,
  IconCalendarMonth,
  IconGripVertical,
  IconCircleCheck,
  IconLock,
} from "@tabler/icons-react";
import dayjs, { type Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Account, Post, PostStatus } from "../api/types";

const STATUS_COLOR: Record<PostStatus, string> = {
  draft: "var(--mantine-color-gray-5)",
  scheduled: "#5b8cff",
  publishing: "var(--mantine-color-yellow-5)",
  published: "#14d2b4",
  failed: "var(--mantine-color-red-5)",
};


type View = "month" | "week";

export function Calendar({ embedded }: { embedded?: boolean } = {}) {
  const { open } = useComposer();
  const { t } = useTranslation();
  const WEEKDAYS = [
    t("calendar.mon"),
    t("calendar.tue"),
    t("calendar.wed"),
    t("calendar.thu"),
    t("calendar.fri"),
    t("calendar.sat"),
    t("calendar.sun"),
  ];
  const [view, setView] = useState<View>(() =>
    localStorage.getItem("pw_cal_view") === "month" ? "month" : "week",
  );
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function changeView(v: View) {
    setView(v);
    localStorage.setItem("pw_cal_view", v);
  }
  function prev() {
    setCursor((c) => (view === "month" ? c.subtract(1, "month") : c.subtract(1, "week")));
  }
  function next() {
    setCursor((c) => (view === "month" ? c.add(1, "month") : c.add(1, "week")));
  }

  async function load() {
    try {
      const [p, a] = await Promise.all([api.listPosts(), api.listAccounts()]);
      setPosts(p);
      setAccounts(a);
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    }
  }

  useEffect(() => {
    load();
    const tm = setInterval(load, 12000);
    return () => clearInterval(tm);
  }, []);

  const accountPlatform = useMemo(() => {
    const m = new Map<number, Account["platform"]>();
    accounts.forEach((a) => m.set(a.id, a.platform));
    return m;
  }, [accounts]);

  // Понедельник недели, содержащей cursor
  const weekStart = useMemo(() => {
    const off = (cursor.day() + 6) % 7;
    return cursor.subtract(off, "day").startOf("day");
  }, [cursor]);

  // 6 недель месяца (от понедельника)
  const monthDays = useMemo(() => {
    const first = cursor.startOf("month");
    const offset = (first.day() + 6) % 7;
    const start = first.subtract(offset, "day");
    return Array.from({ length: 42 }, (_, i) => start.add(i, "day"));
  }, [cursor]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  const title =
    view === "month"
      ? cursor.format("MMMM YYYY")
      : `${weekStart.format("D MMM")} – ${weekStart.add(6, "day").format("D MMM")}`;

  const scheduledPosts = posts.filter((p) => p.scheduled_at);
  const unscheduled = posts.filter(
    (p) => !p.scheduled_at && p.status !== "published" && p.status !== "publishing",
  );

  function postsForDay(day: Dayjs) {
    return scheduledPosts
      .filter((p) => dayjs(p.scheduled_at).isSame(day, "day"))
      .sort((a, b) => dayjs(a.scheduled_at).valueOf() - dayjs(b.scheduled_at).valueOf());
  }

  async function reschedule(postId: number, day: Dayjs) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.status === "published") {
      notifications.show({ color: "gray", message: t("calendar.cantMovePublished") });
      return;
    }
    const base = post.scheduled_at ? dayjs(post.scheduled_at) : day.hour(12).minute(0);
    const when = day.hour(base.hour()).minute(base.minute()).second(0).millisecond(0);

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, scheduled_at: when.toISOString(), status: "scheduled" }
          : p,
      ),
    );
    try {
      await api.updatePost(postId, { scheduled_at: when.toISOString() });
      notifications.show({
        color: "teal",
        message: t("calendar.movedTo", { when: when.format("D MMMM, HH:mm") }),
      });
      load();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
      load();
    }
  }

  const today = dayjs();

  // Общий обработчик дроп-зоны дня
  function dropProps(day: Dayjs, key: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverKey(key);
      },
      onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverKey(null);
        if (draggingId != null) reschedule(draggingId, day);
        setDraggingId(null);
      },
    };
  }

  return (
    <Box>
      <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
        <Group gap="sm">
          <Text fz={{ base: 22, sm: 26 }} fw={800} tt="capitalize">
            {title}
          </Text>
          <Group gap={4}>
            <ActionIcon variant="default" size="lg" onClick={prev}>
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Button variant="default" size="sm" onClick={() => setCursor(dayjs())}>
              {t("calendar.today")}
            </Button>
            <ActionIcon variant="default" size="lg" onClick={next}>
              <IconChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Group>
        <Group gap="sm">
          <SegmentedControl
            size="sm"
            value={view}
            onChange={(v) => changeView(v as View)}
            data={[
              { value: "week", label: t("calendar.viewWeek") },
              { value: "month", label: t("calendar.viewMonth") },
            ]}
          />
          {!embedded && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open()}>
              {t("calendar.newBtn")}
            </Button>
          )}
        </Group>
      </Group>

      {/* Бэклог: посты без даты */}
      {unscheduled.length > 0 && (
        <Paper radius="lg" p="sm" mb="md">
          <Group gap="xs" mb={8}>
            <ThemeIcon size="sm" variant="light" color="grape">
              <IconCalendarMonth size={13} />
            </ThemeIcon>
            <Text fz="sm" fw={600}>
              {t("calendar.backlogLabel")}
            </Text>
            <Badge size="sm" variant="light" color="grape">
              {unscheduled.length}
            </Badge>
          </Group>
          <Group gap="xs">
            {unscheduled.map((p) => (
              <PostChip
                key={p.id}
                post={p}
                platforms={p.targets.map((tg) => accountPlatform.get(tg.account_id))}
                dragging={draggingId === p.id}
                onDragStart={() => setDraggingId(p.id)}
                onDragEnd={() => setDraggingId(null)}
                compact
              />
            ))}
          </Group>
        </Paper>
      )}

      {view === "month" ? (
        <ScrollArea>
          <Box miw={760}>
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
                marginBottom: 6,
              }}
            >
              {WEEKDAYS.map((w) => (
                <Text key={w} fz="xs" fw={700} c="dimmed" ta="center">
                  {w}
                </Text>
              ))}
            </Box>

            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
              }}
            >
              {monthDays.map((day) => {
                const inMonth = day.month() === cursor.month();
                const isToday = day.isSame(today, "day");
                const key = day.format("YYYY-MM-DD");
                const dayPosts = postsForDay(day);
                const isOver = dragOverKey === key;

                return (
                  <Box
                    key={key}
                    {...dropProps(day, key)}
                    style={dayCellStyle(isOver, isToday, inMonth, 124)}
                  >
                    <DayHeader
                      day={day}
                      isToday={isToday}
                      onAdd={() => open(key)}
                      addLabel={t("calendar.createThisDay")}
                    />
                    <Box style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {dayPosts.map((p) => (
                        <PostChip
                          key={p.id}
                          post={p}
                          platforms={p.targets.map((tg) =>
                            accountPlatform.get(tg.account_id),
                          )}
                          dragging={draggingId === p.id}
                          onDragStart={() => setDraggingId(p.id)}
                          onDragEnd={() => setDraggingId(null)}
                          compact
                        />
                      ))}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </ScrollArea>
      ) : (
        <ScrollArea>
          <Box
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 200px)",
              gap: 8,
              width: "fit-content",
            }}
          >
            {weekDays.map((day) => {
              const isToday = day.isSame(today, "day");
              const key = day.format("YYYY-MM-DD");
              const dayPosts = postsForDay(day);
              const isOver = dragOverKey === key;

              return (
                <Box
                  key={key}
                  {...dropProps(day, key)}
                  style={{
                    ...dayCellStyle(isOver, isToday, true, 0),
                    minHeight: "60vh",
                    display: "flex",
                    flexDirection: "column",
                    padding: 10,
                  }}
                >
                  <Group justify="space-between" mb={8} wrap="nowrap">
                    <Box>
                      <Text fz="xs" fw={700} c="dimmed" tt="uppercase">
                        {WEEKDAYS[(day.day() + 6) % 7]}
                      </Text>
                      <Group gap={6} align="center">
                        <Box style={dayNumberStyle(isToday)}>{day.date()}</Box>
                        {dayPosts.length > 0 && (
                          <Badge size="xs" variant="light" color="gray">
                            {dayPosts.length}
                          </Badge>
                        )}
                      </Group>
                    </Box>
                    <Tooltip label={t("calendar.createThisDay")} withArrow>
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="brand"
                        radius="md"
                        onClick={() => open(key)}
                      >
                        <IconPlus size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  <Box
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      overflowY: "auto",
                    }}
                  >
                    {dayPosts.map((p) => (
                      <PostChip
                        key={p.id}
                        post={p}
                        platforms={p.targets.map((tg) =>
                          accountPlatform.get(tg.account_id),
                        )}
                        dragging={draggingId === p.id}
                        onDragStart={() => setDraggingId(p.id)}
                        onDragEnd={() => setDraggingId(null)}
                      />
                    ))}
                    {dayPosts.length === 0 && (
                      <Text fz="xs" c="dimmed" ta="center" mt="xl">
                        {isOver ? t("inbox.dropHere") : "—"}
                      </Text>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </ScrollArea>
      )}
    </Box>
  );
}

function dayCellStyle(
  isOver: boolean,
  isToday: boolean,
  inMonth: boolean,
  minHeight: number,
): React.CSSProperties {
  return {
    minHeight: minHeight || undefined,
    borderRadius: 18,
    border: `1px solid ${
      isOver
        ? "var(--accent-border)"
        : isToday
        ? "var(--accent-border)"
        : "var(--border-1)"
    }`,
    background: isOver
      ? "var(--accent-soft)"
      : isToday
      ? "linear-gradient(160deg, rgba(138,87,251,0.20), rgba(74,163,255,0.13))"
      : "var(--surface-1)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: isOver
      ? "0 0 30px -6px var(--glow-violet), inset 0 1px 0 0 rgba(255,255,255,0.08)"
      : isToday
      ? "0 0 24px -10px var(--glow-violet), inset 0 1px 0 0 rgba(255,255,255,0.06)"
      : "inset 0 1px 0 0 rgba(255,255,255,0.04)",
    padding: 7,
    opacity: inMonth ? 1 : 0.4,
    transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
  };
}

function dayNumberStyle(isToday: boolean): React.CSSProperties {
  return {
    minWidth: 26,
    height: 26,
    paddingInline: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    fontSize: 14,
    fontWeight: 800,
    background: isToday ? "linear-gradient(135deg, #8a57fb, #4aa3ff)" : "transparent",
    color: isToday ? "#fff" : "var(--mantine-color-text)",
    boxShadow: isToday ? "0 0 16px -2px var(--glow-violet)" : "none",
  };
}

function DayHeader({
  day,
  isToday,
  onAdd,
  addLabel,
}: {
  day: Dayjs;
  isToday: boolean;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <Group justify="space-between" mb={4} wrap="nowrap">
      <Box style={dayNumberStyle(isToday)}>{day.date()}</Box>
      <Tooltip label={addLabel} withArrow>
        <ActionIcon size="xs" variant="subtle" color="gray" onClick={onAdd}>
          <IconPlus size={13} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function PostChip({
  post,
  platforms,
  onDragStart,
  onDragEnd,
  dragging,
  compact,
}: {
  post: Post;
  platforms: (Account["platform"] | undefined)[];
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const published = post.status === "published";
  const draggable = !published;
  const time = post.scheduled_at ? dayjs(post.scheduled_at).format("HH:mm") : "";
  const hasIg = platforms.includes("instagram");
  const hasTg = platforms.some((p) => p && p !== "instagram");
  const thumb = post.media_urls[0];

  // ===== Компактный чип (месяц / бэклог) =====
  if (compact) {
    return (
      <Tooltip
        label={post.content?.slice(0, 80) || t("common.noText")}
        withArrow
        multiline
        w={220}
        openDelay={450}
      >
        <Box
          className="pw-chip"
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 8px",
            borderRadius: 9,
            background: "var(--surface-2)",
            border: "1px solid var(--border-1)",
            borderLeft: `3px solid ${STATUS_COLOR[post.status]}`,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            cursor: draggable ? "grab" : "default",
            opacity: dragging ? 0.4 : 1,
            minWidth: 130,
            boxShadow: dragging
              ? "none"
              : `0 2px 10px -4px rgba(0,0,0,0.4), -6px 0 16px -12px ${STATUS_COLOR[post.status]}`,
            transition: "transform 150ms ease, background 150ms ease, box-shadow 150ms ease",
          }}
        >
          {published ? (
            <IconCircleCheck size={12} color="#14d2b4" style={{ flexShrink: 0 }} />
          ) : (
            <IconGripVertical
              size={12}
              style={{ color: "var(--mantine-color-dimmed)", flexShrink: 0, cursor: "grab" }}
            />
          )}
          {hasTg && <IconBrandTelegram size={12} color="#2aabee" style={{ flexShrink: 0 }} />}
          {hasIg && <IconBrandInstagram size={12} color="#d62976" style={{ flexShrink: 0 }} />}
          {time && (
            <Text fz={10} fw={700} c="dimmed" style={{ flexShrink: 0 }}>
              {time}
            </Text>
          )}
          <Text fz={11} lineClamp={1} style={{ flex: 1 }}>
            {post.content || t("common.noText")}
          </Text>
        </Box>
      </Tooltip>
    );
  }

  // ===== Карточка недельного вида — компактная, выровненная =====
  return (
    <Box
      className="pw-chip"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        position: "relative",
        borderRadius: 12,
        background: "var(--surface-2)",
        border: "1px solid var(--border-1)",
        borderLeft: `3px solid ${STATUS_COLOR[post.status]}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: 8,
        cursor: draggable ? "grab" : "default",
        opacity: dragging ? 0.4 : 1,
        boxShadow: dragging
          ? "none"
          : "0 3px 12px -7px rgba(0,0,0,0.45)",
        transition: "transform 160ms ease, background 160ms ease, box-shadow 160ms ease",
      }}
    >
      <Group gap={8} wrap="nowrap" align="flex-start">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            style={{ width: 40, height: 40, borderRadius: 9, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <Box
            style={{
              width: 40,
              height: 40,
              borderRadius: 9,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--surface-hover)",
              color: "var(--mantine-color-dimmed)",
            }}
          >
            {hasIg ? <IconBrandInstagram size={18} /> : <IconBrandTelegram size={18} />}
          </Box>
        )}

        <Box style={{ flex: 1, minWidth: 0 }}>
          {/* мета-строка: статус-точка · время · платформы — справа хват/замок */}
          <Group justify="space-between" wrap="nowrap" gap={6} mb={4}>
            <Group gap={5} wrap="nowrap" style={{ minWidth: 0 }}>
              <Box
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: STATUS_COLOR[post.status],
                  flexShrink: 0,
                }}
              />
              {time && (
                <Text fz={11} fw={800} c="dimmed" style={{ letterSpacing: 0.2 }}>
                  {time}
                </Text>
              )}
              {hasTg && <IconBrandTelegram size={12} color="#2aabee" style={{ flexShrink: 0 }} />}
              {hasIg && <IconBrandInstagram size={12} color="#d62976" style={{ flexShrink: 0 }} />}
            </Group>
            {draggable ? (
              <IconGripVertical
                size={13}
                style={{ color: "var(--mantine-color-dimmed)", cursor: "grab", flexShrink: 0 }}
              />
            ) : (
              <Tooltip label={t("calendar.cantMovePublished")} withArrow>
                <IconLock size={12} style={{ color: "var(--mantine-color-dimmed)", flexShrink: 0 }} />
              </Tooltip>
            )}
          </Group>

          <Text fz={12} lineClamp={2} lh={1.3} c={post.content ? undefined : "dimmed"}>
            {post.content || t("common.noText")}
          </Text>
        </Box>
      </Group>
    </Box>
  );
}
