import { createAuditLogEntry } from '../modules/audit/core/log-entry.js';
import { createNotificationCenter } from '../modules/notify/core/notification-center.js';
import { createPackageValidationReport } from '../modules/package/core/validation-report.js';
import { createReviewTicket, claimReviewTicket, approveReviewTicket } from '../modules/review/core/ticket-policy.js';
import { buildSkillSearchDocument, searchSkillDocuments } from '../modules/search/core/skill-search.js';
import { createSkillDraft, publishApprovedSkill, submitSkillVersion } from '../modules/skill/core/catalog-policy.js';

export function createPublishReviewRuntime() {
  const packageReports = new Map();
  const skills = new Map();
  const reviewTickets = new Map();
  /** @type {ReturnType<typeof createAuditLogEntry>[]} */
  const auditLogs = [];
  /** @type {ReturnType<typeof buildSkillSearchDocument>[]} */
  const searchDocuments = [];
  const notifications = createNotificationCenter();

  /**
   * @param {string} ticketId
   */
  function requireTicket(ticketId) {
    const ticket = reviewTickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Unknown review ticket: ${ticketId}`);
    }
    return ticket;
  }

  /**
   * @param {string} skillId
   */
  function requireSkill(skillId) {
    const skill = skills.get(skillId);
    if (!skill) {
      throw new Error(`Unknown skill: ${skillId}`);
    }
    return skill;
  }

  /**
   * @param {string} packageId
   */
  function requirePackageReport(packageId) {
    const report = packageReports.get(packageId);
    if (!report) {
      throw new Error(`Unknown package report: ${packageId}`);
    }
    return report;
  }

  /**
   * @param {string} reviewerId
   * @param {Date | undefined} now
   */
  function syncReviewerQueue(reviewerId, now) {
    const todoCount = [...reviewTickets.values()].filter(
      (ticket) => ticket.reviewerId === reviewerId && ticket.status === 'todo',
    ).length;
    return notifications.setReviewTodoCount({ userId: reviewerId, reviewTodoCount: todoCount, now });
  }

  /**
   * @param {ReturnType<typeof createAuditLogEntry>} entry
   */
  function appendAudit(entry) {
    auditLogs.push(entry);
    return entry;
  }

  /**
   * @param {ReturnType<typeof buildSkillSearchDocument>} document
   */
  function upsertSearchDocument(document) {
    const index = searchDocuments.findIndex((entry) => entry.skillId === document.skillId);
    if (index === -1) {
      searchDocuments.push(document);
      return document;
    }
    searchDocuments.splice(index, 1, document);
    return document;
  }

  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   packageId: string;
     *   files: { path: string; size?: number; sha256?: string | null }[];
     *   manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] };
     *   now?: Date;
     * }} input
     */
    uploadPackage(input) {
      const report = createPackageValidationReport({
        packageId: input.packageId,
        files: input.files,
        manifest: input.manifest,
      });
      packageReports.set(input.packageId, report);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: input.actor,
          targetType: 'package',
          targetId: input.packageId,
          action: 'package.uploaded',
          details: { valid: report.valid, findings: report.findings.length },
          occurredAt: input.now,
        }),
      );
      return report;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   skillId: string;
     *   packageId: string;
     *   reviewerId: string;
     *   visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable';
     *   allowedDepartmentIds?: string[];
     *   now?: Date;
     * }} input
     */
    submitSkillForReview(input) {
      const report = requirePackageReport(input.packageId);
      const existingSkill = skills.get(input.skillId) ??
        createSkillDraft({
          skillId: input.skillId,
          ownerUserId: input.actor.userId,
          title: report.manifest.title,
          summary: report.manifest.summary,
          visibility: input.visibility,
          allowedDepartmentIds: input.allowedDepartmentIds,
        });
      const submittedSkill = submitSkillVersion({
        skill: existingSkill,
        packageReport: report,
        submittedAt: input.now,
      });
      skills.set(input.skillId, submittedSkill);

      const ticket = createReviewTicket({
        ticketId: `review-${input.skillId}-${submittedSkill.versions.length}`,
        skillId: input.skillId,
        packageId: input.packageId,
        requestedBy: input.actor.userId,
        reviewerId: input.reviewerId,
        createdAt: input.now,
      });
      reviewTickets.set(ticket.ticketId, ticket);
      syncReviewerQueue(input.reviewerId, input.now);
      notifications.notify({
        userId: input.reviewerId,
        category: 'review',
        title: 'New review ticket assigned',
        body: `${submittedSkill.title} is ready for review.`,
        now: input.now,
        metadata: { ticketId: ticket.ticketId, skillId: input.skillId },
      });
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: input.actor,
          targetType: 'skill',
          targetId: input.skillId,
          action: 'skill.version.submitted',
          details: { ticketId: ticket.ticketId, packageId: input.packageId },
          occurredAt: input.now,
        }),
      );

      return Object.freeze({ skill: submittedSkill, ticket });
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   now?: Date;
     * }} input
     */
    claimReview(input) {
      const ticket = requireTicket(input.ticketId);
      const claimedTicket = claimReviewTicket({
        ticket,
        reviewerId: input.actor.userId,
        claimedAt: input.now,
      });
      reviewTickets.set(input.ticketId, claimedTicket);
      syncReviewerQueue(input.actor.userId, input.now);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: input.actor,
          targetType: 'review_ticket',
          targetId: input.ticketId,
          action: 'review.ticket.claimed',
          details: { skillId: ticket.skillId },
          occurredAt: input.now,
        }),
      );
      return claimedTicket;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   comment: string;
     *   now?: Date;
     * }} input
     */
    approveReview(input) {
      const ticket = requireTicket(input.ticketId);
      const approvedTicket = approveReviewTicket({
        ticket,
        reviewerId: input.actor.userId,
        comment: input.comment,
        approvedAt: input.now,
      });
      reviewTickets.set(input.ticketId, approvedTicket);

      const skill = requireSkill(ticket.skillId);
      const publishedSkill = publishApprovedSkill({ skill, approvedAt: input.now });
      skills.set(ticket.skillId, publishedSkill);
      upsertSearchDocument(
        buildSkillSearchDocument({
          skillId: publishedSkill.skillId,
          title: publishedSkill.title,
          summary: publishedSkill.summary,
          ownerUserId: publishedSkill.ownerUserId,
          publishedVersion: publishedSkill.publishedVersion,
          visibility: publishedSkill.visibility,
          allowedDepartmentIds: publishedSkill.allowedDepartmentIds,
          tags: [],
        }),
      );

      syncReviewerQueue(input.actor.userId, input.now);
      notifications.notify({
        userId: publishedSkill.ownerUserId,
        category: 'review',
        title: 'Skill published',
        body: `${publishedSkill.title} passed review and is now searchable.`,
        now: input.now,
        metadata: { ticketId: input.ticketId, version: publishedSkill.publishedVersion },
      });
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: input.actor,
          targetType: 'review_ticket',
          targetId: input.ticketId,
          action: 'review.ticket.approved',
          details: { skillId: publishedSkill.skillId, version: publishedSkill.publishedVersion },
          occurredAt: input.now,
        }),
      );

      return Object.freeze({ ticket: approvedTicket, skill: publishedSkill });
    },

    /**
     * @param {{ viewer: { userId: string; departmentIds?: string[] }; query: string }} input
     */
    search(input) {
      return searchSkillDocuments({
        documents: searchDocuments,
        viewer: input.viewer,
        query: input.query,
      });
    },

    /**
     * @param {string} ownerUserId
     */
    listOwnedSkills(ownerUserId) {
      return Object.freeze([...skills.values()].filter((skill) => skill.ownerUserId === ownerUserId));
    },

    /**
     * @param {{ actor: { roleCode: string; departmentId?: string | null } }} input
     */
    listManageableSkills(input) {
      const isGlobalAdmin = input.actor.roleCode.startsWith('system_admin');
      return Object.freeze(
        [...skills.values()].filter((skill) => {
          if (isGlobalAdmin) {
            return true;
          }
          if (input.actor.departmentId === null || input.actor.departmentId === undefined) {
            return false;
          }
          return skill.allowedDepartmentIds.includes(input.actor.departmentId);
        }),
      );
    },

    /**
     * @param {{ reviewerId?: string; status?: string }} input
     */
    listReviewTickets(input = {}) {
      return Object.freeze(
        [...reviewTickets.values()].filter((ticket) => {
          if (input.reviewerId && ticket.reviewerId !== input.reviewerId) {
            return false;
          }
          if (input.status && ticket.status !== input.status) {
            return false;
          }
          return true;
        }),
      );
    },

    /**
     * @param {string} skillId
     */
    getSkill(skillId) {
      return requireSkill(skillId);
    },

    /**
     * @param {{ userId: string; notificationId: string; now?: Date }} input
     */
    markNotificationRead(input) {
      return notifications.markRead(input);
    },

    /**
     * @param {{ userId: string; now?: Date }} input
     */
    readAllNotifications(input) {
      return notifications.readAll(input);
    },

    /**
     * @param {string} userId
     */
    getBadges(userId) {
      return notifications.getBadges({ userId });
    },

    /**
     * @param {string} userId
     */
    listNotifications(userId) {
      return notifications.listNotifications({ userId });
    },

    /**
     * @param {string} userId
     */
    drainEvents(userId) {
      return notifications.drainEvents({ userId, includeReconnect: true });
    },

    getAuditTrail() {
      return Object.freeze([...auditLogs]);
    },
  });
}
