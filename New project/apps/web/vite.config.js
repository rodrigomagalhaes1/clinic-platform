import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  // Resolve workspace packages by their source directly,
  // so Vite transpiles TypeScript from @clinic/* without needing a build step.
  resolve: {
    alias: {
      "@clinic/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@clinic/domain": resolve(__dirname, "../../packages/domain/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
  server: {
    port: 5173,
    // Proxies API calls to the Clinic Full Stack server (clinic-server-runtime.mjs)
    // which exposes all routes including /v1/auth/login, /health, etc.
    proxy: {
      "/v1": { target: "http://localhost:5173", changeOrigin: true },
      "/health": { target: "http://localhost:5173", changeOrigin: true },
    },
  },
});
