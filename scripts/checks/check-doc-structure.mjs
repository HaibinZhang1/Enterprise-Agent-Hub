import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredDocs = [
  "docs/Architecture/index.md",
  "docs/Architecture/overview.md",
  "docs/Architecture/domain-boundaries.md",
  "docs/Architecture/layering-rules.md",
  "docs/Architecture/shared-contracts-rules.md",
  "docs/Architecture/extension-points.md",
  "docs/Operations/config-and-security.md"
];

const missing = requiredDocs.filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));

if (missing.length > 0) {
  console.error("Missing required P2 architecture docs:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Documentation structure check passed.");
