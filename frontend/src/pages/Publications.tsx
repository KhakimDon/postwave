import { useEffect, useMemo, useState } from "react";
import { useComposer } from "../composer";
import {
  Button,
  Card,
  Group,
  Text,
  SimpleGrid,
  Image,
  Menu,
  ActionIcon,
  Skeleton,
  Box,
  Tooltip,
  Stack,
  TextInput,
  Select,
  Pagination,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDots,
  IconTrash,
  IconBolt,
  IconCalendarTime,
  IconPhoto,
  IconSearch,
  IconFilterOff,
  IconBrandTelegram,
  IconBrandInstagram,
  IconPencil,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Account, Post, PostStatus } from "../api/types";
import { PageHeader, StatusBadge, EmptyState } from "../components/ui";

const PAGE_SIZE_OPTIONS = ["5", "10", "20", "50", "100"];
const DEFAULT_PAGE_SIZE = "20";

export function Publications({ embedded }: { embedded?: boolean } = {}) {
  const { open, edit } = useComposer();
  const { t } = useTranslation();
  const STATUS_OPTIONS: { value: PostStatus | "all"; label: string }[] = [
    { value: "all", label: t("publications.allStatuses") },
    { value: "draft", label: t("status.draft") },
    { value: "scheduled", label: t("status.scheduled") },
    { value: "publishing", label: t("status.publishing") },
    { value: "published", label: t("status.published") },
    { value: "failed", label: t("status.failed") },
  ];
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Фильтры и пагинация (клиентские — listPosts отдаёт весь список).
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>("all");
  const [account, setAccount] = useState<string | null>("all");
  const [pageSize, setPageSize] = useState<string | null>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [p, a] = await Promise.all([api.listPosts(), api.listAccounts()]);
      setPosts(p);
      setAccounts(a);
    } catch (e) {
      if (!silent) notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // тихое авто-обновление: статусы «запланирован → опубликован» видно вживую
    const timer = setInterval(() => load(true), 10000);
    return () => clearInterval(timer);
  }, []);

  // Любое изменение фильтров возвращает на первую страницу.
  useEffect(() => {
    setPage(1);
  }, [search, status, account, pageSize]);

  async function remove(id: number) {
    await api.deletePost(id);
    notifications.show({ color: "gray", message: t("publications.deletedToast") });
    load();
  }

  async function publishNow(id: number) {
    try {
      await api.publishNow(id);
      notifications.show({ color: "teal", message: t("publications.publishedToast") });
      load();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    }
  }

  const accountOptions = useMemo(
    () => [
      { value: "all", label: t("publications.allAccounts") },
      ...accounts.map((a) => ({ value: String(a.id), label: a.display_name })),
    ],
    [accounts, t],
  );

  const accountMap = useMemo(() => {
    const m = new Map<number, Account>();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);

  const hasFilters =
    search.trim() !== "" || status !== "all" || account !== "all";

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setAccount("all");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (q && !p.content.toLowerCase().includes(q)) return false;
      if (status && status !== "all" && p.status !== status) return false;
      if (
        account &&
        account !== "all" &&
        !p.targets.some((t) => String(t.account_id) === account)
      )
        return false;
      return true;
    });
  }, [posts, search, status, account]);

  const size = Number(pageSize) || Number(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * size, safePage * size),
    [filtered, safePage, size],
  );

  return (
    <Box>
      {!embedded && (
        <PageHeader
          title={t("publications.title")}
          subtitle={t("publications.subtitle")}
          action={
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => open()}
              disabled={accounts.length === 0}
            >
              {t("publications.newBtn")}
            </Button>
          }
        />
      )}

      {loading ? (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 4, xl: 5 }} spacing="md">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} h={240} radius={20} />
          ))}
        </SimpleGrid>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendarTime size={32} />}
            title={t("publications.emptyTitle")}
            description={
              accounts.length === 0
                ? t("publications.emptyDescNoAccounts")
                : t("publications.emptyDesc")
            }
            action={
              accounts.length > 0 && (
                <Button
                  mt="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => open()}
                >
                  {t("publications.createBtn")}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Stack gap="md">
          {/* Панель фильтров */}
          <Group gap="sm" align="flex-end" wrap="wrap">
            <TextInput
              flex={1}
              miw={220}
              placeholder={t("publications.searchPh")}
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Select
              w={180}
              placeholder={t("publications.statusPh")}
              data={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
            <Select
              w={200}
              placeholder={t("publications.accountPh")}
              data={accountOptions}
              value={account}
              onChange={setAccount}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
            {hasFilters && (
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconFilterOff size={16} />}
                onClick={resetFilters}
              >
                {t("publications.reset")}
              </Button>
            )}
          </Group>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconSearch size={32} />}
                title={t("publications.notFoundTitle")}
                description={t("publications.notFoundDesc")}
                action={
                  <Button
                    mt="sm"
                    variant="light"
                    leftSection={<IconFilterOff size={16} />}
                    onClick={resetFilters}
                  >
                    {t("publications.resetFilters")}
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 4, xl: 5 }} spacing="md">
                {pageItems.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    accountMap={accountMap}
                    onDelete={() => remove(post.id)}
                    onPublishNow={() => publishNow(post.id)}
                    onEdit={() => edit(post, "edit")}
                    onRepublish={() => edit(post, "republish")}
                  />
                ))}
              </SimpleGrid>

              {/* Пагинация + размер страницы */}
              <Group justify="space-between" align="center" mt="xs" wrap="wrap">
                <Text fz="sm" c="dimmed">
                  {t("publications.shown", { shown: pageItems.length, total: filtered.length })}
                </Text>
                <Group gap="lg" wrap="wrap">
                  <Group gap="xs">
                    <Text fz="sm" c="dimmed">
                      {t("publications.perPage")}
                    </Text>
                    <Select
                      w={84}
                      data={PAGE_SIZE_OPTIONS}
                      value={pageSize}
                      onChange={(v) => setPageSize(v ?? DEFAULT_PAGE_SIZE)}
                      allowDeselect={false}
                      comboboxProps={{ withinPortal: true }}
                    />
                  </Group>
                  {totalPages > 1 && (
                    <Pagination
                      value={safePage}
                      onChange={setPage}
                      total={totalPages}
                      withEdges
                    />
                  )}
                </Group>
              </Group>
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}

