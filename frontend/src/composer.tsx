import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ActionIcon, Box, Button, Group, Modal, Stack, Stepper, Text } from "@mantine/core";
import { IconArrowLeft, IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Compose } from "./pages/Compose";
import { composerGuard } from "./composerGuard";
import type { Post } from "./api/types";

/** Режим композера: создание / редактирование запланированного / «изменить и опубликовать». */
export type ComposerIntent = "create" | "edit" | "republish";

type Ctx = {
  open: (date?: string | null) => void;
  edit: (post: Post, intent: "edit" | "republish") => void;
};
const ComposerCtx = createContext<Ctx>({ open: () => {}, edit: () => {} });
export const useComposer = () => useContext(ComposerCtx);

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [intent, setIntent] = useState<ComposerIntent>("create");
  const [step, setStep] = useState(0);

  const open = useCallback((d?: string | null) => {
    setDate(d ?? null);
    setPost(null);
    setIntent("create");
    setStep(0);
    setOpened(true);
  }, []);
  const edit = useCallback((p: Post, i: "edit" | "republish") => {
    setPost(p);
    setIntent(i);
    setDate(null);
    setStep(0);
    setOpened(true);
  }, []);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doClose = useCallback(() => {
    composerGuard.setDirty(false);
    setConfirmOpen(false);
    setOpened(false);
  }, []);
  // запрос на закрытие: если есть несохранённые данные — спросим
  const close = useCallback(() => {
    if (composerGuard.isDirty()) setConfirmOpen(true);
    else doClose();
  }, [doClose]);

  // предупреждение при обновлении/закрытии вкладки
  useEffect(() => {
    if (!opened) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (composerGuard.isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [opened]);

  const title = intent === "create" ? t("compose.newTitle") : t("compose.editTitle");

  return (
    <ComposerCtx.Provider value={{ open, edit }}>
      {children}
      <Modal
        opened={opened}
        onClose={close}
        fullScreen
        padding={0}
        withCloseButton={false}
        title={
          <Group gap="md" wrap="nowrap" style={{ width: "100%" }}>
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="md"
              onClick={close}
              aria-label={t("common.cancel")}
              style={{ color: "var(--mantine-color-text)", flexShrink: 0 }}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Text fw={800} fz="lg" visibleFrom="md" style={{ flexShrink: 0 }}>
              {title}
            </Text>
            <Box style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <Stepper
                active={step}
                onStepClick={setStep}
                size="xs"
                iconSize={24}
                allowNextStepsSelect={false}
                className="pw-stepper"
                style={{ width: "100%", maxWidth: 520 }}
              >
                <Stepper.Step label={t("compose.stepAccount")} />
                <Stepper.Step label={t("compose.stepContent")} />
                <Stepper.Step label={t("compose.stepSettings")} />
                <Stepper.Step label={t("compose.stepPublish")} />
              </Stepper>
            </Box>
          </Group>
        }
        styles={{
          header: { padding: "10px 18px", minHeight: 56 },
          title: { flex: 1, marginRight: 0 },
          body: { height: "calc(100dvh - 56px)", padding: 0 },
        }}
        transitionProps={{ transition: "fade", duration: 180 }}
      >
        {/* монтируем заново на каждое открытие — свежий/предзаполненный композер */}
        {opened && (
          <Compose
            embedded
            initialDate={date}
            initialPost={post ?? undefined}
            intent={intent}
            onClose={close}
            step={step}
            onStepChange={setStep}
          />
        )}
      </Modal>

      {/* Предупреждение о потере несохранённых данных */}
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        centered
        radius="lg"
        size="sm"
        withCloseButton={false}
        zIndex={600}
      >
        <Stack gap="sm" align="center" ta="center">
          <IconAlertTriangle size={40} color="var(--mantine-color-orange-5)" />
          <Text fw={700} fz="lg">
            {t("compose.closeConfirmTitle")}
          </Text>
          <Text fz="sm" c="dimmed">
            {t("compose.closeConfirmBody")}
          </Text>
          <Group justify="center" gap="sm" mt="xs" w="100%">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>
              {t("compose.closeConfirmStay")}
            </Button>
            <Button color="red" onClick={doClose}>
              {t("compose.closeConfirmDiscard")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </ComposerCtx.Provider>
  );
}
