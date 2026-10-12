import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: http://localhost:5173 (API proxied to Laravel on :8000)
// Build: outputs into ../backend/public/app so Laravel serves the whole site from one server.
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === "production" ? "/app/" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/files": "http://127.0.0.1:8000",
      "/storage": "http://127.0.0.1:8000",
    },
  },
  build: { outDir: "../backend/public/app", emptyOutDir: true },
});
