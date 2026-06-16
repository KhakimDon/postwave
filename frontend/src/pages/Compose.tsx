import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Stack,
  Textarea,
  Group,
  Button,
  Box,
  Text,
  Paper,
  Card,
  SimpleGrid,
  UnstyledButton,
  Image,
  ThemeIcon,
  SegmentedControl,
  Switch,
  TextInput,
  TagsInput,
  Collapse,
  Divider,
  Select,
  Alert,
  ScrollArea,
  ActionIcon,
  Badge,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconBolt,
  IconBrandTelegram,
  IconBrandInstagram,
  IconChevronDown,
  IconInfoCircle,
  IconSettings,
  IconDeviceFloppy,
  IconX,
} from "@tabler/icons-react";
import { api } from "../api/client";
import type { Account, IgPostType, PlatformOptions } from "../api/types";
import { MediaUploader, type MediaItem } from "../components/MediaUploader";
import { PlatformPreview } from "../components/PlatformPreview";

const TELEGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png";
const INSTAGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/9/95/Instagram_logo_2022.svg";

const IG_TYPES: { value: IgPostType; label: string }[] = [
  { value: "feed", label: "Лента" },
  { value: "carousel", label: "Карусель" },
  { value: "reels", label: "Reels" },
  { value: "stories", label: "Stories" },
];

