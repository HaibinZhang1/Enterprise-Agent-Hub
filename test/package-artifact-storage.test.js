import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createMemoryAuditLogRepository } from '../apps/api/src/modules/audit/repositories/memory-audit-log-repository.js';
import { createAuditService } from '../apps/api/src/modules/audit/services/audit-service.js';
import { createMemoryPackageReportRepository } from '../apps/api/src/modules/package/repositories/memory-package-report-repository.js';
import { createPackageService } from '../apps/api/src/modules/package/services/package-service.js';
import { createFilesystemPackageArtifactStorage } from '../apps/api/src/modules/package/storage/filesystem-package-artifact-storage.js';

test('filesystem package storage persists package files and report metadata', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-package-storage-'));
  const auditRepository = createMemoryAuditLogRepository();
  const packageReportRepository = createMemoryPackageReportRepository();
  const packageService = createPackageService({
    packageReportRepository,
    auditService: createAuditService({ auditRepository }),
    artifactStorage: createFilesystemPackageArtifactStorage({ rootDir }),
  });

  const report = packageService.upload({
    requestId: 'req-package-storage-1',
    actor: {
      userId: 'publisher-1',
      username: 'publisher',
      roleCode: 'employee_lv6',
      departmentId: 'dept-2',
    },
    packageId: 'pkg-storage-1',
    files: [
      { path: 'README.md', contentText: '# README\n' },
      { path: 'SKILL.md', contentText: '# SKILL\n' },
      { path: 'resources/icon.txt', contentBase64: Buffer.from('icon').toString('base64') },
    ],
    manifest: {
      skillId: 'skill-storage-1',
      version: '1.0.0',
      title: 'Stored Artifact Skill',
      summary: 'Persists uploaded files into real storage.',
    },
    now: new Date('2026-04-08T08:50:00.000Z'),
  });

  assert.equal(report.valid, true);
  assert.equal(report.storage?.kind, 'filesystem');
  assert.equal(report.storage?.files.length, 3);

  const manifestJson = JSON.parse(await readFile(report.storage.manifestPath, 'utf8'));
  assert.equal(manifestJson.packageId, 'pkg-storage-1');
  assert.equal(manifestJson.manifest.skillId, 'skill-storage-1');

  const readme = await readFile(report.storage.files.find((entry) => entry.path === 'README.md').storagePath, 'utf8');
  assert.equal(readme, '# README\n');

  const auditTrail = auditRepository.list();
  assert.equal(auditTrail.length, 1);
  assert.equal(auditTrail[0].action, 'package.uploaded');
  assert.equal(auditTrail[0].details.storageKind, 'filesystem');
});

test('filesystem package storage fails closed when file content is missing', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-package-storage-'));
  const storage = createFilesystemPackageArtifactStorage({ rootDir });

  assert.throws(
    () =>
      storage.savePackage({
        packageId: 'pkg-storage-invalid',
        files: [{ path: 'README.md' }],
        manifest: { skillId: 'skill-invalid', version: '1.0.0', title: 'Broken Package' },
      }),
    /missing content/i,
  );
});
