import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Group,
  Stack,
  Text,
  Button,
  TextInput,
  PasswordInput,
  ScrollArea,
  Paper,
  Badge,
  Loader,
  ThemeIcon,
  Modal,
  ActionIcon,
  Center,
  Select,
  SegmentedControl,
  Drawer,
  Skeleton,
} from "@mantine/core";
import { useMediaQuery, useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBrandTelegram,
  IconPlus,
  IconMessageChatbot,
  IconSettings,
  IconSearch,
  IconUserCircle,
  IconSettings2,
  IconSpeakerphone,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { notifyMessage } from "../notify";
import type { Account, KanbanColumn, TgDialog, TgMessage } from "../api/types";
import { PageHeader, EmptyState } from "../components/ui";
import { InboxKanban } from "../components/InboxKanban";
import { ChatAvatar } from "../components/ChatAvatar";
import { Conversation } from "../components/Conversation";
import { BroadcastModal } from "../components/BroadcastModal";
import { AccountSettings } from "../components/AccountSettings";
import { ProfileModal } from "../components/ProfileModal";
import {
  colorOf,
  columnIdOf,
  COLUMN_COLORS,
  defaultColumns,
  MIN_COLS,
} from "../kanban";

const DIALOG_PAGE = 40;

export function Inbox() {
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  // активный таб запоминаем — после обновления остаёмся там же
  const [view, setView] = useState<"chat" | "kanban">(() =>
    localStorage.getItem("postwave_inbox_view") === "kanban" ? "kanban" : "chat",
  );
  const [kanbanSettingsOpen, setKanbanSettingsOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // выезжающая панель чата в табе «Канбан»
  const [kanbanChatOpen, setKanbanChatOpen] = useState(false);

  function changeView(v: "chat" | "kanban") {
    setView(v);
    localStorage.setItem("postwave_inbox_view", v);
  }

  const [dialogs, setDialogs] = useState<TgDialog[]>([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeDialog, setActiveDialog] = useState<TgDialog | null>(null);
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const dialogViewportRef = useRef<HTMLDivElement>(null);
  // актуальные значения для обработчика SSE (чтобы не переподписываться)
  const activeDialogRef = useRef<TgDialog | null>(null);
  const dialogsRef = useRef<TgDialog[]>([]);

  // Канбан-доска (общая для табов «Чат» и «Канбан»): колонки + раскладка
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [boardLoading, setBoardLoading] = useState(true);

  // Поиск и фильтры (общие для табов «Чат» и «Канбан»)
  const [search, setSearch] = useState("");
  // дебаунс: инпут отзывчивый, а тяжёлая фильтрация списка идёт реже
  const [debouncedSearch] = useDebouncedValue(search, 200);
  // "__all__" — без фильтра по колонке (не "all", т.к. это id дефолтной колонки)
  const [filterCol, setFilterCol] = useState<string>("__all__");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const tgAccounts = useMemo(
    () => accounts.filter((a) => a.platform === "telegram_user"),
    [accounts]
  );
  const currentAccount = tgAccounts.find((a) => a.id === accountId);

  // Диалоги после поиска/фильтров (применяются и к списку чатов, и к канбану)
  const filteredDialogs = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const now = dayjs();
    const days =
      dateFilter === "today" ? 1 : dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 0;
    return dialogs.filter((d) => {
      if (
        q &&
        !(d.name || "").toLowerCase().includes(q) &&
        !(d.last_message || "").toLowerCase().includes(q)
      )
        return false;
      if (
        filterCol !== "__all__" &&
        columnIdOf(d.id, columns, placements) !== filterCol
      )
        return false;
      if (days && d.date && now.diff(dayjs(d.date), "day") >= days) return false;
      return true;
    });
  }, [dialogs, debouncedSearch, filterCol, dateFilter, columns, placements]);

  async function loadAccounts() {
    const a = await api.listAccounts();
    setAccounts(a);
    const tg = a.filter((x) => x.platform === "telegram_user");
    // если текущий аккаунт пропал (отключили) или ещё не выбран — берём первый
    setAccountId((cur) =>
      cur != null && tg.some((x) => x.id === cur) ? cur : tg[0]?.id ?? null,
    );
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadDialogs(id: number) {
    setLoadingDialogs(true);
    setHasMore(true);
    try {
      const first = await api.tgUserDialogs(id, DIALOG_PAGE, 0);
      setDialogs(first);
      setHasMore(first.length >= DIALOG_PAGE);
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoadingDialogs(false);
    }
  }

  // Подгрузка следующей страницы чатов (бесконечный скролл)
  async function loadMoreDialogs() {
    if (accountId == null || loadingMore || !hasMore || loadingDialogs) return;
    setLoadingMore(true);
    try {
      const next = await api.tgUserDialogs(accountId, DIALOG_PAGE, dialogs.length);
      if (next.length === 0) {
        setHasMore(false);
      } else {
        // защита от дублей по id
        setDialogs((prev) => {
          const seen = new Set(prev.map((d) => d.id));
          const fresh = next.filter((d) => !seen.has(d.id));
          return [...prev, ...fresh];
        });
        setHasMore(next.length >= DIALOG_PAGE);
      }
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoadingMore(false);
    }
  }

  // Загрузка канбан-доски (колонки + раскладка)
  async function loadBoard(id: number) {
    setBoardLoading(true);
    try {
      const b = await api.kanbanGet(id);
      if (b.columns && b.columns.length >= MIN_COLS) {
        // у старых досок цвета могло не быть — подставим из палитры
        setColumns(
          b.columns.map((c, i) => ({
            ...c,
            color: c.color ?? COLUMN_COLORS[i % COLUMN_COLORS.length],
          })),
        );
        setPlacements(b.placements || {});
      } else {
        const def = defaultColumns(t);
        setColumns(def);
        setPlacements({});
        try {
          await api.kanbanSetColumns(id, def);
        } catch {
          /* создастся при первом перемещении */
        }
      }
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setBoardLoading(false);
    }
  }

  function saveColumns(cols: KanbanColumn[]) {
    if (accountId == null) return;
    setColumns(cols);
    api
      .kanbanSetColumns(accountId, cols)
      .then((b) => setPlacements(b.placements || {}))
      .catch((e) =>
        notifications.show({ color: "red", message: (e as Error).message }),
      );
  }

  function movePlacement(dialogId: number, colId: string) {
    if (accountId == null) return;
    if (columnIdOf(dialogId, columns, placements) === colId) return; // та же колонка
    setPlacements((p) => ({ ...p, [String(dialogId)]: colId }));
    const title = columns.find((c) => c.id === colId)?.title ?? "";
    notifications.show({
      color: "teal",
      message: t("inbox.movedToColumn", { column: title }),
    });
    api
      .kanbanSetPlacement(accountId, String(dialogId), colId)
      .catch((e) =>
        notifications.show({ color: "red", message: (e as Error).message }),
      );
  }

  useEffect(() => {
    if (accountId != null) {
      loadDialogs(accountId);
      loadBoard(accountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    activeDialogRef.current = activeDialog;
  }, [activeDialog]);
  useEffect(() => {
    dialogsRef.current = dialogs;
  }, [dialogs]);

  // Real-time: живой поток новых сообщений (SSE) для текущего аккаунта.
  // Обновляет список чатов (превью/время/непрочитанные, поднимает наверх) и
  // дописывает сообщение в открытый чат — без поллинга и перезагрузки.
  useEffect(() => {
    if (accountId == null) return;
    const es = new EventSource(api.tgUserStreamUrl(accountId));
    es.onmessage = (e) => {
      let ev: {
        type: string;
        dialog_id: number;
        id: number;
        text?: string;
        out?: boolean;
        date?: string | null;
        media_type?: TgMessage["media_type"];
        max_id?: number;
        outbox?: boolean;
      };
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }

      // собеседник прочитал наши сообщения — мгновенно перекрашиваем галочки
      if (ev.type === "read") {
        if (
          ev.outbox &&
          activeDialogRef.current?.id === ev.dialog_id &&
          ev.max_id != null
        ) {
          const maxId = ev.max_id;
          setMessages((prev) =>
            prev.map((m) =>
              m.out && !m.read && m.id <= maxId ? { ...m, read: true } : m,
            ),
          );
        }
        return;
      }

      if (ev.type !== "message") return;
      const did = ev.dialog_id;
      const active = activeDialogRef.current?.id === did;
      const preview = ev.text || (ev.media_type ? "📎" : "");

      setDialogs((prev) => {
        const idx = prev.findIndex((d) => d.id === did);
        if (idx === -1) return prev; // чат не загружен в список — пропускаем
        const d = prev[idx];
        const updated: TgDialog = {
          ...d,
          last_message: preview || d.last_message,
          date: ev.date ?? d.date,
          unread: ev.out || active ? d.unread : d.unread + 1,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });

      if (active) {
        setMessages((prev) =>
          prev.some((m) => m.id === ev.id)
            ? prev
            : [
                ...prev,
                {
                  id: ev.id,
                  text: ev.text ?? "",
                  out: !!ev.out,
                  date: ev.date ?? null,
                  media_type: ev.media_type ?? null,
                },
              ],
        );
      }

      // уведомление: входящее сообщение в неактивном чате
      if (!ev.out && !active) {
        const d = dialogsRef.current.find((x) => x.id === did);
        notifyMessage({
          accountId,
          dialogId: did,
          name: d?.name || "Telegram",
          text: preview,
        });
      }
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function openDialog(d: TgDialog) {
    if (accountId == null) return;
    setActiveDialog(d);
    setMessages([]);
    setLoadingMsgs(true);
    try {
      setMessages(await api.tgUserMessages(accountId, d.id));
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function refreshMessages() {
    if (accountId == null || !activeDialog) return;
    setMessages(await api.tgUserMessages(accountId, activeDialog.id));
  }

  async function send() {
    if (accountId == null || !activeDialog || !draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    try {
      await api.tgUserSend(accountId, activeDialog.id, text);
      setDraft("");
      await refreshMessages();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  async function attachFile(file: File) {
    if (accountId == null || !activeDialog) return;
    setSending(true);
    try {
      const up = await api.uploadFile(file);
      await api.tgUserSend(accountId, activeDialog.id, draft.trim(), up.url);
      setDraft("");
      await refreshMessages();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  // нет подключённого аккаунта
  if (tgAccounts.length === 0) {
    return (
      <Box>
        <PageHeader title={t("inbox.title")} subtitle={t("inbox.subtitle")} />
        <Paper withBorder radius="lg">
          <EmptyState
            icon={<IconMessageChatbot size={32} />}
            title={t("inbox.emptyTitle")}
            description={t("inbox.emptyDesc")}
            action={
              <Button
                mt="sm"
                leftSection={<IconBrandTelegram size={16} />}
                onClick={() => setConnectOpen(true)}
              >
                {t("inbox.connectBtn")}
              </Button>
            }
          />
        </Paper>
        <ConnectModal
          opened={connectOpen}
          onClose={() => setConnectOpen(false)}
          onConnected={() => {
            setConnectOpen(false);
            loadAccounts();
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      style={
        isMobile
          ? undefined
          : {
              height: "calc(100vh - 92px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }
      }
    >
      <Group justify="space-between" mb="sm" style={{ flexShrink: 0 }} wrap="wrap" gap="sm">
        <SegmentedControl
          value={view}
          onChange={(v) => changeView(v as "chat" | "kanban")}
          data={[
            { value: "chat", label: t("inbox.tabChat") },
            { value: "kanban", label: t("inbox.tabKanban") },
          ]}
        />
        <Group gap="sm">
          {/* имя текущего аккаунта + переключение, если их несколько */}
          {tgAccounts.length > 1 ? (
            <Select
              size="xs"
              w={170}
              leftSection={<IconUserCircle size={15} />}
              data={tgAccounts.map((a) => ({
                value: String(a.id),
                label: a.display_name,
              }))}
              value={accountId ? String(accountId) : null}
              onChange={(v) => setAccountId(v ? Number(v) : null)}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
          ) : (
            currentAccount && (
              <Group gap={6} wrap="nowrap">
                <ThemeIcon variant="light" color="blue" size="sm" radius="xl">
                  <IconUserCircle size={15} />
                </ThemeIcon>
                <Text fz="sm" fw={600} lineClamp={1} maw={160}>
                  {currentAccount.display_name}
                </Text>
              </Group>
            )
          )}
          {view === "kanban" && (
            <>
              <Button
                size="xs"
                variant="light"
                color="grape"
                leftSection={<IconSpeakerphone size={14} />}
                onClick={() => setBroadcastOpen(true)}
              >
                {t("inbox.broadcast")}
              </Button>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconSettings size={14} />}
                onClick={() => setKanbanSettingsOpen(true)}
              >
                {t("inbox.settings")}
              </Button>
            </>
          )}
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setConnectOpen(true)}
          >
            {t("inbox.accountBtn")}
          </Button>
          <ActionIcon
            size={30}
            variant="default"
            onClick={() => setAccountSettingsOpen(true)}
            aria-label={t("inbox.accountSettings")}
          >
            <IconSettings2 size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Панель поиска и фильтров (общая для обоих табов) */}
      <Group mb="md" gap="sm" wrap="wrap" style={{ flexShrink: 0 }}>
        <TextInput
          flex={1}
          miw={180}
          size="xs"
          placeholder={t("inbox.searchPh")}
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Select
          size="xs"
          w={170}
          value={filterCol}
          onChange={(v) => setFilterCol(v ?? "__all__")}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          data={[
            { value: "__all__", label: t("inbox.allColumns") },
            ...columns.map((c) => ({ value: c.id, label: c.title })),
          ]}
          renderOption={({ option }) => {
            const col = columns.find((c) => c.id === option.value);
            return (
              <Group gap={8} wrap="nowrap">
                <Box
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: col?.color ?? "transparent",
                    border: col ? "none" : "1px solid var(--mantine-color-gray-4)",
                    flexShrink: 0,
                  }}
                />
                <Text fz="sm">{option.label}</Text>
              </Group>
            );
          }}
        />
        <Select
          size="xs"
          w={140}
          value={dateFilter}
          onChange={(v) => setDateFilter(v ?? "all")}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          data={[
            { value: "all", label: t("inbox.dateAll") },
            { value: "today", label: t("inbox.dateToday") },
            { value: "7d", label: t("inbox.date7d") },
            { value: "30d", label: t("inbox.date30d") },
          ]}
        />
      </Group>

      {view === "kanban" ? (
        accountId != null && (
          <Box
            key={`kanban-${accountId}`}
            style={
              isMobile
                ? { minHeight: 400, animation: "pwFade 220ms ease" }
                : {
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    animation: "pwFade 220ms ease",
                  }
            }
          >
            <InboxKanban
              accountId={accountId}
              dialogs={filteredDialogs}
              columns={columns}
              placements={placements}
              loading={loadingDialogs || boardLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMoreDialogs}
              onMove={movePlacement}
              onSaveColumns={saveColumns}
              onOpenChat={(d) => {
                openDialog(d);
                setKanbanChatOpen(true);
              }}
              settingsOpen={kanbanSettingsOpen}
              onSettingsClose={() => setKanbanSettingsOpen(false)}
            />
          </Box>
        )
      ) : (

      <Paper
        withBorder
        radius="lg"
        key={`chat-${accountId}`}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
          animation: "pwFade 220ms ease",
        }}
      >
        {/* Список диалогов */}
        <Box
          style={{
            width: isMobile ? "100%" : 320,
            borderRight: "1px solid var(--mantine-color-gray-3)",
            display: isMobile && activeDialog ? "none" : "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {loadingDialogs ? (
            <Stack gap={0} p="xs">
              {Array.from({ length: 8 }).map((_, i) => (
                <Group key={i} gap="sm" wrap="nowrap" p="xs">
                  <Skeleton circle height={38} />
                  <Stack gap={6} style={{ flex: 1 }}>
                    <Skeleton height={9} width="55%" radius="sm" />
                    <Skeleton height={8} width="80%" radius="sm" />
                  </Stack>
                </Group>
              ))}
            </Stack>
          ) : (
            <ScrollArea
              style={{ flex: 1 }}
              type="auto"
              onScrollPositionChange={({ y }) => {
                const vp = dialogViewportRef.current;
                if (vp && vp.scrollHeight - vp.clientHeight - y < 240)
                  loadMoreDialogs();
              }}
              viewportRef={dialogViewportRef}
            >
              {filteredDialogs.map((d) => (
                <DialogRow
                  key={d.id}
                  dialog={d}
                  active={activeDialog?.id === d.id}
                  avatarUrl={
                    accountId != null
                      ? api.tgUserAvatarUrl(accountId, d.id)
                      : undefined
                  }
                  dotColor={colorOf(d.id, columns, placements)}
                  onClick={() => openDialog(d)}
                />
              ))}
              {loadingMore && (
                <Center py="sm">
                  <Loader size="xs" />
                </Center>
              )}
              {filteredDialogs.length === 0 && (
                <Text c="dimmed" fz="sm" ta="center" mt="xl">
                  {dialogs.length === 0 ? t("inbox.noDialogs") : t("inbox.nothingFound")}
                </Text>
              )}
            </ScrollArea>
          )}
        </Box>

        {/* Переписка */}
        <Box
          style={{
            flex: 1,
            display: isMobile && !activeDialog ? "none" : "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {!activeDialog || accountId == null ? (
            <Center h="100%">
              <Text c="dimmed" fz="sm">
                {t("inbox.selectDialog")}
              </Text>
            </Center>
          ) : (
            <Conversation
              accountId={accountId}
              dialog={activeDialog}
              messages={messages}
              loading={loadingMsgs}
              draft={draft}
              onDraftChange={setDraft}
              sending={sending}
              onSend={send}
              onAttach={attachFile}
              showBack={isMobile}
              onBack={() => setActiveDialog(null)}
              onHeaderClick={() => setProfileOpen(true)}
            />
          )}
        </Box>
      </Paper>
      )}

      <ConnectModal
        opened={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          setConnectOpen(false);
          loadAccounts();
        }}
      />

      {accountId != null && (
        <BroadcastModal
          opened={broadcastOpen}
          onClose={() => setBroadcastOpen(false)}
          accountId={accountId}
          accountName={currentAccount?.display_name}
          columns={columns}
        />
      )}

      <AccountSettings
        opened={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
        accounts={tgAccounts}
        currentId={accountId}
        onSwitch={(id) => setAccountId(id)}
        onAdd={() => setConnectOpen(true)}
        onChanged={() => {
          loadAccounts();
        }}
      />

      {/* Выезжающая панель чата в канбане (плавно, как модалка) */}
      <Drawer
        opened={kanbanChatOpen && activeDialog != null && accountId != null}
        onClose={() => setKanbanChatOpen(false)}
        position="right"
        size={isMobile ? "100%" : 460}
        withCloseButton={false}
        overlayProps={{ opacity: 0.35, blur: 1 }}
        styles={{
          content: { display: "flex", flexDirection: "column" },
          body: { flex: 1, minHeight: 0, padding: 0, display: "flex", flexDirection: "column" },
        }}
      >
        {activeDialog != null && accountId != null && (
          <Conversation
            accountId={accountId}
            dialog={activeDialog}
            messages={messages}
            loading={loadingMsgs}
            draft={draft}
            onDraftChange={setDraft}
            sending={sending}
            onSend={send}
            onAttach={attachFile}
            showBack
            onBack={() => setKanbanChatOpen(false)}
            onHeaderClick={() => setProfileOpen(true)}
          />
        )}
      </Drawer>

      {accountId != null && activeDialog != null && (
        <ProfileModal
          opened={profileOpen}
          onClose={() => setProfileOpen(false)}
          accountId={accountId}
          dialog={activeDialog}
        />
      )}
    </Box>
  );
}

function DialogRow({
  dialog,
  active,
  avatarUrl,
  dotColor,
  onClick,
}: {
  dialog: TgDialog;
  active: boolean;
  avatarUrl?: string;
  dotColor?: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Group
      gap="sm"
      p="sm"
      wrap="nowrap"
      onClick={onClick}
      className="pw-dialog-row"
      data-active={active || undefined}
      style={{
        cursor: "pointer",
        // цветная полоска слева = статус-колонка чата в канбане
        borderLeft: `3px solid ${dotColor ?? "transparent"}`,
        borderBottom: "1px solid var(--border-1)",
      }}
    >
      <Box style={{ position: "relative", flexShrink: 0 }}>
        <ChatAvatar
          src={avatarUrl}
          name={dialog.name}
          color={dialog.is_user ? "blue" : "grape"}
          size={44}
        />
        {dialog.online && (
          <Box
            aria-label="online"
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#37d67a",
              border: "2px solid var(--mantine-color-body)",
            }}
          />
        )}
      </Box>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6} wrap="nowrap">
          {dotColor && (
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: dotColor,
                flexShrink: 0,
              }}
            />
          )}
          <Text fw={600} fz="sm" lineClamp={1}>
            {dialog.name || t("inbox.noName")}
          </Text>
        </Group>
        <Text c="dimmed" fz="xs" lineClamp={1}>
          {dialog.last_message || "—"}
        </Text>
      </Box>
      {dialog.unread > 0 && (
        <Badge size="sm" circle variant="filled" color="brand">
          {dialog.unread}
        </Badge>
      )}
    </Group>
  );
}

/* ---------------- Подключение аккаунта (телефон → код → 2FA) ---------------- */
function ConnectModal({
  opened,
  onClose,
  onConnected,
}: {
  opened: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep("phone");
    setPhone("");
    setCode("");
    setPassword("");
    setLoginId("");
  }

  async function startLogin() {
    setLoading(true);
    try {
      const r = await api.tgUserLoginStart(phone.trim());
      setLoginId(r.login_id);
      setStep("code");
      notifications.show({ color: "blue", message: t("inbox.codeSentToast") });
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    setLoading(true);
    try {
      const r = await api.tgUserLoginCode(loginId, code.trim());
      if (r.status === "password_needed") {
        setStep("password");
        notifications.show({ color: "blue", message: t("inbox.twofaToast") });
      } else {
        notifications.show({ color: "teal", message: t("inbox.connectedToast") });
        reset();
        onConnected();
      }
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword() {
    setLoading(true);
    try {
      await api.tgUserLoginPassword(loginId, password);
      notifications.show({ color: "teal", message: t("inbox.connectedToast") });
      reset();
      onConnected();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {
        reset();
        onClose();
      }}
      title={
        <Group gap={8}>
          <ThemeIcon variant="light" color="blue" radius="md">
            <IconBrandTelegram size={18} />
          </ThemeIcon>
          <Text fw={700}>{t("inbox.connectModalTitle")}</Text>
        </Group>
      }
      radius="lg"
    >
      <Stack>
        {step === "phone" && (
          <>
            <Text fz="sm" c="dimmed">
              {t("inbox.phoneHint")}
            </Text>
            <TextInput
              label={t("inbox.phoneLabel")}
              placeholder={t("inbox.phonePh")}
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
            />
            <Button
              loading={loading}
              onClick={startLogin}
              disabled={phone.trim().length < 6}
            >
              {t("inbox.getCode")}
            </Button>
          </>
        )}
        {step === "code" && (
          <>
            <Text fz="sm" c="dimmed">
              {t("inbox.codeHint")}
            </Text>
            <TextInput
              label={t("inbox.codeLabel")}
              placeholder={t("inbox.codePh")}
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
            />
            <Button loading={loading} onClick={submitCode} disabled={!code.trim()}>
              {t("inbox.confirm")}
            </Button>
          </>
        )}
        {step === "password" && (
          <>
            <Text fz="sm" c="dimmed">
              {t("inbox.passwordHint")}
            </Text>
            <PasswordInput
              label={t("inbox.passwordLabel")}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Button
              loading={loading}
              onClick={submitPassword}
              disabled={!password}
            >
              {t("inbox.login")}
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
