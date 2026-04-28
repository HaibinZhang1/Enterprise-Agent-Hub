import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const acceptance = JSON.parse(readFileSync(path.join(root, "acceptance.json"), "utf8"));

test("P1 adapter fixtures cover symlink-first/copy-fallback expectations", () => {
  assert.equal(acceptance.skillID, "example-skill");
  assert.equal(acceptance.distributionExpectations.defaultRequestedMode, "symlink");
  assert.equal(acceptance.distributionExpectations.fallbackMode, "copy");
  assert.deepEqual(acceptance.distributionExpectations.records, [
    "requestedMode",
    "resolvedMode",
    "fallbackReason",
  ]);
});

test("all declared golden fixture files exist", () => {
  const strategyToTool = {
    codex_skill: "codex",
    claude_skill: "claude",
    cursor_rule: "cursor",
    windsurf_rule: "windsurf",
    opencode_skill: "opencode",
    generic_directory: "custom_directory",
  };

  for (const [strategy, expectedFiles] of Object.entries(acceptance.strategies)) {
    const toolID = strategyToTool[strategy];
    assert.ok(toolID, `missing tool mapping for ${strategy}`);
    for (const expectedFile of expectedFiles) {
      assert.ok(
        existsSync(path.join(root, "golden", toolID, acceptance.skillID, expectedFile)),
        `${strategy} missing ${expectedFile}`,
      );
    }
  }
});
