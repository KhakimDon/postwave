import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { KanbanColumn } from "../api/types";
import { MediaUploader, type MediaItem } from "./MediaUploader";
import { PlatformPreview } from "./PlatformPreview";

/** Массовая рассылка как публикация: текст + медиа, с превью. Уходит всем чатам
 *  выбранной колонки через текущий Telegram-аккаунт. */
export function BroadcastModal({
  opened,
  onClose,
  accountId,
  accountName,
  columns,
}: {
  opened: boolean;
  onClose: () => void;
  accountId: number;
  accountName?: string;
  columns: KanbanColumn[];
}) {
  const { t } = useTranslation();
  const defaultTarget = columns[1]?.id ?? columns[0]?.id ?? null;
  const [target, setTarget] = useState<string | null>(defaultTarget);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      setTarget(columns[1]?.id ?? columns[0]?.id ?? null);
      setText("");
      setMedia([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const uploadedUrls = media.filter((m) => m.url).map((m) => m.url!) as string[];
  const previewMedia = media.map((m) => ({ url: m.previewUrl, isVideo: m.isVideo }));
  const isUploading = media.some((m) => m.uploading);
  const canSend = !!target && (text.trim().length > 0 || uploadedUrls.length > 0);

  async function send() {
    if (!target || !canSend) return;
    setLoading(true);
    try {
      const r = await api.kanbanBroadcast(accountId, target, text.trim(), uploadedUrls);
      notifications.show({
        color: r.total ? "teal" : "gray",
        message: r.total
          ? t("inbox.broadcastResult", { sent: r.sent, total: r.total })
          : t("inbox.broadcastEmpty"),
      });
      if (r.total) onClose();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{t("inbox.broadcastTitle")}</Text>}
      radius="lg"
      size="xl"
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {/* Редактор публикации */}
        <Stack>
          <Select
            label={t("inbox.broadcastTarget")}
            data={columns.map((c) => ({ value: c.id, label: c.title }))}
            value={target}
            onChange={setTarget}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
            renderOption={({ option }) => {
              const col = columns.find((c) => c.id === option.value);
              return (
                <Group gap={8} wrap="nowrap">
                  <Box
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: col?.color ?? "var(--mantine-color-gray-4)",
                      flexShrink: 0,
                    }}
                  />
                  <Text fz="sm">{option.label}</Text>
                </Group>
              );
            }}
          />
          <Textarea
            label={t("compose.captionLabel")}
            placeholder={t("inbox.broadcastTextPh")}
            autosize
            minRows={4}
            maxRows={10}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
          <Box>
            <Text fz="sm" fw={600} mb={6}>
              {t("compose.mediaLabel")}
            </Text>
            <MediaUploader media={media} onChange={setMedia} />
          </Box>
        </Stack>

        {/* Предпросмотр */}
        <Box>
          <Text fz="sm" fw={600} c="dimmed" mb="sm" tt="uppercase">
            {t("compose.previewTitle")}
          </Text>
          <ScrollArea.Autosize mah={460}>
            <PlatformPreview
              platform="telegram_bot"
              content={text}
              media={previewMedia}
              accountName={accountName ?? "Telegram"}
            />
          </ScrollArea.Autosize>
        </Box>
      </SimpleGrid>

      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={send} loading={loading} disabled={!canSend || isUploading}>
          {isUploading ? t("compose.uploadingMedia") : t("inbox.broadcastSend")}
        </Button>
      </Group>
    </Modal>
  );
}
