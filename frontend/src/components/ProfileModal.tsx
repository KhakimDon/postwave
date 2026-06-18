import { useEffect, useState } from "react";
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import {
  IconAt,
  IconBellOff,
  IconChevronLeft,
  IconChevronRight,
  IconPhone,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { TgDialog, TgProfile } from "../api/types";
import { ChatAvatar } from "./ChatAvatar";
import { isMuted, setMuted } from "../notify";

export function ProfileModal({
  opened,
  onClose,
  accountId,
  dialog,
}: {
  opened: boolean;
  onClose: () => void;
  accountId: number;
  dialog: TgDialog;
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<TgProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [idx, setIdx] = useState(0);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setProfile(null);
    setViewer(false);
    setIdx(0);
    setMutedState(isMuted(accountId, dialog.id));
    setLoading(true);
    api
      .tgUserProfile(accountId, dialog.id)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opened, accountId, dialog.id]);

  const count = profile?.photo_count ?? 0;
  const name = profile?.name ?? dialog.name;

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={<Text fw={700}>{t("inbox.profile")}</Text>}
        radius="lg"
        centered
      >
        {loading ? (
          <Center h={180}>
            <Loader />
          </Center>
        ) : (
          <Stack align="center" gap="sm" py="sm">
            <Box
              onClick={() => count > 0 && setViewer(true)}
              style={{ cursor: count > 0 ? "zoom-in" : "default" }}
            >
              <ChatAvatar
                src={api.tgUserAvatarUrl(accountId, dialog.id)}
                name={name}
                color="blue"
                size={120}
              />
            </Box>
            <Text fw={700} fz="lg" ta="center">
              {name}
            </Text>
            {profile?.username && (
              <Group gap={4} c="dimmed">
                <IconAt size={14} />
                <Text fz="sm">{profile.username}</Text>
              </Group>
            )}
            {profile?.phone && (
              <Group gap={4} c="dimmed">
                <IconPhone size={14} />
                <Text fz="sm">+{profile.phone}</Text>
              </Group>
            )}
            {profile?.bio && (
              <Text fz="sm" ta="center" c="dimmed" maw={360} style={{ whiteSpace: "pre-wrap" }}>
                {profile.bio}
              </Text>
            )}

            <Paper withBorder radius="md" p="sm" mt="xs" w="100%">
              <Group justify="space-between" wrap="nowrap">
                <Group gap={8} wrap="nowrap">
                  <IconBellOff size={18} />
                  <Text fz="sm" fw={500}>
                    {t("inbox.muteUser")}
                  </Text>
                </Group>
                <Switch
                  checked={muted}
                  onChange={(e) => {
                    const v = e.currentTarget.checked;
                    setMutedState(v);
                    setMuted(accountId, dialog.id, v);
                  }}
                />
              </Group>
            </Paper>
          </Stack>
        )}
      </Modal>

      {/* Фото профиля во весь экран со слайдером */}
      <Modal
        opened={viewer}
        onClose={() => setViewer(false)}
        fullScreen
        withCloseButton={false}
        padding={0}
        transitionProps={{ transition: "fade" }}
        styles={{ body: { padding: 0, height: "100vh", background: "#000" } }}
      >
        <Box
          style={{
            position: "relative",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActionIcon
            variant="filled"
            color="dark"
            radius="xl"
            size="lg"
            style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}
            onClick={() => setViewer(false)}
          >
            <IconX size={18} />
          </ActionIcon>

          <img
            src={api.tgUserProfilePhotoUrl(accountId, dialog.id, idx)}
            style={{ maxWidth: "100%", maxHeight: "100vh", objectFit: "contain" }}
          />

          {count > 1 && (
            <>
              <ActionIcon
                variant="filled"
                color="dark"
                radius="xl"
                size="xl"
                style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }}
                onClick={() => setIdx((i) => (i - 1 + count) % count)}
              >
                <IconChevronLeft size={22} />
              </ActionIcon>
              <ActionIcon
                variant="filled"
                color="dark"
                radius="xl"
                size="xl"
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}
                onClick={() => setIdx((i) => (i + 1) % count)}
              >
                <IconChevronRight size={22} />
              </ActionIcon>
              <Text
                c="#fff"
                fz="sm"
                style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center" }}
              >
                {idx + 1} / {count}
              </Text>
            </>
          )}
        </Box>
      </Modal>
    </>
  );
}
