import { useMemo, useState, useEffect } from "react";
import {
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Popover,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import { MonthPickerInput, DatePickerInput } from "@mantine/dates";
import {
  IconPlus,
  IconTrash,
  IconGripVertical,
  IconBrandTelegram,
  IconBrandInstagram,
  IconFilter,
  IconCalendar,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { ChatAvatar } from "./ChatAvatar";
import type { KanbanColumn, TgDialog } from "../api/types";
import { COLUMN_COLORS, MAX_COLS, MIN_COLS, columnIdOf } from "../kanban";

type FunnelMode = "month" | "range" | "days";
type FunnelFilter = {
  mode: FunnelMode;
  month: string | null; // "YYYY-MM"
  from: string | null; // ISO date
  to: string | null;
  days: number;
};
const FUNNEL_FILTER_KEY = "pw_funnel_filter";

function loadFunnelFilter(): FunnelFilter {
  try {
    const raw = localStorage.getItem(FUNNEL_FILTER_KEY);
    if (raw) return { days: 30, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  // по умолчанию — текущий месяц
  return {
    mode: "month",
    month: dayjs().format("YYYY-MM"),
    from: null,
    to: null,
    days: 30,
  };
}

export function InboxKanban({
  accountId,
  dialogs,
  columns,
  placements,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onMove,
  onSaveColumns,
  onOpenChat,
  settingsOpen,
  onSettingsClose,
  topSlot,
}: {
  accountId: number;
  dialogs: TgDialog[];
  columns: KanbanColumn[];
  placements: Record<string, string>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onMove: (dialogId: number, colId: string) => void;
  onSaveColumns: (cols: KanbanColumn[]) => void;
  onOpenChat: (d: TgDialog) => void;
  settingsOpen: boolean;
  onSettingsClose: () => void;
  topSlot?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Фильтр воронки по дате (месяц / период / последние N дней), хранится в localStorage
  const [filter, setFilter] = useState<FunnelFilter>(loadFunnelFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(FUNNEL_FILTER_KEY, JSON.stringify(filter));
    } catch {
      /* ignore */
    }
  }, [filter]);

  // Активный диапазон [начало, конец] в мс по текущему фильтру
  const range = useMemo<[number, number] | null>(() => {
    if (filter.mode === "month" && filter.month) {
      const m = dayjs(filter.month + "-01");
      return [m.startOf("month").valueOf(), m.endOf("month").valueOf()];
    }
    if (filter.mode === "range" && filter.from && filter.to) {
      return [
        dayjs(filter.from).startOf("day").valueOf(),
        dayjs(filter.to).endOf("day").valueOf(),
      ];
    }
    if (filter.mode === "days") {
      return [
        dayjs().subtract(filter.days - 1, "day").startOf("day").valueOf(),
        dayjs().endOf("day").valueOf(),
      ];
    }
    return null;
  }, [filter]);

  // Чаты, попадающие в выбранный период (без даты — не прячем)
  const viewDialogs = useMemo(() => {
    if (!range) return dialogs;
    return dialogs.filter((d) => {
      if (!d.date) return true;
      const ts = dayjs(d.date).valueOf();
      return ts >= range[0] && ts <= range[1];
    });
  }, [dialogs, range]);

  const firstId = columns[0]?.id;
  const grouped = useMemo(() => {
    const m: Record<string, TgDialog[]> = {};
    columns.forEach((c) => (m[c.id] = []));
    if (!firstId) return m;
    viewDialogs.forEach((d) => {
      const cid = columnIdOf(d.id, columns, placements) ?? firstId;
      (m[cid] ?? m[firstId]).push(d);
    });
    return m;
  }, [viewDialogs, placements, columns, firstId]);

  // Метрики воронки. Лид — чат, который вышел из первой колонки («Все чаты»),
  // т.е. хотя бы «Заинтересованные». Конверсия = оплаты / лиды.
  const total = viewDialogs.length;
  const leadCount = columns
    .slice(1)
    .reduce((s, c) => s + (grouped[c.id]?.length ?? 0), 0);
  const wonId = columns[columns.length - 1]?.id;
  const wonCount = wonId ? grouped[wonId]?.length ?? 0 : 0;
  const wonColor = columns[columns.length - 1]?.color ?? "#38d9a9";
  const convRate = leadCount > 0 ? Math.round((wonCount / leadCount) * 100) : 0;

  // Подпись текущего периода на кнопке фильтра
  const periodLabel = useMemo(() => {
    if (filter.mode === "month" && filter.month)
      return dayjs(filter.month + "-01").format("MMM YYYY");
    if (filter.mode === "range" && filter.from && filter.to)
      return `${dayjs(filter.from).format("DD.MM")}–${dayjs(filter.to).format("DD.MM")}`;
    if (filter.mode === "days")
      return `${filter.days} ${t("inbox.funnelDaysSuffix")}`;
    return t("inbox.funnelAllTime");
  }, [filter, t]);

  // бесконечный скролл: подгружаем чаты у нижней границы доски
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (
      hasMore &&
      !loadingMore &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 300
    )
      onLoadMore();
  }

  return (
    <>
      {loading ? (
        <Center h={220}>
          <Loader />
        </Center>
      ) : dialogs.length === 0 ? (
        <Center h={220}>
          <Text c="dimmed" fz="sm">
            {t("inbox.kanbanEmpty")}
          </Text>
        </Center>
      ) : (
        <Box
          onScroll={onScroll}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            paddingBottom: 8,
          }}
        >
          {/* Поиск/фильтры — прокручиваются вместе с доской */}
          {topSlot}
          {/* Баннер воронки: всего лидов → дошло до оплаты = конверсия */}
          <Group
            justify="space-between"
            wrap="nowrap"
            px={12}
            py={8}
            mb={8}
            style={{
              borderRadius: 14,
              background: "var(--surface-2)",
              border: "1px solid var(--border-1)",
            }}
          >
            <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
              <Text fw={800} fz="sm" tt="uppercase" c="dimmed" style={{ letterSpacing: 0.4 }}>
                {t("inbox.funnelLabel")}
              </Text>
              <Popover
                opened={filterOpen}
                onChange={setFilterOpen}
                position="bottom-start"
                withArrow
                shadow="md"
                width={260}
              >
                <Popover.Target>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="gray"
                    leftSection={<IconFilter size={13} />}
                    rightSection={<IconCalendar size={13} />}
                    onClick={() => setFilterOpen((o) => !o)}
                  >
                    {periodLabel}
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="xs">
                    <SegmentedControl
                      size="xs"
                      fullWidth
                      value={filter.mode}
                      onChange={(v) =>
                        setFilter((f) => ({ ...f, mode: v as FunnelMode }))
                      }
                      data={[
                        { value: "month", label: t("inbox.funnelModeMonth") },
                        { value: "range", label: t("inbox.funnelModeRange") },
                        { value: "days", label: t("inbox.funnelModeDays") },
                      ]}
                    />
                    {filter.mode === "month" && (
                      <MonthPickerInput
                        size="xs"
                        value={filter.month ? new Date(filter.month + "-01") : null}
                        onChange={(d) =>
                          setFilter((f) => ({
                            ...f,
                            month: d ? dayjs(d).format("YYYY-MM") : null,
                          }))
                        }
                        valueFormat="MMMM YYYY"
                        clearable={false}
                      />
                    )}
                    {filter.mode === "range" && (
                      <DatePickerInput
                        type="range"
                        size="xs"
                        valueFormat="DD.MM.YYYY"
                        placeholder={t("inbox.funnelRangePh")}
                        value={[
                          filter.from ? new Date(filter.from) : null,
                          filter.to ? new Date(filter.to) : null,
                        ]}
                        onChange={(v) =>
                          setFilter((f) => ({
                            ...f,
                            from: v[0] ? dayjs(v[0]).format("YYYY-MM-DD") : null,
                            to: v[1] ? dayjs(v[1]).format("YYYY-MM-DD") : null,
                          }))
                        }
                      />
                    )}
                    {filter.mode === "days" && (
                      <Select
                        size="xs"
                        allowDeselect={false}
                        value={String(filter.days)}
                        onChange={(v) =>
                          setFilter((f) => ({ ...f, days: Number(v) || 30 }))
                        }
                        data={[5, 10, 20, 30, 40, 60].map((n) => ({
                          value: String(n),
                          label: `${n} ${t("inbox.funnelDaysSuffix")}`,
                        }))}
                      />
                    )}
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            </Group>
            <Group gap={8} wrap="nowrap">
              <Text fz="sm" fw={700}>
                {leadCount} {t("inbox.funnelLeadWord")}
              </Text>
              <Text fz="sm" c="dimmed">
                →
              </Text>
              <Text fz="sm" fw={800} style={{ color: wonColor }}>
                {wonCount} {t("inbox.funnelPaidWord")}
              </Text>
              <Badge
                size="lg"
                radius="sm"
                variant="light"
                style={{ background: `${wonColor}22`, color: wonColor }}
              >
                {convRate}%
              </Badge>
            </Group>
          </Group>

          <Box
            style={{
              display: "flex",
              gap: 12,
              // stretch — все колонки тянутся до высоты самой заполненной
              alignItems: "stretch",
            }}
          >
            {columns.map((col) => {
              const items = grouped[col.id] ?? [];
              const isOver = overCol === col.id;
              return (
                <Box
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(col.id);
                  }}
                  onDragLeave={() =>
                    setOverCol((o) => (o === col.id ? null : o))
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId != null) onMove(dragId, col.id);
                    setDragId(null);
                    setOverCol(null);
                  }}
                  style={{
                    width: 272,
                    flexShrink: 0,
                    minHeight: 120,
                    display: "flex",
                    flexDirection: "column",
                    background: isOver ? "var(--accent-soft)" : "var(--surface-1)",
                    border: `1px solid ${
                      isOver ? "var(--accent-border)" : "var(--border-1)"
                    }`,
                    borderRadius: 18,
                    padding: 8,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    boxShadow: isOver
                      ? "0 0 30px -8px var(--glow-violet), inset 0 1px 0 0 rgba(255,255,255,0.06)"
                      : "inset 0 1px 0 0 rgba(255,255,255,0.04)",
                    transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
                  }}
                >
                  <Group justify="space-between" px={4} mb={8} wrap="nowrap">
                    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Box
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: col.color ?? "var(--mantine-color-gray-4)",
                          flexShrink: 0,
                        }}
                      />
                      <Text fw={700} fz="sm" lineClamp={1}>
                        {col.title}
                      </Text>
                    </Group>
                    <Badge variant="light" color="gray" size="sm" className="pw-col-count">
                      {items.length}
                    </Badge>
                  </Group>
                  <Stack gap={6}>
                    {items.map((d) => (
                      <KanbanCard
                        key={d.id}
                        dialog={d}
                        avatarUrl={
                          d.network === "instagram"
                            ? d.avatar_url ?? ""
                            : api.tgUserAvatarUrl(accountId, d.id)
                        }
                        accent={col.color}
                        dragging={dragId === d.id}
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                        onOpen={() => onOpenChat(d)}
                      />
                    ))}
                    {items.length === 0 && (
                      <Text fz="xs" c="dimmed" ta="center" py="lg">
                        {t("inbox.dropHere")}
                      </Text>
                    )}
                  </Stack>
                  {/* Футер колонки: количество + доля от всех лидов */}
                  <Group
                    justify="space-between"
                    wrap="nowrap"
                    px={4}
                    pt={6}
                    mt="auto"
                    style={{ borderTop: "1px solid var(--border-1)" }}
                  >
                    <Text fz={10} fw={700} c="dimmed">
                      {items.length}
                    </Text>
                    <Text fz={10} fw={800} style={{ color: col.color ?? "var(--mantine-color-dimmed)" }}>
                      {total > 0 ? Math.round((items.length / total) * 100) : 0}%
                    </Text>
                  </Group>
                </Box>
              );
            })}
          </Box>
          {loadingMore && (
            <Center py="sm">
              <Loader size="xs" />
            </Center>
          )}
        </Box>
      )}

      <ColumnSettings
        opened={settingsOpen}
        onClose={onSettingsClose}
        columns={columns}
        onSave={onSaveColumns}
      />
    </>
  );
}

