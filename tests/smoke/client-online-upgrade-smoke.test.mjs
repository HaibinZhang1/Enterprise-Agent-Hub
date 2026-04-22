import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const checklistPath = path.resolve("verification/client-online-upgrade/windows-e2e-checklist.md");

test("client online upgrade smoke scaffold validates artifact input when provided", async (t) => {
  assert.equal(fs.existsSync(checklistPath), true, "windows checklist scaffold must exist");

  const artifactPath = process.env.EAH_CLIENT_ONLINE_UPGRADE_ARTIFACT;
  if (!artifactPath) {
    t.skip("set EAH_CLIENT_ONLINE_UPGRADE_ARTIFACT to run the scaffolded smoke flow");
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  assert.equal(typeof artifact.apiBaseURL, "string");
  assert.equal(typeof artifact.releaseID, "string");
  assert.equal(typeof artifact.version, "string");
  assert.equal(typeof artifact.packageURL, "string");
  assert.equal(typeof artifact.packageHash, "string");
  assert.equal(typeof artifact.packageSize, "number");
  assert.match(artifact.packageURL, /^https?:\/\//u);
  assert.match(artifact.packageHash, /^sha256:/u);
  assert.ok(artifact.packageSize > 0);
});
