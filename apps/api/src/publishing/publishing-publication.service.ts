import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type { WorkflowState } from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';
import { PackageStorageService } from './package-storage.service';
import { PublishingRepository } from './publishing.repository';
import type { ActorContext, ReviewRecord } from './publishing.types';

@Injectable()
export class PublishingPublicationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly publishingRepository: PublishingRepository,
    private readonly packageStorage: PackageStorageService,
  ) {}

  async finalizeReview(
    reviewID: string,
    actorUserID: string,
    workflowState: Extract<WorkflowState, 'returned_for_changes' | 'review_rejected'>,
    decision: 'return_for_changes' | 'reject',
    comment: string,
  ): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query(
        `
        UPDATE review_items
        SET workflow_state = $2,
            review_status = 'reviewed',
            decision = $3,
            review_summary = $4,
            lock_owner_id = NULL,
            lock_expires_at = NULL,
            updated_at = now()
        WHERE id = $1
        `,
        [reviewID, workflowState, decision, comment],
      );
      await this.publishingRepository.insertHistory(client, reviewID, actorUserID, decision, comment);
    });
  }

  async publishSubmission(review: ReviewRecord, actor: ActorContext | null, comment: string): Promise<void> {
    const currentSkill = review.current_version ? await this.publishingRepository.loadSkillByID(review.skill_id) : null;
    await this.database.transaction(async (client) => {
      const payload = review.submission_payload ?? {
        description: review.description,
        changelog: '',
        category: '其他',
        tags: [],
        compatibleTools: [],
        compatibleSystems: [],
      };
      const updatesMetadata = review.review_type !== 'permission_change';
      let skillID: string;
      let skillUUID: string;
      let publishedVersionID: string | null = currentSkill?.current_version_id ?? null;

      if (!currentSkill) {
        const insertedSkill = await client.query<{ id: string; skill_id: string }>(
          `
          INSERT INTO skills (
            skill_id,
            display_name,
            description,
            author_id,
            department_id,
            status,
            visibility_level,
            category,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 'published', $6, $7, now())
          RETURNING id, skill_id
          `,
          [
            review.skill_id,
            review.skill_display_name,
            payload.description,
            review.submitter_id,
            review.submitter_department_id,
            review.requested_visibility_level ?? 'private',
            payload.category || '其他',
          ],
        );
        skillUUID = insertedSkill.rows[0].id;
        skillID = insertedSkill.rows[0].skill_id;
      } else {
        skillUUID = currentSkill.id;
        skillID = currentSkill.skill_id;
        await client.query(
          `
          UPDATE skills
          SET display_name = $2,
              description = $3,
              visibility_level = $4,
              category = $5,
              status = $6,
              updated_at = now()
          WHERE id = $1
          `,
          [
            currentSkill.id,
            review.skill_display_name,
            payload.description,
            review.requested_visibility_level ?? currentSkill.visibility_level,
            updatesMetadata ? payload.category || '其他' : currentSkill.category ?? '其他',
            currentSkill.status === 'archived' ? 'published' : currentSkill.status,
          ],
        );
      }

      if (review.review_type !== 'permission_change') {
        const version = review.requested_version ?? review.current_version;
        if (!version || !review.staged_package_bucket || !review.staged_package_object_key || !review.staged_package_sha256) {
          throw new BadRequestException('validation_failed');
        }

        const finalObjectKey = `skills/${skillID}/${version}/package.zip`;
        await this.packageStorage.copyObject(
          review.staged_package_bucket,
          review.staged_package_object_key,
          this.packageStorage.packageBucket(),
          finalObjectKey,
        );
        const versionID = randomUUID();
        const packageID = `pkg_${skillID}_${version.replace(/\./g, '_')}_${randomBytes(4).toString('hex')}`;

        await client.query(
          `
          INSERT INTO skill_versions (
            id,
            skill_id,
            version,
            changelog,
            risk_level,
            review_summary,
            published_at
          )
          VALUES ($1, $2, $3, $4, 'unknown', $5, now())
          `,
          [versionID, skillUUID, version, payload.changelog, comment],
        );
        await client.query(
          `
          INSERT INTO skill_packages (
            id,
            skill_version_id,
            bucket,
            object_key,
            sha256,
            size_bytes,
            file_count,
            content_type
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'application/zip')
          `,
          [
            packageID,
            versionID,
            this.packageStorage.packageBucket(),
            finalObjectKey,
            review.staged_package_sha256,
            review.staged_package_size_bytes ?? payload.packageSize ?? 0,
            review.staged_package_file_count ?? payload.packageFileCount ?? 0,
          ],
        );
        await client.query('UPDATE skills SET current_version_id = $2 WHERE id = $1', [skillUUID, versionID]);
        publishedVersionID = versionID;
      }

      if (updatesMetadata) {
        await client.query('DELETE FROM skill_tags WHERE skill_id = $1', [skillUUID]);
        for (const tag of payload.tags ?? []) {
          await client.query('INSERT INTO skill_tags (skill_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING', [skillUUID, tag]);
        }
        await client.query('DELETE FROM skill_tool_compatibilities WHERE skill_id = $1', [skillUUID]);
        const systems = payload.compatibleSystems.length > 0 ? payload.compatibleSystems : ['windows'];
        for (const toolID of payload.compatibleTools ?? []) {
          for (const system of systems) {
            await client.query(
              `
              INSERT INTO skill_tool_compatibilities (skill_id, tool_id, system)
              VALUES ($1, $2, $3)
              ON CONFLICT DO NOTHING
              `,
              [skillUUID, toolID, system],
            );
          }
        }
      }

      await client.query('DELETE FROM skill_authorizations WHERE skill_id = $1', [skillUUID]);
      const scopeDepartments =
        review.requested_scope_type === 'selected_departments'
          ? review.requested_department_ids ?? []
          : review.requested_scope_type === 'current_department' || review.requested_scope_type === 'department_tree'
            ? [review.submitter_department_id]
            : [];
      if (review.requested_scope_type) {
        if (scopeDepartments.length === 0) {
          await client.query(
            'INSERT INTO skill_authorizations (skill_id, scope_type, department_id) VALUES ($1, $2, NULL)',
            [skillUUID, review.requested_scope_type],
          );
        } else {
          for (const departmentID of scopeDepartments) {
            await client.query(
              'INSERT INTO skill_authorizations (skill_id, scope_type, department_id) VALUES ($1, $2, $3)',
              [skillUUID, review.requested_scope_type, departmentID],
            );
          }
        }
      }

      await client.query('SELECT refresh_skill_search_document($1)', [skillUUID]);

      await client.query(
        `
        UPDATE review_items
        SET workflow_state = 'published',
            review_status = 'reviewed',
            decision = 'approve',
            review_summary = $2,
            lock_owner_id = NULL,
            lock_expires_at = NULL,
            published_version_id = $3,
            updated_at = now()
        WHERE id = $1
        `,
        [review.review_id, comment, publishedVersionID],
      );
      await this.publishingRepository.insertHistory(client, review.review_id, actor?.userID ?? null, actor ? 'approve' : 'auto_approve', comment);
    });
  }
}
