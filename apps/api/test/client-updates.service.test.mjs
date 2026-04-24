import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');

const { ClientUpdatesService } = require('../src/client-updates/client-updates.service.ts');

function releaseRow(overrides = {}) {
  const now = new Date('2026-04-22T00:00:00.000Z');
  return {
    release_id: 'rel-1',
    version: '1.6.0',
    build_number: '20260422.1',
    platform: 'windows',
    arch: 'x64',
    channel: 'stable',
    status: 'published',
    mandatory: false,
    min_supported_version: null,
    rollout_percent: 100,
    release_notes: 'Release notes',
    created_by: 'u_admin_l1',
    published_by: 'u_admin_l1',
    published_at: now,
    created_at: now,
    updated_at: now,
    artifact_id: 'artifact-1',
    artifact_bucket: 'client-updates',
    artifact_object_key: 'windows/x64/stable/1.6.0/setup.exe',
    artifact_package_name: 'EnterpriseAgentHub_1.6.0_x64-setup.exe',
    artifact_size_bytes: 1024,
    artifact_sha256: 'sha256:' + 'a'.repeat(64),
    artifact_signature_status: 'signed',
    artifact_created_at: now,
    latest_event_at: now,
    event_count: 1,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const repository = {
    async listPublishedReleases() {
      return [releaseRow()];
    },
    async loadReleaseOrThrow(releaseID) {
      return releaseRow({ release_id: releaseID });
    },
    async insertDownloadTicket() {
      return 'ticket-123';
    },
    async findDownloadTicket() {
      return { ticket: 'ticket-123', release_id: 'rel-1', user_id: 'u_001', expires_at: new Date(Date.now() + 60_000) };
    },
    async insertEvent() {},
    async clearUserReleaseNotification() {},
    async assertAdminActor() {
      return { user_id: 'u_admin_l1', role: 'admin', admin_level: 1 };
    },
    async listReleases() { return []; },
    async createRelease() { return 'rel-1'; },
    async upsertArtifact() {},
    async setReleasePublished() {},
    async updateRolloutPercent() {},
    async setReleaseStatus() {},
    async upsertReleaseNotifications() {},
    async clearReleaseNotifications() {},
    ...overrides.repository,
  };
  const storage = {
    bucket() { return 'client-updates'; },
    async uploadArtifact() { return { bucket: 'client-updates', objectKey: 'obj', sizeBytes: 123 }; },
    async assertObjectExists() {},
    async openArtifactStream() { return { stream: Readable.from(['ok']), contentLength: 2 }; },
    ...overrides.storage,
  };
  const { Readable } = require('node:stream');
  return new ClientUpdatesService(repository, storage);
}

test('ClientUpdatesService.check returns optional update when a newer eligible release exists', async () => {
  const service = createService();
  const result = await service.check('u_001', {
    currentVersion: '1.5.0',
    platform: 'windows',
    arch: 'x64',
    channel: 'stable',
    deviceID: 'device-001',
  });

  assert.equal(result.status, 'update_available');
  assert.equal(result.updateType, 'optional');
  assert.equal(result.latestVersion, '1.6.0');
  assert.equal(result.downloadTicketRequired, true);
});

test('ClientUpdatesService.check returns mandatory_update when release is mandatory', async () => {
  const service = createService({
    repository: {
      async listPublishedReleases() {
        return [releaseRow({ mandatory: true })];
      },
    },
  });

  const result = await service.check('u_001', {
    currentVersion: '1.5.0',
    platform: 'windows',
    arch: 'x64',
    channel: 'stable',
    deviceID: 'device-001',
  });

  assert.equal(result.status, 'mandatory_update');
  assert.equal(result.updateType, 'mandatory');
  assert.equal(result.mandatory, true);
});

test('ClientUpdatesService.check returns unsupported_version when current version is below min supported', async () => {
  const service = createService({
    repository: {
      async listPublishedReleases() {
        return [releaseRow({ min_supported_version: '1.5.5' })];
      },
    },
  });

  const result = await service.check('u_001', {
    currentVersion: '1.5.0',
    platform: 'windows',
    arch: 'x64',
    channel: 'stable',
    deviceID: 'device-001',
  });

  assert.equal(result.status, 'unsupported_version');
  assert.equal(result.updateType, 'unsupported');
  assert.equal(result.minSupportedVersion, '1.5.5');
});

test('ClientUpdatesService.issueDownloadTicket issues a ticket-backed download URL', async () => {
  const service = createService();
  const result = await service.issueDownloadTicket('u_001', 'rel-1');

  assert.equal(result.releaseID, 'rel-1');
  assert.match(result.downloadURL, /\/client-updates\/releases\/rel-1\/download\?ticket=ticket-123/);
  assert.equal(result.signatureStatus, 'signed');
});

test('ClientUpdatesService.downloadRelease accepts a valid ticket without bearer identity', async () => {
  const service = createService();
  const result = await service.downloadRelease('rel-1', 'ticket-123', null);

  assert.equal(result.fileName, 'EnterpriseAgentHub_1.6.0_x64-setup.exe');
  assert.equal(result.contentLength, 2);
});
