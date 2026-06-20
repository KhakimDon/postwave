import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBell,
  IconBrandInstagram,
  IconBrandTelegram,
  IconCheck,
  IconLogout,
  IconPlus,
  IconScript,
  IconTrash,
  IconVolume,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Account } from "../api/types";
import {
  notifyEnabled,
  setNotifyEnabled,
  soundEnabled,
  setSoundEnabled,
} from "../notify";
import { addScript, removeScript, useScripts } from "../scripts";

/** Меню настроек (как в ТГ): список всех подключённых аккаунтов, переключение, отключение. */
export function AccountSettings({
  opened,
  onClose,
  accounts,
  currentIds,
  onSwitch,
  onChanged,
}: {
  opened: boolean;
  onClose: () => void;
  accounts: Account[];
  currentIds: number[];
  onSwitch: (acc: Account) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<number | null>(null);
  const [notif, setNotif] = useState(notifyEnabled());
  const [sound, setSound] = useState(soundEnabled());
  const scripts = useScripts();
  const [sTitle, setSTitle] = useState("");
  const [sText, setSText] = useState("");

  async function disconnect(id: number) {
    if (!window.confirm(t("inbox.disconnectConfirm"))) return;
    setBusy(id);
    try {
      await api.deleteAccount(id);
      notifications.show({ color: "gray", message: t("accounts.removedToast") });
      onChanged();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>{t("inbox.accountSettings")}</Text>}
      radius="lg"
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {/* ── Левая колонка: настройки ── */}
        <Stack gap="sm">
          {/* Уведомления */}
          <Text fz="xs" c="dimmed" fw={600} tt="uppercase">
            {t("inbox.notifTitle")}
          </Text>
          <Switch
            checked={notif}
            onChange={(e) => {
              const v = e.currentTarget.checked;
              setNotif(v);
              setNotifyEnabled(v);
            }}
            label={
              <Group gap={8} wrap="nowrap">
                <IconBell size={16} />
                <Text fz="sm">{t("inbox.notifEnable")}</Text>
              </Group>
            }
          />
          <Switch
            checked={sound}
            disabled={!notif}
            onChange={(e) => {
              const v = e.currentTarget.checked;
              setSound(v);
              setSoundEnabled(v);
            }}
            label={
              <Group gap={8} wrap="nowrap">
                <IconVolume size={16} />
                <Text fz="sm">{t("inbox.notifSound")}</Text>
              </Group>
            }
          />

          <Divider my={4} />

          <Text fz="xs" c="dimmed" fw={600} tt="uppercase">
            {t("inbox.accountsList")}
          </Text>
          {accounts.map((a) => {
          const isCurrent = currentIds.includes(a.id);
          const isIg = a.platform === "instagram";
          return (
            <Paper key={a.id} withBorder radius="md" p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon
                    variant="light"
                    color={isIg ? "pink" : "blue"}
                    radius="xl"
                    size={36}
                  >
                    {isIg ? (
                      <IconBrandInstagram size={18} />
                    ) : (
                      <IconBrandTelegram size={18} />
                    )}
                  </ThemeIcon>
                  <Box style={{ minWidth: 0 }}>
                    <Text fw={600} fz="sm" lineClamp={1}>
                      {a.display_name}
                    </Text>
                    {isCurrent && (
                      <Badge size="xs" variant="light" color="teal" mt={2}>
                        {t("inbox.currentLabel")}
                      </Badge>
                    )}
                  </Box>
                </Group>
                <Group gap={4} wrap="nowrap">
                  {isCurrent ? (
                    <ThemeIcon variant="light" color="teal" radius="xl" size={28}>
                      <IconCheck size={15} />
                    </ThemeIcon>
                  ) : (
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={() => {
                        onSwitch(a);
                        onClose();
                      }}
                    >
                      {t("inbox.switchTo")}
                    </Button>
                  )}
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    loading={busy === a.id}
                    onClick={() => disconnect(a.id)}
                    aria-label={t("inbox.disconnect")}
                  >
                    <IconLogout size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          );
        })}
        </Stack>

        {/* ── Правая колонка: быстрые ответы ── */}
        <Stack gap="sm">
        <Group gap={6} wrap="nowrap">
          <IconScript size={15} />
          <Text fz="xs" c="dimmed" fw={600} tt="uppercase">
            {t("inbox.scriptsManage")}
          </Text>
        </Group>
        {scripts.length === 0 && (
          <Text fz="xs" c="dimmed">
            {t("inbox.scriptsEmpty")}
          </Text>
        )}
        {scripts.length > 0 && (
          <ScrollArea.Autosize mah={260}>
            <Stack gap="xs" pr={6}>
              {scripts.map((s) => (
                <Paper key={s.id} withBorder radius="md" p="sm">
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Box style={{ minWidth: 0 }}>
                      <Text fw={600} fz="sm" lineClamp={1}>
                        {s.title || s.text.slice(0, 32)}
                      </Text>
                      <Text fz="xs" c="dimmed" lineClamp={2}>
                        {s.text}
                      </Text>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => removeScript(s.id)}
                      aria-label={t("publications.deleteItem")}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
        <TextInput
          size="sm"
          placeholder={t("inbox.scriptTitlePh")}
          value={sTitle}
          onChange={(e) => setSTitle(e.currentTarget.value)}
        />
        <Textarea
          size="sm"
          placeholder={t("inbox.scriptTextPh")}
          value={sText}
          onChange={(e) => setSText(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={5}
        />
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          disabled={!sText.trim()}
          onClick={() => {
            addScript(sTitle, sText);
            setSTitle("");
            setSText("");
          }}
        >
          {t("inbox.scriptAdd")}
        </Button>
        </Stack>
      </SimpleGrid>
    </Modal>
  );
}