export function Compose() {
  const nav = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date"); // из календаря: /compose?date=YYYY-MM-DD

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  // По умолчанию «Сейчас». Если пришли из календаря (?date=) — сразу «По расписанию».
  const [mode, setMode] = useState<"now" | "schedule">(
    dateParam ? "schedule" : "now"
  );
  const [scheduledAt, setScheduledAt] = useState<Date | null>(
    dateParam ? new Date(`${dateParam}T12:00`) : null
  );
  const [loading, setLoading] = useState(false);

  // Telegram options
  const [tgSilent, setTgSilent] = useState(false);
  const [tgNoPreview, setTgNoPreview] = useState(false);
  const [tgParseMode, setTgParseMode] = useState<string | null>("none");

  // Instagram options
  const [igType, setIgType] = useState<IgPostType>("feed");
  const [igLocation, setIgLocation] = useState("");
  const [igTags, setIgTags] = useState<string[]>([]);
  const [igCollabs, setIgCollabs] = useState<string[]>([]);
  const [igHideLikes, setIgHideLikes] = useState(false);
  const [igDisableComments, setIgDisableComments] = useState(false);
  const [igAltText, setIgAltText] = useState("");
  const [igShareToFeed, setIgShareToFeed] = useState(true);
  const [igAdvanced, advanced] = useDisclosure(false);

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch(() => {});
  }, []);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedIds.includes(a.id)),
    [accounts, selectedIds]
  );
  const hasTelegram = selectedAccounts.some((a) => a.platform !== "instagram");
  const hasInstagram = selectedAccounts.some((a) => a.platform === "instagram");

  const previewMedia = media.map((m) => ({ url: m.previewUrl, isVideo: m.isVideo }));
  const uploadedUrls = media.filter((m) => m.url).map((m) => m.url!) as string[];
  const isUploading = media.some((m) => m.uploading);

  function toggleAccount(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function buildOptions(): PlatformOptions {
    const platform_options: PlatformOptions = {};
    if (hasTelegram) {
      platform_options.telegram = {
        silent: tgSilent,
        no_preview: tgNoPreview,
        parse_mode:
          tgParseMode === "none" ? null : (tgParseMode as "MarkdownV2" | "HTML"),
      };
    }
    if (hasInstagram) {
      platform_options.instagram = {
        post_type: igType,
        location: igLocation,
        user_tags: igTags,
        collaborators: igCollabs,
        hide_likes: igHideLikes,
        disable_comments: igDisableComments,
        alt_text: igAltText,
        share_to_feed: igShareToFeed,
      };
    }
    return platform_options;
  }

  // Сохранить как черновик — без отправки и без даты. Запланировать можно позже
  // через календарь (перетащить из «Без даты» в нужный день).
  async function saveDraft() {
    if (selectedIds.length === 0) {
      notifications.show({ color: "red", message: "Выберите хотя бы один аккаунт" });
      return;
    }
    setLoading(true);
    try {
      await api.createPost({
        content: caption,
        media_urls: uploadedUrls,
        scheduled_at: null,
        account_ids: selectedIds,
        platform_options: buildOptions(),
      });
      notifications.show({
        color: "blue",
        message: "Сохранено в черновики — запланируйте через календарь 📅",
      });
      nav("/publications");
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (selectedIds.length === 0) {
      notifications.show({ color: "red", message: "Выберите хотя бы один аккаунт" });
      return;
    }
    if (mode === "schedule" && !scheduledAt) {
      notifications.show({ color: "red", message: "Укажите дату и время" });
      return;
    }
    setLoading(true);
    try {
      const post = await api.createPost({
        content: caption,
        media_urls: uploadedUrls,
        scheduled_at:
          mode === "schedule" && scheduledAt ? scheduledAt.toISOString() : null,
        account_ids: selectedIds,
        platform_options: buildOptions(),
      });
      if (mode === "now") {
        await api.publishNow(post.id);
        notifications.show({ color: "teal", message: "Опубликовано 🚀" });
      } else {
        notifications.show({ color: "teal", message: "Запланировано ⏱" });
      }
      nav("/publications");
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />}>
          Сначала подключите аккаунт.
          <Button ml="md" size="xs" onClick={() => nav("/accounts")}>
            К аккаунтам
          </Button>
        </Alert>
      </Card>
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
      <Group mb="md" gap="sm" style={{ flexShrink: 0 }}>
        <ActionIcon variant="subtle" size="lg" onClick={() => nav("/publications")}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Text fz={{ base: 22, sm: 26 }} fw={800}>
          Новая публикация
        </Text>
      </Group>

      <Box
        style={
          isMobile
            ? { display: "flex", flexDirection: "column", gap: 16 }
            : { display: "flex", gap: 24, flex: 1, minHeight: 0 }
        }
      >
        {/* ---------- Редактор (скроллится) ---------- */}
        <Box
          style={
            isMobile
              ? undefined
              : { flex: "1 1 58%", overflowY: "auto", minHeight: 0, paddingRight: 8 }
          }
        >
          <Stack gap="lg">
            {/* Аккаунты */}
            <Box>
              <Text fz="sm" fw={600} mb={8}>
                Куда публикуем
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                {accounts.map((a) => (
                  <AccountChip
                    key={a.id}
                    account={a}
                    selected={selectedIds.includes(a.id)}
                    onClick={() => toggleAccount(a.id)}
                  />
                ))}
              </SimpleGrid>
            </Box>

            <Textarea
              label="Текст / подпись"
              placeholder="Напишите текст поста…"
              autosize
              minRows={5}
              maxRows={14}
              value={caption}
              onChange={(e) => setCaption(e.currentTarget.value)}
            />

            <Box>
              <Text fz="sm" fw={600} mb={6}>
                Медиа
              </Text>
              <MediaUploader media={media} onChange={setMedia} />
            </Box>

            {/* Telegram-опции */}
            {hasTelegram && (
              <OptionCard
                icon={<IconBrandTelegram size={18} />}
                color="blue"
                title="Настройки Telegram"
              >
                <Stack gap="sm">
                  <Switch
                    label="Без звука (тихая публикация)"
                    checked={tgSilent}
                    onChange={(e) => setTgSilent(e.currentTarget.checked)}
                  />
                  <Switch
                    label="Скрыть превью ссылок"
                    checked={tgNoPreview}
                    onChange={(e) => setTgNoPreview(e.currentTarget.checked)}
                  />
                  <Select
                    label="Форматирование текста"
                    data={[
                      { value: "none", label: "Обычный текст" },
                      { value: "MarkdownV2", label: "Markdown" },
                      { value: "HTML", label: "HTML" },
                    ]}
                    value={tgParseMode}
                    onChange={setTgParseMode}
                    allowDeselect={false}
                  />
                </Stack>
              </OptionCard>
            )}

            {/* Instagram-опции */}
            {hasInstagram && (
              <OptionCard
                icon={<IconBrandInstagram size={18} />}
                color="grape"
                title="Настройки Instagram"
              >
                <Stack gap="md">
                  <Box>
                    <Text fz="sm" fw={500} mb={6}>
                      Тип публикации
                    </Text>
                    <SegmentedControl
                      fullWidth
                      value={igType}
                      onChange={(v) => setIgType(v as IgPostType)}
                      data={IG_TYPES}
                    />
                    <Text fz="xs" c="dimmed" mt={6}>
                      {igTypeHint(igType)}
                    </Text>
                  </Box>

                  {igType !== "stories" && (
                    <>
                      <TextInput
                        label="Локация"
                        placeholder="Например: Tashkent, Uzbekistan"
                        value={igLocation}
                        onChange={(e) => setIgLocation(e.currentTarget.value)}
                      />
                      <TagsInput
                        label="Отметить людей"
                        placeholder="@username и Enter"
                        value={igTags}
                        onChange={setIgTags}
                        clearable
                      />
                      <TagsInput
                        label="Соавторы (до 3)"
                        description="Пост появится в профилях соавторов"
                        placeholder="@username и Enter"
                        value={igCollabs}
                        onChange={(v) => setIgCollabs(v.slice(0, 3))}
                        maxTags={3}
                        clearable
                      />
                    </>
                  )}

                  {igType === "reels" && (
                    <Switch
                      label="Показать Reels в ленте"
                      checked={igShareToFeed}
                      onChange={(e) => setIgShareToFeed(e.currentTarget.checked)}
                    />
                  )}

                  <Box>
                    <UnstyledButton onClick={advanced.toggle}>
                      <Group gap={6} c="grape.7">
                        <IconSettings size={15} />
                        <Text fz="sm" fw={600}>
                          Расширенные настройки
                        </Text>
                        <IconChevronDown
                          size={14}
                          style={{
                            transform: igAdvanced ? "rotate(180deg)" : "none",
                            transition: "transform 150ms ease",
                          }}
                        />
                      </Group>
                    </UnstyledButton>
                    <Collapse in={igAdvanced}>
                      <Stack gap="sm" mt="sm">
                        <Switch
                          label="Скрыть количество лайков"
                          checked={igHideLikes}
                          onChange={(e) => setIgHideLikes(e.currentTarget.checked)}
                        />
                        <Switch
                          label="Выключить комментарии"
                          checked={igDisableComments}
                          onChange={(e) =>
                            setIgDisableComments(e.currentTarget.checked)
                          }
                        />
                        {igType !== "stories" && (
                          <Textarea
                            label="Альтернативный текст (доступность)"
                            placeholder="Опишите изображение для незрячих"
                            autosize
                            minRows={2}
                            value={igAltText}
                            onChange={(e) => setIgAltText(e.currentTarget.value)}
                          />
                        )}
                      </Stack>
                    </Collapse>
                  </Box>
                </Stack>
              </OptionCard>
            )}

            <Divider />

            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(v) => setMode(v as "now" | "schedule")}
              data={[
                { value: "schedule", label: "📅 По расписанию" },
                { value: "now", label: "⚡ Сейчас" },
              ]}
            />
            {mode === "schedule" && (
              <DateTimePicker
                label="Дата и время публикации"
                placeholder="Выберите момент"
                value={scheduledAt}
                onChange={(v) => setScheduledAt(v as Date | null)}
                valueFormat="DD MMM YYYY, HH:mm"
                clearable
                leftSection={<IconClock size={16} />}
              />
            )}

            <Group justify="space-between" wrap="wrap" gap="sm">
              <Button
                variant="default"
                leftSection={<IconX size={16} />}
                onClick={() => nav("/publications")}
              >
                Отмена
              </Button>
              <Group gap="sm">
                {/* «Сохранить» (черновик) доступно только в режиме «Сейчас».
                    В режиме «По расписанию» — только запланировать или отменить. */}
                {mode === "now" && (
                  <Button
                    variant="light"
                    loading={loading}
                    disabled={isUploading}
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={saveDraft}
                  >
                    Сохранить
                  </Button>
                )}
                <Button
                  loading={loading}
                  disabled={isUploading}
                  leftSection={
                    mode === "now" ? <IconBolt size={16} /> : <IconClock size={16} />
                  }
                  onClick={submit}
                >
                  {isUploading
                    ? "Загрузка медиа…"
                    : mode === "now"
                    ? "Опубликовать сейчас"
                    : "Запланировать"}
                </Button>
              </Group>
            </Group>
          </Stack>
        </Box>

        {/* ---------- Превью (закреплено справа, на всю высоту, со скроллом) ---------- */}
        <Box
          style={
            isMobile ? undefined : { flex: "1 1 42%", minHeight: 0 }
          }
        >
          <Paper
            p="md"
            radius="lg"
            withBorder
            style={{
              height: isMobile ? "auto" : "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Text fz="sm" fw={600} c="dimmed" mb="sm" tt="uppercase">
              Предпросмотр
            </Text>
            {selectedAccounts.length === 0 ? (
              <Alert
                variant="light"
                color="brand"
                icon={<IconInfoCircle size={18} />}
              >
                Выберите аккаунт — здесь появится точное превью для каждой
                площадки.
              </Alert>
            ) : (
              <ScrollArea
                style={{ flex: 1 }}
                type="auto"
                offsetScrollbars
                scrollbarSize={8}
              >
                <Stack gap="xl" pr="sm" pb="md">
                  {selectedAccounts.map((a) => (
                    <Box key={a.id}>
                      <Group gap={6} mb={8}>
                        <ThemeIcon
                          size="sm"
                          variant="light"
                          color={a.platform === "instagram" ? "grape" : "blue"}
                        >
                          {a.platform === "instagram" ? (
                            <IconBrandInstagram size={13} />
                          ) : (
                            <IconBrandTelegram size={13} />
                          )}
                        </ThemeIcon>
                        <Text fz="xs" fw={600} c="dimmed">
                          {a.display_name}
                        </Text>
                        {a.platform === "instagram" && (
                          <Badge size="xs" variant="light" color="grape">
                            {IG_TYPES.find((t) => t.value === igType)?.label}
                          </Badge>
                        )}
                      </Group>
                      <PlatformPreview
                        platform={a.platform}
                        content={caption}
                        media={previewMedia}
                        accountName={a.display_name}
                        igPostType={igType}
                        location={igLocation}
                      />
                    </Box>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

function AccountChip({
  account,
  selected,
  onClick,
}: {
  account: Account;
  selected: boolean;
  onClick: () => void;
}) {
  const logo = account.platform === "instagram" ? INSTAGRAM_LOGO : TELEGRAM_LOGO;
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        position: "relative",
        padding: "10px 12px",
        borderRadius: "var(--mantine-radius-md)",
        border: `2px solid ${
          selected ? "var(--mantine-color-brand-5)" : "var(--mantine-color-gray-3)"
        }`,
        background: selected
          ? "var(--mantine-color-brand-0)"
          : "var(--mantine-color-body)",
        transition: "all 150ms ease",
      }}
    >
      {selected && (
        <ThemeIcon
          size={18}
          radius="xl"
          color="brand"
          style={{ position: "absolute", top: 6, right: 6 }}
        >
          <IconCheck size={11} />
        </ThemeIcon>
      )}
      <Group gap={8} wrap="nowrap">
        <Image src={logo} h={22} w={22} fit="contain" />
        <Text fz="sm" fw={600} lineClamp={1}>
          {account.display_name}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

function OptionCard({
  icon,
  color,
  title,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card withBorder radius="md" p="md">
      <Group gap={8} mb="md">
        <ThemeIcon variant="light" color={color} radius="md">
          {icon}
        </ThemeIcon>
        <Text fw={700}>{title}</Text>
      </Group>
      {children}
    </Card>
  );
}

function igTypeHint(t: IgPostType): string {
  switch (t) {
    case "carousel":
      return "2–10 фото/видео в одном посте, листается.";
    case "reels":
      return "Вертикальное видео до 90 сек. Больше охвата.";
    case "stories":
      return "Исчезает через 24 часа, без подписи.";
    default:
      return "Одиночное фото в ленту с подписью.";
  }
}
