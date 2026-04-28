import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const artifactDir = process.env.EAH_FULL_CLOSURE_ARTIFACT_DIR ?? path.resolve("test-results/full-closure/dev");
const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: path.join(configDir, "ui"),
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(artifactDir, "playwright-report"), open: "never" }],
  ],
  outputDir: path.join(artifactDir, "playwright-output"),
  use: {
    baseURL: process.env.EAH_FULL_CLOSURE_UI_BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 1100 },
  },
});
