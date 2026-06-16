import { useEffect, useState } from "react";
import {
  SimpleGrid,
  Card,
  Text,
  Group,
  ThemeIcon,
  Box,
  Stack,
  Button,
  rem,
} from "@mantine/core";
import {
  IconCalendarTime,
  IconCircleCheck,
  IconPlugConnected,
  IconClockHour4,
  IconArrowRight,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Account, Post } from "../api/types";
import { PageHeader } from "../components/ui";

export function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([api.listPosts(), api.listAccounts()]).then(([p, a]) => {
      setPosts(p);
      setAccounts(a);
    });
  }, []);

  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const published = posts.filter((p) => p.status === "published").length;

  const stats = [
    {
      label: "Запланировано",
      value: scheduled,
      icon: IconClockHour4,
      color: "blue",
    },
    {
      label: "Опубликовано",
      value: published,
      icon: IconCircleCheck,
      color: "teal",
    },
    {
      label: "Аккаунтов",
      value: accounts.length,
      icon: IconPlugConnected,
      color: "grape",
    },
    {
      label: "Всего постов",
      value: posts.length,
      icon: IconCalendarTime,
      color: "brand",
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Обзор"
        subtitle="Ваш центр управления соц-продажами"
      />

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
        {stats.map((s) => (
          <Card key={s.label}>
            <Group justify="space-between" wrap="nowrap">
              <Box>
                <Text fz="xs" c="dimmed" fw={600} tt="uppercase">
                  {s.label}
                </Text>
                <Text fz={rem(30)} fw={800} lh={1.1} mt={4}>
                  {s.value}
                </Text>
              </Box>
              <ThemeIcon size={42} radius="md" variant="light" color={s.color}>
                <s.icon size={22} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card
        p="xl"
        style={{
          background:
            "linear-gradient(135deg, var(--mantine-color-brand-6), var(--mantine-color-grape-5))",
          border: "none",
        }}
      >
        <Stack gap="xs" maw={520}>
          <Text c="white" fw={800} fz={rem(24)}>
            Готовы запустить продажи?
          </Text>
          <Text c="white" opacity={0.9} fz="sm">
            Подключите Telegram-канал и Instagram, подготовьте посты на неделю
            вперёд — Postwave опубликует их точно в срок.
          </Text>
          <Group mt="md">
            <Button
              color="white"
              variant="white"
              c="brand.7"
              rightSection={<IconArrowRight size={16} />}
              onClick={() => nav("/publications")}
            >
              Создать публикацию
            </Button>
            <Button
              variant="white"
              color="white"
              style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
              onClick={() => nav("/accounts")}
            >
              Подключить аккаунт
            </Button>
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}
