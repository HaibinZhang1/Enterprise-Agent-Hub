import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { BadRequestException } = require("@nestjs/common");
const { PackageStorageService } = require("../src/publishing/package-storage.service.ts");

async function createZipFixture(fileMap) {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "eah-publishing-src-"));
  const zipDir = await fs.mkdtemp(path.join(os.tmpdir(), "eah-publishing-zip-"));
  const zipPath = path.join(zipDir, "package.zip");

  for (const [relativePath, content] of Object.entries(fileMap)) {
    const targetPath = path.join(sourceDir, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content);
  }

  execFileSync("zip", ["-qr", zipPath, "."], { cwd: sourceDir });
  const buffer = await fs.readFile(zipPath);
  rmSync(sourceDir, { recursive: true, force: true });
  rmSync(zipDir, { recursive: true, force: true });
  return buffer;
}

function createService() {
  return new PackageStorageService({
    get(key) {
      if (key === "LOCAL_PACKAGE_STORAGE_DIR") {
        return path.join(os.tmpdir(), "eah-runtime-package-storage");
      }
      return undefined;
    }
  });
}

test("PackageStorageService lists previewable package files and truncates large text previews", async () => {
  const largeText = "A".repeat(270 * 1024);
  const packageBuffer = await createZipFixture({
    "SKILL.md": "# Prompt Guardrails\n\nreview content\n",
    "README.markdown": "## Details\n\nMore text\n",
    "assets/notes.txt": "plain text file\n",
    "assets/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    "docs/large.txt": largeText
  });

  const service = createService();
  service.readReviewPackageBuffer = async () => packageBuffer;

  const files = await service.listPackageFilesForReview({});
  assert.deepEqual(
    files.map((file) => [file.relativePath, file.fileType, file.previewable]),
    [
      ["assets/logo.png", "other", false],
      ["assets/notes.txt", "text", true],
      ["docs/large.txt", "text", true],
      ["README.markdown", "markdown", true],
      ["SKILL.md", "markdown", true]
    ]
  );

  const skillDoc = await service.readPackageFileContentForReview({}, "SKILL.md");
  assert.equal(skillDoc.fileType, "markdown");
  assert.equal(skillDoc.truncated, false);
  assert.match(skillDoc.content, /Prompt Guardrails/);

  const largeDoc = await service.readPackageFileContentForReview({}, "docs/large.txt");
  assert.equal(largeDoc.fileType, "text");
  assert.equal(largeDoc.truncated, true);
  assert.equal(largeDoc.content.length, 256 * 1024);
});

test("PackageStorageService rejects loose non-zip uploads before staging", async () => {
  const service = createService();

  await assert.rejects(
    () =>
      service.stageSubmissionPackage(
        "rv_invalid",
        {
          skillID: "prompt-guardrails",
          displayName: "Prompt Guardrails",
          description: "desc",
          version: "1.0.0",
          visibilityLevel: "detail_visible",
          scopeType: "current_department",
          selectedDepartmentIDs: [],
          compatibleTools: ["codex"],
          compatibleSystems: ["windows"],
          tags: ["提示"],
          category: "开发"
        },
        [{ originalname: "logo.png", buffer: Buffer.from("not a package") }]
      ),
    BadRequestException
  );
});
