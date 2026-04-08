// @ts-nocheck
import { createReviewTicket } from '../modules/review/core/ticket-policy.js';

const users = Object.freeze([
  Object.freeze({
    userId: '00000000-0000-0000-0000-000000000001',
    username: 'admin',
    roleCode: 'system_admin_lv1',
    departmentId: null,
    password: 'admin',
  }),
  Object.freeze({
    userId: '00000000-0000-0000-0000-000000000002',
    username: 'reviewer',
    roleCode: 'review_admin_lv3',
    departmentId: '00000000-0000-0000-0000-000000000101',
    password: 'reviewer',
  }),
  Object.freeze({
    userId: '00000000-0000-0000-0000-000000000003',
    username: 'publisher',
    roleCode: 'employee_lv6',
    departmentId: '00000000-0000-0000-0000-000000000102',
    password: 'publisher',
  }),
]);

export function seedMvpData(input) {
  const now = input.now ?? new Date('2026-04-08T00:00:00.000Z');
  for (const entry of users) {
    if (!input.authRepository.findUserById(entry.userId)) {
      input.authRepository.createUser({
        userId: entry.userId,
        username: entry.username,
        departmentId: entry.departmentId,
        roleCode: entry.roleCode,
        status: 'active',
        authzVersion: 1,
        authzRecalcPending: false,
        pendingAuthzVersion: null,
        mustChangePassword: false,
        lastLoginAt: null,
        provider: 'local',
      });
    }
    input.authRepository.saveCredential({
      userId: entry.userId,
      password: entry.password,
      passwordHistory: [],
      temporaryCredentialMode: 'permanent',
      failedAttemptCount: 0,
      lockedUntil: null,
      passwordChangedAt: now.toISOString(),
    });
  }

  input.skillCatalogRepository.save({
    skillId: 'skill-market-1',
    ownerUserId: users[2].userId,
    title: 'Enterprise Search Assistant',
    summary: 'Published search helper available from the connected MVP market.',
    visibility: 'global_installable',
    allowedDepartmentIds: [],
    status: 'published',
    versions: [
      Object.freeze({
        packageId: 'pkg-market-1',
        version: '1.0.0',
        submittedAt: now.toISOString(),
        status: 'published',
        publishedAt: now.toISOString(),
      }),
    ],
    publishedVersion: '1.0.0',
  });

  input.skillCatalogRepository.save({
    skillId: 'skill-admin-draft-1',
    ownerUserId: users[0].userId,
    title: 'Admin Review Console',
    summary: 'Owned by admin and visible in My Skills / Skill Management.',
    visibility: 'department',
    allowedDepartmentIds: ['00000000-0000-0000-0000-000000000101'],
    status: 'pending_review',
    versions: [
      Object.freeze({
        packageId: 'pkg-admin-draft-1',
        version: '0.1.0',
        submittedAt: now.toISOString(),
        status: 'pending_review',
      }),
    ],
    publishedVersion: null,
  });

  input.searchDocumentRepository.upsert({
    skillId: 'skill-market-1',
    title: 'Enterprise Search Assistant',
    summary: 'Published search helper available from the connected MVP market.',
    ownerUserId: users[2].userId,
    publishedVersion: '1.0.0',
    visibility: 'global_installable',
    allowedDepartmentIds: [],
    tags: ['search', 'assistant'],
  });

  input.reviewTicketRepository.save(
    createReviewTicket({
      ticketId: 'review-admin-1',
      skillId: 'skill-admin-draft-1',
      packageId: 'pkg-admin-draft-1',
      requestedBy: users[0].userId,
      reviewerId: users[0].userId,
      createdAt: now,
    }),
  );

  if (input.notificationRepository.listNotifications({ userId: users[0].userId }).length === 0) {
    input.notificationRepository.notify({
      userId: users[0].userId,
      category: 'system',
      title: 'Connected MVP seed ready',
      body: 'Admin seed data has been provisioned for the desktop + API MVP.',
      now,
    });
  }
}
