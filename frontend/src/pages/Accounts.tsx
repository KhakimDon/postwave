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
  Code,
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
  IconExternalLink,
  IconCheck,
} from "@tabler/icons-react";

const TELEGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png";
const INSTAGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/9/95/Instagram_logo_2022.svg";
import dayjs from "dayjs";
import { api } from "../api/client";
import type { Account, Platform } from "../api/types";
import { PageHeader, EmptyState } from "../components/ui";

export function Accounts() {
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
            message: `Instagram подключён ✅ (@${r.username})`,
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
        connected: { color: "teal", message: "Instagram подключён ✅" },
        error: { color: "red", message: "Не удалось подключить Instagram" },
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
      notifications.show({ color: "gray", message: "Аккаунт отключён" });
      load();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    }
  }

  return (
    <Box>
      <PageHeader
        title="Аккаунты"
        subtitle="Подключите Telegram-каналы и Instagram-профили. Пароли мы не храним."
        action={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
          >
            Подключить
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
            title="Нет подключённых аккаунтов"
            description="Подключите первый Telegram-канал или Instagram-профиль, чтобы начать публиковать."
            action={
              <Button
                mt="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => setModalOpen(true)}
              >
                Подключить аккаунт
              </Button>
            }
          />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {accounts.map((a) => (
            <Card key={a.id}>
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
                      Подключён {dayjs(a.created_at).format("DD.MM.YYYY")}
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
                {a.is_active ? "Активен" : "Отключён"}
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
      notifications.show({ color: "teal", message: "Аккаунт подключён ✅" });
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
      title={<Text fw={700}>Подключить аккаунт</Text>}
      radius="lg"
      size="lg"
    >
      <Stack>
        <PlatformPicker value={platform} onChange={switchPlatform} />

        <TextInput
          label="Название (для вас)"
          placeholder={platform === "instagram" ? "@my_shop" : "Мой канал"}
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
                Как подключить за 1 минуту:
              </Text>
              <List size="sm" spacing={4} type="ordered">
                <List.Item>
                  Добавьте нашего бота{" "}
                  {botUsername ? (
                    <Anchor
                      href={`https://t.me/${botUsername}`}
                      target="_blank"
                      fw={700}
                    >
                      @{botUsername}
                    </Anchor>
                  ) : (
                    <b>(бот настраивается…)</b>
                  )}{" "}
                  в свой канал
                </List.Item>
                <List.Item>
                  Назначьте его <b>администратором</b> с правом «Публикация
                  сообщений»
                </List.Item>
                <List.Item>Укажите @username канала ниже</List.Item>
              </List>
            </Alert>
            <TextInput
              label="Канал"
              placeholder="@my_channel"
              description="Публичный канал — @username. Приватный — числовой id вида -100…"
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
              Нужен Instagram <b>Business/Creator</b> аккаунт, привязанный к
              странице Facebook. Войдите официально — пароль мы не видим и не
              храним.
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
              Войти через Instagram
            </Button>

            <Divider label="или вручную (для разработчиков)" labelPosition="center" />

            <Box>
              <GuideToggle opened={guideOpen} onToggle={guide.toggle} />
              <Collapse in={guideOpen}>
                <InstagramGuide />
              </Collapse>
            </Box>
            <TextInput
              label="Instagram User ID"
              placeholder="178414…"
              value={creds.ig_user_id ?? ""}
              onChange={(e) => set("ig_user_id", e.currentTarget.value)}
            />
            <TextInput
              label="Access Token"
              placeholder="EAAG…"
              value={creds.access_token ?? ""}
              onChange={(e) => set("access_token", e.currentTarget.value)}
            />
          </>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={loading}
            onClick={submit}
            disabled={!displayName.trim()}
          >
            Подключить
          </Button>
        </Group>
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
  const options: { value: Platform; label: string; logo: string }[] = [
    { value: "telegram_bot", label: "Telegram-канал", logo: TELEGRAM_LOGO },
    { value: "instagram", label: "Instagram", logo: INSTAGRAM_LOGO },
  ];

  return (
    <SimpleGrid cols={2} spacing="sm">
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
                selected
                  ? "var(--mantine-color-brand-5)"
                  : "var(--mantine-color-gray-3)"
              }`,
              background: selected
                ? "var(--mantine-color-brand-0)"
                : "var(--mantine-color-body)",
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
      {opened ? "Скрыть инструкцию" : "Подробнее: откуда взять"}
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
        <Step n={1} title="Переключите Instagram в Professional">
          В приложении Instagram: <b>Настройки → Аккаунт → Тип аккаунта →
          Переключиться на профессиональный</b> и выберите <b>Business</b> или{" "}
          <b>Creator</b>. С личного аккаунта Graph API постить нельзя.
        </Step>
        <Step n={2} title="Привяжите аккаунт к странице Facebook">
          Создайте (или возьмите существующую) <b>страницу Facebook</b> и в её
          настройках свяжите с вашим Instagram-аккаунтом. Meta требует эту связку.
        </Step>
        <Step n={3} title="Создайте приложение Meta">
          Зайдите на{" "}
          <Anchor href="https://developers.facebook.com/apps" target="_blank">
            developers.facebook.com/apps <IconExternalLink size={11} />
          </Anchor>{" "}
          → <b>Создать приложение</b> → тип <b>Business</b>. Затем добавьте
          продукт <b>Instagram Graph API</b>.
        </Step>
        <Step n={4} title="Получите access_token">
          Откройте{" "}
          <Anchor
            href="https://developers.facebook.com/tools/explorer"
            target="_blank"
          >
            Graph API Explorer <IconExternalLink size={11} />
          </Anchor>{" "}
          → выберите своё приложение → <b>Generate Access Token</b> с правами:{" "}
          <Code>instagram_basic</Code>, <Code>instagram_content_publish</Code>,{" "}
          <Code>pages_show_list</Code>, <Code>pages_read_engagement</Code>.
          Полученная строка <Code>EAAG…</Code> — это поле <Code>Access Token</Code>.
        </Step>
        <Step n={5} title="Узнайте ig_user_id">
          В том же Explorer выполните запрос:
          <Code block mt={4}>
            me/accounts?fields=instagram_business_account
          </Code>
          В ответе у вашей страницы будет{" "}
          <Code>instagram_business_account.id</Code> — это число и есть{" "}
          <Code>Instagram User ID</Code>.
        </Step>
      </Stack>
      <Divider my="sm" />
      <Alert variant="light" color="yellow" p="xs">
        <Text fz="xs">
          Звучит сложно — потому что Meta так устроила. Поэтому следующим шагом мы
          сделаем кнопку <b>«Войти через Instagram»</b>, которая получит токен и id
          автоматически, и все эти шаги исчезнут.
        </Text>
      </Alert>
    </Box>
  );
}
