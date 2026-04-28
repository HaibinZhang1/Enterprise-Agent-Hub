import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { ReviewHistoryDto } from "../common/p1-contracts";
import { DatabaseService } from "../database/database.service";
import type { ActorContext, ReviewRecord, SkillRecord } from "./publishing.types";

@Injectable()
export class PublishingRepository {
  constructor(private readonly database: DatabaseService) {}

  async loadActor(userID: string): Promise<ActorContext> {
    const actor = await this.database.one<{
      user_id: string;
      display_name: string;
      role: "normal_user" | "admin";
      admin_level: number | null;
      department_id: string;
      department_name: string;
      department_path: string;
    }>(
      `
      SELECT
        u.id AS user_id,
        u.username AS display_name,
        u.role,
        u.admin_level,
        u.department_id,
        d.name AS department_name,
        d.path AS department_path
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
        AND u.status = 'active'
      `,
      [userID]
    );

    if (!actor) {
      throw new NotFoundException("resource_not_found");
    }

    return {
      userID: actor.user_id,
      displayName: actor.display_name,
      role: actor.role,
      adminLevel: actor.admin_level,
      departmentID: actor.department_id,
      departmentName: actor.department_name,
      departmentPath: actor.department_path
    };
  }

  async loadSkillByID(skillID: string): Promise<SkillRecord | null> {
    return this.database.one<SkillRecord>(
      `
      SELECT
        s.id,
        s.skill_id,
        s.display_name,
        s.description,
        s.author_id,
        s.department_id,
        s.status,
        s.visibility_level,
        s.category,
        current_version.version,
        s.current_version_id,
        current_package.id AS current_package_id,
        current_package.bucket AS current_package_bucket,
        current_package.object_key AS current_package_object_key,
        current_package.sha256 AS current_package_hash,
        current_package.size_bytes AS current_package_size_bytes,
        current_package.file_count AS current_package_file_count,
        auth.scope_type,
        auth.department_ids AS scope_department_ids,
        COALESCE(tools.compatible_tools, '{}') AS compatible_tools,
        COALESCE(systems.compatible_systems, '{}') AS compatible_systems,
        COALESCE(tags.tags, '{}') AS tags
      FROM skills s
      LEFT JOIN skill_versions current_version ON current_version.id = s.current_version_id
      LEFT JOIN skill_packages current_package ON current_package.skill_version_id = current_version.id
      LEFT JOIN LATERAL (
        SELECT
          sa.scope_type,
          array_remove(array_agg(sa.department_id ORDER BY sa.department_id), NULL) AS department_ids
        FROM skill_authorizations sa
        WHERE sa.skill_id = s.id
        GROUP BY sa.scope_type
        ORDER BY count(*) DESC, sa.scope_type ASC
        LIMIT 1
      ) auth ON true
      LEFT JOIN LATERAL (
        SELECT array_remove(array_agg(st.tool_id ORDER BY st.tool_id), NULL) AS compatible_tools
        FROM skill_tool_compatibilities st
        WHERE st.skill_id = s.id
      ) tools ON true
      LEFT JOIN LATERAL (
        SELECT array_remove(array_agg(st.system ORDER BY st.system), NULL) AS compatible_systems
        FROM skill_tool_compatibilities st
        WHERE st.skill_id = s.id
      ) systems ON true
      LEFT JOIN LATERAL (
        SELECT array_remove(array_agg(t.tag ORDER BY t.tag), NULL) AS tags
        FROM skill_tags t
        WHERE t.skill_id = s.id
      ) tags ON true
      WHERE s.skill_id = $1
      `,
      [skillID]
    );
  }

  async loadReview(reviewID: string): Promise<ReviewRecord> {
    const rows = await this.loadReviews(reviewID);
    if (rows.length === 0) {
      throw new NotFoundException("resource_not_found");
    }
    return rows[0];
  }

  async loadReviews(reviewID?: string): Promise<ReviewRecord[]> {
    const result = await this.database.query<ReviewRecord>(
      `
      SELECT
        r.id AS review_id,
        r.skill_id,
        r.skill_display_name,
        r.submitter_id,
        r.submitter_name,
        r.submitter_department_id,
        r.submitter_department_name,
        submitter_department.path AS submitter_department_path,
        submitter_department.parent_id AS submitter_parent_department_id,
        submitter.role AS submitter_role,
        submitter.admin_level AS submitter_admin_level,
        r.review_type,
        r.review_status,
        r.workflow_state,
        r.claimed_from_workflow_state,
        r.risk_level,
        r.summary,
        r.description,
        r.review_summary,
        current_reviewer.username AS current_reviewer_name,
        r.lock_owner_id,
        r.lock_expires_at,
        r.requested_version,
        r.requested_visibility_level,
        r.requested_scope_type,
        r.staged_package_bucket,
        r.staged_package_object_key,
        r.staged_package_sha256,
        r.staged_package_size_bytes,
        r.staged_package_file_count,
        r.decision,
        COALESCE(r.submission_payload, '{}'::jsonb) AS submission_payload,
        r.precheck_results,
        review_scope.department_ids AS requested_department_ids,
        current_version.version AS current_version,
        current_skill.status AS current_status,
        current_skill.visibility_level AS current_visibility_level,
        current_auth.scope_type AS current_scope_type,
        current_auth.department_ids AS current_scope_department_ids,
        current_package.id AS current_package_id,
        current_package.bucket AS current_package_bucket,
        current_package.object_key AS current_package_object_key,
        current_package.sha256 AS current_package_hash,
        current_package.size_bytes AS current_package_size_bytes,
        current_package.file_count AS current_package_file_count,
        r.submitted_at,
        r.updated_at
      FROM review_items r
      JOIN users submitter ON submitter.id = r.submitter_id
      JOIN departments submitter_department ON submitter_department.id = r.submitter_department_id
      LEFT JOIN users current_reviewer ON current_reviewer.id = r.lock_owner_id
      LEFT JOIN skills current_skill ON current_skill.skill_id = r.skill_id
      LEFT JOIN skill_versions current_version ON current_version.id = current_skill.current_version_id
      LEFT JOIN skill_packages current_package ON current_package.skill_version_id = current_version.id
      LEFT JOIN LATERAL (
        SELECT array_remove(array_agg(scope.department_id ORDER BY scope.department_id), NULL) AS department_ids
        FROM review_item_scope_departments scope
        WHERE scope.review_item_id = r.id
      ) review_scope ON true
      LEFT JOIN LATERAL (
        SELECT
          sa.scope_type,
          array_remove(array_agg(sa.department_id ORDER BY sa.department_id), NULL) AS department_ids
        FROM skill_authorizations sa
        WHERE sa.skill_id = current_skill.id
        GROUP BY sa.scope_type
        ORDER BY count(*) DESC, sa.scope_type ASC
        LIMIT 1
      ) current_auth ON true
      WHERE ($1::text IS NULL OR r.id = $1)
      ORDER BY r.updated_at DESC, r.id DESC
      `,
      [reviewID ?? null]
    );
    return result.rows.map((row) => ({
      ...row,
      submission_payload: normalizePayload(row.submission_payload)
    }));
  }

