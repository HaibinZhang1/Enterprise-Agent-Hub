import { cp, mkdir, rm, stat, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DEFAULT_FILESYSTEM = Object.freeze({
  cp,
  mkdir,
  rm,
  stat,
  symlink,
});

/**
 * @typedef {{
 *   cp: typeof cp;
 *   mkdir: typeof mkdir;
 *   rm: typeof rm;
 *   stat: typeof stat;
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
 * }} SkillMaterializeSuccess
 */

/**
 * @typedef {{
 *   ok: false;
 *   skillId: string;
 *   sourceDirectory: string;
 *   skillsDirectory: string;
 *   targetPath: string;
 *   mode: null;
 *   status: 'offline_blocked' | 'access_denied';
 *   fallbackUsed: false;
 *   fallbackReason: null;
 *   failureReason: string;
 * }} SkillMaterializeFailure
 */

/** @typedef {SkillMaterializeSuccess | SkillMaterializeFailure} SkillMaterializeResult */

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
function formatFilesystemReason(error) {
  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'string' ? `${error.code}: ` : '';
    const message = 'message' in error && typeof error.message === 'string' ? error.message : String(error);
    return `${code}${message}`;
  }
  return String(error);
}

/**
 * @param {unknown} error
 */
function statusForSourceFailure(error) {
  if (
    error
    && typeof error === 'object'
    && 'code' in error
    && ['EACCES', 'EPERM'].includes(String(error.code))
  ) {
    return 'access_denied';
  }
  return 'offline_blocked';
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
     * Source availability is checked before touching the destination. Missing
     * or inaccessible package trees return explicit degraded status, preserving
     * any current materialization instead of silently substituting a different
     * source or creating a dangling symlink.
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

      try {
        const sourceStats = await filesystem.stat(sourceDirectory);
        if (!sourceStats.isDirectory()) {
          return Object.freeze({
            ok: false,
            skillId: request.skillId,
            sourceDirectory,
            skillsDirectory,
            targetPath,
            mode: null,
            status: 'offline_blocked',
            fallbackUsed: false,
            fallbackReason: null,
            failureReason: 'source path is not a directory',
          });
        }
      } catch (error) {
        return Object.freeze({
          ok: false,
          skillId: request.skillId,
          sourceDirectory,
          skillsDirectory,
          targetPath,
          mode: null,
          status: statusForSourceFailure(error),
          fallbackUsed: false,
          fallbackReason: null,
          failureReason: formatFilesystemReason(error),
        });
      }

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
          fallbackReason: formatFilesystemReason(error),
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
