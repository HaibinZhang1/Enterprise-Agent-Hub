export { AUTH_PENDING_CODE, AUTH_ERROR_CODES, AUTH_ERROR_FIXTURE } from './auth.js';
export { AUTH_ORG_CONVERGENCE_FIXTURE } from './convergence.js';
export { INSTALL_RECONCILE_STATUS_FIXTURE } from './install.js';
export { SSE_PAYLOAD_FIXTURE } from './notify.js';
export { SOURCE_OF_TRUTH_MATRIX_FIXTURE } from './source-of-truth.js';
export { PHASE_GATES_FIXTURE, CONTRACT_OWNERSHIP_FIXTURE } from './phase-gates.js';
export {
  createAuthErrorEnvelope,
  createAuthPendingError,
  getContractsForConsumer,
  getSourceOfTruthFactsByAuthority,
  isKnownInstallOrReconcileState,
} from './runtime.js';

import { AUTH_ERROR_FIXTURE } from './auth.js';
import { AUTH_ORG_CONVERGENCE_FIXTURE } from './convergence.js';
import { INSTALL_RECONCILE_STATUS_FIXTURE } from './install.js';
import { SSE_PAYLOAD_FIXTURE } from './notify.js';
import { SOURCE_OF_TRUTH_MATRIX_FIXTURE } from './source-of-truth.js';
import { PHASE_GATES_FIXTURE, CONTRACT_OWNERSHIP_FIXTURE } from './phase-gates.js';

export const phaseGateFixtures = Object.freeze({
  authErrorEnvelope: AUTH_ERROR_FIXTURE,
  authOrgConvergence: AUTH_ORG_CONVERGENCE_FIXTURE,
  installReconcileStatus: INSTALL_RECONCILE_STATUS_FIXTURE,
  ssePayloads: SSE_PAYLOAD_FIXTURE,
  sourceOfTruthMatrix: SOURCE_OF_TRUTH_MATRIX_FIXTURE,
  phaseGates: PHASE_GATES_FIXTURE,
  contractOwnership: CONTRACT_OWNERSHIP_FIXTURE,
});
