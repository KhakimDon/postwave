import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconClock,
  IconHeart,
  IconMoodSmile,
  IconScript,
  IconSend,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { api } from "../api/client";
import type { IgApiMessage, TgDialog } from "../api/types";
import { ChatAvatar } from "./ChatAvatar";
import { EmojiPanel } from "./EmojiPanel";
import { useScripts } from "../scripts";

/** Панель переписки Instagram Direct (реальный API). Стиль Instagram Direct:
 *  градиентное кольцо у аватара, скруглённые «пузыри», фирменный градиент
 *  исходящих. Новые сообщения подтягиваются поллингом (вебхук — асинхронный). */
export function InstagramConversation({
  accountId,
  dialog,
  showBack,
  onBack,
}: {
  accountId: number;
  dialog: TgDialog;
  showBack?: boolean;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<IgApiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const scripts = useScripts();
  const bottomRef = useRef<HTMLDivElement>(null);
  const igsid = dialog.igsid ?? "";

  function insertEmoji(e: string) {
    setDraft((d) => d + e);
  }
  function insertScript(text: string) {
    setDraft((d) => (d.trim() ? `${d} ${text}` : text));
    setScriptsOpen(false);
  }

  useEffect(() => {
    let alive = true;
    setDraft("");
    setMessages([]);
    const load = () =>
      api
        .igMessages(accountId, igsid)
        .then((m) => alive && setMessages(m))
        .catch(() => {});
    load();
    const tm = setInterval(load, 5000); // поллинг входящих
    return () => {
      alive = false;
      clearInterval(tm);
    };
  }, [accountId, igsid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    // оптимистично показываем сообщение сразу (с часиками)
    const tempId = -Date.now();
    setMessages((ms) => [
      ...ms,
      { id: tempId, text, out: true, date: new Date().toISOString(), pending: true },
    ]);
    setDraft("");
    try {
      await api.igSend(accountId, igsid, text);
      setMessages(await api.igMessages(accountId, igsid));
    } catch (e) {
      setMessages((ms) => ms.filter((m) => m.id !== tempId));
      setDraft(text);
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <Box
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "row",
        minHeight: 0,
        height: "100%",
      }}
    >
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
      {/* Шапка */}
      <Group
        p="sm"
        gap="sm"
        wrap="nowrap"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-3)", flexShrink: 0 }}
      >
        {showBack && (
          <ActionIcon variant="subtle" onClick={onBack}>
            <IconArrowLeft size={18} />
          </ActionIcon>
        )}
        <Box className="pw-ig-ring">
          <ChatAvatar src={dialog.avatar_url} name={dialog.name} color="grape" size={36} />
        </Box>
        <Box style={{ minWidth: 0 }}>
          <Text fw={600} lineClamp={1}>
            {dialog.name}
          </Text>
          <Text fz="xs" lineClamp={1} c={dialog.online ? "teal" : "dimmed"}>
            {dialog.online ? t("inbox.online") : "Instagram"}
          </Text>
        </Box>
      </Group>

      {/* Сообщения */}
      <ScrollArea style={{ flex: 1 }} type="auto" bg="var(--mantine-color-gray-0)">
        {messages.length === 0 ? (
          <Center h={120}>
            <Text c="dimmed" fz="sm">
              {t("inbox.noDialogs")}
            </Text>
          </Center>
        ) : (
          <Stack gap={4} p="md">
            {messages.map((m) => (
              <Box
                key={m.id}
                className="pw-ig-msg"
                style={{
                  alignSelf: m.out ? "flex-end" : "flex-start",
                  maxWidth: "76%",
                  background: m.out
                    ? "linear-gradient(135deg, #5b51f9 0%, #c13584 55%, #f77737 100%)"
                    : "var(--surface-2)",
                  color: m.out ? "#fff" : "var(--mantine-color-text)",
                  border: m.out ? "none" : "1px solid var(--border-1)",
                  padding: "8px 13px",
                  borderRadius: 20,
                  borderBottomRightRadius: m.out ? 5 : 20,
                  borderBottomLeftRadius: m.out ? 20 : 5,
                  boxShadow: m.out
                    ? "0 6px 20px -8px rgba(193,53,132,0.55)"
                    : "0 3px 12px -8px rgba(0,0,0,0.4)",
                }}
              >
                <Text fz="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.text}
                </Text>
                <Group gap={3} justify="flex-end" wrap="nowrap" mt={2}>
                  {m.date && (
                    <Text fz={10} style={{ opacity: 0.7 }}>
                      {dayjs(m.date).format("HH:mm")}
                    </Text>
                  )}
                  {m.out && m.pending && (
                    <IconClock size={12} style={{ opacity: 0.75 }} />
                  )}
                </Group>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Stack>
        )}
      </ScrollArea>

      {/* Ввод */}
      <Group
        p="sm"
        gap="xs"
        wrap="nowrap"
        style={{ borderTop: "1px solid var(--mantine-color-gray-3)", flexShrink: 0 }}
      >
        <ActionIcon
          size={36}
          radius="md"
          variant={pickerOpen ? "light" : "subtle"}
          color={pickerOpen ? "grape" : "gray"}
          onClick={() => setPickerOpen((o) => !o)}
          title={t("inbox.emojiTitle")}
        >
          <IconMoodSmile size={20} />
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
          radius="xl"
          placeholder={t("inbox.messagePh")}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {draft.trim() ? (
          <ActionIcon size={36} radius="xl" onClick={send} loading={sending} aria-label="send">
            <IconSend size={18} />
          </ActionIcon>
        ) : (
          <ActionIcon size={36} radius="xl" variant="subtle" color="grape" aria-label="like">
            <IconHeart size={20} />
          </ActionIcon>
        )}
      </Group>
      </Box>

      {pickerOpen && (
        <EmojiPanel onPick={insertEmoji} onClose={() => setPickerOpen(false)} />
      )}
    </Box>
  );
}
