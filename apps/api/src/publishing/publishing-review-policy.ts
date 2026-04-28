import {
  PublisherStatusAction,
  ReviewAction,
  ReviewStatus,
  SkillStatus,
  WorkflowState,
} from '../common/p1-contracts';

interface ReviewPolicyRecord {
  review_status: ReviewStatus;
  workflow_state: WorkflowState;
  claimed_from_workflow_state: Extract<WorkflowState, 'manual_precheck' | 'pending_review'> | null;
  lock_owner_id: string | null;
  lock_expires_at: Date | null;
}

export function effectiveReviewStatus(review: ReviewPolicyRecord): ReviewStatus {
  if (review.review_status === 'in_review' && !isLockActive(review.lock_expires_at)) {
    return 'pending';
  }
  return review.review_status;
}

export function buildAvailableActions(review: ReviewPolicyRecord, actorUserID: string): ReviewAction[] {
  const actions: ReviewAction[] = [];
  const claimedByActor = review.lock_owner_id === actorUserID && isLockActive(review.lock_expires_at);
  const status = effectiveReviewStatus(review);
  if (status === 'pending' && (review.workflow_state === 'manual_precheck' || review.workflow_state === 'pending_review')) {
    actions.push('claim');
  }
  if (claimedByActor && review.workflow_state === 'in_review') {
    if (review.claimed_from_workflow_state === 'manual_precheck') {
      actions.push('pass_precheck', 'return_for_changes', 'reject');
    }
    if (review.claimed_from_workflow_state === 'pending_review') {
      actions.push('approve', 'return_for_changes', 'reject');
    }
  }
  return actions;
}

export function publisherStatusActions(status: SkillStatus | null | undefined): PublisherStatusAction[] {
  switch (status) {
    case 'published':
      return ['delist', 'archive'];
    case 'delisted':
      return ['relist', 'archive'];
    default:
      return [];
  }
}

export function isLockActive(lockExpiresAt: Date | null): boolean {
  return !!lockExpiresAt && lockExpiresAt.getTime() > Date.now();
}
