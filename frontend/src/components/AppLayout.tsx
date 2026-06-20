import { useState } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
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
  Box,
  Button,
  UnstyledButton,
  useMantineColorScheme,
  useComputedColorScheme,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { PublishProgress } from "./PublishProgress";
import { useComposer } from "../composer";
import {
  IconHome,
  IconArticle,
  IconPlugConnected,
  IconMessageChatbot,
  IconLogout,
  IconSun,
  IconMoon,
  IconPlus,
} from "@tabler/icons-react";

const NAV = [
  { to: "/", key: "nav.home", icon: IconHome },
  { to: "/posts", key: "nav.posts", icon: IconArticle },
  { to: "/inbox", key: "nav.inbox", icon: IconMessageChatbot },
  { to: "/accounts", key: "nav.accounts", icon: IconPlugConnected },
];

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export function AppLayout({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout?: () => void;
}) {
  const [opened, { toggle, close }] = useDisclosure();
  const [navWidth] = useState(264);
  const location = useLocation();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("dark", { getInitialValueInEffect: false });
  const isDark = scheme === "dark";
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { open: openComposer } = useComposer();

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
              <Logo size={24} />
              <Text fw={800} fz="lg" visibleFrom="xs" tt="uppercase" style={{ letterSpacing: 1 }}>
                Postwave
              </Text>
            </Group>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <LanguageSwitcher />
            <Badge variant="light" color="brand" radius="sm" visibleFrom="sm">
              v0.1 · MVP
            </Badge>
            <Tooltip label={isDark ? t("nav.themeLight") : t("nav.themeDark")}>
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                aria-label={isDark ? t("nav.themeLight") : t("nav.themeDark")}
                onClick={() => setColorScheme(isDark ? "light" : "dark")}
              >
                {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
            {onLogout && (
              <Tooltip label={t("nav.logout")}>
                <ActionIcon variant="default" size="lg" radius="md" onClick={onLogout}>
                  <IconLogout size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section>
          {/* Primary action — как «Post» в X */}
          <Button
            fullWidth
            size="md"
            radius="xl"
            mb="sm"
            leftSection={<IconPlus size={18} />}
            variant="gradient"
            gradient={{ from: "brand.6", to: "#4aa3ff", deg: 135 }}
            onClick={() => {
              openComposer();
              close();
            }}
            style={{ boxShadow: "0 12px 30px -12px var(--glow-violet)" }}
          >
            {t("nav.create")}
          </Button>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              component={RouterNavLink}
              to={item.to}
              onClick={() => close()}
              active={isActive(location.pathname, item.to)}
              label={t(item.key)}
              leftSection={
                <ThemeIcon
                  variant={isActive(location.pathname, item.to) ? "filled" : "light"}
                  color="brand"
                  size="md"
                  radius="md"
                >
                  <item.icon size={17} />
                </ThemeIcon>
              }
              variant="light"
              mb={4}
              styles={{ root: { borderRadius: "var(--mantine-radius-md)" } }}
            />
          ))}
        </AppShell.Section>

        <AppShell.Section>
          <Box
            p="sm"
            style={{
              borderRadius: "var(--mantine-radius-md)",
              background:
                "linear-gradient(135deg, rgba(125,82,249,.18), rgba(74,163,255,.12))",
              border: "1px solid var(--border-1)",
            }}
          >
            <Text fz="xs" c="dimmed" fw={600}>
              {t("nav.tipLabel")}
            </Text>
            <Text fz="xs" mt={4} lh={1.4}>
              {t("nav.tipText")}
            </Text>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box style={{ paddingBottom: isMobile ? 78 : undefined }}>
          <div key={location.pathname} className="pw-rise">
            {children}
          </div>
        </Box>
      </AppShell.Main>

      {/* Плавающий блок прогресса публикации (справа снизу) */}
      <PublishProgress />

      {/* Мобильный нижний таб-бар (стиль X / Instagram) */}
      <Box
        hiddenFrom="sm"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 300,
          height: 66,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          background: "var(--app-bg-overlay)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          borderTop: "1px solid var(--glass-border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <TabItem
          icon={<IconHome size={22} />}
          label={t("nav.home")}
          active={isActive(location.pathname, "/")}
          onClick={() => nav("/")}
        />
        <TabItem
          icon={<IconArticle size={22} />}
          label={t("nav.posts")}
          active={isActive(location.pathname, "/posts")}
          onClick={() => nav("/posts")}
        />
        <UnstyledButton
          aria-label={t("nav.create")}
          onClick={() => openComposer()}
          style={{
            width: 52,
            height: 52,
            marginTop: -18,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            background: "linear-gradient(135deg, #7d52f9, #4aa3ff)",
            boxShadow: "0 12px 28px -8px var(--glow-violet)",
            border: "2px solid var(--surface-deep)",
          }}
        >
          <IconPlus size={24} />
        </UnstyledButton>
        <TabItem
          icon={<IconMessageChatbot size={22} />}
          label={t("nav.inbox")}
          active={isActive(location.pathname, "/inbox")}
          onClick={() => nav("/inbox")}
        />
        <TabItem
          icon={<IconPlugConnected size={22} />}
          label={t("nav.accounts")}
          active={isActive(location.pathname, "/accounts")}
          onClick={() => nav("/accounts")}
        />
      </Box>
    </AppShell>
  );
}

function TabItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: 60,
        color: active ? "var(--mantine-color-brand-4)" : "var(--mantine-color-dimmed)",
        transition: "color 160ms ease",
      }}
    >
      {icon}
      <Text fz={10} fw={active ? 700 : 500} style={{ lineHeight: 1 }}>
        {label}
      </Text>
    </UnstyledButton>
  );
}
