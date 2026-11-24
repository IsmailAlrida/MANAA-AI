import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@workspace/ui": r("../../packages/ui/src"),
      "@": r("."),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
  },
})
