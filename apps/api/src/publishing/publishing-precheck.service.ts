import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseService } from '../database/database.service';
import { PackageStorageService } from './package-storage.service';
import { PublishingRepository } from './publishing.repository';
import { ReviewerRoutingService } from './reviewer-routing.service';
import { PublishingPublicationService } from './publishing-publication.service';
import {
  buildPrecheckItems,
  compareSemver,
  hasWarnings,
  isSemver,
  parseSimpleFrontmatter,
  readSkillMarkdown,
} from './publishing.utils';

const execFileAsync = promisify(execFile);

@Injectable()
export class PublishingPrecheckService {
  constructor(
    private readonly database: DatabaseService,
    private readonly publishingRepository: PublishingRepository,
    private readonly reviewerRouting: ReviewerRoutingService,
    private readonly packageStorage: PackageStorageService,
    private readonly publication: PublishingPublicationService,
  ) {}

  async markQueued(reviewID: string): Promise<void> {
    await this.publishingRepository.recordJobRun(reviewID, 'queued');
  }

  async processSystemPrecheck(reviewID: string): Promise<void> {
    const review = await this.publishingRepository.loadReview(reviewID);
    if (review.workflow_state !== 'system_prechecking') {
      return;
    }

    await this.publishingRepository.recordJobRun(reviewID, 'running');
    const warnings: string[] = [];
    let hasSkillMd = true;
    let frontmatterNameMatches = true;
    let versionValid = isSemver(review.requested_version ?? '');
    let versionIncrementValid = true;
    const sizeValid = (review.staged_package_size_bytes ?? 0) <= 5 * 1024 * 1024 || review.review_type === 'permission_change';
    const fileCountValid = (review.staged_package_file_count ?? 0) <= 100 || review.review_type === 'permission_change';
    const visibilityValid = ['private', 'summary_visible', 'detail_visible', 'public_installable'].includes(review.requested_visibility_level ?? '');
    const scopeValid = ['current_department', 'department_tree', 'selected_departments', 'all_employees'].includes(review.requested_scope_type ?? '');

    const currentSkill = review.current_version ? await this.publishingRepository.loadSkillByID(review.skill_id) : null;
    if (review.review_type === 'update' && currentSkill && review.requested_version) {
      versionIncrementValid = compareSemver(review.requested_version, currentSkill.version ?? '0.0.0') > 0;
    }

    if (review.review_type === 'permission_change') {
      versionValid = true;
      versionIncrementValid = true;
    }

    if (review.review_type !== 'permission_change') {
      const tempDir = await mkdtemp(join(tmpdir(), 'eah-precheck-'));
      try {
        const zipPath = join(tempDir, 'package.zip');
        const extractDir = join(tempDir, 'extract');
        await mkdir(extractDir, { recursive: true });
        const buffer = await this.packageStorage.readReviewPackageBuffer(review);
        await writeFile(zipPath, buffer);
        await this.unzipFile(zipPath, extractDir);
        const packageRoot = await this.resolvePackageRoot(extractDir);
        hasSkillMd = existsSync(join(packageRoot, 'SKILL.md'));
        if (hasSkillMd) {
          const frontmatter = parseSimpleFrontmatter(readSkillMarkdown(packageRoot));
          frontmatterNameMatches = !frontmatter.name || frontmatter.name === review.skill_id;
        } else {
          frontmatterNameMatches = false;
        }
      } catch (error) {
        hasSkillMd = false;
        frontmatterNameMatches = false;
        warnings.push(error instanceof Error ? error.message : '系统初审解包失败。');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }

    if (review.review_type === 'publish' && currentSkill) {
      warnings.push('存在同名 Skill，需人工复核是否允许重建。');
    }
    if ((review.review_type === 'update' || review.review_type === 'permission_change') && !currentSkill) {
      warnings.push('目标 Skill 不存在，需人工复核。');
    }

    const items = buildPrecheckItems({
      hasSkillMd,
      frontmatterNameMatches,
      versionValid,
      versionIncrementValid,
      sizeValid,
      fileCountValid,
      visibilityValid,
      scopeValid,
      warnings,
    });
    const nextWorkflow = hasWarnings(items) ? 'manual_precheck' : 'pending_review';
    const autoApprove = !hasWarnings(items) && (await this.reviewerRouting.shouldAutoApprove(review));

    await this.database.transaction(async (client) => {
      await client.query(
        `
        UPDATE review_items
        SET precheck_results = $2::jsonb,
            workflow_state = $3,
            review_status = 'pending',
            updated_at = now()
        WHERE id = $1
        `,
        [reviewID, JSON.stringify(items), nextWorkflow],
      );
      await this.publishingRepository.insertHistory(
        client,
        reviewID,
        null,
        hasWarnings(items) ? 'manual_precheck' : 'system_precheck_passed',
        hasWarnings(items) ? '系统初审发现异常，转人工复核。' : '系统初审通过。',
      );
    });

    if (autoApprove) {
      const refreshed = await this.publishingRepository.loadReview(reviewID);
      await this.publication.publishSubmission(refreshed, null, '系统初审通过，按管理员等级自动发布。');
    }
    await this.publishingRepository.recordJobRun(reviewID, 'finished');
  }

  private async unzipFile(zipPath: string, targetDir: string): Promise<void> {
    await execFileAsync('unzip', ['-oq', zipPath, '-d', targetDir]);
  }

  private async resolvePackageRoot(extractDir: string): Promise<string> {
    const entries = await readdir(extractDir, { withFileTypes: true });
    const fileEntries = entries.filter((entry) => entry.isFile());
    const dirEntries = entries.filter((entry) => entry.isDirectory());
    if (fileEntries.length === 0 && dirEntries.length === 1) {
      return join(extractDir, dirEntries[0].name);
    }
    return extractDir;
  }
}
