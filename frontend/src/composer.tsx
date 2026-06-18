import { createContext, useCallback, useContext, useState } from "react";
import { ActionIcon, Group, Modal, Text } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Compose } from "./pages/Compose";
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

  const open = useCallback((d?: string | null) => {
    setDate(d ?? null);
    setPost(null);
    setIntent("create");
    setOpened(true);
  }, []);
  const edit = useCallback((p: Post, i: "edit" | "republish") => {
    setPost(p);
    setIntent(i);
    setDate(null);
    setOpened(true);
  }, []);
  const close = useCallback(() => setOpened(false), []);

  const title = intent === "create" ? t("compose.newTitle") : t("compose.editTitle");

  return (
    <ComposerCtx.Provider value={{ open, edit }}>
      {children}
      <Modal
        opened={opened}
        onClose={close}
        fullScreen
        padding={0}
        title={
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="md"
              onClick={close}
              aria-label={t("common.cancel")}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Text fw={800} fz="lg">
              {title}
            </Text>
          </Group>
        }
        styles={{
          header: { padding: "12px 18px", minHeight: 56 },
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
          />
        )}
      </Modal>
    </ComposerCtx.Provider>
  );
}
