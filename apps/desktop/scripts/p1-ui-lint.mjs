import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const forbiddenP2Surfaces = ["审核", "管理台", "发布 Skill", "MCP", "插件"];
const forbiddenPrototypeMutationMarkers = ["ui-prototype/app.js", "ui-prototype/styles.css"];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path) : path;
    })
  );
  return files.flat().filter((path) => /\.(ts|tsx|css)$/.test(path));
}

const violations = [];
for (const file of await listFiles(sourceRoot)) {
  const text = await readFile(file, "utf8");
  for (const forbidden of forbiddenP2Surfaces) {
    const allowlist = forbidden === "发布 Skill" && text.includes("P1 does not expose publish surfaces");
    if (!allowlist && text.includes(forbidden)) {
      violations.push(`${file}: contains forbidden P2 surface label ${forbidden}`);
    }
  }
  for (const forbidden of forbiddenPrototypeMutationMarkers) {
    if (text.includes(forbidden)) {
      violations.push(`${file}: references prototype file path ${forbidden}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("P1 UI lint passed: navigation excludes formal P2 surfaces and prototype files are not referenced.");
