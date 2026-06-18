import { useState } from "react";
import { Box, Button, Group, SegmentedControl, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Publications } from "./Publications";
import { Calendar } from "./Calendar";
import { useComposer } from "../composer";

/** Единый раздел «Посты»: переключатель Список / Календарь + общая кнопка создания. */
export function Posts() {
  const { t } = useTranslation();
  const { open } = useComposer();
  const [view, setView] = useState<"list" | "calendar">(() =>
    localStorage.getItem("pw_posts_view") === "calendar" ? "calendar" : "list",
  );
  function change(v: "list" | "calendar") {
    setView(v);
    localStorage.setItem("pw_posts_view", v);
  }

  return (
    <Box>
      <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
        <Text fz={{ base: 22, sm: 28 }} fw={800}>
          {t("nav.posts")}
        </Text>
        <Group gap="sm">
          <SegmentedControl
            value={view}
            onChange={(v) => change(v as "list" | "calendar")}
            data={[
              { value: "list", label: t("nav.list") },
              { value: "calendar", label: t("nav.calendar") },
            ]}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={() => open()}>
            {t("nav.create")}
          </Button>
        </Group>
      </Group>

      {view === "list" ? <Publications embedded /> : <Calendar embedded />}
    </Box>
  );
}
