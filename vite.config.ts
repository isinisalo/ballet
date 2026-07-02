import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: "frontend",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@xyflow\/react$/, replacement: path.resolve(__dirname, "node_modules/@xyflow/react/dist/esm/index.mjs") },
      { find: "@", replacement: path.resolve(__dirname, "frontend/src") }
    ]
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4174"
    }
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["frontend/tests/**/*.test.tsx", "jsdom"]],
    root: __dirname,
    include: ["backend/tests/**/*.test.ts", "frontend/tests/**/*.test.{ts,tsx}"],
    setupFiles: ["frontend/tests/setup.ts"]
  }
});
