import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTH_ACCOUNT_FROZEN, AUTHZ_VERSION_MISMATCH } from '../apps/api/src/modules/auth/core/access-policy.js';
import { createAdminGovernanceRuntime } from '../apps/api/src/workflows/admin-governance-runtime.js';
import { createPublishReviewRuntime } from '../apps/api/src/workflows/publish-review-runtime.js';
import { AUTH_PENDING_CODE } from '../packages/contracts/src/index.js';

test('phase 1 admin governance runtime fails closed during org convergence and records audit/notify outputs', () => {
  const runtime = createAdminGovernanceRuntime();
  const admin = {
    userId: 'admin-1',
    username: 'admin',
    roleCode: 'system_admin_lv1',
    departmentId: null,
  };

  runtime.provisionUser({
    requestId: 'req-phase1-create',
    actor: admin,
    userId: 'user-1',
    username: 'lisi',
    departmentId: 'dept-1',
    roleCode: 'reviewer_lv5',
    temporaryCredentialMode: 'temporary-password',
    now: new Date('2026-04-06T00:00:00.000Z'),
  });

  runtime.reassignUser({
    requestId: 'req-phase1-org',
    actor: admin,
    userId: 'user-1',
    departmentId: 'dept-2',
    roleCode: 'dept_admin_lv4',
    now: new Date('2026-04-06T00:01:00.000Z'),
  });

  assert.deepEqual(runtime.evaluateAccess({ userId: 'user-1', tokenAuthzVersion: 1 }), {
    allowed: false,
    code: AUTH_PENDING_CODE,
    reason: 'authz_recalc_pending',
  });

  runtime.completeScopeConvergence({
    requestId: 'req-phase1-converged',
    actor: admin,
    userId: 'user-1',
    now: new Date('2026-04-06T00:02:00.000Z'),
  });

  assert.deepEqual(runtime.evaluateAccess({ userId: 'user-1', tokenAuthzVersion: 1 }), {
    allowed: false,
    code: AUTHZ_VERSION_MISMATCH,
    reason: 'token_authz_version_stale',
  });
  assert.deepEqual(runtime.evaluateAccess({ userId: 'user-1', tokenAuthzVersion: 2 }), { allowed: true });

  runtime.freezeUser({
    requestId: 'req-phase1-freeze',
    actor: admin,
    userId: 'user-1',
    reason: 'security_investigation',
    now: new Date('2026-04-06T00:03:00.000Z'),
  });
  assert.deepEqual(runtime.evaluateAccess({ userId: 'user-1', tokenAuthzVersion: 3 }), {
    allowed: false,
    code: AUTH_ACCOUNT_FROZEN,
    reason: 'user_frozen',
  });

  runtime.unfreezeUser({
    requestId: 'req-phase1-unfreeze',
    actor: admin,
    userId: 'user-1',
    now: new Date('2026-04-06T00:04:00.000Z'),
  });
  runtime.resetPassword({
    requestId: 'req-phase1-reset',
    actor: admin,
    userId: 'user-1',
    temporaryCredentialMode: 'reset-ticket',
    now: new Date('2026-04-06T00:05:00.000Z'),
  });

  assert.deepEqual(runtime.evaluateAccess({ userId: 'user-1', tokenAuthzVersion: 5 }), { allowed: true });
  assert.equal(runtime.getUser('user-1').mustChangePassword, true);
  assert.equal(runtime.getBadges('user-1').unreadCount, 6);
  assert.deepEqual(
    runtime.getAuditTrail().map((entry) => entry.action),
    [
      'AUTH_USER_CREATED',
      'org.user.assignment.changed',
      'org.scope.recalc.completed',
      'AUTH_USER_FROZEN',
      'AUTH_USER_UNFROZEN',
      'AUTH_PASSWORD_RESET',
    ],
  );
  assert.equal(
    runtime.drainEvents('user-1').some((entry) => entry.event === 'sse.reconnect-required'),
    true,
  );
});

test('phase 2 publish-review runtime drives package validation through approved search visibility and notify badges', () => {
  const runtime = createPublishReviewRuntime();
  const publisher = {
    userId: 'publisher-1',
    username: 'publisher',
    roleCode: 'employee_lv6',
    departmentId: 'dept-2',
  };
  const reviewer = {
    userId: 'reviewer-1',
    username: 'reviewer',
    roleCode: 'review_admin_lv3',
    departmentId: 'dept-1',
  };

  const report = runtime.uploadPackage({
    requestId: 'req-phase2-upload',
    actor: publisher,
    packageId: 'pkg-1',
    files: [
      { path: 'README.md', size: 128 },
      { path: 'SKILL.md', size: 256 },
      { path: 'resources/icon.png', size: 512 },
    ],
    manifest: {
      skillId: 'skill-1',
      version: '1.0.0',
      title: 'Dept Search Assistant',
      summary: 'Department-scoped retrieval assistant for internal docs.',
      tags: ['search', 'assistant'],
    },
    now: new Date('2026-04-06T01:00:00.000Z'),
  });

  assert.equal(report.valid, true);
  assert.equal(report.hash.length, 64);

  const submission = runtime.submitSkillForReview({
    requestId: 'req-phase2-submit',
    actor: publisher,
    skillId: 'skill-1',
    packageId: 'pkg-1',
    reviewerId: reviewer.userId,
    visibility: 'department',
    allowedDepartmentIds: ['dept-2'],
    now: new Date('2026-04-06T01:01:00.000Z'),
  });

  assert.equal(submission.ticket.status, 'todo');
  assert.deepEqual(runtime.getBadges(reviewer.userId), {
    unreadCount: 1,
    reviewTodoCount: 1,
    updateAvailableCount: 0,
    generatedAt: '2026-04-06T01:01:00.000Z',
  });

  runtime.claimReview({
    requestId: 'req-phase2-claim',
    actor: reviewer,
    ticketId: submission.ticket.ticketId,
    now: new Date('2026-04-06T01:02:00.000Z'),
  });

  const approval = runtime.approveReview({
    requestId: 'req-phase2-approve',
    actor: reviewer,
    ticketId: submission.ticket.ticketId,
    comment: 'Meets the phase 2 minimal publish/search contract.',
    now: new Date('2026-04-06T01:03:00.000Z'),
  });

  assert.equal(approval.skill.status, 'published');
  assert.equal(approval.skill.publishedVersion, '1.0.0');
  assert.equal(runtime.getBadges(reviewer.userId).reviewTodoCount, 0);
  assert.equal(runtime.getBadges(publisher.userId).unreadCount, 1);

  assert.deepEqual(runtime.search({
    viewer: { userId: 'consumer-allowed', departmentIds: ['dept-2'] },
    query: 'search assistant',
  }), [
    {
      skillId: 'skill-1',
      title: 'Dept Search Assistant',
      summary: 'Department-scoped retrieval assistant for internal docs.',
      publishedVersion: '1.0.0',
      score: 2,
      canInstall: true,
      detailVisible: true,
    },
  ]);

  assert.deepEqual(runtime.search({
    viewer: { userId: 'consumer-blocked', departmentIds: ['dept-9'] },
    query: 'search assistant',
  }), []);

  assert.equal(
    runtime.drainEvents(reviewer.userId).some((entry) => entry.event === 'review.queue.updated'),
    true,
  );
  assert.deepEqual(
    runtime.getAuditTrail().map((entry) => entry.action),
    ['package.uploaded', 'skill.version.submitted', 'review.ticket.claimed', 'review.ticket.approved'],
  );
});
