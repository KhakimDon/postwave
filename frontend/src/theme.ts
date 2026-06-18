import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Фирменный фиолетовый «Postwave» — неоновый акцент на тёмном стекле
const brand: MantineColorsTuple = [
  "#f1ecff",
  "#dccdff",
  "#bfa3ff",
  "#a279ff",
  "#8a57fb",
  "#7d52f9",
  "#6f3df0",
  "#5e30d6",
  "#4f28b6",
  "#3f2096",
];

// Глубокая тёмно-сине-чёрная палитра (фон/поверхности/границы)
const dark: MantineColorsTuple = [
  "#e8ecf8", // 0 — основной светлый текст
  "#c3cadf", // 1
  "#99a2bf", // 2 — dimmed
  "#717a9a", // 3
  "#49506b", // 4 — границы
  "#2c3147", // 5
  "#171a2a", // 6 — приподнятая поверхность
  "#0d0f1c", // 7 — базовый фон body
  "#080a14", // 8
  "#050610", // 9
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand, dark },
  primaryShade: { light: 5, dark: 5 },
  fontFamily:
    "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: {
    fontFamily: "Outfit, sans-serif",
    fontWeight: "700",
  },
  defaultRadius: "lg",
  radius: { md: "14px", lg: "20px", xl: "28px" },
  cursorType: "pointer",
  components: {
    Card: {
      defaultProps: { radius: 24, withBorder: false, shadow: undefined },
      classNames: { root: "glass glass-hover" },
    },
    Paper: {
      defaultProps: { radius: 20, withBorder: false, shadow: undefined },
      classNames: { root: "glass" },
    },
    Modal: {
      defaultProps: {
        radius: 24,
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, blur: 8 },
        transitionProps: { transition: "pop", duration: 220 },
      },
      classNames: { content: "glass-modal", header: "glass-modal-header" },
    },
    Drawer: {
      defaultProps: {
        overlayProps: { backgroundOpacity: 0.55, blur: 8 },
      },
      classNames: { content: "glass-modal", header: "glass-modal-header" },
    },
    Button: {
      defaultProps: { radius: "xl" },
    },
    ActionIcon: {
      defaultProps: { radius: "lg" },
    },
    Popover: {
      defaultProps: { radius: "lg" },
    },
    Menu: {
      defaultProps: { radius: "lg" },
    },
    Tooltip: {
      defaultProps: { radius: "md", withArrow: true },
    },
  },
});