function KanbanCard({
  dialog,
  avatarUrl,
  accent,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  dialog: TgDialog;
  avatarUrl: string;
  accent?: string | null;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Box
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="pw-chip"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-1)",
        borderLeft: `3px solid ${accent ?? "var(--border-1)"}`,
        borderRadius: 12,
        padding: 8,
        cursor: "grab",
        opacity: dragging ? 0.5 : 1,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 2px 10px -4px rgba(0,0,0,0.4)",
        transition: "transform 140ms ease, background 140ms ease",
      }}
    >
      <Group gap={8} wrap="nowrap">
        <IconGripVertical
          size={14}
          style={{ color: "var(--mantine-color-gray-4)", flexShrink: 0 }}
        />
        {/* аватар + бейдж соцсети (TG / IG) */}
        <Box style={{ position: "relative", flexShrink: 0 }}>
          <ChatAvatar
            src={avatarUrl}
            name={dialog.name}
            color={dialog.network === "instagram" ? "grape" : dialog.is_user ? "blue" : "grape"}
            size={30}
          />
          <Box
            style={{
              position: "absolute",
              right: -3,
              bottom: -3,
              width: 15,
              height: 15,
              borderRadius: "50%",
              background: "var(--mantine-color-body)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 1px var(--border-1)",
            }}
          >
            {dialog.network === "instagram" ? (
              <IconBrandInstagram size={11} color="#E4405F" />
            ) : (
              <IconBrandTelegram size={11} color="#229ED9" />
            )}
          </Box>
        </Box>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} fz="xs" lineClamp={1}>
            {dialog.name || t("inbox.noName")}
          </Text>
          <Text c="dimmed" fz="xs" lineClamp={1}>
            {dialog.last_message || "—"}
          </Text>
        </Box>
        {dialog.unread > 0 && (
          <Badge size="xs" circle variant="filled" color="brand">
            {dialog.unread}
          </Badge>
        )}
      </Group>
    </Box>
  );
}

