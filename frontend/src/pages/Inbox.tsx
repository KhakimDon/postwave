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
  Avatar,
  Paper,
  Badge,
  Loader,
  ThemeIcon,
  Modal,
  ActionIcon,
  Center,
  Select,
  Anchor,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBrandTelegram,
  IconSend,
  IconPlus,
  IconMessageChatbot,
  IconArrowLeft,
  IconPaperclip,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { api } from "../api/client";
import type { Account, TgDialog, TgMessage } from "../api/types";
import { PageHeader, EmptyState } from "../components/ui";

export function Inbox() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  const [dialogs, setDialogs] = useState<TgDialog[]>([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [activeDialog, setActiveDialog] = useState<TgDialog | null>(null);
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tgAccounts = useMemo(
    () => accounts.filter((a) => a.platform === "telegram_user"),
    [accounts]
  );

  async function loadAccounts() {
    const a = await api.listAccounts();
    setAccounts(a);
    const tg = a.filter((x) => x.platform === "telegram_user");
    if (tg.length && accountId == null) setAccountId(tg[0].id);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadDialogs(id: number) {
    setLoadingDialogs(true);
    try {
      setDialogs(await api.tgUserDialogs(id));
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoadingDialogs(false);
    }
  }

  useEffect(() => {
    if (accountId != null) loadDialogs(accountId);
  }, [accountId]);

  async function openDialog(d: TgDialog) {
    if (accountId == null) return;
    setActiveDialog(d);
    setMessages([]);
    setLoadingMsgs(true);
    try {
      setMessages(await api.tgUserMessages(accountId, d.id));
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function refreshMessages() {
    if (accountId == null || !activeDialog) return;
    setMessages(await api.tgUserMessages(accountId, activeDialog.id));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
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
        <PageHeader title="Входящие" subtitle="Единый инбокс ваших Telegram-чатов" />
        <Paper withBorder radius="lg">
          <EmptyState
            icon={<IconMessageChatbot size={32} />}
            title="Подключите свой Telegram"
            description="Войдите в свой аккаунт (телефон + код), чтобы обрабатывать клиентов в одном окне. Пароль 2FA мы не храним, сессию шифруем."
            action={
              <Button
                mt="sm"
                leftSection={<IconBrandTelegram size={16} />}
                onClick={() => setConnectOpen(true)}
              >
                Подключить Telegram
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
      <Group justify="space-between" mb="md" style={{ flexShrink: 0 }} wrap="wrap">
        <Text fz={{ base: 22, sm: 26 }} fw={800}>
          Входящие
        </Text>
        <Group gap="sm">
          {tgAccounts.length > 1 && (
            <Select
              size="xs"
              data={tgAccounts.map((a) => ({
                value: String(a.id),
                label: a.display_name,
              }))}
              value={accountId ? String(accountId) : null}
              onChange={(v) => setAccountId(v ? Number(v) : null)}
              allowDeselect={false}
            />
          )}
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setConnectOpen(true)}
          >
            Аккаунт
          </Button>
        </Group>
      </Group>

      <Paper
        withBorder
        radius="lg"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
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
            <Center h={120}>
              <Loader size="sm" />
            </Center>
          ) : (
            <ScrollArea style={{ flex: 1 }} type="auto">
              {dialogs.map((d) => (
                <DialogRow
                  key={d.id}
                  dialog={d}
                  active={activeDialog?.id === d.id}
                  onClick={() => openDialog(d)}
                />
              ))}
              {dialogs.length === 0 && (
                <Text c="dimmed" fz="sm" ta="center" mt="xl">
                  Диалогов нет
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
          {!activeDialog ? (
            <Center h="100%">
              <Text c="dimmed" fz="sm">
                Выберите диалог слева
              </Text>
            </Center>
          ) : (
            <>
              <Group
                p="sm"
                gap="sm"
                style={{
                  borderBottom: "1px solid var(--mantine-color-gray-3)",
                  flexShrink: 0,
                }}
              >
                {isMobile && (
                  <ActionIcon variant="subtle" onClick={() => setActiveDialog(null)}>
                    <IconArrowLeft size={18} />
                  </ActionIcon>
                )}
                <Avatar size="sm" radius="xl" color="blue">
                  {activeDialog.name?.[0] ?? "?"}
                </Avatar>
                <Text fw={600}>{activeDialog.name}</Text>
              </Group>

              <ScrollArea
                style={{ flex: 1 }}
                type="auto"
                bg="var(--mantine-color-gray-0)"
              >
                <Stack gap={6} p="md">
                  {loadingMsgs ? (
                    <Center h={120}>
                      <Loader size="sm" />
                    </Center>
                  ) : (
                    messages.map((m) => (
                      <Bubble
                        key={m.id}
                        msg={m}
                        accountId={accountId!}
                        dialogId={activeDialog.id}
                      />
                    ))
                  )}
                  <div ref={bottomRef} />
                </Stack>
              </ScrollArea>

              <Group
                p="sm"
                gap="xs"
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
                    if (f) attachFile(f);
                    e.target.value = "";
                  }}
                />
                <ActionIcon
                  size={36}
                  radius="md"
                  variant="subtle"
                  color="gray"
                  onClick={() => fileRef.current?.click()}
                  loading={sending}
                  title="Прикрепить фото/видео"
                >
                  <IconPaperclip size={18} />
                </ActionIcon>
                <TextInput
                  style={{ flex: 1 }}
                  placeholder="Напишите сообщение…"
                  value={draft}
                  onChange={(e) => setDraft(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <ActionIcon
                  size={36}
                  radius="md"
                  onClick={send}
                  loading={sending}
                  disabled={!draft.trim()}
                >
                  <IconSend size={18} />
                </ActionIcon>
              </Group>
            </>
          )}
        </Box>
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

function DialogRow({
  dialog,
  active,
  onClick,
}: {
  dialog: TgDialog;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Group
      gap="sm"
      p="sm"
      wrap="nowrap"
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: active ? "var(--mantine-color-brand-0)" : undefined,
        borderBottom: "1px solid var(--mantine-color-gray-1)",
      }}
    >
      <Avatar radius="xl" color={dialog.is_user ? "blue" : "grape"}>
        {dialog.name?.[0] ?? "?"}
      </Avatar>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text fw={600} fz="sm" lineClamp={1}>
          {dialog.name || "Без имени"}
        </Text>
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

function Bubble({
  msg,
  accountId,
  dialogId,
}: {
  msg: TgMessage;
  accountId: number;
  dialogId: number;
}) {
  if (!msg.text && !msg.media_type) return null;
  const mediaUrl = msg.media_type
    ? api.tgUserMediaUrl(accountId, dialogId, msg.id)
    : null;

  return (
    <Box
      style={{
        alignSelf: msg.out ? "flex-end" : "flex-start",
        maxWidth: "75%",
        background: msg.out ? "var(--mantine-color-brand-5)" : "#fff",
        color: msg.out ? "#fff" : "var(--mantine-color-text)",
        padding: 6,
        borderRadius: 14,
        borderBottomRightRadius: msg.out ? 4 : 14,
        borderBottomLeftRadius: msg.out ? 14 : 4,
        boxShadow: "var(--mantine-shadow-xs)",
      }}
    >
      {mediaUrl && (msg.media_type === "photo" || msg.media_type === "sticker") && (
        <img
          src={mediaUrl}
          style={{ maxWidth: 240, borderRadius: 10, display: "block" }}
        />
      )}
      {mediaUrl && msg.media_type === "video" && (
        <video
          src={mediaUrl}
          controls
          style={{ maxWidth: 240, borderRadius: 10, display: "block" }}
        />
      )}
      {mediaUrl && msg.media_type === "audio" && (
        <audio src={mediaUrl} controls style={{ maxWidth: 240 }} />
      )}
      {mediaUrl && msg.media_type === "document" && (
        <Anchor href={mediaUrl} target="_blank" fz="sm" c={msg.out ? "#fff" : undefined}>
          📎 Открыть файл
        </Anchor>
      )}
      {msg.text && (
        <Text
          fz="sm"
          px={6}
          pt={msg.media_type ? 4 : 0}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {msg.text}
        </Text>
      )}
      {msg.date && (
        <Text fz={10} ta="right" opacity={0.7} mt={2} px={6}>
          {dayjs(msg.date).format("HH:mm")}
        </Text>
      )}
    </Box>
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
      notifications.show({ color: "blue", message: "Код отправлен в Telegram" });
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
        notifications.show({ color: "blue", message: "Включена 2FA — введите облачный пароль" });
      } else {
        notifications.show({ color: "teal", message: "Telegram подключён ✅" });
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
      notifications.show({ color: "teal", message: "Telegram подключён ✅" });
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
          <Text fw={700}>Подключить свой Telegram</Text>
        </Group>
      }
      radius="lg"
    >
      <Stack>
        {step === "phone" && (
          <>
            <Text fz="sm" c="dimmed">
              Введите номер, привязанный к Telegram. Придёт код в приложение.
            </Text>
            <TextInput
              label="Номер телефона"
              placeholder="+998901234567"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
            />
            <Button
              loading={loading}
              onClick={startLogin}
              disabled={phone.trim().length < 6}
            >
              Получить код
            </Button>
          </>
        )}
        {step === "code" && (
          <>
            <Text fz="sm" c="dimmed">
              Введите код из Telegram (придёт в чат «Telegram»).
            </Text>
            <TextInput
              label="Код подтверждения"
              placeholder="12345"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
            />
            <Button loading={loading} onClick={submitCode} disabled={!code.trim()}>
              Подтвердить
            </Button>
          </>
        )}
        {step === "password" && (
          <>
            <Text fz="sm" c="dimmed">
              У аккаунта включена двухэтапная проверка. Введите облачный пароль —
              мы его <b>не сохраняем</b>.
            </Text>
            <PasswordInput
              label="Облачный пароль (2FA)"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Button
              loading={loading}
              onClick={submitPassword}
              disabled={!password}
            >
              Войти
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
