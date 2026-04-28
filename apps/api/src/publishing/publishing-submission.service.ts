import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { assertSkillStatusTransition } from '../admin/skill-status';
import { DatabaseService } from '../database/database.service';
import { PackageStorageService } from './package-storage.service';
import { PublishingNotificationService } from './publishing-notification.service';
import { PublishingRepository } from './publishing.repository';
import { buildSubmissionSummary, parseSubmissionInput } from './publishing-submission-input';
import { ReviewerRoutingService } from './reviewer-routing.service';
import type {
  PublisherStatusAction,
} from '../common/p1-contracts';
import type {
  SubmissionPayload,
  UploadedSubmissionFile,
} from './publishing.types';

@Injectable()
export class PublishingSubmissionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly publishingRepository: PublishingRepository,
    private readonly reviewerRouting: ReviewerRoutingService,
    private readonly packageStorage: PackageStorageService,
    private readonly notifications: PublishingNotificationService,
  ) {}

  async createSubmission(
    userID: string,
    body: Record<string, string | undefined>,
    files: UploadedSubmissionFile[],
  ): Promise<{ actorUserID: string; reviewID: string }> {
    const actor = await this.publishingRepository.loadActor(userID);
    const input = parseSubmissionInput(body);
    const uploadFiles = applySubmittedFileRelativePaths(files, body.fileRelativePaths);
    const currentSkill = await this.publishingRepository.loadSkillByID(input.skillID);

    if (input.submissionType === 'publish' && currentSkill && currentSkill.status !== 'archived') {
      throw new BadRequestException('skill_id_exists');
    }
    if (input.submissionType !== 'publish') {
      if (!currentSkill) {
        throw new NotFoundException('skill_not_found');
      }
      if (currentSkill.author_id !== actor.userID) {
        throw new ForbiddenException('permission_denied');
      }
      if (currentSkill.status === 'archived') {
        throw new BadRequestException('validation_failed');
      }
    }

    if (input.submissionType === 'permission_change') {
      input.version = currentSkill?.version ?? input.version;
      if (uploadFiles.length > 0) {
        throw new BadRequestException('validation_failed');
      }
    } else if (uploadFiles.length === 0) {
      throw new BadRequestException('validation_failed');
    }

    const reviewID = `rv_${randomBytes(8).toString('hex')}`;
    const stagedPackage =
      input.submissionType === 'permission_change'
        ? null
        : await this.packageStorage.stageSubmissionPackage(reviewID, input, uploadFiles);

    const payload: SubmissionPayload = {
      description: input.description,
      changelog: input.changelog,
      category: input.category,
      tags: input.tags,
      compatibleTools: input.compatibleTools,
      compatibleSystems: input.compatibleSystems,
      packageSize: stagedPackage?.sizeBytes,
      packageFileCount: stagedPackage?.fileCount,
    };

    await this.database.transaction(async (client) => {
      await client.query(
        `
        INSERT INTO review_items (
          id,
          skill_id,
          skill_display_name,
          submitter_id,
          submitter_name,
          submitter_department_id,
          submitter_department_name,
          review_type,
          review_status,
          workflow_state,
          risk_level,
          summary,
          description,
          requested_version,
          requested_visibility_level,
          requested_scope_type,
          staged_package_bucket,
          staged_package_object_key,
          staged_package_sha256,
          staged_package_size_bytes,
          staged_package_file_count,
          staged_package_content_type,
          submission_payload,
          submitted_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'system_prechecking', 'unknown', $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, 'application/zip', $19::jsonb, now(), now()
        )
        `,
        [
          reviewID,
          input.skillID,
          input.displayName,
          actor.userID,
          actor.displayName,
          actor.departmentID,
          actor.departmentName,
          input.submissionType,
          buildSubmissionSummary(input),
          input.description,
          input.version,
          input.visibilityLevel,
          input.scopeType,
          stagedPackage?.bucket ?? null,
          stagedPackage?.objectKey ?? null,
          stagedPackage?.sha256 ?? null,
          stagedPackage?.sizeBytes ?? null,
          stagedPackage?.fileCount ?? null,
          JSON.stringify(payload),
        ],
      );

      if (input.selectedDepartmentIDs.length > 0) {
        for (const departmentID of input.selectedDepartmentIDs) {
          await client.query(
            'INSERT INTO review_item_scope_departments (review_item_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [reviewID, departmentID],
          );
        }
      }

      await client.query(
        `
        INSERT INTO review_item_history (id, review_item_id, actor_id, action, comment, created_at)
        VALUES ($1, $2, $3, 'submitted', $4, now())
        `,
        [`rvh_${randomBytes(8).toString('hex')}`, reviewID, actor.userID, buildSubmissionSummary(input)],
      );
      await this.notifications.notifySubmissionCreated(client, {
        review_id: reviewID,
        skill_display_name: input.displayName,
        submitter_id: actor.userID,
      });
    });

    return { actorUserID: actor.userID, reviewID };
  }

  async withdrawSubmission(userID: string, submissionID: string): Promise<{ actorUserID: string; submissionID: string }> {
    await this.publishingRepository.releaseExpiredReviewLocks(submissionID);
    const actor = await this.publishingRepository.loadActor(userID);
    const review = await this.publishingRepository.loadReview(submissionID);
    if (review.submitter_id !== actor.userID || !this.reviewerRouting.canSubmitterWithdraw(actor.userID, review)) {
      throw new ForbiddenException('permission_denied');
    }

    await this.database.transaction(async (client) => {
      await client.query(
        `
        UPDATE review_items
        SET workflow_state = 'withdrawn',
            review_status = 'reviewed',
            decision = 'withdraw',
            lock_owner_id = NULL,
            lock_expires_at = NULL,
            claimed_from_workflow_state = NULL,
            updated_at = now()
        WHERE id = $1
        `,
        [submissionID],
      );
      await this.publishingRepository.insertHistory(client, submissionID, actor.userID, 'withdrawn', '发布者已撤回提交。');
      await this.notifications.notifyAuthorWorkflow(client, review, {
        title: `${review.skill_display_name} 已撤回`,
        summary: '发布者已撤回提交。',
      });
    });

    return { actorUserID: actor.userID, submissionID };
  }

  async setPublisherSkillStatus(
    userID: string,
    skillID: string,
    nextStatus: PublisherStatusAction,
  ): Promise<string> {
    const actor = await this.publishingRepository.loadActor(userID);
    const skill = await this.publishingRepository.loadSkillByID(skillID);
    if (!skill || skill.author_id !== actor.userID) {
      throw new ForbiddenException('permission_denied');
    }

    const statusMap: Record<PublisherStatusAction, 'delisted' | 'published' | 'archived'> = {
      delist: 'delisted',
      relist: 'published',
      archive: 'archived',
    };
    const targetStatus = statusMap[nextStatus];
    assertSkillStatusTransition(skill.status, targetStatus);

    await this.database.query(
      'UPDATE skills SET status = $2, updated_at = now() WHERE skill_id = $1',
      [skillID, targetStatus],
    );
    return actor.userID;
  }
}

function applySubmittedFileRelativePaths(
  files: UploadedSubmissionFile[],
  rawRelativePaths: string | undefined,
): UploadedSubmissionFile[] {
  if (!rawRelativePaths) {
    return files;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawRelativePaths);
  } catch {
    throw new BadRequestException('validation_failed');
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== files.length ||
    !parsed.every((item) => typeof item === 'string' && item.trim())
  ) {
    throw new BadRequestException('validation_failed');
  }

  return files.map((file, index) => ({
    ...file,
    originalname: parsed[index].trim(),
  }));
}
