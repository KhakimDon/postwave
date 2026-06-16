import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { api } from "../api/client";
import type { Account, Post, PostStatus } from "../api/types";
import { PageHeader, StatusBadge, EmptyState } from "../components/ui";

const STATUS_OPTIONS: { value: PostStatus | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "draft", label: "Черновик" },
  { value: "scheduled", label: "Запланирован" },
  { value: "publishing", label: "Публикуется" },
  { value: "published", label: "Опубликован" },
  { value: "failed", label: "Ошибка" },
];

const PAGE_SIZE_OPTIONS = ["6", "12", "24", "48"];
const DEFAULT_PAGE_SIZE = "12";

export function Publications() {
  const nav = useNavigate();
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
    notifications.show({ color: "gray", message: "Пост удалён" });
    load();
  }

  async function publishNow(id: number) {
    try {
      await api.publishNow(id);
      notifications.show({ color: "teal", message: "Опубликовано 🚀" });
      load();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    }
  }

  const accountOptions = useMemo(
    () => [
      { value: "all", label: "Все аккаунты" },
      ...accounts.map((a) => ({ value: String(a.id), label: a.display_name })),
    ],
    [accounts],
  );

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
      <PageHeader
        title="Публикации"
        subtitle="Создавайте посты для Telegram и Instagram и ставьте их на расписание"
        action={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => nav("/compose")}
            disabled={accounts.length === 0}
          >
            Новая публикация
          </Button>
        }
      />

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} h={220} radius="lg" />
          ))}
        </SimpleGrid>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendarTime size={32} />}
            title="Пока нет публикаций"
            description={
              accounts.length === 0
                ? "Сначала подключите аккаунт во вкладке «Аккаунты», затем создайте первый пост."
                : "Создайте первую публикацию — её можно опубликовать сразу или поставить на расписание."
            }
            action={
              accounts.length > 0 && (
                <Button
                  mt="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => nav("/compose")}
                >
                  Создать публикацию
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
              placeholder="Поиск по тексту поста"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Select
              w={180}
              placeholder="Статус"
              data={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
            <Select
              w={200}
              placeholder="Аккаунт"
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
                Сбросить
              </Button>
            )}
          </Group>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconSearch size={32} />}
                title="Ничего не найдено"
                description="По выбранным фильтрам публикаций нет. Измените условия или сбросьте фильтры."
                action={
                  <Button
                    mt="sm"
                    variant="light"
                    leftSection={<IconFilterOff size={16} />}
                    onClick={resetFilters}
                  >
                    Сбросить фильтры
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {pageItems.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={() => remove(post.id)}
                    onPublishNow={() => publishNow(post.id)}
                  />
                ))}
              </SimpleGrid>

              {/* Пагинация + размер страницы */}
              <Group justify="space-between" align="center" mt="xs" wrap="wrap">
                <Text fz="sm" c="dimmed">
                  Показано {pageItems.length} из {filtered.length}
                </Text>
                <Group gap="lg" wrap="wrap">
                  <Group gap="xs">
                    <Text fz="sm" c="dimmed">
                      На странице:
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
  onDelete,
  onPublishNow,
}: {
  post: Post;
  onDelete: () => void;
  onPublishNow: () => void;
}) {
  const when = post.scheduled_at
    ? dayjs(post.scheduled_at).format("DD MMM YYYY, HH:mm")
    : "Без расписания";

  return (
    <Card>
      <Card.Section>
        {post.media_urls[0] ? (
          <Image
            src={post.media_urls[0]}
            h={140}
            fit="cover"
            fallbackSrc="https://placehold.co/400x140?text=Без+фото"
          />
        ) : (
          <Box
            h={140}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--mantine-color-gray-1)",
              color: "var(--mantine-color-gray-5)",
            }}
          >
            <IconPhoto size={28} />
          </Box>
        )}
      </Card.Section>

      <Group justify="space-between" mt="sm" mb={4} wrap="nowrap">
        <StatusBadge status={post.status} />
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray">
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconBolt size={16} />}
              onClick={onPublishNow}
            >
              Опубликовать сейчас
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={onDelete}
            >
              Удалить
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Text fz="sm" lineClamp={3} mih={60}>
        {post.content || <Text span c="dimmed">(без текста)</Text>}
      </Text>

      <Group gap={6} mt="sm" c="dimmed">
        <IconCalendarTime size={14} />
        <Text fz="xs">{when}</Text>
      </Group>

      <Group gap={4} mt={6}>
        {post.targets.map((t) => (
          <Tooltip
            key={t.id}
            label={t.error ?? t.status}
            disabled={!t.error}
            color="red"
          >
            <Box>
              <StatusBadge status={t.status} />
            </Box>
          </Tooltip>
        ))}
      </Group>
    </Card>
  );
}
