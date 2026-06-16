import { Menu, Button, ScrollArea } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { LANGS, setLanguage } from "../i18n";

export function LanguageSwitcher({
  variant = "default",
  light = false,
}: {
  variant?: string;
  light?: boolean;
}) {
  const { i18n } = useTranslation();
  const current = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0];

  return (
    <Menu position="bottom-end" withinPortal radius="md" shadow="md">
      <Menu.Target>
        <Button
          variant={variant}
          size="xs"
          radius="md"
          leftSection={<Flag cc={current.cc} />}
          rightSection={<IconChevronDown size={14} />}
          styles={
            light
              ? { root: { color: "#fff", borderColor: "rgba(255,255,255,0.3)" } }
              : undefined
          }
        >
          {current.code.toUpperCase()}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <ScrollArea.Autosize mah={320}>
          {LANGS.map((l) => (
            <Menu.Item
              key={l.code}
              onClick={() => setLanguage(l.code)}
              leftSection={<Flag cc={l.cc} />}
              bg={l.code === current.code ? "var(--mantine-color-brand-0)" : undefined}
            >
              {l.label}
            </Menu.Item>
          ))}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}

function Flag({ cc }: { cc: string }) {
  return (
    <span
      className={`fi fi-${cc}`}
      style={{ width: 20, height: 14, borderRadius: 2, display: "inline-block" }}
    />
  );
}
