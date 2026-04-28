import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function listFiles(dir, predicate = () => true, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, predicate, acc);
    } else if (predicate(full)) {
      acc.push(full);
    }
  }
  return acc;
}

function importsFrom(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

const failures = [];

const tsLike = (filePath) => /\.(ts|tsx|mjs)$/.test(filePath);
const files = listFiles(root, (filePath) => tsLike(filePath) && !filePath.includes("/node_modules/"));

for (const filePath of files) {
  const rel = relative(filePath);
  const imports = importsFrom(filePath);

  if (rel.startsWith("packages/shared-contracts/src/")) {
    for (const specifier of imports) {
      if (specifier.includes("/apps/") || specifier.startsWith("../../apps") || specifier.startsWith("../apps")) {
        failures.push(`${rel} must not depend on app code (${specifier})`);
      }
    }
  }

  if (/apps\/api\/src\/.*controller\.ts$/.test(rel)) {
    for (const specifier of imports) {
      if (specifier.includes(".repository") || specifier.includes("query.service") || specifier.includes("policy")) {
        failures.push(`${rel} must not import repository/query/policy modules directly (${specifier})`);
      }
    }
  }

  if (/apps\/api\/src\/.*repository\.ts$/.test(rel)) {
    for (const specifier of imports) {
      if (specifier.endsWith(".controller") || /\/.*service(\.ts)?$/.test(specifier) && !specifier.includes("database.service")) {
        failures.push(`${rel} repository must not depend on controller/service layers (${specifier})`);
      }
    }
  }

  if (/apps\/desktop\/src\/state\/workspace\/.*\.ts$/.test(rel)) {
    for (const specifier of imports) {
      if (specifier.includes("/ui/") || specifier.includes("useP1Workspace")) {
        failures.push(`${rel} workspace slice must not import UI or facade hook (${specifier})`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Import boundary check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Import boundary check passed.");
