import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotificationCenter } from '../apps/api/src/modules/notify/core/notification-center.js';
import { createPublishReviewRuntime } from '../apps/api/src/workflows/publish-review-runtime.js';

test('phase 2 runtime fails closed on invalid package submissions without downstream state changes', () => {
  const runtime = createPublishReviewRuntime();
  const publisher = {
    userId: 'publisher-1',
    username: 'publisher',
    roleCode: 'employee_lv6',
    departmentId: 'dept-2',
  };

  const report = runtime.uploadPackage({
    requestId: 'req-phase2-invalid-upload',
    actor: publisher,
    packageId: 'pkg-invalid',
    files: [{ path: 'README.md', size: 128 }],
    manifest: {
      skillId: 'skill-invalid',
      version: '1.0.0',
      title: 'Broken Skill Package',
      summary: 'Missing required skill contract.',
    },
    now: new Date('2026-04-06T02:00:00.000Z'),
  });

  assert.equal(report.valid, false);
  assert.deepEqual(report.findings, [
    {
      severity: 'error',
      code: 'missing_required_file',
      file: 'SKILL.md',
    },
  ]);

  assert.throws(
    () => runtime.submitSkillForReview({
      requestId: 'req-phase2-invalid-submit',
      actor: publisher,
      skillId: 'skill-invalid',
      packageId: 'pkg-invalid',
      reviewerId: 'reviewer-1',
      visibility: 'department',
      allowedDepartmentIds: ['dept-2'],
      now: new Date('2026-04-06T02:01:00.000Z'),
    }),
    /invalid package report/i,
  );

  assert.deepEqual(
    runtime.search({
      viewer: { userId: 'consumer-1', departmentIds: ['dept-2'] },
      query: 'broken skill',
    }),
    [],
  );
  assert.deepEqual(runtime.listNotifications('reviewer-1'), []);
  assert.deepEqual(runtime.getAuditTrail().map((entry) => entry.action), ['package.uploaded']);
});

test('phase 2 runtime keeps reviewer and publisher notification payloads aligned with the minimal loop', () => {
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

  const submission = runtime.submitSkillForReview({
    requestId: 'req-phase2-submit',
    actor: publisher,
    skillId: 'skill-2',
    packageId: runtime.uploadPackage({
      requestId: 'req-phase2-upload',
      actor: publisher,
      packageId: 'pkg-2',
      files: [
        { path: 'README.md', size: 128 },
        { path: 'SKILL.md', size: 256 },
      ],
      manifest: {
        skillId: 'skill-2',
        version: '2.0.0',
        title: 'Review Loop Assistant',
        summary: 'Exercises publish review notifications.',
        tags: ['review', 'notify'],
      },
      now: new Date('2026-04-06T03:00:00.000Z'),
    }).packageId,
    reviewerId: reviewer.userId,
    visibility: 'department',
    allowedDepartmentIds: ['dept-2'],
    now: new Date('2026-04-06T03:01:00.000Z'),
  });

  assert.deepEqual(runtime.listNotifications(reviewer.userId), [
    {
      id: 'reviewer-1-1',
      category: 'review',
      title: 'New review ticket assigned',
      body: 'Review Loop Assistant is ready for review.',
      readAt: null,
      createdAt: '2026-04-06T03:01:00.000Z',
      metadata: {
        ticketId: submission.ticket.ticketId,
        skillId: 'skill-2',
      },
    },
  ]);

  runtime.claimReview({
    requestId: 'req-phase2-claim',
    actor: reviewer,
    ticketId: submission.ticket.ticketId,
    now: new Date('2026-04-06T03:02:00.000Z'),
  });
  runtime.approveReview({
    requestId: 'req-phase2-approve',
    actor: reviewer,
    ticketId: submission.ticket.ticketId,
    comment: 'Approved for publish/notify regression coverage.',
    now: new Date('2026-04-06T03:03:00.000Z'),
  });

  assert.deepEqual(runtime.listNotifications(publisher.userId), [
    {
      id: 'publisher-1-1',
      category: 'review',
      title: 'Skill published',
      body: 'Review Loop Assistant passed review and is now searchable.',
      readAt: null,
      createdAt: '2026-04-06T03:03:00.000Z',
      metadata: {
        ticketId: submission.ticket.ticketId,
        version: '2.0.0',
      },
    },
  ]);

  assert.deepEqual(runtime.getBadges(reviewer.userId), {
    unreadCount: 1,
    reviewTodoCount: 0,
    updateAvailableCount: 0,
    generatedAt: '2026-04-06T03:03:00.000Z',
  });
  assert.deepEqual(runtime.getBadges(publisher.userId), {
    unreadCount: 1,
    reviewTodoCount: 0,
    updateAvailableCount: 0,
    generatedAt: '2026-04-06T03:03:00.000Z',
  });
});

test('notification center preserves unread badge transitions when reading notifications', () => {
  const center = createNotificationCenter();

  const first = center.notify({
    userId: 'user-1',
    category: 'review',
    title: 'First',
    body: 'First notification',
    now: new Date('2026-04-06T04:00:00.000Z'),
  });
  const second = center.notify({
    userId: 'user-1',
    category: 'review',
    title: 'Second',
    body: 'Second notification',
    now: new Date('2026-04-06T04:01:00.000Z'),
  });

  assert.deepEqual(center.getBadges({ userId: 'user-1' }), {
    unreadCount: 2,
    reviewTodoCount: 0,
    updateAvailableCount: 0,
    generatedAt: '2026-04-06T04:01:00.000Z',
  });

  assert.deepEqual(center.markRead({
    userId: 'user-1',
    notificationId: first.id,
    now: new Date('2026-04-06T04:02:00.000Z'),
  }), {
    unreadCount: 1,
    reviewTodoCount: 0,
    updateAvailableCount: 0,
    generatedAt: '2026-04-06T04:02:00.000Z',
  });

  assert.deepEqual(center.readAll({
    userId: 'user-1',
    now: new Date('2026-04-06T04:03:00.000Z'),
  }), {
    unreadCount: 0,
    reviewTodoCount: 0,
    updateAvailableCount: 0,
    generatedAt: '2026-04-06T04:03:00.000Z',
  });

  assert.deepEqual(
    center.listNotifications({ userId: 'user-1' }).map((entry) => ({ id: entry.id, readAt: entry.readAt })),
    [
      { id: second.id, readAt: '2026-04-06T04:03:00.000Z' },
      { id: first.id, readAt: '2026-04-06T04:02:00.000Z' },
    ],
  );
});
