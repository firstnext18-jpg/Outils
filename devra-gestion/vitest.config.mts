import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // Le marqueur « server-only » ne s'applique qu'au bundle Next.js.
      "server-only": path.resolve(root, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { TZ: "Europe/Zurich" },
  },
});
