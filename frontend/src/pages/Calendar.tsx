import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconBrandTelegram,
  IconBrandInstagram,
  IconCalendarMonth,
} from "@tabler/icons-react";
import dayjs, { type Dayjs } from "dayjs";
import { api } from "../api/client";
import type { Account, Post, PostStatus } from "../api/types";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const STATUS_COLOR: Record<PostStatus, string> = {
  draft: "var(--mantine-color-gray-5)",
  scheduled: "var(--mantine-color-blue-5)",
  publishing: "var(--mantine-color-yellow-5)",
  published: "var(--mantine-color-teal-5)",
  failed: "var(--mantine-color-red-5)",
};

export function Calendar() {
  const nav = useNavigate();
  const [cursor, setCursor] = useState<Dayjs>(dayjs().startOf("month"));
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

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
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  const accountPlatform = useMemo(() => {
    const m = new Map<number, Account["platform"]>();
    accounts.forEach((a) => m.set(a.id, a.platform));
    return m;
  }, [accounts]);

  // 6 недель от понедельника
  const days = useMemo(() => {
    const start = cursor.startOf("month").startOf("week");
    return Array.from({ length: 42 }, (_, i) => start.add(i, "day"));
  }, [cursor]);

  const scheduledPosts = posts.filter((p) => p.scheduled_at);
  // «Без даты» — только то, что ещё можно запланировать (не отправленное)
  const unscheduled = posts.filter(
    (p) => !p.scheduled_at && p.status !== "published" && p.status !== "publishing"
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
      notifications.show({ color: "gray", message: "Опубликованный пост перенести нельзя" });
      return;
    }
    // сохраняем время; для постов без даты — 12:00
    const base = post.scheduled_at ? dayjs(post.scheduled_at) : day.hour(12).minute(0);
    const when = day
      .hour(base.hour())
      .minute(base.minute())
      .second(0)
      .millisecond(0);

    // оптимистично
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, scheduled_at: when.toISOString(), status: "scheduled" }
          : p
      )
    );
    try {
      await api.updatePost(postId, { scheduled_at: when.toISOString() });
      notifications.show({
        color: "teal",
        message: `Перенесено на ${when.format("D MMMM, HH:mm")}`,
      });
      load();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
      load();
    }
  }

  const today = dayjs();

  return (
    <Box>
      <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
        <Group gap="sm">
          <Text fz={{ base: 22, sm: 26 }} fw={800} tt="capitalize">
            {cursor.format("MMMM YYYY")}
          </Text>
          <Group gap={4}>
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => setCursor((c) => c.subtract(1, "month"))}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Button
              variant="default"
              size="sm"
              onClick={() => setCursor(dayjs().startOf("month"))}
            >
              Сегодня
            </Button>
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => setCursor((c) => c.add(1, "month"))}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => nav("/compose")}>
          Новая публикация
        </Button>
      </Group>

      {/* Бэклог: посты без даты — перетащи в календарь */}
      {unscheduled.length > 0 && (
        <Paper withBorder radius="md" p="sm" mb="md">
          <Group gap="xs" mb={8}>
            <ThemeIcon size="sm" variant="light" color="gray">
              <IconCalendarMonth size={13} />
            </ThemeIcon>
            <Text fz="sm" fw={600}>
              Без даты — перетащите в день
            </Text>
            <Badge size="sm" variant="light" color="gray">
              {unscheduled.length}
            </Badge>
          </Group>
          <Group gap="xs">
            {unscheduled.map((p) => (
              <PostChip
                key={p.id}
                post={p}
                platforms={p.targets.map((t) => accountPlatform.get(t.account_id))}
                onDragStart={() => setDraggingId(p.id)}
                onDragEnd={() => setDraggingId(null)}
                compact
              />
            ))}
          </Group>
        </Paper>
      )}

      <ScrollArea>
        <Box miw={720}>
          {/* заголовок дней недели */}
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

          {/* сетка дней */}
          <Box
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
            }}
          >
            {days.map((day) => {
              const inMonth = day.month() === cursor.month();
              const isToday = day.isSame(today, "day");
              const key = day.format("YYYY-MM-DD");
              const dayPosts = postsForDay(day);
              const isOver = dragOverKey === key;

              return (
                <Box
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey(key);
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    if (draggingId != null) reschedule(draggingId, day);
                    setDraggingId(null);
                  }}
                  style={{
                    minHeight: 116,
                    borderRadius: 10,
                    border: `1.5px solid ${
                      isOver
                        ? "var(--mantine-color-brand-5)"
                        : "var(--mantine-color-gray-3)"
                    }`,
                    background: isOver
                      ? "var(--mantine-color-brand-0)"
                      : inMonth
                      ? "var(--mantine-color-body)"
                      : "var(--mantine-color-gray-0)",
                    padding: 6,
                    opacity: inMonth ? 1 : 0.55,
                    transition: "border-color 120ms ease, background 120ms ease",
                  }}
                >
                  <Group justify="space-between" mb={4} wrap="nowrap">
                    <Box
                      style={{
                        width: 24,
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        fontSize: 12,
                        fontWeight: 700,
                        background: isToday
                          ? "var(--mantine-color-brand-6)"
                          : "transparent",
                        color: isToday ? "#fff" : "var(--mantine-color-text)",
                      }}
                    >
                      {day.date()}
                    </Box>
                    <Tooltip label="Создать в этот день" withArrow>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => nav(`/compose?date=${key}`)}
                      >
                        <IconPlus size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  <Box style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dayPosts.map((p) => (
                      <PostChip
                        key={p.id}
                        post={p}
                        platforms={p.targets.map((t) =>
                          accountPlatform.get(t.account_id)
                        )}
                        onDragStart={() => setDraggingId(p.id)}
                        onDragEnd={() => setDraggingId(null)}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </ScrollArea>
    </Box>
  );
}

function PostChip({
  post,
  platforms,
  onDragStart,
  onDragEnd,
  compact,
}: {
  post: Post;
  platforms: (Account["platform"] | undefined)[];
  onDragStart: () => void;
  onDragEnd: () => void;
  compact?: boolean;
}) {
  const draggable = post.status !== "published";
  const time = post.scheduled_at ? dayjs(post.scheduled_at).format("HH:mm") : "";
  const hasIg = platforms.includes("instagram");
  const hasTg = platforms.some((p) => p && p !== "instagram");

  return (
    <Tooltip
      label={post.content?.slice(0, 80) || "(без текста)"}
      withArrow
      multiline
      w={220}
      openDelay={400}
    >
      <Box
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 7px",
          borderRadius: 7,
          background: "var(--mantine-color-gray-0)",
          borderLeft: `3px solid ${STATUS_COLOR[post.status]}`,
          cursor: draggable ? "grab" : "default",
          fontSize: 11,
          minWidth: compact ? 130 : undefined,
          boxShadow: "var(--mantine-shadow-xs)",
        }}
      >
        {hasTg && <IconBrandTelegram size={12} color="#2aabee" />}
        {hasIg && <IconBrandInstagram size={12} color="#d62976" />}
        {time && (
          <Text fz={10} fw={700} c="dimmed" style={{ flexShrink: 0 }}>
            {time}
          </Text>
        )}
        <Text fz={11} lineClamp={1} style={{ flex: 1 }}>
          {post.content || "(без текста)"}
        </Text>
      </Box>
    </Tooltip>
  );
}
