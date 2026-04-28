import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const examplePath = path.join(root, "infra/env/server.env.example");
const envPath = path.join(root, "infra/env/server.env");
const gitignorePath = path.join(root, ".gitignore");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").trim();
}

const requiredGitignoreEntries = [
  ".env",
  ".env.*",
  "infra/env/*.local",
  "infra/env/*.secret",
  "test-results/"
];

const gitignore = fs.existsSync(gitignorePath) ? read(gitignorePath) : "";
const missingGitignoreEntries = requiredGitignoreEntries.filter((entry) => !gitignore.includes(entry));

if (!fs.existsSync(examplePath)) {
  console.error("Missing infra/env/server.env.example");
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  const example = read(examplePath);
  const actual = read(envPath);
  if (actual !== example) {
    console.error("infra/env/server.env differs from server.env.example. Real runtime values must not be committed.");
    process.exit(1);
  }
}

if (missingGitignoreEntries.length > 0) {
  console.error("Missing .gitignore env safety entries:");
  for (const entry of missingGitignoreEntries) {
    console.error(`- ${entry}`);
  }
  process.exit(1);
}

console.log("Environment safety check passed.");
