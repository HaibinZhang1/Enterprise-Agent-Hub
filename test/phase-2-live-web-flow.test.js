import assert from 'node:assert/strict';
import test from 'node:test';

import { createPhase2LiveWebWorkflow } from '../apps/web/src/live/phase-2-workflow.js';

test('phase 2 live web workflow executes the minimal publish-review-search-notify loop with page-state parity', () => {
  const workflow = createPhase2LiveWebWorkflow();
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
  const admin = {
    userId: 'admin-1',
    username: 'admin',
    roleCode: 'system_admin_lv1',
    departmentId: null,
  };
  const viewer = {
    userId: 'consumer-1',
    departmentIds: ['dept-2'],
  };

  assert.equal(workflow.openMySkillPage({ actor: publisher }).state, 'empty');
  assert.equal(workflow.openReviewPage({ actor: publisher }).state, 'permission-denied');
  assert.equal(workflow.openSkillManagementPage({ actor: publisher }).state, 'permission-denied');
  assert.equal(workflow.openMarketPage({ viewer, query: 'review loop' }).state, 'empty');

  const publication = workflow.publishFromMySkill({
    actor: publisher,
    packageId: 'pkg-live-2',
    skillId: 'skill-live-2',
    reviewerId: reviewer.userId,
    visibility: 'department',
    allowedDepartmentIds: ['dept-2'],
    manifest: {
      skillId: 'skill-live-2',
      version: '2.1.0',
      title: 'Live Review Loop Assistant',
      summary: 'Exercises the live reviewer and publisher web path.',
      tags: ['review', 'notify'],
    },
    files: [
      { path: 'README.md', size: 128 },
      { path: 'SKILL.md', size: 256 },
    ],
    now: new Date('2026-04-06T06:00:00.000Z'),
  });

  assert.equal(publication.report.valid, true);
  assert.equal(publication.submission.ticket.status, 'todo');

  const mySkillPage = workflow.openMySkillPage({ actor: publisher });
  assert.equal(mySkillPage.state, 'ready');
  assert.equal(mySkillPage.skills.length, 1);
  assert.equal(mySkillPage.skills[0].status, 'pending_review');

  const reviewerQueue = workflow.openReviewPage({ actor: reviewer });
  assert.equal(reviewerQueue.state, 'ready');
  assert.equal(reviewerQueue.queue.todo.length, 1);
  assert.equal(reviewerQueue.queue.todo[0].ticketId, publication.submission.ticket.ticketId);

  const claimedTicket = workflow.claimReview({
    actor: reviewer,
    ticketId: publication.submission.ticket.ticketId,
    now: new Date('2026-04-06T06:01:00.000Z'),
  });
  assert.equal(claimedTicket.status, 'in_progress');

  const inProgressQueue = workflow.openReviewPage({ actor: reviewer });
  assert.equal(inProgressQueue.queue.todo.length, 0);
  assert.equal(inProgressQueue.queue.inProgress.length, 1);

  const approved = workflow.approveReview({
    actor: reviewer,
    ticketId: publication.submission.ticket.ticketId,
    comment: 'Approved for minimal live loop coverage.',
    now: new Date('2026-04-06T06:02:00.000Z'),
  });
  assert.equal(approved.ticket.status, 'approved');
  assert.equal(approved.skill.status, 'published');
  assert.equal(approved.skill.publishedVersion, '2.1.0');

  const searchableMarket = workflow.openMarketPage({ viewer, query: 'live review loop' });
  assert.equal(searchableMarket.state, 'ready');
  assert.equal(searchableMarket.results.length, 1);
  assert.equal(searchableMarket.results[0].skillId, 'skill-live-2');

  const reviewerNotifications = workflow.openNotificationsPage({ userId: reviewer.userId });
  assert.equal(reviewerNotifications.state, 'ready');
  assert.equal(reviewerNotifications.badges.unreadCount, 1);
  assert.equal(reviewerNotifications.reconnectBanner, true);
  assert.equal(reviewerNotifications.items[0].title, 'New review ticket assigned');

  const publisherNotifications = workflow.openNotificationsPage({ userId: publisher.userId });
  assert.equal(publisherNotifications.state, 'ready');
  assert.equal(publisherNotifications.badges.unreadCount, 1);
  assert.equal(publisherNotifications.items[0].title, 'Skill published');

  assert.deepEqual(
    workflow.markNotificationRead({
      userId: publisher.userId,
      notificationId: publisherNotifications.items[0].id,
      now: new Date('2026-04-06T06:03:00.000Z'),
    }),
    {
      unreadCount: 0,
      reviewTodoCount: 0,
      updateAvailableCount: 0,
      generatedAt: '2026-04-06T06:03:00.000Z',
    },
  );

  const managementPage = workflow.openSkillManagementPage({ actor: admin });
  assert.equal(managementPage.state, 'ready');
  assert.equal(managementPage.skills.length, 1);
  assert.equal(managementPage.skills[0].skillId, 'skill-live-2');
  assert.equal(managementPage.skills[0].history.length, 1);
  assert.equal(managementPage.skills[0].history[0].status, 'published');
});
