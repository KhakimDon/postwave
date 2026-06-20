import { useEffect, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconAt,
  IconBellOff,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceFloppy,
  IconPencil,
  IconPhone,
  IconTrash,
  IconUserCheck,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
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

  // управление контактом
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!opened) return;
    setProfile(null);
    setViewer(false);
    setIdx(0);
    setEditing(false);
    setConfirmDel(false);
    setMutedState(isMuted(accountId, dialog.id));
    setLoading(true);
    api
      .tgUserProfile(accountId, dialog.id)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opened, accountId, dialog.id]);

  function startEdit() {
    setFirst(profile?.first_name ?? profile?.name ?? "");
    setLast(profile?.last_name ?? "");
    setPhone(profile?.phone ?? "");
    setConfirmDel(false);
    setEditing(true);
  }

  async function saveContact() {
    if (!first.trim()) return;
    setBusy(true);
    try {
      const updated = await api.tgUserSaveContact(accountId, dialog.id, {
        first_name: first.trim(),
        last_name: last.trim(),
        phone: phone.trim(),
      });
      setProfile(updated);
      setEditing(false);
      notifications.show({ color: "teal", message: t("inbox.contactSavedToast") });
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact() {
    setBusy(true);
    try {
      const updated = await api.tgUserDeleteContact(accountId, dialog.id);
      setProfile(updated);
      setConfirmDel(false);
      notifications.show({ color: "gray", message: t("inbox.contactDeletedToast") });
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

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
        overlayProps={{ blur: 8, backgroundOpacity: 0.25 }}
        classNames={{
          content: "pw-liquid-modal-content",
          header: "pw-liquid-modal-header",
        }}
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

            {/* ── Управление контактом (только для пользователей) ── */}
            {profile?.is_user && (
              <Paper withBorder radius="md" p="sm" w="100%">
                {editing ? (
                  <Stack gap="xs">
                    <Group gap={8} wrap="nowrap">
                      <IconUserPlus size={16} />
                      <Text fz="sm" fw={600}>
                        {profile.is_contact
                          ? t("inbox.editContact")
                          : t("inbox.saveContact")}
                      </Text>
                    </Group>
                    <Group gap="xs" grow wrap="nowrap">
                      <TextInput
                        size="sm"
                        label={t("inbox.firstName")}
                        value={first}
                        onChange={(e) => setFirst(e.currentTarget.value)}
                        data-autofocus
                      />
                      <TextInput
                        size="sm"
                        label={t("inbox.lastName")}
                        value={last}
                        onChange={(e) => setLast(e.currentTarget.value)}
                      />
                    </Group>
                    <TextInput
                      size="sm"
                      label={t("inbox.phoneOptional")}
                      leftSection={<IconPhone size={14} />}
                      placeholder="+998 ..."
                      value={phone}
                      onChange={(e) => setPhone(e.currentTarget.value)}
                    />
                    <Group justify="flex-end" gap="xs" mt={4}>
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => setEditing(false)}
                        disabled={busy}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="xs"
                        leftSection={<IconDeviceFloppy size={15} />}
                        loading={busy}
                        disabled={!first.trim()}
                        onClick={saveContact}
                      >
                        {t("common.save")}
                      </Button>
                    </Group>
                  </Stack>
                ) : confirmDel ? (
                  <Stack gap="xs">
                    <Text fz="sm" fw={600} ta="center">
                      {t("inbox.deleteContactQ")}
                    </Text>
                    <Group justify="center" gap="xs">
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => setConfirmDel(false)}
                        disabled={busy}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        color="red"
                        size="xs"
                        leftSection={<IconTrash size={15} />}
                        loading={busy}
                        onClick={deleteContact}
                      >
                        {t("inbox.deleteContact")}
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                      {profile.is_contact ? (
                        <IconUserCheck size={18} color="var(--mantine-color-teal-5)" />
                      ) : (
                        <IconUserPlus size={18} color="var(--mantine-color-dimmed)" />
                      )}
                      <Text fz="sm" fw={500} lineClamp={1}>
                        {profile.is_contact
                          ? t("inbox.contactSaved")
                          : t("inbox.contactNotSaved")}
                      </Text>
                    </Group>
                    {profile.is_contact ? (
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={startEdit}
                          aria-label={t("inbox.editContact")}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setConfirmDel(true)}
                          aria-label={t("inbox.deleteContact")}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconUserPlus size={15} />}
                        onClick={startEdit}
                      >
                        {t("inbox.saveContact")}
                      </Button>
                    )}
                  </Group>
                )}
              </Paper>
            )}
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
