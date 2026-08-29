import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: "frontend",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@shared", replacement: path.resolve(__dirname, "shared") },
      { find: "@", replacement: path.resolve(__dirname, "frontend/src") }
    ]
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          if (id.includes("@base-ui/react") || id.includes("class-variance-authority") || id.includes("tailwind-merge")) {
            return "vendor-ui";
          }

          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) {
            return "vendor-react";
          }
        }
      }
    }
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4317",
        configure(proxy) {
          proxy.on("proxyReq", (request) => request.setHeader("origin", "http://127.0.0.1:4317"));
        }
      }
    }
  },
  test: {
    root: __dirname,
    projects: [
      {
        extends: true,
        test: {
          name: "backend",
          environment: "node",
          include: ["backend/**/*.test.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["frontend/tests/**/*.test.{ts,tsx}"],
          setupFiles: ["frontend/tests/setup.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "project-local",
          environment: "node",
          include: [".ballet/tests/**/*.test.ts"]
        }
      }
    ]
  }
});
