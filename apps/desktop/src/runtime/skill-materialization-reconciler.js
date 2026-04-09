// @ts-nocheck
import { lstat, readlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createSkillMaterializer } from './skill-materializer.js';

function formatReason(error) {
  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'string' ? `${error.code}: ` : '';
    const message = 'message' in error && typeof error.message === 'string' ? error.message : String(error);
    return `${code}${message}`;
  }
  return String(error);
}

async function existingSymlinkMatches(targetPath, packageRoot) {
  try {
    const stats = await lstat(targetPath);
    if (!stats.isSymbolicLink()) {
      return false;
    }
    return resolve(await readlink(targetPath)) === resolve(packageRoot);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export function createSkillMaterializationReconciler(options = {}) {
  const materializer = createSkillMaterializer({
    filesystem: options.createSymlink ? { symlink: options.createSymlink } : undefined,
  });

  return Object.freeze({
    async reconcileSkillTarget(request) {
      const skillsDirectory = resolve(request.skillsDirectory);
      const packageRoot = resolve(request.packageRoot);
      const targetPath = join(skillsDirectory, request.skillId);

      if (request.enabled === false || request.targetMaterializationEnabled === false) {
        const removal = await materializer.removeMaterialization({
          skillId: request.skillId,
          skillsDirectory,
        });
        return Object.freeze({
          ...request,
          ...removal,
          operation: request.targetMaterializationEnabled === false ? 'skip_disabled_target' : 'remove',
          mode: 'none',
        });
      }

      if (await existingSymlinkMatches(targetPath, packageRoot)) {
        return Object.freeze({
          targetType: request.targetType,
          targetId: request.targetId,
          skillId: request.skillId,
          packageId: request.packageId,
          version: request.version,
          packageRoot,
          skillsDirectory,
          targetPath,
          operation: 'noop',
          mode: 'symlink',
          status: 'materialized',
        });
      }

      const result = await materializer.materialize({
        skillId: request.skillId,
        sourceDirectory: packageRoot,
        skillsDirectory,
        preferredMode: request.preferredMode,
      });

      if (!result.ok) {
        return Object.freeze({
          targetType: request.targetType,
          targetId: request.targetId,
          skillId: request.skillId,
          packageId: request.packageId,
          version: request.version,
          packageRoot,
          skillsDirectory,
          targetPath,
          operation: 'blocked',
          mode: 'none',
          status: 'blocked',
          reason: `package unavailable or access denied: ${result.failureReason}`,
        });
      }

      return Object.freeze({
        targetType: request.targetType,
        targetId: request.targetId,
        skillId: request.skillId,
        packageId: request.packageId,
        version: request.version,
        packageRoot,
        skillsDirectory,
        targetPath: result.targetPath,
        operation: result.mode === 'symlink' ? 'link' : 'copy',
        mode: result.mode,
        status: result.status,
        fallbackUsed: result.fallbackUsed,
        fallbackReason: result.fallbackReason ? formatReason(result.fallbackReason) : result.fallbackReason,
      });
    },
  });
}