  async loadHistory(reviewID: string): Promise<ReviewHistoryDto[]> {
    const result = await this.database.query<{
      history_id: string;
      action: string;
      actor_name: string | null;
      comment: string | null;
      created_at: Date;
    }>(
      `
      SELECT
        h.id AS history_id,
        h.action,
        actor.username AS actor_name,
        h.comment,
        h.created_at
      FROM review_item_history h
      LEFT JOIN users actor ON actor.id = h.actor_id
      WHERE h.review_item_id = $1
      ORDER BY h.created_at ASC, h.id ASC
      `,
      [reviewID]
    );
    return result.rows.map((row) => ({
      historyID: row.history_id,
      action: row.action,
      actorName: row.actor_name ?? "系统",
      comment: row.comment,
      createdAt: row.created_at.toISOString()
    }));
  }

  async insertHistory(client: PoolClient, reviewID: string, actorID: string | null, action: string, comment: string | null): Promise<void> {
    await client.query(
      `
      INSERT INTO review_item_history (id, review_item_id, actor_id, action, comment, created_at)
      VALUES ($1, $2, $3, $4, $5, now())
      `,
      [`rvh_${randomBytes(8).toString("hex")}`, reviewID, actorID, action, comment]
    );
  }

  async releaseExpiredReviewLocks(reviewID?: string): Promise<void> {
    await this.database.transaction(async (client) => {
      const expired = await client.query<{
        id: string;
        claimed_from_workflow_state: 'manual_precheck' | 'pending_review';
      }>(
        `
        SELECT id, claimed_from_workflow_state
        FROM review_items
        WHERE workflow_state = 'in_review'
          AND review_status = 'in_review'
          AND claimed_from_workflow_state IN ('manual_precheck', 'pending_review')
          AND (lock_expires_at IS NULL OR lock_expires_at <= now())
          AND ($1::text IS NULL OR id = $1)
        FOR UPDATE
        `,
        [reviewID ?? null],
      );

      for (const row of expired.rows) {
        const updated = await client.query(
          `
          UPDATE review_items
          SET workflow_state = claimed_from_workflow_state,
              review_status = 'pending',
              lock_owner_id = NULL,
              lock_expires_at = NULL,
              claimed_from_workflow_state = NULL,
              updated_at = now()
          WHERE id = $1
            AND workflow_state = 'in_review'
          `,
          [row.id],
        );
        if (updated.rowCount === 1) {
          await this.insertHistory(
            client,
            row.id,
            null,
            'lock_expired',
            row.claimed_from_workflow_state === 'manual_precheck'
              ? '锁单超时，已退回待人工复核队列。'
              : '锁单超时，已退回待管理员审核队列。',
          );
        }
      }
    });
  }

  async recordJobRun(reviewID: string, status: string): Promise<void> {
    await this.database.query(
      `
      INSERT INTO job_runs (job_type, job_id, status, created_at, finished_at)
      VALUES ('publishing_precheck', $1, $2, now(), CASE WHEN $2 = 'finished' THEN now() ELSE NULL END)
      `,
      [reviewID, status]
    );
  }
}

function normalizePayload(value: unknown) {
  if (!value) {
    return {
      description: "",
      changelog: "",
      category: "其他",
      tags: [],
      compatibleTools: [],
      compatibleSystems: []
    };
  }
  const payload = typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    description: typeof payload.description === "string" ? payload.description : "",
    changelog: typeof payload.changelog === "string" ? payload.changelog : "",
    category: typeof payload.category === "string" && payload.category ? payload.category : "其他",
    tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
    compatibleTools: Array.isArray(payload.compatibleTools) ? payload.compatibleTools.map(String) : [],
    compatibleSystems: Array.isArray(payload.compatibleSystems) ? payload.compatibleSystems.map(String) : [],
    packageSize: typeof payload.packageSize === "number" ? payload.packageSize : undefined,
    packageFileCount: typeof payload.packageFileCount === "number" ? payload.packageFileCount : undefined
  };
}
