// @ts-nocheck
import { createHash } from 'node:crypto';

export const REQUIRED_PACKAGE_FILES = Object.freeze(['SKILL.md', 'README.md']);

/**
 * @param {{ path: string; size?: number; sha256?: string | null }[]} files
 */
function normalizeFiles(files) {
  return files
    .map((file) => ({
      path: file.path,
      size: file.size ?? 0,
      sha256: file.sha256 ?? null,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * @param {{
 *   packageId: string;
 *   files: { path: string; size?: number; sha256?: string | null }[];
 *   manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] };
 *   storage?: { kind: string; packageRoot: string; files: { path: string; size: number; sha256: string; storagePath: string }[]; manifestPath?: string };
 *   uploadedBy?: string | null;
 *   createdAt?: Date;
 * }} input
 */
export function createPackageValidationReport(input) {
  const normalizedFiles = normalizeFiles(input.files);
  const fileNames = new Set(normalizedFiles.map((entry) => entry.path.toLowerCase()));
  const findings = REQUIRED_PACKAGE_FILES.filter((filePath) => !fileNames.has(filePath.toLowerCase())).map((missingPath) =>
    Object.freeze({ severity: 'error', code: 'missing_required_file', file: missingPath }),
  );

  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        manifest: input.manifest,
        files: normalizedFiles,
      }),
    )
    .digest('hex');

  return Object.freeze({
    packageId: input.packageId,
    valid: findings.length === 0,
    hash,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    uploadedBy: input.uploadedBy ?? null,
    findings: Object.freeze(findings),
    manifest: Object.freeze({
      skillId: input.manifest.skillId,
      version: input.manifest.version,
      title: input.manifest.title,
      summary: input.manifest.summary ?? '',
      tags: Object.freeze([...(input.manifest.tags ?? [])]),
    }),
    files: Object.freeze(normalizedFiles.map((entry) => Object.freeze(entry))),
    storage: input.storage
      ? Object.freeze({
          kind: input.storage.kind,
          packageRoot: input.storage.packageRoot,
          manifestPath: input.storage.manifestPath ?? null,
          files: Object.freeze(
            input.storage.files.map((entry) =>
              Object.freeze({
                path: entry.path,
                size: entry.size,
                sha256: entry.sha256,
                storagePath: entry.storagePath,
              }),
            ),
          ),
        })
      : null,
  });
}