function genId(): string {
  return crypto.randomUUID();
}

/** Кнопка-кружок цвета: по клику открывает поп-ап с 10 цветами (без hex/rgb). */
function ColorDot({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      withinPortal
      shadow="md"
      radius="md"
    >
      <Popover.Target>
        <ActionIcon
          variant="default"
          radius="xl"
          size={36}
          aria-label={t("inbox.columnColor")}
          onClick={() => setOpened((o) => !o)}
        >
          <Box
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: color,
              boxShadow: "0 0 0 1px rgba(0,0,0,.12)",
            }}
          />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p={8}>
        <SimpleGrid cols={5} spacing={6}>
          {COLUMN_COLORS.map((c) => (
            <ActionIcon
              key={c}
              variant="transparent"
              size={28}
              onClick={() => {
                onChange(c);
                setOpened(false);
              }}
            >
              <Box
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: c,
                  border:
                    c === color
                      ? "2px solid var(--mantine-color-dark-5)"
                      : "2px solid transparent",
                  boxShadow: "0 0 0 1px rgba(0,0,0,.12)",
                }}
              />
            </ActionIcon>
          ))}
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  );
}

function ColumnSettings({
  opened,
  onClose,
  columns,
  onSave,
}: {
  opened: boolean;
  onClose: () => void;
  columns: KanbanColumn[];
  onSave: (cols: KanbanColumn[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<KanbanColumn[]>(columns);

  useEffect(() => {
    if (opened) setDraft(columns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  function setTitle(i: number, v: string) {
    setDraft((d) => d.map((c, idx) => (idx === i ? { ...c, title: v } : c)));
  }
  function setColor(i: number, v: string) {
    setDraft((d) => d.map((c, idx) => (idx === i ? { ...c, color: v } : c)));
  }
  function remove(i: number) {
    setDraft((d) => (d.length > MIN_COLS ? d.filter((_, idx) => idx !== i) : d));
  }
  function add() {
    setDraft((d) =>
      d.length < MAX_COLS
        ? [
            ...d,
            {
              id: genId(),
              title: "",
              color: COLUMN_COLORS[d.length % COLUMN_COLORS.length],
            },
          ]
        : d,
    );
  }
  function save() {
    const cleaned = draft
      .map((c) => ({ ...c, title: c.title.trim() }))
      .filter((c) => c.title.length > 0);
    if (cleaned.length < MIN_COLS) return;
    onSave(cleaned);
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{t("inbox.columnsSettings")}</Text>}
      radius="lg"
    >
      <Stack>
        <Text fz="xs" c="dimmed">
          {t("inbox.columnsHint")}
        </Text>
        {draft.map((c, i) => (
          <Group key={c.id} gap="xs" wrap="nowrap">
            <ColorDot
              color={c.color ?? COLUMN_COLORS[0]}
              onChange={(v) => setColor(i, v)}
            />
            <TextInput
              style={{ flex: 1 }}
              value={c.title}
              placeholder={t("inbox.columnNamePh")}
              onChange={(e) => setTitle(i, e.currentTarget.value)}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              disabled={draft.length <= MIN_COLS}
              onClick={() => remove(i)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          disabled={draft.length >= MAX_COLS}
          onClick={add}
        >
          {t("inbox.addColumn")}
        </Button>
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={draft.filter((c) => c.title.trim()).length < MIN_COLS}
          >
            {t("common.save")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
