import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

const migrations = await readD1Migrations("./migrations");

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: migrations,
                SESSION_SECRET: "test-secret-0123456789abcdef0123456789",
              },
            },
          }),
        ],
        test: {
          name: "worker",
          include: ["test/**/*.test.ts"],
          exclude: ["test/pure/**"],
          setupFiles: ["./test/setup.ts"],
        },
      },
      {
        test: {
          name: "pure",
          include: ["test/pure/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
