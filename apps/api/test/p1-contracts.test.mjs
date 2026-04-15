import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const contracts = readFileSync(new URL('../src/common/p1-contracts.ts', import.meta.url), 'utf8');
const sharedContracts = readFileSync(new URL('../../../packages/shared-contracts/src/index.ts', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../src/database/p1-seed.ts', import.meta.url), 'utf8');
const seedSql = readFileSync(new URL('../src/database/seeds/p1_seed.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../src/database/migrations/001_p1_base.sql', import.meta.url), 'utf8');
const publishingMigration = readFileSync(new URL('../src/database/migrations/002_publishing_workflow.sql', import.meta.url), 'utf8');
const packageDownloadService = readFileSync(new URL('../src/skills/package-download.service.ts', import.meta.url), 'utf8');
const packageDownloadController = readFileSync(new URL('../src/skills/package-download.controller.ts', import.meta.url), 'utf8');
const publishingService = readFileSync(new URL('../src/publishing/publishing-publication.service.ts', import.meta.url), 'utf8');
const seedPackage = new URL('../src/database/seeds/packages/codex-review-helper/1.2.0/package.zip', import.meta.url);
const seedPackageHash = `sha256:${createHash('sha256').update(readFileSync(seedPackage)).digest('hex')}`;

test('P1 API contracts preserve symlink-first copy fallback fields', () => {
  assert.match(contracts, /@enterprise-agent-hub\/shared-contracts/);
  for (const field of ['RequestedMode', 'ResolvedMode']) {
    assert.match(contracts, new RegExp(field));
  }
  for (const field of ['requestedMode', 'resolvedMode', 'fallbackReason', 'installMode']) {
    assert.match(sharedContracts, new RegExp(field));
  }
  assert.match(sharedContracts, /RequestedMode = InstallMode/);
  assert.match(sharedContracts, /ResolvedMode = InstallMode/);
  assert.match(sharedContracts, /Symlink: "symlink"/);
  assert.match(sharedContracts, /Copy: "copy"/);
  assert.match(sharedContracts, /menuPermissions/);
  assert.match(sharedContracts, /adminLevel/);
  assert.match(contracts, /WorkflowState/);
  assert.match(contracts, /PublisherSkillSummaryDto/);
  assert.match(contracts, /ReviewPrecheckItemDto/);
});

test('P1 seed covers full, restricted, and delisted skill scenarios', () => {
  assert.match(seed, /detailAccess: 'full'/);
  assert.match(seed, /detailAccess: 'summary'/);
  assert.match(seed, /status: 'delisted'/);
  assert.match(seedSql, /UPDATE skills s\s+SET current_version_id = v\.id\s+FROM desired_versions dv/s);
  assert.match(seedSql, /sha256:[a-f0-9]{64}/);
  assert.match(packageDownloadService, /packageHash: packageRow\.sha256/);
  assert.match(publishingService, /publishSubmission/);
  assert.match(publishingService, /refresh_skill_search_document/);
});

test('download-ticket points at a real package download URL with matching seed package metadata', () => {
  assert.match(packageDownloadService, /issuePackageDownloadTicket/);
  assert.ok(packageDownloadService.includes('packageURL: `/skill-packages/${encodeURIComponent(packageRow.id)}/download?ticket=${encodeURIComponent(ticket)}`'));
  assert.ok(packageDownloadController.includes("@Controller('skill-packages')"));
  assert.match(packageDownloadController, /StreamableFile/);
  assert.match(packageDownloadController, /content-disposition/);
  assert.match(seedSql, new RegExp(seedPackageHash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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
