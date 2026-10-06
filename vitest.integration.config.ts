import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

/**
 * Integration tests against the live Supabase project (keys from .env.local / .env.test.local).
 * Run with `npm run test:integration`. Tests that need a key that isn't set are skipped.
 */
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
