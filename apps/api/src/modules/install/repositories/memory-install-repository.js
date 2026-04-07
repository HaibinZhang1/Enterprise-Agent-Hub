/**
 * @typedef {{ type: 'tool' | 'project'; id: string }} InstallTarget
 */

/**
 * @typedef {{
 *   installId: string;
 *   userId: string;
 *   skillId: string;
 *   version: string;
 *   status: 'requested' | 'installed' | 'active' | 'inactive' | 'uninstalled' | 'blocked';
 *   target: InstallTarget;
 *   createdAt: string;
 *   updatedAt: string;
 *   lastDesktopSyncAt: string | null;
 *   lastDesktopLocalState: string | null;
 *   lastDesktopReconcileState: string | null;
 *   lastFailureReason: string | null;
 * }} InstallRecord
 */

/**
 * @param {InstallTarget} target
 */
function freezeTarget(target) {
  return Object.freeze({ ...target });
}

/**
 * @param {InstallRecord} install
 */
function freezeInstall(install) {
  return Object.freeze({
    ...install,
    target: freezeTarget(install.target),
  });
}

export function createMemoryInstallRepository() {
  /** @type {Map<string, InstallRecord>} */
  const installsById = new Map();
  let installSequence = 1;

  return Object.freeze({
    /**
     * @param {string} userId
     */
    nextInstallId(userId) {
      const installId = `${userId}-install-${installSequence}`;
      installSequence += 1;
      return installId;
    },

    /**
     * @param {InstallRecord} install
     */
    saveInstall(install) {
      const stored = freezeInstall(install);
      installsById.set(stored.installId, stored);
      return stored;
    },

    /**
     * @param {string} installId
     */
    getInstall(installId) {
      return installsById.get(installId) ?? null;
    },

    /**
     * @param {string} userId
     */
    listInstallsByUserId(userId) {
      return Object.freeze([...installsById.values()].filter((install) => install.userId === userId));
    },
  });
}
