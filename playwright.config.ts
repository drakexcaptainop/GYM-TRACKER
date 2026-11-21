import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://localhost:5199", ...devices["Pixel 7"] },
  projects: [{ name: "movil", use: { browserName: "chromium" } }],
  webServer: {
    command: "node e2e/prepare.mjs && npx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
