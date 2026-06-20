import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Stack,
  Textarea,
  Group,
  Button,
  Box,
  Text,
  Card,
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
  ActionIcon,
  Popover,
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
  IconLink,
  IconSparkles,
  IconBrandInstagram,
  IconChevronDown,
  IconChevronRight,
  IconInfoCircle,
  IconSettings,
  IconDeviceFloppy,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { runPublish } from "../publishProgress";
import { composerGuard } from "../composerGuard";
import type { Account, IgPostType, PlatformOptions, Post } from "../api/types";
import { MediaUploader, type MediaItem } from "../components/MediaUploader";
import { PlatformPreview } from "../components/PlatformPreview";

const TELEGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png";
const INSTAGRAM_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/9/95/Instagram_logo_2022.svg";

const HINT_KEY: Record<IgPostType, string> = {
  feed: "compose.hintFeed",
  carousel: "compose.hintCarousel",
  reels: "compose.hintReels",
  stories: "compose.hintStories",
};

const AI_LANGS: { code: string; label: string; flag: string }[] = [
  { code: "uz", label: "Oʻzbekcha", flag: "🇺🇿" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export function Compose({
  initialDate,
  onClose,
  embedded,
  initialPost,
  intent = "create",
  step: stepProp,
  onStepChange,
}: {
  initialDate?: string | null;
  onClose?: () => void;
  embedded?: boolean;
  initialPost?: Post;
  intent?: "create" | "edit" | "republish";
  step?: number;
  onStepChange?: (s: number) => void;
} = {}) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const mobile = useMediaQuery("(max-width: 768px)");
  // десктоп: редактор сбоку + превью по центру; телефон: стопкой
  const isMobile = mobile;
  const IG_TYPES: { value: IgPostType; label: string }[] = [
    { value: "feed", label: t("compose.igFeed") },
    { value: "carousel", label: t("compose.igCarousel") },
    { value: "reels", label: t("compose.igReels") },
    { value: "stories", label: t("compose.igStories") },
  ];
  const [searchParams] = useSearchParams();
  // дата приходит пропсом (панель) или из query (страница /compose?date=YYYY-MM-DD)
  const dateParam = initialDate ?? searchParams.get("date");

  // успешно создали/отменили: закрываем панель ИЛИ уходим на /posts
  function done() {
    if (onClose) onClose();
    else nav("/posts");
  }

  // Данные для предзаполнения (редактирование / «изменить и опубликовать»).
  // platform_options не описаны в типе Post, но приходят с бэкенда — читаем кастом.
  const ipOpts = (initialPost as { platform_options?: PlatformOptions } | undefined)
    ?.platform_options;
  const ipTg = ipOpts?.telegram;
  const ipIg = ipOpts?.instagram;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialPost ? Array.from(new Set(initialPost.targets.map((t) => t.account_id))) : []
  );
  const [caption, setCaption] = useState(initialPost?.content ?? "");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  // шаг мастера: 0 аккаунт,1 контент,2 настройки,3 публикация.
  // приходит пропсом из composer (индикатор в хидере) или локальный фолбэк.
  const [localStep, setLocalStep] = useState(0);
  const step = stepProp ?? localStep;
  const setStep = (u: number | ((s: number) => number)) => {
    const next = typeof u === "function" ? u(step) : u;
    if (onStepChange) onStepChange(next);
    else setLocalStep(next);
  };
  const [aiPopOpen, setAiPopOpen] = useState(false);
  // порядок важен — генерация идёт в порядке выбора (1-й, 2-й, 3-й)
  const [aiLangs, setAiLangs] = useState<string[]>(["uz"]);
  const [media, setMedia] = useState<MediaItem[]>(
    initialPost
      ? initialPost.media_urls.map((u) => ({
          id: u,
          previewUrl: u,
          url: u,
          uploading: false,
          isVideo: /\.(mp4|mov|webm|m4v)$/i.test(u),
        }))
      : []
  );
  // По умолчанию «По расписанию». Для «изменить и опубликовать» — сразу «Сейчас».
  const [mode, setMode] = useState<"now" | "schedule">(
    intent === "republish" ? "now" : "schedule"
  );
  const [scheduledAt, setScheduledAt] = useState<Date | null>(
    initialPost?.scheduled_at
      ? new Date(initialPost.scheduled_at)
      : dateParam
      ? new Date(`${dateParam}T12:00`)
      : null
  );
  const [loading, setLoading] = useState(false);

  // Telegram options
  const [tgSilent, setTgSilent] = useState(ipTg?.silent ?? false);
  const [tgNoPreview, setTgNoPreview] = useState(ipTg?.no_preview ?? false);
  const [tgAsFile, setTgAsFile] = useState(ipTg?.as_file ?? false);
  const [tgParseMode, setTgParseMode] = useState<string | null>(ipTg?.parse_mode ?? "none");

  // Instagram options
  const [igType, setIgType] = useState<IgPostType>(ipIg?.post_type ?? "feed");
  const [igLocation, setIgLocation] = useState(ipIg?.location ?? "");
  const [igTags, setIgTags] = useState<string[]>(ipIg?.user_tags ?? []);
  const [igCollabs, setIgCollabs] = useState<string[]>(ipIg?.collaborators ?? []);
  const [igHideLikes, setIgHideLikes] = useState(ipIg?.hide_likes ?? false);
  const [igDisableComments, setIgDisableComments] = useState(ipIg?.disable_comments ?? false);
  const [igAltText, setIgAltText] = useState(ipIg?.alt_text ?? "");
  const [igShareToFeed, setIgShareToFeed] = useState(ipIg?.share_to_feed ?? true);
  const [igAdvanced, advanced] = useDisclosure(false);

  useEffect(() => {
    // публикуем только в каналы/Instagram; личный TG-аккаунт инбокса (telegram_user)
    // — не цель публикации
    api
      .listAccounts()
      .then((a) => setAccounts(a.filter((x) => x.platform !== "telegram_user")))
      .catch(() => {});
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

  // Стянуть карточку товара по ссылке: текст + картинки → в пост.
  async function pullCard() {
    const url = scrapeUrl.trim();
    if (!url) return;
    setScraping(true);
    try {
      const r = await api.scrapeCard(url);
      const text = [r.title, r.description].filter(Boolean).join("\n\n");
      if (text) setCaption((c) => (c.trim() ? `${c}\n\n${text}` : text));
      if (r.images.length) {
        setMedia((prev) => [
          ...prev,
          ...r.images.map((u) => ({
            id: crypto.randomUUID(),
            previewUrl: u,
            url: u,
            uploading: false,
            isVideo: false,
          })),
        ]);
      }
      notifications.show({ color: "teal", message: t("compose.cardPulled") });
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setScraping(false);
    }
  }

  // все загруженные картинки (не видео) — для генерации по фото
  const imageUrls = media
    .filter((m) => m.url && !m.isVideo)
    .map((m) => m.url!) as string[];
  // кнопка AI активна, если есть хоть один источник: ссылка / фото / текст
  const canAi = !!scrapeUrl.trim() || imageUrls.length > 0 || !!caption.trim();

  // есть несохранённые данные → предупреждаем при закрытии/обновлении
  const isDirty =
    !!caption.trim() ||
    media.length > 0 ||
    !!scrapeUrl.trim() ||
    selectedIds.length > 0;
  useEffect(() => {
    composerGuard.setDirty(isDirty);
    return () => composerGuard.setDirty(false);
  }, [isDirty]);

  function toggleLang(code: string) {
    setAiLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  // AI: сгенерировать на выбранных языках. Приоритет источника: ссылка → фото → текст.
  async function aiGenerate() {
    const url = scrapeUrl.trim();
    const text = caption.trim();
    if (!url && imageUrls.length === 0 && !text) {
      notifications.show({ color: "yellow", message: t("compose.aiNeedSource") });
      return;
    }
    const languages = aiLangs;
    if (languages.length === 0) return;
    setAiGenerating(true);
    try {
      const base = url
        ? { url, text }
        : imageUrls.length
        ? { image_urls: imageUrls, text }
        : { text };
      const r = await api.aiDescribe({ ...base, languages });
      if (r.caption) setCaption(r.caption);
      setAiPopOpen(false);
      notifications.show({ color: "teal", message: t("compose.aiDone") });
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setAiGenerating(false);
    }
  }

  function buildOptions(): PlatformOptions {
    const platform_options: PlatformOptions = {};
    if (hasTelegram) {
      platform_options.telegram = {
        silent: tgSilent,
        no_preview: tgNoPreview,
        as_file: tgAsFile,
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
      notifications.show({ color: "red", message: t("compose.errSelectAccount") });
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
        message: t("compose.draftSaved"),
      });
      composerGuard.setDirty(false);
      done();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (selectedIds.length === 0) {
      notifications.show({ color: "red", message: t("compose.errSelectAccount") });
      return;
    }
    if (mode === "schedule" && !scheduledAt) {
      notifications.show({ color: "red", message: t("compose.errDateTime") });
      return;
    }
    setLoading(true);
    let post: Post;
    try {
      post = await api.createPost({
        content: caption,
        media_urls: uploadedUrls,
        scheduled_at:
          mode === "schedule" && scheduledAt ? scheduledAt.toISOString() : null,
        account_ids: selectedIds,
        platform_options: buildOptions(),
      });
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
      setLoading(false);
      return;
    }
    setLoading(false);
    composerGuard.setDirty(false);
    done(); // закрываем модалку сразу

    // запланировано — без публикации
    if (mode !== "now") {
      notifications.show({ color: "teal", message: t("compose.scheduledToast") });
      if (intent === "edit" && initialPost) {
        api.deletePost(initialPost.id).catch(() => {});
      }
      return;
    }

    // публикуем сейчас в фоне — тост на каждый аккаунт по мере публикации
    const postId = post.id;
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    const seen = new Set<number>();
    const toastTargets = (p?: Post) => {
      if (!p) return;
      for (const tg of p.targets) {
        if (seen.has(tg.id)) continue;
        if (tg.status === "published") {
          seen.add(tg.id);
          notifications.show({
            color: "teal",
            title: accMap.get(tg.account_id)?.display_name,
            message: t("compose.publishedToAccount"),
          });
        } else if (tg.status === "failed") {
          seen.add(tg.id);
          notifications.show({
            color: "red",
            title: accMap.get(tg.account_id)?.display_name,
            message: tg.error || t("compose.publishFailedAccount"),
          });
        }
      }
    };

    runPublish(
      t("compose.publishingNow"),
      t("compose.publishedToast"),
      async () => {
        const iv = setInterval(async () => {
          try {
            const posts = await api.listPosts();
            toastTargets(posts.find((x) => x.id === postId));
          } catch {
            /* игнор */
          }
        }, 1500);
        try {
          await api.publishNow(postId);
        } finally {
          clearInterval(iv);
          // финальная проверка — добить тосты, что не успел поллинг
          try {
            const posts = await api.listPosts();
            toastTargets(posts.find((x) => x.id === postId));
          } catch {
            /* игнор */
          }
        }
        if (intent === "edit" && initialPost) {
          try {
            await api.deletePost(initialPost.id);
          } catch {
            /* не критично */
          }
        }
      }
    ).catch(() => {
      /* ошибка уже в блоке прогресса/тостах */
    });
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />}>
          {t("compose.needAccountFirst")}
          <Button
            ml="md"
            size="xs"
            onClick={() => {
              onClose?.();
              nav("/accounts");
            }}
          >
            {t("compose.toAccounts")}
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
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }
      }
    >
      {!embedded && (
        <Group mb="md" gap="sm" style={{ flexShrink: 0 }}>
          <ActionIcon variant="subtle" size="lg" onClick={() => done()}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Text fz={{ base: 22, sm: 26 }} fw={800}>
            {t("compose.newTitle")}
          </Text>
        </Group>
      )}

      <Box
        style={
          isMobile
            ? { display: "flex", flexDirection: "column", gap: 16, padding: 16 }
            : { display: "flex", flex: 1, minHeight: 0 }
        }
      >
        {/* ---------- Редактор (сбоку, скроллится) ---------- */}
        <Box
          style={
            isMobile
              ? undefined
              : {
                  width: 460,
                  flexShrink: 0,
                  overflowY: "auto",
                  minHeight: 0,
                  padding: 22,
                  borderRight: "1px solid var(--glass-border)",
                }
          }
        >
          <Stack gap="lg">
            {/* ===== Шаг 1: аккаунты ===== */}
            {step === 0 && (
              <Box>
                <Text fz="sm" fw={600} mb={8}>
                  {t("compose.whereToPublish")}
                </Text>
                <Group gap="sm" wrap="wrap">
                  {accounts.map((a) => (
                    <AccountChip
                      key={a.id}
                      account={a}
                      selected={selectedIds.includes(a.id)}
                      onClick={() => toggleAccount(a.id)}
                    />
                  ))}
                </Group>
              </Box>
            )}

            {/* ===== Шаг 2: текст и фото ===== */}
            {step === 1 && (
              <>
            {/* Стянуть карточку товара по ссылке (Uzum/Wildberries/Ozon и др.) */}
            <Box>
              <Group gap={6} mb={6} align="center" wrap="nowrap">
                <Text fz="sm" fw={600}>
                  {t("compose.pullCardLabel")}
                </Text>
                <Popover
                  opened={hintOpen}
                  onChange={setHintOpen}
                  width={250}
                  position="top"
                  withArrow
                  shadow="md"
                >
                  <Popover.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      radius="xl"
                      onClick={() => setHintOpen((o) => !o)}
                      aria-label="info"
                      style={{ color: "var(--mantine-color-dimmed)" }}
                    >
                      <IconInfoCircle size={15} />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Text fz="xs">{t("compose.pullCardHint")}</Text>
                    <Text fz="xs" fw={700} mt={8}>
                      {t("compose.pullCardSitesTitle")}
                    </Text>
                    <Text fz="xs" c="dimmed">
                      {t("compose.pullCardSites")}
                    </Text>
                  </Popover.Dropdown>
                </Popover>
              </Group>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <TextInput
                  style={{ flex: 1 }}
                  placeholder={t("compose.pullCardPh")}
                  leftSection={<IconLink size={15} />}
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      pullCard();
                    }
                  }}
                />
                <Button
                  variant="light"
                  loading={scraping}
                  onClick={pullCard}
                  disabled={!scrapeUrl.trim()}
                >
                  {t("compose.pullCardBtn")}
                </Button>
              </Group>
            </Box>

            <Box>
              <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                <Text fz="sm" fw={500}>
                  {t("compose.captionLabel")}
                </Text>
                <Popover
                  opened={aiPopOpen}
                  onChange={setAiPopOpen}
                  position="bottom-end"
                  offset={8}
                  withinPortal
                  transitionProps={{ transition: "pop-top-right", duration: 180 }}
                  classNames={{ dropdown: "pw-acc-pop" }}
                >
                  <Popover.Target>
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="grape"
                      radius="xl"
                      leftSection={<IconSparkles size={13} />}
                      onClick={() => canAi && setAiPopOpen((o) => !o)}
                      disabled={!canAi}
                      loading={aiGenerating}
                      className="pw-ai-btn"
                    >
                      AI
                    </Button>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Stack gap={6} style={{ minWidth: 190 }}>
                      <Text fz="xs" fw={600} c="dimmed">
                        {t("compose.aiPickLang")}
                      </Text>
                      {AI_LANGS.map((l) => {
                        const order = aiLangs.indexOf(l.code);
                        return (
                          <UnstyledButton
                            key={l.code}
                            className="pw-acc-item"
                            data-active={order >= 0 || undefined}
                            onClick={() => toggleLang(l.code)}
                          >
                            <span style={{ fontSize: 17 }}>{l.flag}</span>
                            <span className="pw-acc-name">{l.label}</span>
                            {order >= 0 && (
                              <span className="pw-lang-order">{order + 1}</span>
                            )}
                          </UnstyledButton>
                        );
                      })}
                      <Button
                        size="xs"
                        mt={4}
                        leftSection={<IconSparkles size={14} />}
                        loading={aiGenerating}
                        disabled={aiLangs.length === 0}
                        onClick={aiGenerate}
                      >
                        {t("compose.aiGenerate")}
                      </Button>
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
              </Group>
              <Textarea
                placeholder={t("compose.captionPh")}
                autosize
                minRows={5}
                maxRows={14}
                value={caption}
                onChange={(e) => setCaption(e.currentTarget.value)}
              />
            </Box>

            <Box>
              <Text fz="sm" fw={600} mb={6}>
                {t("compose.mediaLabel")}
              </Text>
              <MediaUploader media={media} onChange={setMedia} />
            </Box>
              </>
            )}

            {/* ===== Шаг 3: настройки ===== */}
            {step === 2 && (
              <>
            {/* Telegram-опции */}
            {hasTelegram && (
              <OptionCard
                icon={<IconBrandTelegram size={18} />}
                color="blue"
                title={t("compose.tgSettings")}
              >
                <Stack gap="sm">
                  <Switch
                    label={t("compose.tgHqLabel")}
                    description={t("compose.tgHqHint")}
                    checked={tgAsFile}
                    onChange={(e) => setTgAsFile(e.currentTarget.checked)}
                  />
                  <Switch
                    label={t("compose.tgSilent")}
                    checked={tgSilent}
                    onChange={(e) => setTgSilent(e.currentTarget.checked)}
                  />
                  <Switch
                    label={t("compose.tgNoPreview")}
                    checked={tgNoPreview}
                    onChange={(e) => setTgNoPreview(e.currentTarget.checked)}
                  />
                  <Select
                    label={t("compose.tgFormat")}
                    data={[
                      { value: "none", label: t("compose.tgFormatNone") },
                      { value: "MarkdownV2", label: t("compose.tgFormatMd") },
                      { value: "HTML", label: t("compose.tgFormatHtml") },
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
                title={t("compose.igSettings")}
              >
                <Stack gap="md">
                  <Box>
                    <Text fz="sm" fw={500} mb={6}>
                      {t("compose.igPostType")}
                    </Text>
                    <SegmentedControl
                      fullWidth
                      value={igType}
                      onChange={(v) => setIgType(v as IgPostType)}
                      data={IG_TYPES}
                    />
                    <Text fz="xs" c="dimmed" mt={6}>
                      {t(HINT_KEY[igType])}
                    </Text>
                  </Box>

                  {igType !== "stories" && (
                    <>
                      <TextInput
                        label={t("compose.locationLabel")}
                        placeholder={t("compose.locationPh")}
                        value={igLocation}
                        onChange={(e) => setIgLocation(e.currentTarget.value)}
                      />
                      <TagsInput
                        label={t("compose.tagPeopleLabel")}
                        placeholder={t("compose.tagPeoplePh")}
                        value={igTags}
                        onChange={setIgTags}
                        clearable
                      />
                      <TagsInput
                        label={t("compose.collabLabel")}
                        description={t("compose.collabDesc")}
                        placeholder={t("compose.tagPeoplePh")}
                        value={igCollabs}
                        onChange={(v) => setIgCollabs(v.slice(0, 3))}
                        maxTags={3}
                        clearable
                      />
                    </>
                  )}

                  {igType === "reels" && (
                    <Switch
                      label={t("compose.showInFeed")}
                      checked={igShareToFeed}
                      onChange={(e) => setIgShareToFeed(e.currentTarget.checked)}
                    />
                  )}

                  <Box>
                    <UnstyledButton onClick={advanced.toggle}>
                      <Group gap={6} c="grape.7">
                        <IconSettings size={15} />
                        <Text fz="sm" fw={600}>
                          {t("compose.advanced")}
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
                          label={t("compose.hideLikes")}
                          checked={igHideLikes}
                          onChange={(e) => setIgHideLikes(e.currentTarget.checked)}
                        />
                        <Switch
                          label={t("compose.disableComments")}
                          checked={igDisableComments}
                          onChange={(e) =>
                            setIgDisableComments(e.currentTarget.checked)
                          }
                        />
                        {igType !== "stories" && (
                          <Textarea
                            label={t("compose.altLabel")}
                            placeholder={t("compose.altPh")}
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
              </>
            )}

            {/* ===== Шаг 4: публикация ===== */}
            {step === 3 && (
              <>
            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(v) => setMode(v as "now" | "schedule")}
              data={[
                { value: "schedule", label: t("compose.modeSchedule") },
                { value: "now", label: t("compose.modeNow") },
              ]}
            />
            {mode === "schedule" && (
              <DateTimePicker
                label={t("compose.dateLabel")}
                placeholder={t("compose.datePh")}
                value={scheduledAt}
                onChange={(v) => setScheduledAt(v as Date | null)}
                valueFormat="DD MMM YYYY, HH:mm"
                clearable
                leftSection={<IconClock size={16} />}
              />
            )}
              </>
            )}

            <Divider />

            {/* ===== Навигация мастера ===== */}
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Button
                variant="default"
                leftSection={step === 0 ? <IconX size={16} /> : <IconArrowLeft size={16} />}
                onClick={() => (step === 0 ? done() : setStep((s) => s - 1))}
              >
                {step === 0 ? t("common.cancel") : t("common.back")}
              </Button>

              {step < 3 ? (
                <Button
                  rightSection={<IconChevronRight size={16} />}
                  disabled={step === 0 && selectedIds.length === 0}
                  onClick={() => setStep((s) => s + 1)}
                >
                  {t("common.next")}
                </Button>
              ) : (
                <Group gap="sm">
                  {intent === "create" && mode === "now" && (
                    <Button
                      variant="light"
                      loading={loading}
                      disabled={isUploading}
                      leftSection={<IconDeviceFloppy size={16} />}
                      onClick={saveDraft}
                    >
                      {t("compose.saveDraft")}
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
                      ? t("compose.uploadingMedia")
                      : mode === "now"
                      ? t("compose.publishNowBtn")
                      : t("compose.scheduleBtn")}
                  </Button>
                </Group>
              )}
            </Group>
          </Stack>
        </Box>

        {/* ---------- Превью (по центру, закреплено) ---------- */}
        <Box
          style={
            isMobile
              ? undefined
              : {
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  padding: 24,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-start",
                }
          }
        >
          <Box style={{ width: "100%" }}>
            <Text fz="sm" fw={600} c="dimmed" mb="md" tt="uppercase" ta="center">
              {t("compose.previewTitle")}
            </Text>
            {selectedAccounts.length === 0 ? (
              <Alert
                variant="light"
                color="brand"
                icon={<IconInfoCircle size={18} />}
              >
                {t("compose.previewHint")}
              </Alert>
            ) : (
              <Group align="flex-start" justify="center" gap="xl" wrap="wrap" pb="md">
                {selectedAccounts.map((a) => (
                  <Box key={a.id} style={{ width: 340, maxWidth: "100%" }}>
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
                          {IG_TYPES.find((x) => x.value === igType)?.label}
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
              </Group>
            )}
          </Box>
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
          selected ? "var(--accent-border)" : "var(--border-1)"
        }`,
        background: selected ? "var(--accent-soft)" : "var(--surface-1)",
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
      <Group gap={8} wrap="nowrap" style={{ paddingRight: selected ? 18 : 0 }}>
        <Image src={logo} h={22} w={22} fit="contain" style={{ flexShrink: 0 }} />
        <Text fz="sm" fw={600} style={{ whiteSpace: "nowrap" }}>
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

