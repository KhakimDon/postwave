import { Badge, Box, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import type { PostStatus } from "../api/types";

const STATUS_MAP: Record<PostStatus, { label: string; color: string }> = {
  draft: { label: "Черновик", color: "gray" },
  scheduled: { label: "Запланирован", color: "blue" },
  publishing: { label: "Публикуется", color: "yellow" },
  published: { label: "Опубликован", color: "teal" },
  failed: { label: "Ошибка", color: "red" },
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS_MAP[status];
  return (
    <Badge color={s.color} variant="light" radius="sm">
      {s.label}
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
