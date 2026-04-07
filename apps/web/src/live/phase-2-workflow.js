import { createLivePublishReviewSlice } from '../../../api/src/workflows/live-publish-review-slice.js';

/**
 * @param {{ roleCode: string }} actor
 */
function canReview(actor) {
  return actor.roleCode.startsWith('review_admin') || actor.roleCode.startsWith('system_admin');
}

/**
 * @param {{ roleCode: string }} actor
 */
function canManageSkills(actor) {
  return actor.roleCode.includes('admin');
}

/**
 * @param {readonly unknown[]} entries
 */
function toState(entries) {
  return entries.length === 0 ? 'empty' : 'ready';
}

/**
 * @param {{
 *   liveSlice?: ReturnType<typeof import('../../../api/src/workflows/live-publish-review-slice.js').createLivePublishReviewSlice>;
 * }} [input]
 */
export function createPhase2LiveWebWorkflow(input = {}) {
  const liveSlice = input.liveSlice ?? createLivePublishReviewSlice();

  return Object.freeze({
    /**
     * @param {{
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   packageId: string;
     *   skillId: string;
     *   reviewerId: string;
     *   visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable';
     *   allowedDepartmentIds?: string[];
     *   manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] };
     *   files: { path: string; size?: number; sha256?: string | null }[];
     *   now?: Date;
     * }} input
     */
    publishFromMySkill(input) {
      const report = liveSlice.packageController.upload({
        requestId: `${input.packageId}:upload`,
        actor: input.actor,
        packageId: input.packageId,
        files: input.files,
        manifest: input.manifest,
        now: input.now,
      });
      const submission = liveSlice.reviewController.submit({
        requestId: `${input.packageId}:submit`,
        actor: input.actor,
        skillId: input.skillId,
        packageId: input.packageId,
        reviewerId: input.reviewerId,
        visibility: input.visibility,
        allowedDepartmentIds: input.allowedDepartmentIds,
        now: input.now,
      });
      return Object.freeze({ report, submission });
    },

    /**
     * @param {{ actor: { userId: string } }} input
     */
    openMySkillPage(input) {
      const skills = liveSlice.mySkillController.listOwned({ ownerUserId: input.actor.userId });
      return Object.freeze({
        pageId: 'my-skill',
        state: toState(skills),
        skills,
      });
    },

    /**
     * @param {{ actor: { userId: string; roleCode: string } }} input
     */
    openReviewPage(input) {
      if (!canReview(input.actor)) {
        return Object.freeze({
          pageId: 'review',
          state: 'permission-denied',
          queue: Object.freeze({ todo: Object.freeze([]), inProgress: Object.freeze([]), done: Object.freeze([]) }),
        });
      }
      const queue = liveSlice.reviewController.listQueue(input);
      return Object.freeze({
        pageId: 'review',
        state: queue.todo.length + queue.inProgress.length + queue.done.length === 0 ? 'empty' : 'ready',
        queue,
      });
    },

    /**
     * @param {{
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   now?: Date;
     * }} input
     */
    claimReview(input) {
      return liveSlice.reviewController.claim({
        requestId: `${input.ticketId}:claim`,
        actor: input.actor,
        ticketId: input.ticketId,
        now: input.now,
      });
    },

    /**
     * @param {{
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   comment: string;
     *   now?: Date;
     * }} input
     */
    approveReview(input) {
      return liveSlice.reviewController.approve({
        requestId: `${input.ticketId}:approve`,
        actor: input.actor,
        ticketId: input.ticketId,
        comment: input.comment,
        now: input.now,
      });
    },

    /**
     * @param {{ viewer: { userId: string; departmentIds?: string[] }; query: string }} input
     */
    openMarketPage(input) {
      const results = liveSlice.marketController.search(input);
      return Object.freeze({
        pageId: 'market',
        state: toState(results),
        results,
      });
    },

    /**
     * @param {{ userId: string }} input
     */
    openNotificationsPage(input) {
      const items = liveSlice.notificationsController.list(input);
      const badges = liveSlice.notificationsController.badges(input);
      const events = liveSlice.notificationsController.stream(input);
      return Object.freeze({
        pageId: 'notifications',
        state: toState(items),
        items,
        badges,
        reconnectBanner: events.some(/** @param {{ event: string }} entry */ (entry) => entry.event === 'sse.reconnect-required'),
      });
    },

    /**
     * @param {{ userId: string; notificationId: string; now?: Date }} input
     */
    markNotificationRead(input) {
      return liveSlice.notificationsController.markRead(input);
    },

    /**
     * @param {{ userId: string; now?: Date }} input
     */
    readAllNotifications(input) {
      return liveSlice.notificationsController.readAll(input);
    },

    /**
     * @param {{ actor: { roleCode: string; departmentId?: string | null } }} input
     */
    openSkillManagementPage(input) {
      if (!canManageSkills(input.actor)) {
        return Object.freeze({
          pageId: 'skill-management',
          state: 'permission-denied',
          skills: Object.freeze([]),
        });
      }
      const skills = liveSlice.skillManagementController.listManageable(input);
      return Object.freeze({
        pageId: 'skill-management',
        state: toState(skills),
        skills: skills.map(
          /** @param {ReturnType<ReturnType<typeof import('../../../api/src/workflows/live-publish-review-slice.js').createLivePublishReviewSlice>['skillManagementController']['listManageable']>[number]} skill */
          (skill) =>
          Object.freeze({
            ...skill,
            history: liveSlice.skillManagementController.getHistory({ actor: input.actor, skillId: skill.skillId }),
          }),
        ),
      });
    },
  });
}
