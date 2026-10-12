import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: http://localhost:5173 (API proxied to Laravel on :8000)
// Build: outputs into ../backend/public/app so Laravel serves the whole site from one server.
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === "production" ? "/app/" : "/",
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        headers: { Connection: "close" },
      },
      "/files": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        headers: { Connection: "close" },
      },
      "/storage": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        headers: { Connection: "close" },
      },
    },
  },
  build: { outDir: "../backend/public/app", emptyOutDir: true },
});
