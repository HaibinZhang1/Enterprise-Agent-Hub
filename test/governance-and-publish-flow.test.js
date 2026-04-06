import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getManagedDepartmentIds,
  validateAssignmentChange,
  planScopeConvergence,
  ORG_SCOPE_EVENTS,
} from '../apps/api/src/modules/org/core/scope-policy.js';
import {
  createActorSnapshot,
  createAuditLogEntry,
} from '../apps/api/src/modules/audit/core/log-policy.js';
import {
  createNotificationBadgeProjection,
  markNotificationsRead,
  buildNotificationSsePayloads,
} from '../apps/api/src/modules/notify/core/badge-policy.js';
import {
  claimReviewTicket,
  resolveReviewTicket,
  buildReviewQueueSnapshot,
} from '../apps/api/src/modules/review/core/ticket-policy.js';
import {
  createPackageReviewSubmission,
  applyReviewDecisionToSkill,
} from '../apps/api/src/modules/skill/core/publish-workflow.js';
import {
  buildLeaderboard,
  searchSkills,
} from '../apps/api/src/modules/search/core/skill-search-policy.js';

test('org scope policy expands managed departments and plans fail-closed convergence', () => {
  const departments = [
    { id: 'root', parentId: null },
    { id: 'dept-a', parentId: 'root' },
    { id: 'dept-b', parentId: 'root' },
    { id: 'dept-a-1', parentId: 'dept-a' },
  ];

  assert.deepEqual(getManagedDepartmentIds({ rootDepartmentId: 'dept-a', departments }), ['dept-a', 'dept-a-1']);
  assert.deepEqual(getManagedDepartmentIds({ rootDepartmentId: null, departments }), ['root', 'dept-a', 'dept-b', 'dept-a-1']);

  assert.deepEqual(
    validateAssignmentChange({
      actorRoleLevel: 4,
      actorManagedDepartmentIds: ['dept-a', 'dept-a-1'],
      targetDepartmentId: 'dept-a-1',
      targetRoleLevel: 5,
    }),
    { allowed: true },
  );

  assert.deepEqual(
    validateAssignmentChange({
      actorRoleLevel: 4,
      actorManagedDepartmentIds: ['dept-a', 'dept-a-1'],
      targetDepartmentId: 'dept-b',
      targetRoleLevel: 5,
    }),
    { allowed: false, reason: 'target_outside_managed_scope' },
  );

  assert.deepEqual(
    planScopeConvergence({
      affectedUserIds: ['u-2', 'u-1', 'u-2'],
      currentAuthzVersion: 7,
      reason: 'DEPARTMENT_CHANGE',
    }),
    {
      impactedUserIds: ['u-1', 'u-2'],
      authzTargetVersion: 8,
      markPending: true,
      reason: 'DEPARTMENT_CHANGE',
      requestedEvent: ORG_SCOPE_EVENTS.scopeRecalcRequested,
      completedEvent: ORG_SCOPE_EVENTS.scopeRecalcCompleted,
    },
  );
});

test('audit policy preserves request id, actor snapshot, and target metadata', () => {
  const actorSnapshot = createActorSnapshot({
    actorId: 'admin-1',
    username: 'admin',
    roleCode: 'system_admin_lv1',
    departmentId: null,
    ipAddress: '10.0.0.10',
  });

  assert.deepEqual(
    createAuditLogEntry({
      requestId: 'req-1',
      actorSnapshot,
      targetType: 'review_ticket',
      targetId: 'review-skill-1',
      action: 'review.ticket.approved',
      result: 'success',
      occurredAt: new Date('2026-04-06T00:00:00.000Z'),
      metadata: { source: 'review-workbench' },
    }),
    {
      requestId: 'req-1',
      actorSnapshot,
      targetType: 'review_ticket',
      targetId: 'review-skill-1',
      action: 'review.ticket.approved',
      result: 'success',
      reason: null,
      occurredAt: '2026-04-06T00:00:00.000Z',
      metadata: { source: 'review-workbench' },
    },
  );
});

