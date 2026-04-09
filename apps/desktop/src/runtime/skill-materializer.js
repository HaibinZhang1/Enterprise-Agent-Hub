import { cp, mkdir, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DEFAULT_FILESYSTEM = Object.freeze({
  cp,
  mkdir,
  rm,
  symlink,
});

/**
 * @typedef {{
 *   cp: typeof cp;
 *   mkdir: typeof mkdir;
 *   rm: typeof rm;
 *   symlink: typeof symlink;
 * }} SkillMaterializerFilesystem
 */

/**
 * @typedef {{
 *   skillId: string;
 *   sourceDirectory: string;
 *   skillsDirectory: string;
 *   preferredMode?: 'symlink' | 'copy';
 * }} SkillMaterializeRequest
 */

/**
 * @typedef {{
 *   ok: true;
 *   skillId: string;
 *   sourceDirectory: string;
 *   skillsDirectory: string;
 *   targetPath: string;
 *   mode: 'symlink' | 'copy';
 *   status: 'materialized';
 *   fallbackUsed: boolean;
 *   fallbackReason: string | null;
 * }} SkillMaterializeResult
 */

/**
 * @param {string} value
 * @param {string} fieldName
 */
function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
}

/**
 * @param {unknown} error
 */
function formatFallbackReason(error) {
  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'string' ? `${error.code}: ` : '';
    const message = 'message' in error && typeof error.message === 'string' ? error.message : String(error);
    return `${code}${message}`;
  }
  return String(error);
}

/**
 * @param {SkillMaterializeRequest} request
 */
function validateMaterializeRequest(request) {
  requireNonEmptyString(request.skillId, 'skillId');
  requireNonEmptyString(request.sourceDirectory, 'sourceDirectory');
  requireNonEmptyString(request.skillsDirectory, 'skillsDirectory');
  if (request.preferredMode && !['symlink', 'copy'].includes(request.preferredMode)) {
    throw new TypeError('preferredMode must be either "symlink" or "copy".');
  }
}

/**
 * @param {{ filesystem?: Partial<SkillMaterializerFilesystem> }} [input]
 */
export function createSkillMaterializer(input = {}) {
  const filesystem = Object.freeze({ ...DEFAULT_FILESYSTEM, ...(input.filesystem ?? {}) });

  return Object.freeze({
    /**
     * Materialize one skill into a target skills directory.
     *
     * The default contract is symlink-first. If symlink creation fails for any
     * platform or permissions reason, the destination is cleaned and the same
     * source tree is copied into place instead. The returned mode is the mode
     * that actually reached the filesystem, so callers can persist it in
     * skill_materialization_status without guessing.
     *
     * @param {SkillMaterializeRequest} request
     * @returns {Promise<SkillMaterializeResult>}
     */
    async materialize(request) {
      validateMaterializeRequest(request);
      const preferredMode = request.preferredMode ?? 'symlink';
      const sourceDirectory = resolve(request.sourceDirectory);
      const skillsDirectory = resolve(request.skillsDirectory);
      const targetPath = join(skillsDirectory, request.skillId);

      await filesystem.mkdir(skillsDirectory, { recursive: true });
      await filesystem.rm(targetPath, { recursive: true, force: true });

      if (preferredMode === 'copy') {
        await filesystem.cp(sourceDirectory, targetPath, { recursive: true, force: true });
        return Object.freeze({
          ok: true,
          skillId: request.skillId,
          sourceDirectory,
          skillsDirectory,
          targetPath,
          mode: 'copy',
          status: 'materialized',
          fallbackUsed: false,
          fallbackReason: null,
        });
      }

      try {
        await filesystem.symlink(
          sourceDirectory,
          targetPath,
          process.platform === 'win32' ? 'junction' : 'dir',
        );
        return Object.freeze({
          ok: true,
          skillId: request.skillId,
          sourceDirectory,
          skillsDirectory,
          targetPath,
          mode: 'symlink',
          status: 'materialized',
          fallbackUsed: false,
          fallbackReason: null,
        });
      } catch (error) {
        await filesystem.rm(targetPath, { recursive: true, force: true });
        await filesystem.cp(sourceDirectory, targetPath, { recursive: true, force: true });
        return Object.freeze({
          ok: true,
          skillId: request.skillId,
          sourceDirectory,
          skillsDirectory,
          targetPath,
          mode: 'copy',
          status: 'materialized',
          fallbackUsed: true,
          fallbackReason: formatFallbackReason(error),
        });
      }
    },

    /**
     * @param {{ skillId: string; skillsDirectory: string }} request
     */
    async removeMaterialization(request) {
      requireNonEmptyString(request.skillId, 'skillId');
      requireNonEmptyString(request.skillsDirectory, 'skillsDirectory');
      const skillsDirectory = resolve(request.skillsDirectory);
      const targetPath = join(skillsDirectory, request.skillId);
      await filesystem.rm(targetPath, { recursive: true, force: true });
      return Object.freeze({
        ok: true,
        skillId: request.skillId,
        skillsDirectory,
        targetPath,
        status: 'removed',
      });
    },
  });
}
