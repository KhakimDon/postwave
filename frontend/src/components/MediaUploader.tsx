import {
  SimpleGrid,
  Image,
  Box,
  Group,
  Text,
  ActionIcon,
  Loader,
  Center,
  rem,
} from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconUpload, IconX, IconPhotoPlus, IconVideo } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

export interface MediaItem {
  id: string;
  previewUrl: string; // локальный objectURL для мгновенного показа
  url: string | null; // ссылка с сервера (после загрузки)
  uploading: boolean;
  isVideo: boolean;
}

interface Props {
  media: MediaItem[];
  onChange: (updater: (prev: MediaItem[]) => MediaItem[]) => void;
}

export function MediaUploader({ media, onChange }: Props) {
  const { t } = useTranslation();
  async function handleDrop(files: File[]) {
    const items: MediaItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(f),
      url: null,
      uploading: true,
      isVideo: f.type.startsWith("video/"),
    }));
    onChange((prev) => [...prev, ...items]);

    await Promise.all(
      items.map(async (item, i) => {
        try {
          const res = await api.uploadFile(files[i]);
          onChange((prev) =>
            prev.map((m) =>
              m.id === item.id ? { ...m, url: res.url, uploading: false } : m
            )
          );
        } catch (e) {
          notifications.show({ color: "red", message: (e as Error).message });
          onChange((prev) => prev.filter((m) => m.id !== item.id));
        }
      })
    );
  }

  function remove(id: string) {
    onChange((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <Box>
      <Dropzone
        onDrop={handleDrop}
        accept={[...IMAGE_MIME_TYPE, "video/mp4", "video/quicktime", "video/webm"]}
        maxSize={200 * 1024 ** 2}
        radius="md"
        onReject={() =>
          notifications.show({
            color: "red",
            message: t("mediaUploader.rejectToast"),
          })
        }
      >
        <Group
          justify="center"
          gap="md"
          mih={100}
          style={{ pointerEvents: "none" }}
          wrap="nowrap"
        >
          <Dropzone.Accept>
            <IconUpload size={38} color="var(--mantine-color-brand-6)" />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={38} color="var(--mantine-color-red-6)" />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhotoPlus size={38} color="var(--mantine-color-dimmed)" />
          </Dropzone.Idle>
          <Box>
            <Text fz="sm" fw={600}>
              {t("mediaUploader.dropTitle")}
            </Text>
            <Text fz="xs" c="dimmed" mt={2}>
              {t("mediaUploader.dropHint")}
            </Text>
          </Box>
        </Group>
      </Dropzone>

      {media.length > 0 && (
        <SimpleGrid cols={{ base: 4, sm: 5 }} spacing="xs" mt="sm">
          {media.map((m) => (
            <Box
              key={m.id}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: rem(10),
                overflow: "hidden",
                border: "1px solid var(--mantine-color-gray-3)",
                background: "var(--mantine-color-gray-1)",
              }}
            >
              {m.isVideo ? (
                <Center h="100%">
                  <IconVideo size={24} />
                </Center>
              ) : (
                <Image src={m.previewUrl} h="100%" w="100%" fit="cover" />
              )}

              {m.uploading && (
                <Center
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,.45)",
                  }}
                >
                  <Loader size="sm" color="white" />
                </Center>
              )}

              <ActionIcon
                size="sm"
                radius="xl"
                color="dark"
                variant="filled"
                style={{ position: "absolute", top: 4, right: 4 }}
                onClick={() => remove(m.id)}
              >
                <IconX size={13} />
              </ActionIcon>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
