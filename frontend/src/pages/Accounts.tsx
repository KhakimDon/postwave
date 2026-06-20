import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  Group,
  Text,
  SimpleGrid,
  ThemeIcon,
  Modal,
  Stack,
  TextInput,
  UnstyledButton,
  Image,
  ActionIcon,
  Skeleton,
  Box,
  Badge,
  Alert,
  List,
  Collapse,
  Anchor,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconTrash,
  IconBrandTelegram,
  IconBrandInstagram,
  IconPlugConnected,
  IconInfoCircle,
  IconHelpCircle,
  IconChevronDown,
  IconCheck,
} from "@tabler/icons-react";

const TELEGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png";
const INSTAGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/9/95/Instagram_logo_2022.svg";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Account, Platform } from "../api/types";
import { PageHeader, EmptyState } from "../components/ui";
import { TelegramUserLogin } from "../components/TelegramUserLogin";

export function Accounts() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  async function load() {
    setLoading(true);
    try {
      setAccounts(await api.listAccounts());
    } finally {
      setLoading(false);
    }
  }

  // Возврат с OAuth Instagram: либо ?code=... (обмениваем на токен),
  // либо ?ig=connected|error (резервный серверный колбэк).
  useEffect(() => {
    const code = searchParams.get("code");
    const ig = searchParams.get("ig");

    if (code) {
      setSearchParams({}, { replace: true });
      api
        .instagramOAuthExchange(code)
        .then((r) => {
          notifications.show({
            color: "teal",
            message: t("accounts.igConnectedUser", { username: r.username }),
          });
          load();
        })
        .catch((e) =>
          notifications.show({ color: "red", message: (e as Error).message })
        );
      return;
    }

    if (ig) {
      const map: Record<string, { color: string; message: string }> = {
        connected: { color: "teal", message: t("accounts.igConnected") },
        error: { color: "red", message: t("accounts.igFailed") },
      };
      const n = map[ig];
      if (n) notifications.show(n);
      setSearchParams({}, { replace: true });
      load();
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  async function remove(id: number) {
    try {
      await api.deleteAccount(id);
      notifications.show({ color: "gray", message: t("accounts.removedToast") });
      load();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    }
  }

  return (
    <Box>
      <PageHeader
        title={t("accounts.title")}
        subtitle={t("accounts.subtitle")}
        action={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
          >
            {t("accounts.connectBtn")}
          </Button>
        }
      />

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} h={120} radius="lg" />
          ))}
        </SimpleGrid>
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconPlugConnected size={32} />}
            title={t("accounts.emptyTitle")}
            description={t("accounts.emptyDesc")}
            action={
              <Button
                mt="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => setModalOpen(true)}
              >
                {t("accounts.emptyAction")}
              </Button>
            }
          />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {accounts.map((a) => (
            <Card key={a.id} className="pw-liquid-card">
              <Group justify="space-between" wrap="nowrap">
                <Group wrap="nowrap">
                  <ThemeIcon
                    size={44}
                    radius="md"
                    variant="light"
                    color={a.platform === "instagram" ? "grape" : "blue"}
                  >
                    {a.platform === "instagram" ? (
                      <IconBrandInstagram size={24} />
                    ) : (
                      <IconBrandTelegram size={24} />
                    )}
                  </ThemeIcon>
                  <Box>
                    <Text fw={600} lineClamp={1}>
                      {a.display_name}
                    </Text>
                    <Text fz="xs" c="dimmed">
                      {t("accounts.connectedOn", { date: dayjs(a.created_at).format("DD.MM.YYYY") })}
                    </Text>
                  </Box>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => remove(a.id)}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
              <Badge mt="md" variant="dot" color={a.is_active ? "teal" : "gray"}>
                {a.is_active ? t("accounts.active") : t("accounts.inactive")}
              </Badge>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <ConnectModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnected={load}
      />
    </Box>
  );
}

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
  const [platform, setPlatform] = useState<Platform>("telegram_bot");
  const [displayName, setDisplayName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [guideOpen, guide] = useDisclosure(false);
  const [botUsername, setBotUsername] = useState("");

  useEffect(() => {
    api.telegramBotInfo().then((r) => setBotUsername(r.username)).catch(() => {});
  }, []);

  function set(key: string, val: string) {
    setCreds((c) => ({ ...c, [key]: val }));
  }

  async function oauthLogin() {
    setOauthLoading(true);
    try {
      const { url } = await api.instagramOAuthStart();
      window.location.href = url; // уходим на диалог Meta
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
      setOauthLoading(false);
    }
  }

  function switchPlatform(p: Platform) {
    setPlatform(p);
    setCreds({});
    guide.close();
  }

  async function submit() {
    setLoading(true);
    try {
      await api.connectAccount({
        platform,
        display_name: displayName,
        credentials: creds,
      });
      notifications.show({ color: "teal", message: t("accounts.connectedToast") });
      setDisplayName("");
      setCreds({});
      onConnected();
      onClose();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{t("accounts.modalTitle")}</Text>}
      radius="lg"
      size="lg"
    >
      <Stack>
        <PlatformPicker value={platform} onChange={switchPlatform} />

        {platform === "telegram_user" ? (
          <TelegramUserLogin
            onConnected={() => {
              onConnected();
              onClose();
            }}
          />
        ) : (
          <>
        <TextInput
          label={t("accounts.nameLabel")}
          placeholder={platform === "instagram" ? t("accounts.namePhIg") : t("accounts.namePhChannel")}
          value={displayName}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
        />

        {platform === "telegram_bot" ? (
          <>
            <Alert
              variant="light"
              color="blue"
              icon={<IconInfoCircle size={18} />}
            >
              <Text fz="sm" fw={600} mb={4}>
                {t("accounts.tgHowto")}
              </Text>
              <List size="sm" spacing={4} type="ordered">
                <List.Item>
                  {t("accounts.tgStep1a")}{" "}
                  {botUsername ? (
                    <Anchor
                      href={`https://t.me/${botUsername}`}
                      target="_blank"
                      fw={700}
                    >
                      @{botUsername}
                    </Anchor>
                  ) : (
                    <b>{t("accounts.tgBotPending")}</b>
                  )}{" "}
                  {t("accounts.tgStep1b")}
                </List.Item>
                <List.Item>{t("accounts.tgStep2")}</List.Item>
                <List.Item>{t("accounts.tgStep3")}</List.Item>
              </List>
            </Alert>
            <TextInput
              label={t("accounts.channelLabel")}
              placeholder={t("accounts.channelPh")}
              description={t("accounts.channelDesc")}
              value={creds.chat_id ?? ""}
              onChange={(e) => set("chat_id", e.currentTarget.value)}
            />
          </>
        ) : (
          <>
            <Alert
              variant="light"
              color="grape"
              icon={<IconInfoCircle size={18} />}
            >
              {t("accounts.igAlert")}
            </Alert>

            <Button
              fullWidth
              size="md"
              variant="gradient"
              gradient={{ from: "grape", to: "orange", deg: 135 }}
              leftSection={<IconBrandInstagram size={20} />}
              onClick={oauthLogin}
              loading={oauthLoading}
            >
              {t("accounts.igLoginBtn")}
            </Button>

            <Divider label={t("accounts.orManual")} labelPosition="center" />

            <Box>
              <GuideToggle opened={guideOpen} onToggle={guide.toggle} />
              <Collapse in={guideOpen}>
                <InstagramGuide />
              </Collapse>
            </Box>
            <TextInput
              label={t("accounts.igUserIdLabel")}
              placeholder={t("accounts.igUserIdPh")}
              value={creds.ig_user_id ?? ""}
              onChange={(e) => set("ig_user_id", e.currentTarget.value)}
            />
            <TextInput
              label={t("accounts.tokenLabel")}
              placeholder={t("accounts.tokenPh")}
              value={creds.access_token ?? ""}
              onChange={(e) => set("access_token", e.currentTarget.value)}
            />
          </>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={loading}
            onClick={submit}
            disabled={!displayName.trim()}
          >
            {t("common.connect")}
          </Button>
        </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

function PlatformPicker({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (p: Platform) => void;
}) {
  const { t } = useTranslation();
  const options: { value: Platform; label: string; logo: string }[] = [
    { value: "telegram_bot", label: t("accounts.platformTelegram"), logo: TELEGRAM_LOGO },
    { value: "telegram_user", label: t("accounts.platformTelegramUser"), logo: TELEGRAM_LOGO },
    { value: "instagram", label: t("accounts.platformInstagram"), logo: INSTAGRAM_LOGO },
  ];

  return (
    <SimpleGrid cols={3} spacing="sm">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <UnstyledButton
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            style={{
              position: "relative",
              padding: "var(--mantine-spacing-md)",
              borderRadius: "var(--mantine-radius-lg)",
              border: `2px solid ${
                selected ? "var(--accent-border)" : "var(--border-1)"
              }`,
              background: selected ? "var(--accent-soft)" : "var(--surface-1)",
              transition: "border-color 150ms ease, background 150ms ease",
            }}
          >
            {selected && (
              <ThemeIcon
                size={20}
                radius="xl"
                color="brand"
                style={{ position: "absolute", top: 8, right: 8 }}
              >
                <IconCheck size={13} />
              </ThemeIcon>
            )}
            <Stack align="center" gap={8}>
              <Image
                src={opt.logo}
                h={36}
                w={36}
                fit="contain"
                alt={opt.label}
              />
              <Text fz="sm" fw={600}>
                {opt.label}
              </Text>
            </Stack>
          </UnstyledButton>
        );
      })}
    </SimpleGrid>
  );
}

function GuideToggle({
  opened,
  onToggle,
}: {
  opened: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      variant="subtle"
      size="compact-sm"
      mt="xs"
      px={4}
      leftSection={<IconHelpCircle size={16} />}
      rightSection={
        <IconChevronDown
          size={14}
          style={{
            transform: opened ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
      }
      onClick={onToggle}
    >
      {opened ? t("accounts.guideHide") : t("accounts.guideShow")}
    </Button>
  );
}

/** Маленький помощник: пронумерованный шаг с заголовком и описанием. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <ThemeIcon size={26} radius="xl" variant="light" color="brand">
        <Text fz="xs" fw={700}>
          {n}
        </Text>
      </ThemeIcon>
      <Box style={{ flex: 1 }}>
        <Text fz="sm" fw={600}>
          {title}
        </Text>
        {children && (
          <Text fz="sm" c="dimmed" mt={2} component="div">
            {children}
          </Text>
        )}
      </Box>
    </Group>
  );
}

function InstagramGuide() {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4, 5] as const;
  return (
    <Box
      p="md"
      mt="xs"
      style={{
        borderRadius: "var(--mantine-radius-md)",
        border: "1px solid var(--mantine-color-gray-3)",
        background: "var(--mantine-color-gray-0)",
      }}
    >
      <Stack gap="md">
        {steps.map((n) => (
          <Step key={n} n={n} title={t(`accounts.guideStep${n}Title`)}>
            {t(`accounts.guideStep${n}Desc`)}
          </Step>
        ))}
      </Stack>
      <Divider my="sm" />
      <Alert variant="light" color="yellow" p="xs">
        <Text fz="xs">{t("accounts.guideNote")}</Text>
      </Alert>
    </Box>
  );
}
