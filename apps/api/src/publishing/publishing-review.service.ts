import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { REVIEW_LOCK_MS } from './publishing.service.constants';
import { logInfo } from '../common/structured-log';
import { DatabaseService } from '../database/database.service';
import { PublishingNotificationService } from './publishing-notification.service';
import { PublishingRepository } from './publishing.repository';
import { ReviewerRoutingService } from './reviewer-routing.service';
import { PublishingPublicationService } from './publishing-publication.service';
import { hasBlockingPrecheckFailures } from './publishing.utils';
import type { ReviewRecord } from './publishing.types';

@Injectable()
export class PublishingReviewService {
  constructor(
    private readonly database: DatabaseService,
    private readonly publishingRepository: PublishingRepository,
    private readonly reviewerRouting: ReviewerRoutingService,
    private readonly publication: PublishingPublicationService,
    private readonly notifications: PublishingNotificationService,
  ) {}

  async claimReview(userID: string, reviewID: string): Promise<string> {
    await this.publishingRepository.releaseExpiredReviewLocks(reviewID);
    const actor = await this.publishingRepository.loadActor(userID);
    const review = await this.publishingRepository.loadReview(reviewID);
    if (!(await this.reviewerRouting.canActorReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }

    await this.database.transaction(async (client) => {
      const claimResult = await client.query(
        `
        UPDATE review_items
          SET lock_owner_id = $2,
              lock_expires_at = $3,
              claimed_from_workflow_state = workflow_state,
              workflow_state = 'in_review',
              review_status = 'in_review',
              updated_at = now()
        WHERE id = $1
          AND workflow_state IN ('manual_precheck', 'pending_review')
          AND (
            lock_owner_id IS NULL
            OR lock_expires_at IS NULL
            OR lock_expires_at <= now()
            OR lock_owner_id = $2
          )
        `,
        [reviewID, actor.userID, new Date(Date.now() + REVIEW_LOCK_MS).toISOString()],
      );
      if (claimResult.rowCount !== 1) {
        throw new ForbiddenException('permission_denied');
      }
      await this.publishingRepository.insertHistory(client, reviewID, actor.userID, 'claimed', '审核员已领取当前单据。');
      await this.notifications.notifyAuthorWorkflow(client, review, {
        title: `${review.skill_display_name} 已被领取审核`,
        summary: `${actor.displayName} 已领取当前审核单。`,
      });
    });

    return actor.userID;
  }

  async passPrecheck(userID: string, reviewID: string, comment: string): Promise<string> {
    const actor = await this.publishingRepository.loadActor(userID);
    const review = await this.publishingRepository.loadReview(reviewID);
    this.reviewerRouting.assertClaimedReview(actor, review, 'manual_precheck');

    if (!(await this.reviewerRouting.canActorReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }
    const overrideHistory = this.precheckOverrideHistory(review, comment);

    const autoApprove = await this.reviewerRouting.shouldAutoApprove(review);
    if (autoApprove) {
      await this.publication.publishSubmission(
        review,
        actor,
        comment || '系统初审复核通过并自动发布。',
        overrideHistory ? { preHistory: overrideHistory } : {},
      );
    } else {
      const reviewerIDs = await this.reviewerRouting.eligibleReviewerIDsFor({ ...review, workflow_state: 'pending_review' });
      await this.database.transaction(async (client) => {
        if (overrideHistory) {
          await this.publishingRepository.insertHistory(client, reviewID, actor.userID, overrideHistory.action, overrideHistory.comment);
        }
        await client.query(
          `
          UPDATE review_items
          SET workflow_state = 'pending_review',
              review_status = 'pending',
              lock_owner_id = NULL,
              lock_expires_at = NULL,
              claimed_from_workflow_state = NULL,
              review_summary = COALESCE(NULLIF($2, ''), review_summary),
              updated_at = now()
          WHERE id = $1
          `,
          [reviewID, comment],
        );
        await this.publishingRepository.insertHistory(client, reviewID, actor.userID, 'pass_precheck', comment || '人工复核通过，进入管理员审核。');
        await this.notifications.notifyAuthorWorkflow(client, review, {
          title: `${review.skill_display_name} 进入管理员审核`,
          summary: '人工复核通过，已进入管理员审核队列。',
        });
        await this.notifications.notifyReviewTask(client, review, reviewerIDs, '人工复核通过，等待管理员审核。');
      });
    }

    return actor.userID;
  }

  async approveReview(userID: string, reviewID: string, comment: string): Promise<string> {
    const startedAt = Date.now();
    const actor = await this.publishingRepository.loadActor(userID);
    const review = await this.publishingRepository.loadReview(reviewID);
    this.reviewerRouting.assertClaimedReview(actor, review, 'pending_review');
    if (!(await this.reviewerRouting.canActorReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }

    const overrideHistory = this.precheckOverrideHistory(review, comment);
    await this.publication.publishSubmission(
      review,
      actor,
      comment || '审核通过，已发布。',
      overrideHistory ? { preHistory: overrideHistory } : {},
    );
    logInfo({
      event: 'review.approved',
      domain: 'review-governance',
      action: 'approve_review',
      actorID: actor.userID,
      entityID: reviewID,
      result: 'ok',
      durationMs: Date.now() - startedAt,
    });
    return actor.userID;
  }

  async returnReview(userID: string, reviewID: string, comment: string): Promise<string> {
    const startedAt = Date.now();
    const actor = await this.publishingRepository.loadActor(userID);
    const review = await this.publishingRepository.loadReview(reviewID);
    this.reviewerRouting.assertClaimedReview(actor, review);
    if (!(await this.reviewerRouting.canActorReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }
    await this.publication.finalizeReview(reviewID, actor.userID, 'returned_for_changes', 'return_for_changes', comment || '请补充修改后重新提交。');
    logInfo({
      event: 'review.returned',
      domain: 'review-governance',
      action: 'return_review',
      actorID: actor.userID,
      entityID: reviewID,
      result: 'ok',
      durationMs: Date.now() - startedAt,
    });
    return actor.userID;
  }

  async rejectReview(userID: string, reviewID: string, comment: string): Promise<string> {
    const startedAt = Date.now();
    const actor = await this.publishingRepository.loadActor(userID);
    const review = await this.publishingRepository.loadReview(reviewID);
    this.reviewerRouting.assertClaimedReview(actor, review);
    if (!(await this.reviewerRouting.canActorReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }
    await this.publication.finalizeReview(reviewID, actor.userID, 'review_rejected', 'reject', comment || '审核拒绝。');
    logInfo({
      event: 'review.rejected',
      domain: 'review-governance',
      action: 'reject_review',
      actorID: actor.userID,
      entityID: reviewID,
      result: 'ok',
      durationMs: Date.now() - startedAt,
    });
    return actor.userID;
  }

  private precheckOverrideHistory(review: Pick<ReviewRecord, 'precheck_results'>, comment: string): { action: string; comment: string } | null {
    if (!hasBlockingPrecheckFailures(review.precheck_results)) {
      return null;
    }
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      throw new BadRequestException('precheck_override_comment_required');
    }
    return { action: 'override_precheck', comment: trimmedComment };
  }
}
