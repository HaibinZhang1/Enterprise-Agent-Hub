import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const forbiddenPrototypeMutationMarkers = ["docs/design-ui/layout-prototype/app.js", "docs/design-ui/layout-prototype/styles.css"];
const forbiddenLegacyImports = [
  "desktopPages.tsx",
  "desktopModals.tsx",
  "desktopNavigationGroups.ts",
  "useDesktopNavigation.ts",
  "MyInstalledPage",
  "TargetManagementPage",
  "PublisherWorkbenchPage",
  "ReviewPage",
  "AdminDepartmentsPage",
  "AdminUsersPage",
  "AdminSkillsPage"
];

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
  for (const forbidden of forbiddenPrototypeMutationMarkers) {
    if (text.includes(forbidden)) {
      violations.push(`${file}: references prototype file path ${forbidden}`);
    }
  }
  for (const forbidden of forbiddenLegacyImports) {
    if (text.includes(forbidden)) {
      violations.push(`${file}: references archived legacy desktop surface ${forbidden}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Desktop UI lint passed: legacy page shells are archived and prototype files are not referenced directly.");