function PostCard({
  post,
  accountMap,
  onDelete,
  onPublishNow,
  onEdit,
  onRepublish,
}: {
  post: Post;
  accountMap: Map<number, Account>;
  onDelete: () => void;
  onPublishNow: () => void;
  onEdit: () => void;
  onRepublish: () => void;
}) {
  const { t } = useTranslation();
  const when = post.scheduled_at
    ? dayjs(post.scheduled_at).format("DD MMM, HH:mm")
    : t("publications.noSchedule");
  const mediaCount = post.media_urls.length;

  return (
    <Card p={0} style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Медиа + оверлеи: статус, меню, счётчик медиа */}
      <Box style={{ position: "relative" }}>
        {post.media_urls[0] ? (
          <Image src={post.media_urls[0]} h={130} fit="cover" />
        ) : (
          <Box
            h={130}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, rgba(125,82,249,0.28), rgba(74,163,255,0.22))",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <IconPhoto size={26} />
          </Box>
        )}
        <Box style={{ position: "absolute", top: 8, left: 8 }}>
          <StatusBadge status={post.status} />
        </Box>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="default"
              size="sm"
              radius="md"
              style={{ position: "absolute", top: 8, right: 8 }}
            >
              <IconDots size={15} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {post.status === "scheduled" && (
              <Menu.Item leftSection={<IconPencil size={16} />} onClick={onEdit}>
                {t("publications.edit")}
              </Menu.Item>
            )}
            {post.status === "published" ? (
              <Menu.Item leftSection={<IconBolt size={16} />} onClick={onRepublish}>
                {t("publications.editPublish")}
              </Menu.Item>
            ) : (
              <Menu.Item leftSection={<IconBolt size={16} />} onClick={onPublishNow}>
                {t("publications.publishNow")}
              </Menu.Item>
            )}
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={onDelete}
            >
              {t("publications.deleteItem")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        {mediaCount > 1 && (
          <Badge
            size="sm"
            variant="filled"
            color="dark"
            leftSection={<IconPhoto size={11} />}
            style={{ position: "absolute", bottom: 8, right: 8 }}
          >
            {mediaCount}
          </Badge>
        )}
      </Box>

      <Stack gap={8} p="sm" style={{ flex: 1 }}>
        {/* Индикаторы: в какие аккаунты/платформы идёт пост.
            Иконка соцсети с лёгким неоновым свечением + имя аккаунта в её цвете. */}
        {post.targets.length > 0 && (
          <Group gap={6} wrap="wrap">
            {post.targets.map((tg) => {
              const acc = accountMap.get(tg.account_id);
              const ig = acc?.platform === "instagram";
              const color = tg.error ? "#ff5470" : ig ? "#e1306c" : "#2aabee";
              return (
                <Tooltip
                  key={tg.id}
                  withArrow
                  label={`${acc?.display_name ?? "—"} · ${t(`status.${tg.status}`)}${
                    tg.error ? ` · ${tg.error}` : ""
                  }`}
                  color={tg.error ? "red" : undefined}
                >
                  <Group
                    gap={5}
                    wrap="nowrap"
                    style={{
                      padding: "3px 9px 3px 7px",
                      borderRadius: 999,
                      maxWidth: "100%",
                      background: `${color}1f`,
                      border: `1px solid ${color}59`,
                    }}
                  >
                    <Box
                      style={{
                        display: "flex",
                        color,
                        filter: `drop-shadow(0 0 4px ${color}b3)`,
                      }}
                    >
                      {ig ? (
                        <IconBrandInstagram size={13} />
                      ) : (
                        <IconBrandTelegram size={13} />
                      )}
                    </Box>
                    <Text fz={10} fw={700} lineClamp={1} style={{ color, lineHeight: 1.15 }}>
                      {acc?.display_name ?? "—"}
                    </Text>
                  </Group>
                </Tooltip>
              );
            })}
          </Group>
        )}

        <Text fz="sm" lineClamp={2} mih={38}>
          {post.content || (
            <Text span c="dimmed">
              {t("common.noText")}
            </Text>
          )}
        </Text>

        <Group gap={6} c="dimmed" mt="auto" wrap="nowrap">
          <IconCalendarTime size={14} />
          <Text fz="xs" lineClamp={1}>
            {when}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}
