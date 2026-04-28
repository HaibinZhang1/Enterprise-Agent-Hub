import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { WorkflowState } from "../common/p1-contracts";
import { isPermissionExpansion } from "./publishing.utils";
import { effectiveReviewStatus, isLockActive } from "./publishing-review-policy";
import type { ActorContext, DepartmentRow, ReviewRecord } from "./publishing.types";

@Injectable()
export class ReviewerRoutingService {
  constructor(private readonly database: DatabaseService) {}

  assertClaimedReview(actor: ActorContext, review: ReviewRecord, expectedWorkflowState?: WorkflowState): void {
    if (review.lock_owner_id === actor.userID && !isLockActive(review.lock_expires_at)) {
      throw new BadRequestException("review_lock_expired");
    }
    if (review.workflow_state !== "in_review") {
      throw new BadRequestException("validation_failed");
    }
    if (expectedWorkflowState && review.claimed_from_workflow_state !== expectedWorkflowState) {
      throw new BadRequestException("validation_failed");
    }
    if (review.lock_owner_id !== actor.userID) {
      throw new ForbiddenException("permission_denied");
    }
  }

  canSubmitterWithdraw(userID: string, review: ReviewRecord): boolean {
    const status = effectiveReviewStatus(review);
    return (
      review.submitter_id === userID &&
      status !== "in_review" &&
      ["system_prechecking", "manual_precheck", "pending_review"].includes(review.workflow_state)
    );
  }

  async shouldAutoApprove(review: ReviewRecord): Promise<boolean> {
    if (review.submitter_role !== "admin" || review.submitter_admin_level === null) {
      return false;
    }
    return review.submitter_admin_level <= 3;
  }

  async canActorSeeReview(actor: ActorContext, review: ReviewRecord): Promise<boolean> {
    if (review.lock_owner_id === actor.userID && isLockActive(review.lock_expires_at)) {
      return true;
    }
    return this.canActorReview(actor, review);
  }

  async canActorReview(actor: ActorContext, review: ReviewRecord): Promise<boolean> {
    if (actor.role !== "admin" || actor.adminLevel === null || actor.userID === review.submitter_id) {
      return false;
    }
    const candidateIDs = await this.eligibleReviewerIDsFor(review);
    return candidateIDs.includes(actor.userID);
  }

  async eligibleReviewerIDsFor(review: ReviewRecord): Promise<string[]> {
    if (review.workflow_state === "withdrawn") {
      return [];
    }

    const type = review.review_type;
    const currentScopeType = review.current_scope_type ?? "current_department";
    const nextScopeType = review.requested_scope_type ?? currentScopeType;
    const currentVisibility = review.current_visibility_level ?? "private";
    const nextVisibility = review.requested_visibility_level ?? currentVisibility;

    if (review.submitter_role === "normal_user" || review.submitter_admin_level === null) {
      const admins = await this.database.query<{ id: string }>(
        `
        SELECT id
        FROM users
        WHERE role = 'admin'
          AND status = 'active'
          AND department_id = $1
        ORDER BY admin_level ASC, username ASC
        `,
        [review.submitter_department_id]
      );
      return admins.rows.map((row) => row.id);
    }

    const isExpansion =
      type === "permission_change"
        ? isPermissionExpansion({
            currentVisibilityLevel: currentVisibility,
            currentScopeType,
            nextVisibilityLevel: nextVisibility,
            nextScopeType,
            currentSelectedDepartmentIDs: review.current_scope_department_ids ?? [],
            nextSelectedDepartmentIDs: review.requested_department_ids ?? []
          })
        : true;

    if (type === "permission_change" && !isExpansion) {
      return this.peerAdminsOrEscalate(review);
    }
    if (review.submitter_admin_level <= 3) {
      return [];
    }

    const requestedVisibility = review.requested_visibility_level ?? "private";
    if (requestedVisibility === "private" || requestedVisibility === "summary_visible") {
      return this.peerAdminsOrEscalate(review);
    }
    return this.findChainReviewers(review, [3, 2, 1]);
  }

  private async peerAdminsOrEscalate(review: ReviewRecord): Promise<string[]> {
    const peers = await this.database.query<{ id: string }>(
      `
      SELECT u.id
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.role = 'admin'
        AND u.status = 'active'
        AND u.admin_level = $1
        AND u.id <> $2
        AND d.parent_id IS NOT DISTINCT FROM $3
      ORDER BY u.username ASC
      `,
      [review.submitter_admin_level, review.submitter_id, review.submitter_parent_department_id]
    );
    if (peers.rows.length > 0) {
      return peers.rows.map((row) => row.id);
    }
    return this.findChainReviewers(review, [2, 1], review.submitter_admin_level ?? undefined);
  }

  private async findChainReviewers(
    review: ReviewRecord,
    preferredAdminLevels: number[],
    lessThanLevel?: number
  ): Promise<string[]> {
    const ancestors = await this.loadAncestorDepartments(review.submitter_department_id);
    for (const adminLevel of preferredAdminLevels) {
      const reviewers = await this.database.query<{ id: string; department_id: string }>(
        `
        SELECT u.id, u.department_id
        FROM users u
        WHERE u.role = 'admin'
          AND u.status = 'active'
          AND u.admin_level = $1
          ${lessThanLevel ? "AND u.admin_level < $3" : ""}
          AND u.department_id = ANY($2::text[])
      ORDER BY array_position($2::text[], u.department_id), u.username ASC
        `,
        lessThanLevel
          ? [adminLevel, ancestors.map((department) => department.department_id), lessThanLevel]
          : [adminLevel, ancestors.map((department) => department.department_id)]
      );
      if (reviewers.rows.length > 0) {
        return reviewers.rows.map((row) => row.id);
      }
    }
    if (lessThanLevel) {
      const fallback = await this.database.query<{ id: string }>(
        `
        SELECT u.id
        FROM users u
        WHERE u.role = 'admin'
          AND u.status = 'active'
          AND u.admin_level < $1
          AND u.department_id = ANY($2::text[])
      ORDER BY u.admin_level ASC, array_position($2::text[], u.department_id), u.username ASC
        `,
        [lessThanLevel, ancestors.map((department) => department.department_id)]
      );
      return fallback.rows.map((row) => row.id);
    }
    return [];
  }

  private async loadAncestorDepartments(departmentID: string): Promise<DepartmentRow[]> {
    const result = await this.database.query<DepartmentRow>(
      `
      WITH RECURSIVE ancestry AS (
        SELECT id AS department_id, parent_id, path, level
        FROM departments
        WHERE id = $1
        UNION ALL
        SELECT d.id AS department_id, d.parent_id, d.path, d.level
        FROM departments d
        JOIN ancestry a ON a.parent_id = d.id
      )
      SELECT department_id, parent_id, path, level
      FROM ancestry
      ORDER BY level DESC
      `,
      [departmentID]
    );
    return result.rows;
  }
}
