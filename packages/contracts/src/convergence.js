export const AUTH_ORG_CONVERGENCE_FIXTURE = Object.freeze({
  version: 1,
  userProjection: {
    authzVersion: 'server-authoritative bigint',
    authzRecalcPending: 'server-authoritative boolean',
    authzTargetVersion: 'server-authoritative bigint | null',
    pendingReason: 'ORG_SCOPE_CHANGE | ROLE_CHANGE | DEPARTMENT_CHANGE',
  },
  progression: [
    'org mutation calculates impacted users',
    'auth marks impacted users pending=true and raises authzTargetVersion',
    'protected requests fail closed while pending=true',
    'convergence job recomputes scope and atomically updates authzVersion',
    'fresh login reissues access token with the new authzVersion',
  ],
  serverActions: {
    onPendingProtectedRequest: 'deny with AUTHZ_RECALC_PENDING',
    onPendingRefresh: 'deny and require fresh login after convergence',
    onConvergenceComplete: 'clear pending state and revoke obsolete session family',
  },
});
