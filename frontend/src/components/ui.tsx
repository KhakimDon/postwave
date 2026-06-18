import { Badge, Box, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { PostStatus } from "../api/types";

const STATUS_COLOR: Record<PostStatus, string> = {
  draft: "gray",
  scheduled: "blue",
  publishing: "yellow",
  published: "teal",
  failed: "red",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const { t } = useTranslation();
  return (
    <Badge color={STATUS_COLOR[status]} variant="light" radius="sm">
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
