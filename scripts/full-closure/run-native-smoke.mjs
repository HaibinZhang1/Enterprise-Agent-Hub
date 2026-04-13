#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

if (!process.env.EAH_FULL_CLOSURE_ARTIFACT_DIR) {
  run("node", ["scripts/full-closure/run.mjs", "--mode", "native"]);
  process.exit(0);
}

const artifactDir = requiredEnv("EAH_FULL_CLOSURE_ARTIFACT_DIR");
const artifactPath = process.env.EAH_FULL_CLOSURE_HAPPY_PATH_ARTIFACT ?? path.join(artifactDir, "happy-path.json");
if (!existsSync(artifactPath)) {
  throw new Error(`Happy-path artifact not found: ${artifactPath}`);
}

run("cargo", [
  "test",
  "--manifest-path",
  "apps/desktop/src-tauri/Cargo.toml",
  "--test",
  "full_closure",
  "--",
  "--nocapture",
], {
  env: {
    ...process.env,
    EAH_FULL_CLOSURE_ARTIFACT: artifactPath,
  },
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
