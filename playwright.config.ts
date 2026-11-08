import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "web/tests",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    channel: process.env.LIFERAFT_BROWSER === "chromium" ? undefined : "chrome",
  },
  outputDir: ".liferaft/cockpit-qa",
  reporter: [
    ["list"],
    ["json", { outputFile: ".liferaft/cockpit-qa-results.json" }],
  ],
});
