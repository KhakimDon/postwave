import { Box, Group, Loader, Progress, Text, ActionIcon, ThemeIcon } from "@mantine/core";
import { IconCheck, IconX, IconAlertTriangle } from "@tabler/icons-react";
import { usePublish, closePublish } from "../publishProgress";

/** Плавающий блок прогресса публикации (справа снизу). */
export function PublishProgress() {
  const s = usePublish();
  if (!s.active) return null;

  const color = s.phase === "error" ? "red" : s.phase === "done" ? "teal" : "brand";

  return (
    <Box
      className="glass"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 500,
        width: 320,
        maxWidth: "calc(100vw - 32px)",
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 18px 50px -18px rgba(0,0,0,0.5)",
        animation: "pwSlideUp 240ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <Group justify="space-between" wrap="nowrap" mb={8} gap={8}>
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          {s.phase === "running" && <Loader size={16} />}
          {s.phase === "done" && (
            <ThemeIcon size={18} radius="xl" color="teal">
              <IconCheck size={12} />
            </ThemeIcon>
          )}
          {s.phase === "error" && (
            <ThemeIcon size={18} radius="xl" color="red">
              <IconAlertTriangle size={12} />
            </ThemeIcon>
          )}
          <Text fz="sm" fw={600} lineClamp={2}>
            {s.message}
          </Text>
        </Group>
        {s.phase !== "running" && (
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={closePublish}>
            <IconX size={15} />
          </ActionIcon>
        )}
      </Group>

      <Progress
        value={s.percent}
        color={color}
        radius="xl"
        size="md"
        striped={s.phase === "running"}
        animated={s.phase === "running"}
      />
      <Text fz="xs" c="dimmed" mt={6} ta="right">
        {s.phase === "error" ? "Ошибка" : `${Math.round(s.percent)}%`}
      </Text>
    </Box>
  );
}
