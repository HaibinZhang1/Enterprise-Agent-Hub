import { createMemoryAuditLogRepository } from '../modules/audit/repositories/memory-audit-log-repository.js';
import { createAuditService } from '../modules/audit/services/audit-service.js';
import { createNotificationCenterRepository } from '../modules/notify/repositories/notification-center-repository.js';
import { createNotifyService } from '../modules/notify/services/notify-service.js';
import { createMemoryPackageReportRepository } from '../modules/package/repositories/memory-package-report-repository.js';
import { createPackageService } from '../modules/package/services/package-service.js';
import { createMemoryReviewTicketRepository } from '../modules/review/repositories/memory-review-ticket-repository.js';
import { createReviewService } from '../modules/review/services/review-service.js';
import { createMemorySearchDocumentRepository } from '../modules/search/repositories/memory-search-document-repository.js';
import { createSearchService } from '../modules/search/services/search-service.js';
import { createMemorySkillCatalogRepository } from '../modules/skill/repositories/memory-skill-catalog-repository.js';
import { createSkillCatalogService } from '../modules/skill/services/skill-catalog-service.js';

export function createPublishReviewRuntime() {
  const auditRepository = createMemoryAuditLogRepository();
  const notificationRepository = createNotificationCenterRepository();
  const packageReportRepository = createMemoryPackageReportRepository();
  const reviewTicketRepository = createMemoryReviewTicketRepository();
  const skillCatalogRepository = createMemorySkillCatalogRepository();
  const searchDocumentRepository = createMemorySearchDocumentRepository();

  const auditService = createAuditService({ auditRepository });
  const notifyService = createNotifyService({ notificationRepository });
  const packageService = createPackageService({ packageReportRepository, auditService });
  const reviewService = createReviewService({ reviewTicketRepository, notifyService, auditService });
  const skillCatalogService = createSkillCatalogService({ skillCatalogRepository, auditService });
  const searchService = createSearchService({ searchDocumentRepository });

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
      return packageService.upload(input);
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
      const report = packageService.getReport(input.packageId);
      const submittedSkill = skillCatalogService.submitVersion({
        requestId: input.requestId,
        actor: input.actor,
        skillId: input.skillId,
        packageReport: report,
        visibility: input.visibility,
        allowedDepartmentIds: input.allowedDepartmentIds,
        now: input.now,
      });
      const ticket = reviewService.createTicket({
        requestId: input.requestId,
        actor: input.actor,
        ticketId: `review-${input.skillId}-${submittedSkill.versions.length}`,
        skillId: input.skillId,
        skillTitle: submittedSkill.title,
        packageId: input.packageId,
        reviewerId: input.reviewerId,
        now: input.now,
      });

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
      return reviewService.claimTicket(input);
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
      const approvedTicket = reviewService.approveTicket(input);
      const publishedSkill = skillCatalogService.publishApproved({
        requestId: input.requestId,
        actor: input.actor,
        skillId: approvedTicket.skillId,
        now: input.now,
      });
      searchService.upsertSkill({
        skillId: publishedSkill.skillId,
        title: publishedSkill.title,
        summary: publishedSkill.summary,
        ownerUserId: publishedSkill.ownerUserId,
        publishedVersion: publishedSkill.publishedVersion,
        visibility: publishedSkill.visibility,
        allowedDepartmentIds: publishedSkill.allowedDepartmentIds,
        tags: [],
      });
      notifyService.notify({
        userId: publishedSkill.ownerUserId,
        category: 'review',
        title: 'Skill published',
        body: `${publishedSkill.title} passed review and is now searchable.`,
        now: input.now,
        metadata: { ticketId: input.ticketId, version: publishedSkill.publishedVersion },
      });

      return Object.freeze({ ticket: approvedTicket, skill: publishedSkill });
    },

    /**
     * @param {{ viewer: { userId: string; departmentIds?: string[] }; query: string }} input
     */
    search(input) {
      return searchService.search(input);
    },

    /**
     * @param {string} ownerUserId
     */
    listOwnedSkills(ownerUserId) {
      return skillCatalogService.listOwnedSkills(ownerUserId);
    },

    /**
     * @param {{ actor: { roleCode: string; departmentId?: string | null } }} input
     */
    listManageableSkills(input) {
      return skillCatalogService.listManageableSkills(input);
    },

    /**
     * @param {{ reviewerId?: string; status?: string }} input
     */
    listReviewTickets(input = {}) {
      return reviewService.listTickets(input);
    },

    /**
     * @param {string} skillId
     */
    getSkill(skillId) {
      return skillCatalogService.getSkill(skillId);
    },

    /**
     * @param {{ userId: string; notificationId: string; now?: Date }} input
     */
    markNotificationRead(input) {
      return notificationRepository.markRead(input);
    },

    /**
     * @param {{ userId: string; now?: Date }} input
     */
    readAllNotifications(input) {
      return notificationRepository.readAll(input);
    },

    /**
     * @param {string} userId
     */
    getBadges(userId) {
      return notifyService.getBadges(userId);
    },

    /**
     * @param {string} userId
     */
    listNotifications(userId) {
      return notifyService.listNotifications(userId);
    },

    /**
     * @param {string} userId
     */
    drainEvents(userId) {
      return notifyService.drainEvents(userId);
    },

    getAuditTrail() {
      return auditService.list();
    },
  });
}
