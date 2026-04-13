#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

if (!process.env.EAH_FULL_CLOSURE_UI_BASE_URL || !process.env.EAH_FULL_CLOSURE_API_BASE_URL || !process.env.EAH_FULL_CLOSURE_ARTIFACT_DIR) {
  run("node", ["scripts/full-closure/run.mjs", "--mode", "ui"]);
  process.exit(0);
}

const artifactDir = requiredEnv("EAH_FULL_CLOSURE_ARTIFACT_DIR");
requiredEnv("EAH_FULL_CLOSURE_UI_BASE_URL");
requiredEnv("EAH_FULL_CLOSURE_API_BASE_URL");

mkdirSync(artifactDir, { recursive: true });

if (process.env.EAH_FULL_CLOSURE_SKIP_PLAYWRIGHT_INSTALL !== "true") {
  run("npx", ["playwright", "install", "chromium"]);
}

const testArgs = ["playwright", "test", "-c", "tests/full-closure/playwright.config.ts"];
if (process.env.EAH_FULL_CLOSURE_PLAYWRIGHT_GREP) {
  testArgs.push("--grep", process.env.EAH_FULL_CLOSURE_PLAYWRIGHT_GREP);
}

run("npx", testArgs, {
  env: process.env,
});

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(process.cwd()),
    stdio: "inherit",
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}
