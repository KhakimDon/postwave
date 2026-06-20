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
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import {
  IconPlus,
  IconTrash,
  IconGripVertical,
  IconBrandTelegram,
  IconBrandInstagram,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { ChatAvatar } from "./ChatAvatar";
import type { KanbanColumn, TgDialog } from "../api/types";
import { COLUMN_COLORS, MAX_COLS, MIN_COLS, columnIdOf } from "../kanban";

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
}) {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const firstId = columns[0]?.id;
  const grouped = useMemo(() => {
    const m: Record<string, TgDialog[]> = {};
    columns.forEach((c) => (m[c.id] = []));
    if (!firstId) return m;
    dialogs.forEach((d) => {
      const cid = columnIdOf(d.id, columns, placements) ?? firstId;
      (m[cid] ?? m[firstId]).push(d);
    });
    return m;
  }, [dialogs, placements, columns, firstId]);

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
          <Box
            style={{
              display: "flex",
              gap: 12,
              // stretch — все колонки тянутся до высоты самой заполненной
              alignItems: "stretch",
              minHeight: "100%",
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
