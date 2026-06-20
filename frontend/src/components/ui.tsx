import { Badge, Box, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { PostStatus } from "../api/types";

// Яркие акцентные цвета статуса — читаются поверх любого (даже светлого) медиа.
const STATUS_HEX: Record<PostStatus, string> = {
  draft: "#cdd2da",
  scheduled: "#74a4ff",
  publishing: "#ffd43b",
  published: "#2ce0c0",
  failed: "#ff6b81",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const { t } = useTranslation();
  const hex = STATUS_HEX[status];
  return (
    <Badge
      variant="filled"
      radius="sm"
      leftSection={
        <Box
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: hex,
            boxShadow: `0 0 6px ${hex}`,
          }}
        />
      }
      styles={{
        root: {
          // тёмная «матовая» подложка с блюром — текст всегда контрастный
          background: "rgba(13,15,20,0.60)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: `1px solid ${hex}66`,
          color: hex,
          boxShadow: "0 2px 10px -3px rgba(0,0,0,0.55)",
          textTransform: "none",
          fontWeight: 700,
        },
      }}
    >
      {t(`status.${status}`)}
    </Badge>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap">
      <Box>
        <Text fz={{ base: 22, sm: 26 }} fw={800} lh={1.1}>
          {title}
        </Text>
        {subtitle && (
          <Text c="dimmed" fz="sm" mt={4}>
            {subtitle}
          </Text>
        )}
      </Box>
      {action}
    </Group>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack align="center" gap="sm" py={48} px="md">
      <ThemeIcon size={64} radius="xl" variant="light" color="brand">
        {icon}
      </ThemeIcon>
      <Text fw={700} fz="lg" ta="center">
        {title}
      </Text>
      <Text c="dimmed" fz="sm" ta="center" maw={380}>
        {description}
      </Text>
      {action}
    </Stack>
  );
}
