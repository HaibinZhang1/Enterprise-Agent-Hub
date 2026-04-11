// @ts-nocheck
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

function fileContentBuffer(file) {
  if (file.contentBase64) {
    return Buffer.from(file.contentBase64, 'base64');
  }
  if (file.contentText) {
    return Buffer.from(file.contentText, 'utf8');
  }
  throw new Error(`Package file "${file.path}" is missing content.`);
}

function normalizeRelativePath(filePath) {
  const normalized = String(filePath ?? '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.split('/').includes('..')) {
    throw new Error(`Invalid package file path: ${filePath}`);
  }
  return normalized;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function staysWithinRoot(rootPath, candidatePath) {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

/**
 * @param {{ rootDir: string }} input
 */
export function createFilesystemPackageArtifactStorage(input) {
  const rootDir = resolve(input.rootDir);

  return Object.freeze({
    kind: 'filesystem',
    rootDir,

    /**
     * @param {{
     *   packageId: string;
     *   files: { path: string; size?: number; sha256?: string | null; contentText?: string; contentBase64?: string }[];
     *   manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] };
     * }} saveInput
     */
    savePackage(saveInput) {
      const packageRoot = resolve(rootDir, saveInput.packageId);
      const filesRoot = resolve(packageRoot, 'files');
      const manifestPath = resolve(packageRoot, 'manifest.json');

      mkdirSync(filesRoot, { recursive: true });

      const storedFiles = [];
      for (const file of saveInput.files) {
        const relativePath = normalizeRelativePath(file.path);
        const content = fileContentBuffer(file);
        const storagePath = resolve(filesRoot, relativePath);
        if (!staysWithinRoot(filesRoot, storagePath)) {
          throw new Error(`Refusing to write package file outside storage root: ${file.path}`);
        }
        mkdirSync(dirname(storagePath), { recursive: true });
        writeFileSync(storagePath, content);
        storedFiles.push(
          Object.freeze({
            path: relativePath,
            size: file.size ?? content.byteLength,
            sha256: file.sha256 ?? sha256(content),
            storagePath,
          }),
        );
      }

      writeFileSync(
        manifestPath,
        `${JSON.stringify(
          {
            packageId: saveInput.packageId,
            manifest: saveInput.manifest,
            storedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
      );

      return Object.freeze({
        kind: 'filesystem',
        packageRoot,
        manifestPath,
        files: Object.freeze(storedFiles.sort((left, right) => left.path.localeCompare(right.path))),
      });
    },

    readArtifact(packageId, artifactPath) {
      const packageRoot = resolve(rootDir, packageId, 'files');
      const relativePath = normalizeRelativePath(artifactPath);
      const storagePath = resolve(packageRoot, relativePath);
      if (!staysWithinRoot(packageRoot, storagePath)) {
        throw new Error(`Refusing to read package file outside storage root: ${artifactPath}`);
      }
      return readFileSync(storagePath);
    },
  });
}
