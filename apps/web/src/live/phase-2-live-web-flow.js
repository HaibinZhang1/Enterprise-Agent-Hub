import { createPublishReviewRuntime } from '../../../api/src/workflows/publish-review-runtime.js';

import { buildReconnectBanner, permissionDenied, resolveCollectionState } from './page-state.js';

/**
 * @typedef {{ userId: string; username: string; roleCode: string; departmentId?: string | null }} Actor
 * @typedef {{ userId: string; departmentIds?: string[] }} Viewer
 * @typedef {{ ticketId?: string; id?: string; reviewerId: string; status: string }} ReviewTicket
 * @typedef {{ skillId: string; ownerUserId: string }} SkillRecord
 */

/**
 * @param {Record<string, unknown>} [payload]
 */
function ready(payload = {}) {
  return Object.freeze({
    state: 'ready',
    ...payload,
  });
}

/**
 * @param {Map<string, ReviewTicket & Record<string, unknown>>} store
 * @param {ReviewTicket & Record<string, unknown>} ticket
 */
function trackTicket(store, ticket) {
  const ticketId = ticket.ticketId ?? ticket.id;
  if (!ticketId) {
    throw new Error('Review ticket is missing a stable id.');
  }
  store.set(ticketId, ticket);
  return ticket;
}

/**
 * @param {Map<string, SkillRecord & Record<string, unknown>>} store
 * @param {SkillRecord & Record<string, unknown>} skill
 */
function trackSkill(store, skill) {
  store.set(skill.skillId, skill);
  return skill;
}

export function createPhase2LiveWebFlow() {
  const runtime = createPublishReviewRuntime();
  /** @type {Map<string, ReviewTicket & Record<string, unknown>>} */
  const tickets = new Map();
  /** @type {Map<string, SkillRecord & Record<string, unknown>>} */
  const skills = new Map();

  /**
   * @param {Actor} actor
   * @param {'todo' | 'in-progress' | 'done'} status
   */
  function listTicketsFor(actor, status) {
    return Object.freeze(
      [...tickets.values()].filter((ticket) => {
        if (ticket.reviewerId !== actor.userId) {
          return false;
        }
        if (status === 'todo') {
          return ticket.status === 'todo';
        }
        if (status === 'in-progress') {
          return ticket.status === 'in_progress';
        }
        if (status === 'done') {
          return !['todo', 'in_progress'].includes(ticket.status);
        }
        return true;
      }),
    );
  }

  /**
   * @param {Actor} actor
   */
  function listOwnedSkills(actor) {
    return Object.freeze([...skills.values()].filter((skill) => skill.ownerUserId === actor.userId));
  }

  return Object.freeze({
    mySkillPage: Object.freeze({
      /**
       * @param {{ actor: Actor | null }} input
       */
      load(input) {
        if (!input.actor) {
          return permissionDenied();
        }
        const ownedSkills = listOwnedSkills(input.actor);
        return resolveCollectionState(ownedSkills, { skills: ownedSkills });
      },

      /**
       * @param {{ requestId: string; actor: Actor; packageId: string; reviewerId: string; files: { path: string; size?: number; sha256?: string | null }[]; manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] }; visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable'; allowedDepartmentIds?: string[]; now?: Date }} input
       */
      uploadAndSubmit(input) {
        const report = runtime.uploadPackage({
          requestId: input.requestId,
          actor: input.actor,
          packageId: input.packageId,
          files: input.files,
          manifest: input.manifest,
          now: input.now,
        });
        const submission = runtime.submitSkillForReview({
          requestId: `${input.requestId}-submit`,
          actor: input.actor,
          skillId: input.manifest.skillId,
          packageId: input.packageId,
          reviewerId: input.reviewerId,
          visibility: input.visibility,
          allowedDepartmentIds: input.allowedDepartmentIds,
          now: input.now,
        });
        trackSkill(skills, submission.skill);
        trackTicket(tickets, submission.ticket);
        return ready({ report, skill: submission.skill, ticket: submission.ticket });
      },
    }),

    reviewPage: Object.freeze({
      /**
       * @param {{ actor: Actor | null; status: 'todo' | 'in-progress' | 'done' }} input
       */
      load(input) {
        if (!input.actor) {
          return permissionDenied();
        }
        const reviewTickets = listTicketsFor(input.actor, input.status);
        return resolveCollectionState(reviewTickets, { tickets: reviewTickets });
      },

      /**
       * @param {{ requestId: string; actor: Actor; ticketId: string; now?: Date }} input
       */
      claimTicket(input) {
        const claim = runtime.claimReview(input);
        const ticket = 'ticket' in claim ? claim.ticket : claim;
        trackTicket(tickets, ticket);
        return ready({ ticket });
      },

      /**
       * @param {{ requestId: string; actor: Actor; ticketId: string; comment: string; now?: Date }} input
       */
      approveTicket(input) {
        const approval = runtime.approveReview(input);
        trackTicket(tickets, approval.ticket);
        trackSkill(skills, approval.skill);
        return ready(approval);
      },
    }),

    marketPage: Object.freeze({
      /**
       * @param {{ viewer: Viewer | null; query: string }} input
       */
      search(input) {
        if (!input.viewer) {
          return permissionDenied();
        }
        const results = runtime.search({ viewer: input.viewer, query: input.query });
        return resolveCollectionState(results, { results });
      },
    }),

    notificationsPage: Object.freeze({
      /**
       * @param {{ userId: string }} input
       */
      load(input) {
        const notifications = runtime.listNotifications(input.userId);
        const badges = runtime.getBadges(input.userId);
        const events = runtime.drainEvents(input.userId);
        return resolveCollectionState(notifications, {
          notifications,
          badges,
          events,
          reconnectBanner: buildReconnectBanner(events),
        });
      },
    }),

    skillManagementPage: Object.freeze({
      /**
       * @param {{ actor: Actor | null }} input
       */
      load(input) {
        if (!input.actor) {
          return permissionDenied();
        }
        const ownedSkills = listOwnedSkills(input.actor);
        return resolveCollectionState(ownedSkills, { skills: ownedSkills });
      },
    }),
  });
}
