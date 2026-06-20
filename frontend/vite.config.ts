import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 127.0.0.1 (не localhost): бэкенд слушает IPv4, а localhost на macOS
      // может резолвиться в IPv6 ::1 → socket hang up / 500 на /api.
      "/api": "http://127.0.0.1:8000",
    },
  },
});
