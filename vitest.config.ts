import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          fileParallelism: false,
        },
      },
      {
        extends: true,
        esbuild: { jsx: "automatic" },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
          // Node 22 flag to allow require() of ESM modules (needed for jsdom 27 CSS deps)
          execArgv: ["--experimental-require-module"],
        },
      },
    ],
  },
});
