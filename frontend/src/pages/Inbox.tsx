import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Group,
  Stack,
  Text,
  Button,
  TextInput,
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
  Popover,
  UnstyledButton,
  Menu,
} from "@mantine/core";
import { useMediaQuery, useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBrandTelegram,
  IconBrandInstagram,
  IconBrandFacebook,
  IconBrandThreads,
  IconPlus,
  IconMessageChatbot,
  IconPencil,
  IconSearch,
  IconSettings2,
  IconSpeakerphone,
  IconFilter,
  IconCheck,
  IconLayoutGrid,
  IconChevronDown,
  IconBellOff,
  IconArchive,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { notifyMessage } from "../notify";
import type { Account, KanbanColumn, Network, TgDialog, TgMessage } from "../api/types";
import { PageHeader, EmptyState } from "../components/ui";
import { InboxKanban } from "../components/InboxKanban";
import { ChatAvatar } from "../components/ChatAvatar";
import { Conversation } from "../components/Conversation";
import { InstagramConversation } from "../components/InstagramConversation";
import { TelegramUserLogin } from "../components/TelegramUserLogin";

// Стабильный отрицательный числовой id из igsid (строки) — для ключей React и
// раскладки канбана (placements хранятся по id). Отрицательный — чтобы не
// пересекаться с положительными Telegram-id.
function igNumId(igsid: string): number {
  let h = 0;
  for (let i = 0; i < igsid.length; i++) h = (h * 31 + igsid.charCodeAt(i)) | 0;
  return -Math.abs(h) - 1;
}
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

/* Каталог соцсетей инбокса (лого + бренд-цвет). */
interface SocialMeta {
  id: Network;
  label: string;
  Icon: typeof IconBrandTelegram;
  color: string;
}
const SOCIALS: SocialMeta[] = [
  { id: "telegram", label: "Telegram", Icon: IconBrandTelegram, color: "#229ED9" },
  { id: "instagram", label: "Instagram", Icon: IconBrandInstagram, color: "#E4405F" },
  { id: "facebook", label: "Facebook", Icon: IconBrandFacebook, color: "#1877F2" },
  { id: "threads", label: "Threads", Icon: IconBrandThreads, color: "var(--mantine-color-text)" },
];

/* Переключатель соцсетей: icon-only стеклянная кнопка с лого активной сети,
   по клику вниз раскрывается поповер. Показываются только ПОДКЛЮЧЁННЫЕ сети. */
function SocialSwitcher({
  networks,
  value,
  onChange,
}: {
  networks: SocialMeta[];
  value: Network;
  onChange: (n: Network) => void;
}) {
  const [opened, setOpened] = useState(false);
  const current = networks.find((s) => s.id === value) ?? networks[0];
  if (!current) return null;
  const CurrentIcon = current.Icon;

  function pick(id: Network) {
    onChange(id);
    setOpened(false);
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      offset={10}
      withinPortal
      transitionProps={{ transition: "pop-top-left", duration: 180 }}
      classNames={{ dropdown: "pw-social-pop" }}
    >
      <Popover.Target>
        <UnstyledButton
          className="pw-social-trigger"
          data-opened={opened || undefined}
          onClick={() => setOpened((o) => !o)}
          aria-label={`Social network: ${current.label}`}
        >
          <CurrentIcon size={20} color={current.color} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={4} align="center">
          {networks.map((s, i) => {
            const Icon = s.Icon;
            const isActive = s.id === current.id;
            return (
              <UnstyledButton
                key={s.id}
                className="pw-social-item"
                data-active={isActive || undefined}
                onClick={() => pick(s.id)}
                aria-label={s.label}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <Icon size={20} color={s.color} />
              </UnstyledButton>
            );
          })}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/* Переключатель аккаунтов текущей сети: кнопка с именем аккаунта + стеклянный
   popup (в стиле переключателя соцсетей) со списком аккаунтов этой сети. */
function AccountSwitcher({
  network,
  accounts,
  currentId,
  onPick,
  onAdd,
}: {
  network: Network;
  accounts: Account[];
  currentId: number | null;
  onPick: (id: number) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const meta = SOCIALS.find((s) => s.id === network) ?? SOCIALS[0];
  const Icon = meta.Icon;
  const current = accounts.find((a) => a.id === currentId) ?? accounts[0];

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      offset={10}
      withinPortal
      transitionProps={{ transition: "pop-top-right", duration: 180 }}
      classNames={{ dropdown: "pw-acc-pop" }}
    >
      <Popover.Target>
        <UnstyledButton
          className="pw-acc-trigger"
          data-opened={opened || undefined}
          onClick={() => setOpened((o) => !o)}
        >
          <Icon size={16} color={meta.color} />
          <span className="pw-acc-trigger-name">
            {current?.display_name ?? "—"}
          </span>
          <IconChevronDown size={13} className="pw-acc-caret" />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={3}>
          {accounts.map((a, i) => (
            <UnstyledButton
              key={a.id}
              className="pw-acc-item"
              data-active={a.id === current?.id || undefined}
              onClick={() => {
                onPick(a.id);
                setOpened(false);
              }}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="pw-acc-chip" style={{ color: meta.color }}>
                <Icon size={16} />
              </span>
              <span className="pw-acc-name">{a.display_name}</span>
              {a.id === current?.id && <IconCheck size={15} className="pw-acc-check" />}
            </UnstyledButton>
          ))}
          <UnstyledButton
            className="pw-acc-item pw-acc-add"
            onClick={() => {
              onAdd();
              setOpened(false);
            }}
          >
            <span className="pw-acc-chip">
              <IconPlus size={15} />
            </span>
            <span className="pw-acc-name">{t("inbox.accountBtn")}</span>
          </UnstyledButton>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

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
  const [archiveOpen, setArchiveOpen] = useState(false);
  // выезжающая панель чата в табе «Канбан»
  const [kanbanChatOpen, setKanbanChatOpen] = useState(false);
  // активная соцсеть инбокса (показываем только подключённые)
  const [network, setNetwork] = useState<Network>(
    () => (localStorage.getItem("postwave_inbox_social") as Network) || "telegram",
  );
  // выбранный Instagram-диалог (таб «Чат» и дровер канбана)
  const [activeIg, setActiveIg] = useState<TgDialog | null>(null);
  // выбранный Instagram-аккаунт (если их несколько)
  const [igAccountId, setIgAccountId] = useState<number | null>(null);
  // диалоги Instagram (реальные, из API)
  const [igDialogs, setIgDialogs] = useState<TgDialog[]>([]);
  // для уведомлений: предыдущие счётчики непрочитанных по igsid + открытый IG-чат
  const igPrevUnread = useRef<Record<string, number> | null>(null);
  const activeIgRef = useRef<TgDialog | null>(null);
  // фильтр канбана по аккаунту: "all" — все подключённые, иначе id аккаунта
  const [kanbanAccount, setKanbanAccount] = useState<"all" | number>("all");

  function changeView(v: "chat" | "kanban") {
    setView(v);
    localStorage.setItem("postwave_inbox_view", v);
  }

  function changeNetwork(n: Network) {
    setNetwork(n);
    localStorage.setItem("postwave_inbox_social", n);
    setActiveIg(null);
    setActiveDialog(null);
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

  // Какие сети подключены (есть аккаунт). Telegram — по telegram_user, IG — по instagram.
  const connected = useMemo(() => {
    const set = new Set<Network>();
    if (accounts.some((a) => a.platform === "telegram_user")) set.add("telegram");
    if (accounts.some((a) => a.platform === "instagram")) set.add("instagram");
    return set;
  }, [accounts]);
  const connectedNetworks = useMemo(
    () => SOCIALS.filter((s) => connected.has(s.id)),
    [connected]
  );
  const igAccounts = useMemo(
    () => accounts.filter((a) => a.platform === "instagram"),
    [accounts]
  );
  const igAccount = useMemo(
    () =>
      igAccounts.find((a) => a.id === igAccountId) ?? igAccounts[0] ?? null,
    [igAccounts, igAccountId]
  );

  useEffect(() => {
    activeIgRef.current = activeIg;
  }, [activeIg]);

  // Загрузка реальных IG-диалогов + поллинг (вебхук доставляет асинхронно).
  // При росте непрочитанных в неоткрытом чате — тост-уведомление (как в Telegram).
  useEffect(() => {
    if (!igAccount) {
      setIgDialogs([]);
      igPrevUnread.current = null;
      return;
    }
    const accId = igAccount.id;
    let alive = true;
    const load = () =>
      api
        .igDialogs(accId)
        .then((rows) => {
          if (!alive) return;
          const mapped = rows.map((d) => ({
            id: igNumId(d.igsid),
            igsid: d.igsid,
            name: d.name || d.igsid,
            is_user: true,
            is_group: false,
            is_channel: false,
            unread: d.unread,
            last_message: d.last_message,
            date: d.date,
            network: "instagram" as const,
          }));
          setIgDialogs(mapped);

          // уведомления: только если это не первая загрузка
          const prev = igPrevUnread.current;
          if (prev) {
            for (const d of mapped) {
              const before = prev[d.igsid] ?? 0;
              const open = activeIgRef.current?.igsid === d.igsid;
              if (d.unread > before && !open) {
                notifyMessage({
                  accountId: accId,
                  dialogId: d.id,
                  name: d.name,
                  text: d.last_message,
                  avatarUrl: null,
                });
              }
            }
          }
          igPrevUnread.current = Object.fromEntries(
            mapped.map((d) => [d.igsid, d.unread])
          );
        })
        .catch(() => {});
    load();
    const tm = setInterval(load, 7000);
    return () => {
      alive = false;
      clearInterval(tm);
    };
  }, [igAccount]);
  // если сохранённая сеть не подключена — переключаемся на первую подключённую
  useEffect(() => {
    if (connectedNetworks.length && !connected.has(network)) {
      changeNetwork(connectedNetworks[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedNetworks]);

  // Предикат поиска/фильтров — общий для Telegram и Instagram
  const matchDialog = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const now = dayjs();
    const days =
      dateFilter === "today" ? 1 : dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 0;
    return (d: TgDialog) => {
      if (
        q &&
        !(d.name || "").toLowerCase().includes(q) &&
        !(d.last_message || "").toLowerCase().includes(q)
      )
        return false;
      if (filterCol !== "__all__" && columnIdOf(d.id, columns, placements) !== filterCol)
        return false;
      if (days && d.date && now.diff(dayjs(d.date), "day") >= days) return false;
      return true;
    };
  }, [debouncedSearch, filterCol, dateFilter, columns, placements]);

  const tgFiltered = useMemo(() => dialogs.filter(matchDialog), [dialogs, matchDialog]);
  const igFiltered = useMemo(
    () => (connected.has("instagram") ? igDialogs.filter(matchDialog) : []),
    [connected, igDialogs, matchDialog]
  );
  // Канбан — оба (по подключённым сетям) с фильтром по сети. Таб «Чат» берёт
  // tgFiltered/igFiltered напрямую.
  const kanbanDialogs = useMemo(() => {
    const merged = [...(connected.has("telegram") ? tgFiltered : []), ...igFiltered];
    if (kanbanAccount === "all") return merged;
    const acc = accounts.find((a) => a.id === kanbanAccount);
    if (!acc) return merged;
    const net: Network = acc.platform === "instagram" ? "instagram" : "telegram";
    return merged.filter((d) => (d.network ?? "telegram") === net);
  }, [connected, tgFiltered, igFiltered, kanbanAccount, accounts]);

  // Выбор аккаунта в фильтре канбана: переключаем активный аккаунт нужной сети,
  // чтобы подгрузились его диалоги.
  function pickKanbanAccount(val: "all" | number) {
    setKanbanAccount(val);
    if (val === "all") return;
    const acc = accounts.find((a) => a.id === val);
    if (!acc) return;
    if (acc.platform === "telegram_user") setAccountId(val);
    else if (acc.platform === "instagram") setIgAccountId(val);
  }

  async function loadAccounts() {
    const a = await api.listAccounts();
    setAccounts(a);
    const tg = a.filter((x) => x.platform === "telegram_user");
    // если текущий аккаунт пропал (отключили) или ещё не выбран — берём первый
    setAccountId((cur) =>
      cur != null && tg.some((x) => x.id === cur) ? cur : tg[0]?.id ?? null,
    );
    const ig = a.filter((x) => x.platform === "instagram");
    setIgAccountId((cur) =>
      cur != null && ig.some((x) => x.id === cur) ? cur : ig[0]?.id ?? null,
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
      // Авто-обновление нетронутой дефолт-доски до актуальной воронки.
      // Узнаём дефолт по набору id (старый и текущий) и переносим названия/цвета,
      // не трогая раскладку (id чатов ремапятся со старых на новые).
      const DEFAULT_SIGNATURES = [
        ["all", "interested", "ordering", "ordered"], // самый старый
        ["new", "interested", "invoice", "paid"], // воронка
      ];
      const ID_MAP: Record<string, string> = {
        all: "new",
        ordering: "invoice",
        ordered: "paid",
      };
      const ids = (b.columns || []).map((c) => c.id);
      const isKnownDefault = DEFAULT_SIGNATURES.some(
        (sig) => sig.length === ids.length && sig.every((x, i) => x === ids[i]),
      );

      if (isKnownDefault) {
        const def = defaultColumns(t);
        const remapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(b.placements || {})) {
          remapped[k] = ID_MAP[v] ?? v;
        }
        setColumns(def);
        setPlacements(remapped);
        // пишем в БД только если колонки реально поменялись (иначе лишний запрос)
        if (JSON.stringify(b.columns) !== JSON.stringify(def)) {
          try {
            await api.kanbanSetColumns(id, def, remapped);
          } catch {
            /* не критично — применится при следующем сохранении */
          }
        }
      } else if (b.columns && b.columns.length >= MIN_COLS) {
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
    // оптимистично показываем сообщение сразу (с часиками), id временный
    const tempId = -Date.now();
    setMessages((ms) => [
      ...ms,
      {
        id: tempId,
        text,
        out: true,
        date: new Date().toISOString(),
        media_type: null,
        read: false,
        pending: true,
      },
    ]);
    setDraft("");
    try {
      await api.tgUserSend(accountId, activeDialog.id, text);
      await refreshMessages();
    } catch (e) {
      // не удалось — убираем оптимистичное и возвращаем текст
      setMessages((ms) => ms.filter((m) => m.id !== tempId));
      setDraft(text);
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

  // нет ни одной подключённой сети инбокса
  if (connectedNetworks.length === 0) {
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

  // Панель поиска и фильтров — общая для обоих табов. В чате стоит сверху,
  // в канбане прокручивается вместе с доской (передаётся внутрь скролла).
  const filtersPanel = (
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
  );

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
        <Group gap="sm" wrap="nowrap">
          {connectedNetworks.length > 0 && (
            <SocialSwitcher
              networks={connectedNetworks}
              value={network}
              onChange={changeNetwork}
            />
          )}
          <SegmentedControl
            value={view}
            onChange={(v) => changeView(v as "chat" | "kanban")}
            data={[
              { value: "chat", label: t("inbox.tabChat") },
              { value: "kanban", label: t("inbox.tabKanban") },
            ]}
          />
        </Group>
        <Group gap="sm">
          {/* кнопка с именем аккаунта текущей сети + popup со списком аккаунтов */}
          <AccountSwitcher
            network={network}
            accounts={network === "instagram" ? igAccounts : tgAccounts}
            currentId={network === "instagram" ? igAccountId : accountId}
            onPick={network === "instagram" ? setIgAccountId : setAccountId}
            onAdd={() => {
              if (network === "instagram") {
                api
                  .instagramOAuthStart()
                  .then(({ url }) => {
                    window.location.href = url;
                  })
                  .catch((e) =>
                    notifications.show({ color: "red", message: (e as Error).message })
                  );
              } else {
                setConnectOpen(true);
              }
            }}
          />
          {/* Рассылка — доступна в обоих табах (чат и канбан) */}
          <Button
            size="xs"
            variant="light"
            color="grape"
            leftSection={<IconSpeakerphone size={14} />}
            onClick={() => setBroadcastOpen(true)}
          >
            {t("inbox.broadcast")}
          </Button>
          {view === "kanban" && (
            <Menu shadow="md" width={220} position="bottom-end" withinPortal>
              <Menu.Target>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconFilter size={14} />}
                >
                  {kanbanAccount === "all"
                    ? t("inbox.filterAllAccounts")
                    : accounts.find((a) => a.id === kanbanAccount)?.display_name ??
                      t("inbox.filterAllAccounts")}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconLayoutGrid size={16} />}
                  rightSection={kanbanAccount === "all" ? <IconCheck size={14} /> : null}
                  onClick={() => pickKanbanAccount("all")}
                >
                  {t("inbox.filterAllAccounts")}
                </Menu.Item>
                {[...tgAccounts, ...igAccounts].map((a) => {
                  const meta = SOCIALS.find(
                    (s) =>
                      s.id ===
                      (a.platform === "instagram" ? "instagram" : "telegram")
                  )!;
                  const Icon = meta.Icon;
                  return (
                    <Menu.Item
                      key={a.id}
                      leftSection={<Icon size={16} color={meta.color} />}
                      rightSection={
                        kanbanAccount === a.id ? <IconCheck size={14} /> : null
                      }
                      onClick={() => pickKanbanAccount(a.id)}
                    >
                      {a.display_name}
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          )}
          {view === "kanban" && (
            <Button
              size="xs"
              variant="default"
              leftSection={<IconPencil size={14} />}
              onClick={() => setKanbanSettingsOpen(true)}
            >
              {t("inbox.editColumns")}
            </Button>
          )}
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

      {/* В чате панель фильтров сверху; в канбане — внутри скролла доски */}
      {view !== "kanban" && filtersPanel}

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
              dialogs={kanbanDialogs}
              columns={columns}
              placements={placements}
              topSlot={filtersPanel}
              loading={loadingDialogs || boardLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMoreDialogs}
              onMove={movePlacement}
              onSaveColumns={saveColumns}
              onOpenChat={(d) => {
                // IG-диалог открываем без загрузки TG-сообщений
                if (d.network === "instagram") setActiveDialog(d);
                else openDialog(d);
                setKanbanChatOpen(true);
              }}
              settingsOpen={kanbanSettingsOpen}
              onSettingsClose={() => setKanbanSettingsOpen(false)}
            />
          </Box>
        )
      ) : network === "instagram" ? (
        /* ===== Таб «Чат»: Instagram (демо) ===== */
        <Paper
          withBorder
          radius="lg"
          key="chat-ig"
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            overflow: "hidden",
            animation: "pwFade 220ms ease",
          }}
        >
          <Box
            style={{
              width: isMobile ? "100%" : 320,
              borderRight: "1px solid var(--mantine-color-gray-3)",
              display: isMobile && activeIg ? "none" : "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <ScrollArea style={{ flex: 1 }} type="auto">
              {igFiltered.map((d) => (
                <DialogRow
                  key={d.id}
                  dialog={d}
                  active={activeIg?.id === d.id}
                  avatarUrl={d.avatar_url}
                  dotColor={colorOf(d.id, columns, placements)}
                  onClick={() => setActiveIg(d)}
                />
              ))}
              {igFiltered.length === 0 && (
                <Text c="dimmed" fz="sm" ta="center" mt="xl">
                  {t("inbox.nothingFound")}
                </Text>
              )}
            </ScrollArea>
          </Box>
          <Box
            style={{
              flex: 1,
              display: isMobile && !activeIg ? "none" : "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {!activeIg || !igAccount ? (
              <Center h="100%">
                <Text c="dimmed" fz="sm">
                  {t("inbox.selectDialog")}
                </Text>
              </Center>
            ) : (
              <InstagramConversation
                accountId={igAccount.id}
                dialog={activeIg}
                showBack={isMobile}
                onBack={() => setActiveIg(null)}
              />
            )}
          </Box>
        </Paper>
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
              {/* Архив — отдельным блоком сверху, раскрывается по клику */}
              {tgFiltered.some((d) => d.archived) && (
                <>
                  <Group
                    gap="sm"
                    p="sm"
                    wrap="nowrap"
                    className="pw-dialog-row"
                    onClick={() => setArchiveOpen((o) => !o)}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-1)",
                    }}
                  >
                    <ThemeIcon variant="light" color="gray" radius="xl" size={44}>
                      <IconArchive size={20} />
                    </ThemeIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} fz="sm">
                        {t("inbox.archive")}
                      </Text>
                      <Text c="dimmed" fz="xs">
                        {t("inbox.archiveCount", {
                          count: tgFiltered.filter((d) => d.archived).length,
                        })}
                      </Text>
                    </Box>
                    <IconChevronDown
                      size={16}
                      style={{
                        color: "var(--mantine-color-dimmed)",
                        transform: archiveOpen ? "rotate(180deg)" : "none",
                        transition: "transform 160ms ease",
                      }}
                    />
                  </Group>
                  {archiveOpen &&
                    tgFiltered
                      .filter((d) => d.archived)
                      .map((d) => (
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
                </>
              )}

              {/* Основные чаты (не в архиве) */}
              {tgFiltered
                .filter((d) => !d.archived)
                .map((d) => (
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
              {tgFiltered.length === 0 && (
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
        accounts={[...tgAccounts, ...igAccounts]}
        currentIds={[accountId, igAccountId].filter(
          (x): x is number => x != null
        )}
        onSwitch={(acc) => {
          if (acc.platform === "instagram") setIgAccountId(acc.id);
          else setAccountId(acc.id);
        }}
        onChanged={() => {
          loadAccounts();
        }}
      />

      {/* Выезжающая панель чата в канбане (плавно, как модалка) */}
      <Drawer
        opened={kanbanChatOpen && activeDialog != null}
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
        {activeDialog != null &&
          (activeDialog.network === "instagram" ? (
            igAccount && (
              <InstagramConversation
                accountId={igAccount.id}
                dialog={activeDialog}
                showBack
                onBack={() => setKanbanChatOpen(false)}
              />
            )
          ) : accountId != null ? (
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
          ) : null)}
      </Drawer>

      {accountId != null &&
        activeDialog != null &&
        activeDialog.network !== "instagram" && (
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
          {dialog.muted && (
            <IconBellOff
              size={13}
              style={{ color: "var(--mantine-color-dimmed)", flexShrink: 0 }}
            />
          )}
        </Group>
        <Text c="dimmed" fz="xs" lineClamp={1}>
          {dialog.last_message || "—"}
        </Text>
      </Box>
      {dialog.unread > 0 && (
        // у замьюченных чатов бейдж серый (как в Telegram)
        <Badge size="sm" circle variant="filled" color={dialog.muted ? "gray" : "brand"}>
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
  return (
    <Modal
      opened={opened}
      onClose={onClose}
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
      {/* монтируем заново на каждое открытие — свежий QR */}
      {opened && (
        <TelegramUserLogin
          onConnected={() => {
            onConnected();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
