import assert from 'node:assert/strict';
import test from 'node:test';

import { createPhase2LiveWebFlow } from '../apps/web/src/live/phase-2-live-web-flow.js';

test('phase 2 live web flow executes publish/review/search/notify with approved page states', () => {
  const flow = createPhase2LiveWebFlow();
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

  assert.deepEqual(flow.mySkillPage.load({ actor: null }), {
    state: 'permission-denied',
    reason: 'actor_required',
  });
  assert.equal(flow.reviewPage.load({ actor: reviewer, status: 'todo' }).state, 'empty');
  assert.equal(flow.notificationsPage.load({ userId: publisher.userId }).state, 'empty');

  const submitted = flow.mySkillPage.uploadAndSubmit({
    requestId: 'req-web-upload-submit',
    actor: publisher,
    packageId: 'pkg-web-1',
    reviewerId: reviewer.userId,
    files: [
      { path: 'README.md', size: 128 },
      { path: 'SKILL.md', size: 256 },
    ],
    manifest: {
      skillId: 'skill-web-1',
      version: '1.0.0',
      title: 'Web Review Assistant',
      summary: 'Exercises the live phase 2 web path.',
      tags: ['review', 'web'],
    },
    visibility: 'department',
    allowedDepartmentIds: ['dept-2'],
    now: new Date('2026-04-06T06:00:00.000Z'),
  });

  assert.equal(submitted.state, 'ready');
  assert.equal(submitted.report.valid, true);
  assert.equal(submitted.ticket.status, 'todo');
  assert.equal(flow.mySkillPage.load({ actor: publisher }).state, 'ready');
  assert.equal(flow.reviewPage.load({ actor: reviewer, status: 'todo' }).tickets.length, 1);

  const claimed = flow.reviewPage.claimTicket({
    requestId: 'req-web-claim',
    actor: reviewer,
    ticketId: submitted.ticket.ticketId,
    now: new Date('2026-04-06T06:01:00.000Z'),
  });
  assert.equal(claimed.state, 'ready');
  assert.equal(flow.reviewPage.load({ actor: reviewer, status: 'in-progress' }).tickets.length, 1);

  const approved = flow.reviewPage.approveTicket({
    requestId: 'req-web-approve',
    actor: reviewer,
    ticketId: submitted.ticket.ticketId,
    comment: 'Approved via the web review path.',
    now: new Date('2026-04-06T06:02:00.000Z'),
  });
  assert.equal(approved.state, 'ready');
  assert.equal(approved.skill.status, 'published');

  const market = flow.marketPage.search({
    viewer: { userId: 'consumer-1', departmentIds: ['dept-2'] },
    query: 'review assistant',
  });
  assert.equal(market.state, 'ready');
  assert.deepEqual(market.results.map((entry) => entry.skillId), ['skill-web-1']);
  assert.equal(market.results[0].canInstall, true);

  const blockedMarket = flow.marketPage.search({
    viewer: { userId: 'consumer-2', departmentIds: ['dept-9'] },
    query: 'review assistant',
  });
  assert.equal(blockedMarket.state, 'empty');

  const publisherNotifications = flow.notificationsPage.load({ userId: publisher.userId });
  assert.equal(publisherNotifications.state, 'ready');
  assert.equal(publisherNotifications.badges.unreadCount, 1);
  assert.equal(publisherNotifications.reconnectBanner.visible, true);
  assert.equal(publisherNotifications.reconnectBanner.fallback, 'polling');

  assert.equal(flow.reviewPage.load({ actor: reviewer, status: 'done' }).tickets.length, 1);
});
