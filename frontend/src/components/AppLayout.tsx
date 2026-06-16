import { useState } from "react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  ThemeIcon,
  Badge,
  ActionIcon,
  Tooltip,
  useMantineColorScheme,
  Box,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconLayoutDashboard,
  IconCalendarTime,
  IconCalendarMonth,
  IconPlugConnected,
  IconMessageChatbot,
  IconWaveSine,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";

const NAV = [
  { to: "/", label: "Обзор", icon: IconLayoutDashboard },
  { to: "/publications", label: "Публикации", icon: IconCalendarTime },
  { to: "/calendar", label: "Календарь", icon: IconCalendarMonth },
  { to: "/accounts", label: "Аккаунты", icon: IconPlugConnected },
  {
    to: "/inbox",
    label: "Входящие",
    icon: IconMessageChatbot,
    soon: true,
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const [navWidth] = useState(264);
  const location = useLocation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: navWidth,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap={8} wrap="nowrap">
              <ThemeIcon
                size={34}
                radius="md"
                variant="gradient"
                gradient={{ from: "brand.6", to: "grape.5", deg: 135 }}
              >
                <IconWaveSine size={20} />
              </ThemeIcon>
              <Text fw={800} fz="lg" visibleFrom="xs">
                Postwave
              </Text>
            </Group>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color="brand" radius="sm" visibleFrom="sm">
              v0.1 · MVP
            </Badge>
            <Tooltip label={colorScheme === "dark" ? "Светлая тема" : "Тёмная тема"}>
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                onClick={toggleColorScheme}
              >
                {colorScheme === "dark" ? (
                  <IconSun size={18} />
                ) : (
                  <IconMoon size={18} />
                )}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                component={RouterNavLink}
                to={item.soon ? "#" : item.to}
                onClick={(e) => {
                  if (item.soon) e.preventDefault();
                  else close();
                }}
                active={active}
                label={item.label}
                disabled={item.soon}
                leftSection={
                  <ThemeIcon
                    variant={active ? "filled" : "light"}
                    color="brand"
                    size="md"
                    radius="md"
                  >
                    <item.icon size={17} />
                  </ThemeIcon>
                }
                rightSection={
                  item.soon ? (
                    <Badge size="xs" variant="light" color="gray">
                      скоро
                    </Badge>
                  ) : undefined
                }
                variant="light"
                mb={4}
                styles={{ root: { borderRadius: "var(--mantine-radius-md)" } }}
              />
            );
          })}
        </AppShell.Section>

        <AppShell.Section>
          <Box
            p="sm"
            style={{
              borderRadius: "var(--mantine-radius-md)",
              background:
                "linear-gradient(135deg, rgba(125,82,249,.12), rgba(190,107,249,.10))",
            }}
          >
            <Text fz="xs" c="dimmed" fw={600}>
              СОВЕТ
            </Text>
            <Text fz="xs" mt={4} lh={1.4}>
              Готовьте посты на неделю вперёд и ставьте на расписание — Postwave
              опубликует сам.
            </Text>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
