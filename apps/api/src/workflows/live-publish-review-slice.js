import { createPublishReviewRuntime } from './publish-review-runtime.js';

/**
 * @param {string} roleCode
 */
function isReviewAdmin(roleCode) {
  return roleCode.startsWith('review_admin') || roleCode.startsWith('system_admin');
}

/**
 * @param {{ roleCode: string }} actor
 */
function assertReviewAdmin(actor) {
  if (!isReviewAdmin(actor.roleCode)) {
    throw new Error('Review queue requires admin privileges.');
  }
}

/**
 * @param {{ roleCode: string }} actor
 */
function assertSkillManager(actor) {
  if (!actor.roleCode.includes('admin')) {
    throw new Error('Skill management requires admin privileges.');
  }
}

export function createLivePublishReviewSlice() {
  const runtime = createPublishReviewRuntime();

  return Object.freeze({
    packageController: Object.freeze({
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
      upload(input) {
        return runtime.uploadPackage(input);
      },
    }),

    reviewController: Object.freeze({
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
      submit(input) {
        return runtime.submitSkillForReview(input);
      },

      /**
       * @param {{ actor: { roleCode: string; userId: string } }} input
       */
      listQueue(input) {
        assertReviewAdmin(input.actor);
        return Object.freeze({
          todo: runtime.listReviewTickets({ reviewerId: input.actor.userId, status: 'todo' }),
          inProgress: runtime.listReviewTickets({ reviewerId: input.actor.userId, status: 'in_progress' }),
          done: runtime.listReviewTickets({ reviewerId: input.actor.userId }).filter((/** @param {any} ticket */ ticket) =>
            !['todo', 'in_progress'].includes(ticket.status),
          ),
        });
      },

      /**
       * @param {{
       *   requestId: string;
       *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
       *   ticketId: string;
       *   now?: Date;
       * }} input
       */
      claim(input) {
        assertReviewAdmin(input.actor);
        return runtime.claimReview(input);
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
      approve(input) {
        assertReviewAdmin(input.actor);
        return runtime.approveReview(input);
      },
    }),

    mySkillController: Object.freeze({
      /**
       * @param {{ ownerUserId: string }} input
       */
      listOwned(input) {
        return runtime.listOwnedSkills(input.ownerUserId);
      },
    }),

    marketController: Object.freeze({
      /**
       * @param {{ viewer: { userId: string; departmentIds?: string[] }; query: string }} input
       */
      search(input) {
        return runtime.search(input);
      },
    }),

    notificationsController: Object.freeze({
      /**
       * @param {{ userId: string }} input
       */
      list(input) {
        return runtime.listNotifications(input.userId);
      },

      /**
       * @param {{ userId: string }} input
       */
      badges(input) {
        return runtime.getBadges(input.userId);
      },

      /**
       * @param {{ userId: string }} input
       */
      stream(input) {
        return runtime.drainEvents(input.userId);
      },

      /**
       * @param {{ userId: string; notificationId: string; now?: Date }} input
       */
      markRead(input) {
        return runtime.markNotificationRead(input);
      },

      /**
       * @param {{ userId: string; now?: Date }} input
       */
      readAll(input) {
        return runtime.readAllNotifications(input);
      },
    }),

    skillManagementController: Object.freeze({
      /**
       * @param {{ actor: { roleCode: string; departmentId?: string | null } }} input
       */
      listManageable(input) {
        assertSkillManager(input.actor);
        return runtime.listManageableSkills(input);
      },

      /**
       * @param {{ actor: { roleCode: string }; skillId: string }} input
       */
      getHistory(input) {
        assertSkillManager(input.actor);
        return runtime.getSkill(input.skillId).versions;
      },
    }),
  });
}
