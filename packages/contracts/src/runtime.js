import {
  AUTH_ERROR_FIXTURE,
  AUTH_PENDING_CODE,
  AUTH_ERROR_CODES,
} from './auth.js';
import { CONTRACT_OWNERSHIP_FIXTURE } from './phase-gates.js';
import {
  INSTALL_RECONCILE_STATUS_FIXTURE,
} from './install.js';
import { SOURCE_OF_TRUTH_MATRIX_FIXTURE } from './source-of-truth.js';

/**
 * @param {{
 *   code: string;
 *   requestId: string;
 *   details?: Record<string, unknown>;
 * }} input
 */
export function createAuthErrorEnvelope(input) {
  if (!AUTH_ERROR_CODES.includes(input.code)) {
    throw new Error(`Unsupported auth error code: ${input.code}`);
  }

  const base =
    input.code === AUTH_PENDING_CODE
      ? AUTH_ERROR_FIXTURE
      : {
          version: 1,
          error: {
            domain: 'auth',
            code: input.code,
            httpStatus: 401,
            retryable: false,
            userMessage: 'Authentication failed.',
            action: 'show-error',
          },
          metadata: {
            requiresFreshLogin: false,
            clearSession: false,
            authority: 'server',
            allowedClientFallbacks: ['show-inline-error'],
          },
        };

  return Object.freeze({
    ...base,
    requestId: input.requestId,
    details: input.details ?? {},
  });
}

/**
 * @param {{ requestId: string; details?: Record<string, unknown> }} input
 */
export function createAuthPendingError(input) {
  return createAuthErrorEnvelope({
    code: AUTH_PENDING_CODE,
    requestId: input.requestId,
    details: input.details,
  });
}

/**
 * @param {string} consumer
 */
export function getContractsForConsumer(consumer) {
  return CONTRACT_OWNERSHIP_FIXTURE.filter((entry) => entry.consumers.includes(consumer));
}

/**
 * @param {'server' | 'desktop' | 'derived'} authority
 */
export function getSourceOfTruthFactsByAuthority(authority) {
  return SOURCE_OF_TRUTH_MATRIX_FIXTURE.filter((entry) => entry.authority === authority);
}

/**
 * @param {string} state
 */
export function isKnownInstallOrReconcileState(state) {
  return (
    INSTALL_RECONCILE_STATUS_FIXTURE.serverInstallStates.includes(state) ||
    INSTALL_RECONCILE_STATUS_FIXTURE.desktopLocalStates.includes(state) ||
    INSTALL_RECONCILE_STATUS_FIXTURE.derivedReconcileStates.includes(state)
  );
}
