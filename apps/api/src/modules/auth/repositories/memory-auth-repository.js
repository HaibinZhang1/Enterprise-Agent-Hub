/**
 * @typedef {{
 *   userId: string;
 *   username: string;
 *   departmentId: string | null;
 *   roleCode: string;
 *   status: 'active' | 'frozen';
 *   authzVersion: number;
 *   authzRecalcPending: boolean;
 *   pendingAuthzVersion: number | null;
 *   mustChangePassword: boolean;
 *   lastLoginAt: string | null;
 *   provider: 'local';
 * }} ManagedUser
 */

/**
 * @typedef {{
 *   userId: string;
 *   password: string;
 *   passwordHistory: readonly string[];
 *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket' | 'bootstrap-ticket' | 'permanent';
 *   failedAttemptCount: number;
 *   lockedUntil: string | null;
 *   passwordChangedAt: string;
 * }} LocalCredentialRecord
 */

/**
 * @typedef {{
 *   sessionId: string;
 *   userId: string;
 *   sessionFamilyId: string;
 *   parentSessionId: string | null;
 *   clientType: 'desktop' | 'web' | 'api';
 *   deviceLabel: string;
 *   refreshTokenHash: string;
 *   issuedAuthzVersion: number;
 *   issuedAt: string;
 *   lastSeenAt: string;
 *   expiresAt: string;
 *   idleExpiresAt: string;
 *   revokedAt: string | null;
 *   revokeReason: string | null;
 * }} AuthSessionRecord
 */

/**
 * @param {ManagedUser} user
 */
function freezeUser(user) {
  return Object.freeze({ ...user });
}

/**
 * @param {LocalCredentialRecord} credential
 */
function freezeCredential(credential) {
  return Object.freeze({
    ...credential,
    passwordHistory: [...credential.passwordHistory],
  });
}

/**
 * @param {AuthSessionRecord} session
 */
function freezeSession(session) {
  return Object.freeze({ ...session });
}

export function createMemoryAuthRepository() {
  /** @type {Map<string, ManagedUser>} */
  const usersById = new Map();
  /** @type {Map<string, string>} */
  const userIdByUsername = new Map();
  /** @type {Map<string, LocalCredentialRecord>} */
  const credentialsByUserId = new Map();
  /** @type {Map<string, AuthSessionRecord>} */
  const sessionsById = new Map();
  let nextSessionSequence = 1;

  return Object.freeze({
    /**
     * @param {ManagedUser} user
     */
    createUser(user) {
      if (usersById.has(user.userId)) {
        throw new Error(`User already exists: ${user.userId}`);
      }
      if (userIdByUsername.has(user.username)) {
        throw new Error(`Username already exists: ${user.username}`);
      }
      const stored = freezeUser(user);
      usersById.set(stored.userId, stored);
      userIdByUsername.set(stored.username, stored.userId);
      return stored;
    },

    /**
     * @param {ManagedUser} user
     */
    updateUser(user) {
      const previous = usersById.get(user.userId);
      if (!previous) {
        throw new Error(`Unknown user: ${user.userId}`);
      }
      if (previous.username !== user.username) {
        userIdByUsername.delete(previous.username);
        userIdByUsername.set(user.username, user.userId);
      }
      const stored = freezeUser(user);
      usersById.set(stored.userId, stored);
      return stored;
    },

    /**
     * @param {string} userId
     */
    findUserById(userId) {
      return usersById.get(userId) ?? null;
    },

    /**
     * @param {string} username
     */
    findUserByUsername(username) {
      const userId = userIdByUsername.get(username);
      return userId ? usersById.get(userId) ?? null : null;
    },

    /**
     * @param {LocalCredentialRecord} credential
     */
    saveCredential(credential) {
      const stored = freezeCredential(credential);
      credentialsByUserId.set(stored.userId, stored);
      return stored;
    },

    /**
     * @param {string} userId
     */
    getCredential(userId) {
      return credentialsByUserId.get(userId) ?? null;
    },

    /**
     * @param {string} userId
     */
    nextSessionId(userId) {
      const sessionId = `${userId}-session-${nextSessionSequence}`;
      nextSessionSequence += 1;
      return sessionId;
    },

    /**
     * @param {AuthSessionRecord} session
     */
    saveSession(session) {
      const stored = freezeSession(session);
      sessionsById.set(stored.sessionId, stored);
      return stored;
    },

    /**
     * @param {string} sessionId
     */
    getSession(sessionId) {
      return sessionsById.get(sessionId) ?? null;
    },

    /**
     * @param {string} userId
     */
    listSessionsByUserId(userId) {
      const sessions = [...sessionsById.values()].filter((session) => session.userId === userId);
      return Object.freeze(sessions);
    },

    /**
     * @param {string} userId
     */
    listActiveSessionsByUserId(userId) {
      const sessions = [...sessionsById.values()].filter(
        (session) => session.userId === userId && session.revokedAt === null,
      );
      return Object.freeze(sessions);
    },

    /**
     * @param {{ userId: string; revokedAt: string; revokeReason: string }} input
     */
    revokeUserSessions(input) {
      const revoked = [];
      for (const session of sessionsById.values()) {
        if (session.userId !== input.userId || session.revokedAt !== null) {
          continue;
        }
        const nextSession = freezeSession({
          ...session,
          revokedAt: input.revokedAt,
          revokeReason: input.revokeReason,
        });
        sessionsById.set(nextSession.sessionId, nextSession);
        revoked.push(nextSession);
      }
      return Object.freeze(revoked);
    },
  });
}