test('phase 2 publish flow creates a review ticket, publishes approved skills, and filters search before rank', () => {
  const submission = createPackageReviewSubmission({
    packageReport: {
      packageId: 'pkg-1',
      structureValid: true,
      findings: [{ severity: 'warning', code: 'README_SUMMARY_MISSING' }],
    },
    skillDraft: {
      skillId: 'skill-1',
      version: '1.0.0',
      title: 'Secure File Review',
      summary: 'Review secure archives before deployment',
      description: 'Review workflow with notifications and safe install gates.',
      allowedDepartmentIds: ['dept-a'],
      accessLevel: 'install',
    },
    submittedBy: 'publisher-1',
    submittedAt: new Date('2026-04-06T01:00:00.000Z'),
  });

  assert.equal(submission.accepted, true);

  const claimed = claimReviewTicket({
    ticket: submission.reviewTicket,
    reviewerId: 'reviewer-1',
    now: new Date('2026-04-06T02:00:00.000Z'),
  });

  assert.equal(claimed.ok, true);

  const resolved = resolveReviewTicket({
    ticket: claimed.ticket,
    reviewerId: 'reviewer-1',
    action: 'approve',
    comment: 'Ready to publish',
    now: new Date('2026-04-06T03:00:00.000Z'),
  });

  assert.equal(resolved.ok, true);

  const publication = applyReviewDecisionToSkill({
    skillVersion: submission.skillVersion,
    searchDocumentDraft: submission.searchDocumentDraft,
    resolvedTicket: resolved.ticket,
  });

  assert.equal(publication.published, true);
  assert.equal(publication.skillVersion.status, 'published');
  assert.equal(publication.searchDocument?.skillId, 'skill-1');

  const searchResults = searchSkills({
    documents: [
      publication.searchDocument,
      {
        skillId: 'skill-2',
        title: 'Hidden Admin Skill',
        summary: 'Only for dept-b',
        description: 'Should never appear before ranking for dept-a viewers.',
        allowedDepartmentIds: ['dept-b'],
        accessLevel: 'install',
        stars: 99,
        downloads: 999,
        updatedAt: '2026-04-06T03:30:00.000Z',
      },
      {
        skillId: 'skill-3',
        title: 'Secure Summary Only',
        summary: 'Visible summary only for dept-a',
        description: 'Long description remains hidden from summary-only viewers.',
        allowedDepartmentIds: ['dept-a'],
        accessLevel: 'summary',
        stars: 2,
        downloads: 5,
        updatedAt: '2026-04-06T03:30:00.000Z',
      },
    ],
    viewer: { departmentId: 'dept-a' },
    query: 'secure',
  });

  assert.equal(searchResults.map((entry) => entry.skillId).includes('skill-2'), false);
  assert.equal(searchResults[0]?.skillId, 'skill-1');
  assert.equal(searchResults[0]?.canInstall, true);
  assert.equal(searchResults[1]?.description, undefined);

  const leaderboard = buildLeaderboard({
    documents: [publication.searchDocument],
    viewer: { departmentId: 'dept-a' },
  });

  assert.equal(leaderboard.length, 1);
  assert.equal(leaderboard[0]?.skillId, 'skill-1');
});

