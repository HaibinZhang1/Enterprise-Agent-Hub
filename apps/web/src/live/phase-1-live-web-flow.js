import { createLiveAuthGovernanceSlice } from '../../../api/src/modules/auth/live-governance-slice.js';

import { buildReconnectBanner, permissionDenied, resolveCollectionState } from './page-state.js';

/**
 * @typedef {{ userId: string; username: string; roleCode: string; departmentId?: string | null }} Actor
 */

/**
 * @param {Record<string, unknown>} [payload]
 */
function readyUserAction(payload = {}) {
  return Object.freeze({
    state: 'ready',
    ...payload,
  });
}

export function createPhase1LiveWebFlow() {
  const slice = createLiveAuthGovernanceSlice();
  const managedUserIds = new Set();

  function listManagedUsers() {
    return Object.freeze([...managedUserIds].map((userId) => slice.getUser(userId)));
  }

  return Object.freeze({
    loginPage: Object.freeze({
      /**
       * @param {{ requestId: string; username: string; password: string; deviceLabel?: string; now?: Date }} input
       */
      submit(input) {
        const result = slice.authController.login({
          clientType: 'web',
          deviceLabel: input.deviceLabel ?? 'Chrome on macOS',
          ...input,
        });
        return result.ok
          ? readyUserAction(result)
          : Object.freeze({ state: 'error', code: result.code, reason: result.reason });
      },
    }),

    userManagementPage: Object.freeze({
      /**
       * @param {{ actor: Actor | null }} input
       */
      load(input) {
        if (!input.actor) {
          return permissionDenied();
        }

        const users = listManagedUsers();
        return resolveCollectionState(users, { users });
      },

      /**
       * @param {{
       *   requestId: string;
       *   actor: Actor;
       *   userId: string;
       *   username: string;
       *   departmentId: string | null;
       *   roleCode: string;
       *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket';
       *   now?: Date;
       * }} input
       */
      provisionUser(input) {
        const result = slice.authAdminController.provisionUser(input);
        managedUserIds.add(result.user.userId);
        return readyUserAction(result);
      },

      /**
       * @param {{ requestId: string; actor: Actor; userId: string; departmentId: string | null; roleCode: string; now?: Date }} input
       */
      reassignUser(input) {
        return readyUserAction(slice.orgAdminController.reassignUser(input));
      },

      /**
       * @param {{ requestId: string; actor: Actor; userId: string; now?: Date }} input
       */
      completeScopeConvergence(input) {
        return readyUserAction(slice.orgAdminController.completeScopeConvergence(input));
      },

      /**
       * @param {{ requestId: string; actor: Actor; userId: string; reason: string; now?: Date }} input
       */
      freezeUser(input) {
        return readyUserAction({ user: slice.authAdminController.freezeUser(input) });
      },

      /**
       * @param {{ requestId: string; actor: Actor; userId: string; now?: Date }} input
       */
      unfreezeUser(input) {
        return readyUserAction({ user: slice.authAdminController.unfreezeUser(input) });
      },

      /**
       * @param {{ requestId: string; actor: Actor; userId: string; temporaryCredentialMode: 'temporary-password' | 'reset-ticket'; now?: Date }} input
       */
      resetPassword(input) {
        return readyUserAction(slice.authAdminController.resetPassword(input));
      },
    }),

    notificationsPage: Object.freeze({
      /**
       * @param {{ userId: string }} input
       */
      load(input) {
        const notifications = slice.listNotifications(input.userId);
        const badges = slice.getBadges(input.userId);
        const events = slice.drainEvents(input.userId);
        return resolveCollectionState(notifications, {
          notifications,
          badges,
          events,
          reconnectBanner: buildReconnectBanner(events),
        });
      },
    }),

    auditPage: Object.freeze({
      load() {
        const entries = slice.getAuditTrail();
        return resolveCollectionState(entries, { entries });
      },
    }),
  });
}
