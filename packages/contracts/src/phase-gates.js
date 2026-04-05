export const PHASE_GATES_FIXTURE = Object.freeze([
  {
    gate: 'gate-0-foundation',
    description: 'Workspace, package boundaries, and migration runners exist and build locally.',
    requiredArtifacts: [
      'package.json',
      'pnpm-workspace.yaml',
      'apps/api/src/manifest.js',
      'apps/web/src/manifest.js',
      'apps/desktop/src/manifest.js',
      'packages/migrations/postgres/sql/0001_initial_foundation.sql',
      'packages/migrations/sqlite/sql/0001_local_state_foundation.sql',
    ],
    verification: ['pnpm lint', 'pnpm typecheck', 'pnpm build'],
  },
  {
    gate: 'gate-0.5-contract-freeze',
    description: 'Shared fixtures are frozen and consumed across backend, web, and desktop scaffolds.',
    requiredArtifacts: [
      'packages/contracts/fixtures/auth-error-envelope.fixture.json',
      'packages/contracts/fixtures/auth-org-convergence.fixture.json',
      'packages/contracts/fixtures/install-reconcile-status.fixture.json',
      'packages/contracts/fixtures/sse-payload.fixture.json',
      'packages/contracts/fixtures/source-of-truth-matrix.fixture.json',
    ],
    verification: ['pnpm test', 'python3 -m unittest discover -s tests -p test_*.py'],
  },
]);

export const CONTRACT_OWNERSHIP_FIXTURE = Object.freeze([
  {
    contract: 'auth-error-envelope',
    canonicalSource: 'packages/contracts/src/auth.js',
    fixture: 'packages/contracts/fixtures/auth-error-envelope.fixture.json',
    consumers: ['apps/api', 'apps/web', 'apps/desktop'],
  },
  {
    contract: 'auth-org-convergence',
    canonicalSource: 'packages/contracts/src/convergence.js',
    fixture: 'packages/contracts/fixtures/auth-org-convergence.fixture.json',
    consumers: ['apps/api', 'apps/web'],
  },
  {
    contract: 'install-reconcile-status',
    canonicalSource: 'packages/contracts/src/install.js',
    fixture: 'packages/contracts/fixtures/install-reconcile-status.fixture.json',
    consumers: ['apps/api', 'apps/desktop'],
  },
  {
    contract: 'sse-payload',
    canonicalSource: 'packages/contracts/src/notify.js',
    fixture: 'packages/contracts/fixtures/sse-payload.fixture.json',
    consumers: ['apps/api', 'apps/web', 'apps/desktop'],
  },
  {
    contract: 'source-of-truth-matrix',
    canonicalSource: 'packages/contracts/src/source-of-truth.js',
    fixture: 'packages/contracts/fixtures/source-of-truth-matrix.fixture.json',
    consumers: ['apps/api', 'apps/desktop'],
  },
]);
