import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { NotificationType } from '../common/p1-contracts';
import type { ReviewRecord } from './publishing.types';

type PublishingNotificationObjectType = 'review' | 'publisher_submission';
type NotificationReview = Pick<ReviewRecord, 'review_id' | 'skill_display_name' | 'submitter_id'>;

interface PublishingNotificationInput {
  userID: string;
  type: NotificationType;
  title: string;
  summary: string;
  objectType: PublishingNotificationObjectType;
  objectID: string;
  action: string;
}

@Injectable()
export class PublishingNotificationService {
  async notifySubmissionCreated(client: PoolClient, review: NotificationReview): Promise<void> {
    await this.insert(client, {
      userID: review.submitter_id,
      type: 'skill_review_progress',
      title: `${review.skill_display_name} 已提交审核`,
      summary: `${review.review_id} 已进入系统初审。`,
      objectType: 'publisher_submission',
      objectID: review.review_id,
      action: publisherSubmissionAction(review.review_id),
    });
  }

  async notifyAuthorWorkflow(client: PoolClient, review: NotificationReview, input: {
    title: string;
    summary: string;
  }): Promise<void> {
    await this.insert(client, {
      userID: review.submitter_id,
      type: 'skill_review_progress',
      title: input.title,
      summary: `${review.review_id} · ${input.summary}`,
      objectType: 'publisher_submission',
      objectID: review.review_id,
      action: publisherSubmissionAction(review.review_id),
    });
  }

  async notifyReviewTask(client: PoolClient, review: NotificationReview, reviewerIDs: string[], summary: string): Promise<void> {
    for (const reviewerID of uniqueUserIDs(reviewerIDs, review.submitter_id)) {
      await this.insert(client, {
        userID: reviewerID,
        type: 'skill_review_task',
        title: `你有新的待审核任务：${review.skill_display_name}`,
        summary: `${review.review_id} · ${summary}`,
        objectType: 'review',
        objectID: review.review_id,
        action: reviewAction(review.review_id),
      });
    }
  }

  private async insert(client: PoolClient, input: PublishingNotificationInput): Promise<void> {
    await client.query(
      `
      INSERT INTO notifications (id, user_id, type, title, summary, object_type, object_id, action, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      `,
      [
        `ntf_${randomBytes(8).toString('hex')}`,
        input.userID,
        input.type,
        input.title,
        input.summary,
        input.objectType,
        input.objectID,
        input.action,
      ],
    );
  }
}

function uniqueUserIDs(userIDs: string[], excludeUserID: string): string[] {
  return [...new Set(userIDs)].filter((userID) => userID && userID !== excludeUserID);
}

function publisherSubmissionAction(submissionID: string): string {
  return `/publisher/submissions/${encodeURIComponent(submissionID)}`;
}

function reviewAction(reviewID: string): string {
  return `/admin/reviews/${encodeURIComponent(reviewID)}`;
}
