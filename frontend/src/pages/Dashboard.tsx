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
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Account, Post } from "../api/types";
import { PageHeader } from "../components/ui";
import { useComposer } from "../composer";

export function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const nav = useNavigate();
  const { open } = useComposer();
  const { t } = useTranslation();

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
      label: t("dashboard.statScheduled"),
      value: scheduled,
      icon: IconClockHour4,
      color: "blue",
    },
    {
      label: t("dashboard.statPublished"),
      value: published,
      icon: IconCircleCheck,
      color: "teal",
    },
    {
      label: t("dashboard.statAccounts"),
      value: accounts.length,
      icon: IconPlugConnected,
      color: "grape",
    },
    {
      label: t("dashboard.statPosts"),
      value: posts.length,
      icon: IconCalendarTime,
      color: "brand",
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
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
            "linear-gradient(135deg, #6f3df0 0%, #7d52f9 35%, #4aa3ff 100%)",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow:
            "0 24px 70px -22px rgba(74,120,255,0.6), inset 0 1px 0 0 rgba(255,255,255,0.18)",
        }}
      >
        <Stack gap="xs" maw={520}>
          <Text c="white" fw={800} fz={rem(24)}>
            {t("dashboard.ctaTitle")}
          </Text>
          <Text c="white" opacity={0.9} fz="sm">
            {t("dashboard.ctaText")}
          </Text>
          <Group mt="md">
            <Button
              color="white"
              variant="white"
              c="brand.7"
              rightSection={<IconArrowRight size={16} />}
              onClick={() => open()}
            >
              {t("dashboard.ctaCreate")}
            </Button>
            <Button
              variant="white"
              color="white"
              style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
              onClick={() => nav("/accounts")}
            >
              {t("dashboard.ctaConnect")}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}
