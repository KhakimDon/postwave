import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Group,
  Popover,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Transition,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconClock,
  IconMoodSmile,
  IconPaperclip,
  IconScript,
  IconSearch,
  IconSend,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { TgDialog, TgMessage, TgStatus } from "../api/types";
import { ChatAvatar } from "./ChatAvatar";
import { AudioPlayer } from "./AudioPlayer";
import { Lightbox } from "./Lightbox";
import { EmojiPanel } from "./EmojiPanel";
import { useScripts } from "../scripts";

/** Панель переписки (шапка + сообщения + ввод). Используется и в табе «Чат»,
 *  и в выезжающей панели канбана. Состояние живёт в Inbox, сюда приходит пропсами. */
export function Conversation({
  accountId,
  dialog,
  messages,
  loading,
  draft,
  onDraftChange,
  sending,
  onSend,
  onAttach,
  showBack,
  onBack,
  onHeaderClick,
}: {
  accountId: number;
  dialog: TgDialog;
  messages: TgMessage[];
  loading: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  onAttach: (file: File) => void;
  showBack?: boolean;
  onBack?: () => void;
  onHeaderClick?: () => void;
}) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lb, setLb] = useState<{ images: string[]; index: number } | null>(null);
  const scripts = useScripts();
  const [scriptsOpen, setScriptsOpen] = useState(false);

  // прокрутка: отслеживаем, у нижней ли границы пользователь
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const switchedRef = useRef(true);

  // поиск по сообщениям внутри чата
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const vp = viewportRef.current;
    if (vp) vp.scrollTo({ top: vp.scrollHeight, behavior });
    else bottomRef.current?.scrollIntoView();
  }

  // при смене диалога — мгновенно вниз; при новых сообщениях — только если уже внизу
  useEffect(() => {
    switchedRef.current = true;
    setSearchOpen(false);
    setQuery("");
  }, [dialog.id]);
  useEffect(() => {
    if (switchedRef.current) {
      scrollToBottom("auto");
      switchedRef.current = false;
    } else if (atBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  // отфильтрованные сообщения при активном поиске
  const q = query.trim().toLowerCase();
  const shownMessages =
    searchOpen && q
      ? messages.filter((m) => (m.text || "").toLowerCase().includes(q))
      : messages;

  function insertScript(text: string) {
    onDraftChange(draft.trim() ? `${draft} ${text}` : text);
    setScriptsOpen(false);
  }

  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  function insertEmoji(e: string) {
    onDraftChange(draft + e);
  }

  // последняя активность собеседника (под именем в шапке)
  const [status, setStatus] = useState<TgStatus | null>(null);
  useEffect(() => {
    let alive = true;
    setStatus(null);
    const load = () =>
      api
        .tgUserPresence(accountId, dialog.id)
        .then((s) => alive && setStatus(s))
        .catch(() => {});
    load();
    const tm = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(tm);
    };
  }, [accountId, dialog.id]);
  const presence = formatPresence(status, t);

  // Открыть картинку на весь экран. Альбом (одинаковый grouped_id) — как слайдер.
  function openImage(msg: TgMessage) {
    const isImg = (m: TgMessage) =>
      m.media_type === "photo" || m.media_type === "sticker";
    const group =
      msg.grouped_id != null
        ? messages.filter((m) => m.grouped_id === msg.grouped_id && isImg(m))
        : [msg];
    const imgs = group.length ? group : [msg];
    const images = imgs.map((m) => api.tgUserMediaUrl(accountId, dialog.id, m.id));
    const index = Math.max(0, imgs.findIndex((m) => m.id === msg.id));
    setLb({ images, index });
  }

  return (
    <Box
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        files.forEach((f) => onAttach(f));
      }}
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "row",
        minHeight: 0,
        height: "100%",
      }}
    >
      {dragOver && (
        <Box
          style={{
            position: "absolute",
            inset: 8,
            zIndex: 5,
            borderRadius: 16,
            border: "2px dashed var(--accent-border)",
            background: "var(--accent-soft)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Stack align="center" gap={8}>
            <IconUpload size={34} />
            <Text fw={700}>{t("inbox.dropFile")}</Text>
          </Stack>
        </Box>
      )}

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
      <Group
        p="sm"
        gap="sm"
        wrap="nowrap"
        onClick={onHeaderClick}
        style={{
          position: "relative",
          borderBottom: "1px solid var(--mantine-color-gray-3)",
          flexShrink: 0,
          cursor: onHeaderClick ? "pointer" : undefined,
        }}
      >
        {showBack && (
          <ActionIcon
            variant="subtle"
            onClick={(e) => {
              e.stopPropagation();
              onBack?.();
            }}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
        )}
        <ChatAvatar
          src={api.tgUserAvatarUrl(accountId, dialog.id)}
          name={dialog.name}
          color="blue"
          size={36}
        />
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text fw={600} lineClamp={1}>
            {dialog.name}
          </Text>
          {presence && (
            <Text fz="xs" lineClamp={1} c={presence.online ? "teal" : "dimmed"}>
              {presence.text}
            </Text>
          )}
        </Box>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={(e) => {
            e.stopPropagation();
            setSearchOpen(true);
          }}
          title={t("inbox.searchInChat")}
        >
          <IconSearch size={18} />
        </ActionIcon>

        {/* Плавно выезжающий поиск поверх шапки */}
        <Transition mounted={searchOpen} transition="slide-left" duration={180}>
          {(styles) => (
            <Group
              gap="xs"
              wrap="nowrap"
              onClick={(e) => e.stopPropagation()}
              style={{
                ...styles,
                position: "absolute",
                inset: 0,
                padding: "0 12px",
                background: "var(--mantine-color-body)",
                zIndex: 3,
              }}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <TextInput
                autoFocus
                variant="unstyled"
                style={{ flex: 1 }}
                placeholder={t("inbox.searchInChat")}
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
              {query && (
                <ActionIcon variant="subtle" color="gray" onClick={() => setQuery("")}>
                  <IconX size={16} />
                </ActionIcon>
              )}
            </Group>
          )}
        </Transition>
      </Group>

      <Box style={{ position: "relative", flex: 1, minHeight: 0 }}>
      <ScrollArea
        style={{ height: "100%" }}
        type="auto"
        bg="var(--mantine-color-gray-0)"
        viewportRef={viewportRef}
        onScrollPositionChange={({ y }) => {
          const vp = viewportRef.current;
          if (!vp) return;
          const ab = vp.scrollHeight - vp.clientHeight - y < 80;
          atBottomRef.current = ab;
          setAtBottom(ab);
        }}
      >
        {loading ? (
          <Stack gap={12} p="md">
            {[42, 60, 48, 66, 38, 54, 50].map((w, i) => (
              <Skeleton
                key={i}
                height={34}
                width={`${w}%`}
                radius="lg"
                style={{ alignSelf: i % 2 ? "flex-end" : "flex-start" }}
              />
            ))}
          </Stack>
        ) : (
          <Stack gap={6} p="md">
            {shownMessages.map((m) => (
              <Bubble
                key={m.id}
                msg={m}
                accountId={accountId}
                dialogId={dialog.id}
                onOpenImage={openImage}
                highlight={searchOpen ? q : ""}
              />
            ))}
            {searchOpen && q && shownMessages.length === 0 && (
              <Text c="dimmed" fz="sm" ta="center" py="xl">
                {t("inbox.searchNothing")}
              </Text>
            )}
            <div ref={bottomRef} />
          </Stack>
        )}
      </ScrollArea>

      {/* Кнопка «вниз» — когда прокручено вверх */}
      <Transition mounted={!atBottom} transition="pop" duration={150}>
        {(styles) => (
          <ActionIcon
            variant="filled"
            color="dark"
            radius="xl"
            size="lg"
            onClick={() => scrollToBottom("smooth")}
            style={{
              ...styles,
              position: "absolute",
              right: 16,
              bottom: 16,
              zIndex: 4,
              boxShadow: "0 6px 18px -6px rgba(0,0,0,0.5)",
            }}
          >
            <IconChevronDown size={20} />
          </ActionIcon>
        )}
      </Transition>
      </Box>

      <Group
        p="sm"
        gap="xs"
        wrap="nowrap"
        style={{
          borderTop: "1px solid var(--mantine-color-gray-3)",
          flexShrink: 0,
        }}
      >
        <input
          type="file"
          hidden
          ref={fileRef}
          accept="image/*,video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAttach(f);
            e.target.value = "";
          }}
        />
        <ActionIcon
          size={36}
          radius="md"
          variant={pickerOpen ? "light" : "subtle"}
          color={pickerOpen ? "brand" : "gray"}
          onClick={() => setPickerOpen((o) => !o)}
          title={t("inbox.emojiTitle")}
        >
          <IconMoodSmile size={20} />
        </ActionIcon>
        <ActionIcon
          size={36}
          radius="md"
          variant="subtle"
          color="gray"
          onClick={() => fileRef.current?.click()}
          loading={sending}
          title={t("inbox.attachTitle")}
        >
          <IconPaperclip size={18} />
        </ActionIcon>

        <Popover
          opened={scriptsOpen}
          onChange={setScriptsOpen}
          position="top-start"
          withArrow
          shadow="lg"
          width={300}
          transitionProps={{ transition: "pop-bottom-left", duration: 200 }}
        >
          <Popover.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              leftSection={<IconScript size={16} />}
              onClick={() => setScriptsOpen((o) => !o)}
            >
              {t("inbox.scripts")}
            </Button>
          </Popover.Target>
          <Popover.Dropdown p={6}>
            {scripts.length === 0 ? (
              <Text fz="xs" c="dimmed" p="sm" ta="center">
                {t("inbox.scriptsEmpty")}
              </Text>
            ) : (
              <ScrollArea.Autosize mah={280}>
                <Stack gap={4}>
                  {scripts.map((s) => (
                    <UnstyledButton
                      key={s.id}
                      className="pw-script-item"
                      onClick={() => insertScript(s.text)}
                    >
                      <Text fz="sm" fw={600} lineClamp={1}>
                        {s.title || s.text.slice(0, 32)}
                      </Text>
                      <Text fz="xs" c="dimmed" lineClamp={2}>
                        {s.text}
                      </Text>
                    </UnstyledButton>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Popover.Dropdown>
        </Popover>

        <TextInput
          style={{ flex: 1 }}
          placeholder={t("inbox.messagePh")}
          value={draft}
          onChange={(e) => onDraftChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <ActionIcon
          size={36}
          radius="md"
          onClick={onSend}
          loading={sending}
          disabled={!draft.trim()}
        >
          <IconSend size={18} />
        </ActionIcon>
      </Group>
      </Box>

      {pickerOpen && (
        <EmojiPanel onPick={insertEmoji} onClose={() => setPickerOpen(false)} />
      )}

      {lb && (
        <Lightbox
          images={lb.images}
          index={lb.index}
          onIndexChange={(i) => setLb((s) => (s ? { ...s, index: i } : s))}
          onClose={() => setLb(null)}
        />
      )}
    </Box>
  );
}

function formatPresence(
  s: TgStatus | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { text: string; online: boolean } | null {
  if (!s) return null;
  switch (s.kind) {
    case "online":
      return { text: t("inbox.online"), online: true };
    case "offline": {
      if (s.was_online) {
        const d = dayjs(s.was_online);
        const when = d.isSame(dayjs(), "day")
          ? d.format("HH:mm")
          : d.format("D MMM, HH:mm");
        return { text: t("inbox.lastSeenAt", { when }), online: false };
      }
      return { text: t("inbox.recently"), online: false };
    }
    case "recently":
      return { text: t("inbox.recently"), online: false };
    case "week":
      return { text: t("inbox.lastWeek"), online: false };
    case "month":
      return { text: t("inbox.lastMonth"), online: false };
    case "group":
      return s.members
        ? { text: t("inbox.members", { count: s.members }), online: false }
        : null;
    default:
      return null;
  }
}

function highlightText(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark
        key={k++}
        style={{ background: "#ffd84d", color: "#000", borderRadius: 3, padding: "0 1px" }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return parts;
}

function Bubble({
  msg,
  accountId,
  dialogId,
  onOpenImage,
  highlight,
}: {
  msg: TgMessage;
  accountId: number;
  dialogId: number;
  onOpenImage?: (msg: TgMessage) => void;
  highlight?: string;
}) {
  const { t } = useTranslation();
  if (!msg.text && !msg.media_type) return null;
  const mediaUrl = msg.media_type
    ? api.tgUserMediaUrl(accountId, dialogId, msg.id)
    : null;

  return (
    <Box
      className="pw-msg"
      style={{
        alignSelf: msg.out ? "flex-end" : "flex-start",
        maxWidth: "75%",
        background: msg.out
          ? "linear-gradient(135deg, #7d52f9, #5b8cff)"
          : "rgba(255,255,255,0.07)",
        color: msg.out ? "#fff" : "var(--mantine-color-text)",
        border: msg.out ? "none" : "1px solid rgba(255,255,255,0.1)",
        backdropFilter: msg.out ? undefined : "blur(12px)",
        WebkitBackdropFilter: msg.out ? undefined : "blur(12px)",
        padding: 6,
        borderRadius: 16,
        borderBottomRightRadius: msg.out ? 5 : 16,
        borderBottomLeftRadius: msg.out ? 16 : 5,
        boxShadow: msg.out
          ? "0 6px 20px -8px rgba(123,82,249,0.6)"
          : "0 4px 16px -8px rgba(0,0,0,0.5)",
      }}
    >
      {mediaUrl && (msg.media_type === "photo" || msg.media_type === "sticker") && (
        <img
          src={mediaUrl}
          onClick={() => onOpenImage?.(msg)}
          style={{
            maxWidth: 240,
            borderRadius: 10,
            display: "block",
            cursor: "zoom-in",
          }}
        />
      )}
      {mediaUrl && msg.media_type === "video" && (
        <video
          src={mediaUrl}
          controls
          preload="metadata"
          playsInline
          style={{
            maxWidth: 260,
            maxHeight: 360,
            width: "100%",
            borderRadius: 10,
            display: "block",
            background: "#000",
          }}
        />
      )}
      {mediaUrl && msg.media_type === "audio" && (
        <AudioPlayer src={mediaUrl} dark={msg.out} />
      )}
      {mediaUrl && msg.media_type === "document" && (
        <Anchor href={mediaUrl} target="_blank" fz="sm" c={msg.out ? "#fff" : undefined}>
          {t("inbox.openFile")}
        </Anchor>
      )}
      {msg.text && (
        <Text
          fz="sm"
          px={6}
          pt={msg.media_type ? 4 : 0}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {highlight ? highlightText(msg.text, highlight) : msg.text}
        </Text>
      )}
      <Group gap={3} justify="flex-end" wrap="nowrap" mt={2} px={6}>
        {msg.date && (
          <Text fz={10} style={{ opacity: 0.75 }}>
            {dayjs(msg.date).format("HH:mm")}
          </Text>
        )}
        {msg.out &&
          (msg.pending ? (
            <IconClock size={13} style={{ opacity: 0.75 }} />
          ) : msg.read ? (
            <IconChecks size={14} style={{ opacity: 0.95 }} />
          ) : (
            <IconCheck size={13} style={{ opacity: 0.65 }} />
          ))}
      </Group>
    </Box>
  );
}