test('phase 2 review return/reject decisions stay non-searchable and preserve remediation state', () => {
  const submission = createPackageReviewSubmission({
    packageReport: {
      packageId: 'pkg-return-1',
      structureValid: true,
      findings: [],
    },
    skillDraft: {
      skillId: 'skill-return-1',
      version: '1.2.0',
      title: 'Needs Revision',
      summary: 'Regression coverage for non-approved review outcomes.',
      description: 'Ensure return/reject decisions do not leak to search.',
      allowedDepartmentIds: ['dept-a'],
      accessLevel: 'install',
    },
    submittedBy: 'publisher-1',
    submittedAt: new Date('2026-04-06T04:00:00.000Z'),
  });

  assert.equal(submission.accepted, true);

  const claimed = claimReviewTicket({
    ticket: submission.reviewTicket,
    reviewerId: 'reviewer-1',
    now: new Date('2026-04-06T04:10:00.000Z'),
  });
  assert.equal(claimed.ok, true);

  const returned = resolveReviewTicket({
    ticket: claimed.ticket,
    reviewerId: 'reviewer-1',
    action: 'return',
    comment: 'Please add remediation notes before publish.',
    now: new Date('2026-04-06T04:20:00.000Z'),
  });
  assert.equal(returned.ok, true);

  const returnedPublication = applyReviewDecisionToSkill({
    skillVersion: submission.skillVersion,
    searchDocumentDraft: submission.searchDocumentDraft,
    resolvedTicket: returned.ticket,
  });
  assert.equal(returnedPublication.published, false);
  assert.equal(returnedPublication.skillVersion.status, 'changes_requested');
  assert.equal(returnedPublication.searchDocument, null);
  assert.equal(returnedPublication.notifyEvent, null);

  const rejected = resolveReviewTicket({
    ticket: claimed.ticket,
    reviewerId: 'reviewer-1',
    action: 'reject',
    comment: 'Package violates publish policy.',
    now: new Date('2026-04-06T04:21:00.000Z'),
  });
  assert.equal(rejected.ok, true);

  const rejectedPublication = applyReviewDecisionToSkill({
    skillVersion: submission.skillVersion,
    searchDocumentDraft: submission.searchDocumentDraft,
    resolvedTicket: rejected.ticket,
  });
  assert.equal(rejectedPublication.published, false);
  assert.equal(rejectedPublication.skillVersion.status, 'rejected');
  assert.equal(rejectedPublication.searchDocument, null);
  assert.equal(rejectedPublication.notifyEvent, null);
});

test('notify and review queue policies keep badge counts, read state, and sla warnings aligned', () => {
  const queue = buildReviewQueueSnapshot({
    tickets: [
      {
        id: 'review-1',
        skillId: 'skill-1',
        status: 'todo',
        submittedAt: '2026-04-05T00:00:00.000Z',
        dueAt: '2026-04-05T12:00:00.000Z',
        claimedBy: null,
        claimExpiresAt: null,
        resolution: null,
      },
      {
        id: 'review-2',
        skillId: 'skill-2',
        status: 'approved',
        submittedAt: '2026-04-05T00:00:00.000Z',
        dueAt: '2026-04-07T12:00:00.000Z',
        claimedBy: 'reviewer-1',
        claimExpiresAt: null,
        resolution: {
          action: 'approve',
          comment: 'ok',
          resolvedBy: 'reviewer-1',
          resolvedAt: '2026-04-05T02:00:00.000Z',
        },
      },
    ],
    now: new Date('2026-04-06T00:00:00.000Z'),
  });

  assert.equal(queue.todo[0]?.needsSlaWarning, true);
  assert.equal(queue.overdueTickets, 1);

  const notificationState = markNotificationsRead({
    notifications: [
      { id: 'n-1', readAt: null },
      { id: 'n-2', readAt: null },
      { id: 'n-3', readAt: '2026-04-05T01:00:00.000Z' },
    ],
    notificationIds: ['n-1'],
    now: new Date('2026-04-06T01:00:00.000Z'),
  });

  const badgeProjection = createNotificationBadgeProjection({
    notifications: notificationState,
    reviewTickets: queue.todo,
    updateSignals: [{ status: 'available' }, { status: 'dismissed' }],
    now: new Date('2026-04-06T01:05:00.000Z'),
  });

  assert.deepEqual(badgeProjection, {
    unreadCount: 1,
    reviewTodoCount: 1,
    updateAvailableCount: 1,
    generatedAt: '2026-04-06T01:05:00.000Z',
  });

  assert.deepEqual(buildNotificationSsePayloads({
    badgeProjection,
    openTickets: queue.todo.length + queue.inProgress.length,
    overdueTickets: queue.overdueTickets,
    updateSignal: { skillId: 'skill-1', version: '1.1.0', severity: 'normal' },
  }), [
    {
      event: 'notify.badge.updated',
      payload: badgeProjection,
    },
    {
      event: 'review.queue.updated',
      payload: {
        openTickets: 1,
        overdueTickets: 1,
        generatedAt: '2026-04-06T01:05:00.000Z',
      },
    },
    {
      event: 'install.update-available',
      payload: {
        skillId: 'skill-1',
        version: '1.1.0',
        severity: 'normal',
      },
    },
  ]);
});
