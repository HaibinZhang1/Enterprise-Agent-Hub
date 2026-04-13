import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const contracts = readFileSync(new URL('../src/common/p1-contracts.ts', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../src/database/p1-seed.ts', import.meta.url), 'utf8');
const seedSql = readFileSync(new URL('../src/database/seeds/p1_seed.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../src/database/migrations/001_p1_base.sql', import.meta.url), 'utf8');
const publishingMigration = readFileSync(new URL('../src/database/migrations/002_publishing_workflow.sql', import.meta.url), 'utf8');
const skillsService = readFileSync(new URL('../src/skills/skills.service.ts', import.meta.url), 'utf8');
const packageDownloadController = readFileSync(new URL('../src/skills/package-download.controller.ts', import.meta.url), 'utf8');
const publishingService = readFileSync(new URL('../src/publishing/publishing.service.ts', import.meta.url), 'utf8');
const seedPackage = new URL('../src/database/seeds/packages/codex-review-helper/1.2.0/package.zip', import.meta.url);

test('P1 API contracts preserve symlink-first copy fallback fields', () => {
  for (const field of ['requestedMode', 'resolvedMode', 'fallbackReason', 'installMode']) {
    assert.match(contracts, new RegExp(field));
  }
  assert.match(contracts, /'symlink' \| 'copy'/);
  assert.match(contracts, /menuPermissions/);
  assert.match(contracts, /adminLevel/);
  assert.match(contracts, /WorkflowState/);
  assert.match(contracts, /PublisherSkillSummaryDto/);
  assert.match(contracts, /ReviewPrecheckItemDto/);
});

test('P1 seed covers full, restricted, and delisted skill scenarios', () => {
  assert.match(seed, /detailAccess: 'full'/);
  assert.match(seed, /detailAccess: 'summary'/);
  assert.match(seed, /status: 'delisted'/);
  assert.match(seedSql, /sha256:[a-f0-9]{64}/);
  assert.match(skillsService, /packageHash: packageRow\.sha256/);
  assert.match(publishingService, /publishSubmission/);
});

test('download-ticket points at a real package download URL with matching seed package metadata', () => {
  assert.match(skillsService, /issuePackageDownloadTicket/);
  assert.ok(skillsService.includes('packageURL: `/skill-packages/${encodeURIComponent(packageRow.id)}/download?ticket=${encodeURIComponent(ticket)}`'));
  assert.ok(packageDownloadController.includes("@Controller('skill-packages')"));
  assert.match(packageDownloadController, /StreamableFile/);
  assert.match(packageDownloadController, /content-disposition/);
  assert.match(seedSql, /sha256:9650d3afdfb7b401ff9c52015f277ec075e768a64aefcc8872257dd51b4cdef5/);
  assert.match(seedSql, new RegExp(`, ${statSync(seedPackage).size}, 2`));
});

test('PostgreSQL migration includes FTS and local-event idempotency gates', () => {
  assert.match(migration, /TSVECTOR NOT NULL/);
  assert.match(migration, /USING GIN\(search_vector\)/);
  assert.match(migration, /UNIQUE\(device_id, event_id\)/);
  assert.match(migration, /requested_mode TEXT CHECK/);
  assert.match(migration, /resolved_mode TEXT CHECK/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_sessions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS review_items/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS admin_level/);
  assert.match(publishingMigration, /ALTER TABLE review_items/);
  assert.match(publishingMigration, /review_item_scope_departments/);
  assert.match(publishingMigration, /workflow_state/);
});
