import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Фирменный фиолетовый «Postwave» — уверенный, современный (вайб Linear/Notion)
const brand: MantineColorsTuple = [
  "#f3f0ff",
  "#e5dbff",
  "#c8b4ff",
  "#a98bff",
  "#8f68fb",
  "#7d52f9",
  "#7548f9",
  "#6438df",
  "#5831c7",
  "#4a29af",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand },
  primaryShade: { light: 5, dark: 6 },
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: {
    fontFamily: "Inter, sans-serif",
    fontWeight: "700",
  },
  defaultRadius: "md",
  cursorType: "pointer",
  components: {
    Card: {
      defaultProps: { shadow: "sm", radius: "lg", withBorder: true },
    },
    Button: {
      defaultProps: { radius: "md" },
    },
    Paper: {
      defaultProps: { radius: "lg" },
    },
  },
});
