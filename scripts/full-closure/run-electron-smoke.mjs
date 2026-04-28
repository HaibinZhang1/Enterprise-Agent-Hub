#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(process.cwd());

run("npm", ["run", "typecheck", "--workspace", "@enterprise-agent-hub/desktop"]);
run("npm", ["run", "electron:smoke", "--workspace", "@enterprise-agent-hub/desktop"]);
run("node", ["scripts/checks/check-no-tauri-scan.mjs", "--strict"]);
run("node", ["scripts/checks/check-rust-exception-gate.mjs", "--strict"]);
run("node", ["scripts/checks/check-electron-security-policy.mjs", "--strict"]);
run("node", ["--test", "tests/smoke/p1-real-delivery-static.test.mjs"]);

console.log("P1 Electron closure smoke PASS");

function run(program, args) {
  const result = spawnSync(program, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${program} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}
