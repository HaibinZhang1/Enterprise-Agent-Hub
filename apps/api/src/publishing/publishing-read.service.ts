import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  PackageFileContentDto,
  PackageFileEntryDto,
  PublisherSkillSummaryDto,
  PublisherSubmissionDetailDto,
  ReviewDetailDto,
  ReviewHistoryDto,
  ReviewItemDto,
} from '../common/p1-contracts';
import { SkillsService } from '../skills/skills.service';
import { PackageStorageService } from './package-storage.service';
import {
  buildPublisherSubmissionDetailDto,
  buildPublisherSkillSummaries,
  buildReviewDetailDto,
  mapReviewItem,
} from './publishing-review-mappers';
import { PublishingReadRepository } from './publishing-read.repository';
import { PublishingRepository } from './publishing.repository';
import { ReviewerRoutingService } from './reviewer-routing.service';
import type { ActorContext, ReviewRecord } from './publishing.types';

@Injectable()
export class PublishingReadService {
  constructor(
    private readonly skillsService: SkillsService,
    private readonly readRepository: PublishingReadRepository,
    private readonly publishingRepository: PublishingRepository,
    private readonly reviewerRouting: ReviewerRoutingService,
    private readonly packageStorage: PackageStorageService,
  ) {}

  async listPublisherSkills(userID: string): Promise<PublisherSkillSummaryDto[]> {
    await this.publishingRepository.releaseExpiredReviewLocks();
    const actor = await this.readRepository.loadActor(userID);
    const [skillRows, submissionRows] = await Promise.all([
      this.readRepository.listPublisherSkillsForAuthor(actor.userID),
      this.readRepository.listLatestSubmissionsForAuthor(actor.userID),
    ]);
    return buildPublisherSkillSummaries(skillRows, submissionRows, {
      userID: actor.userID,
      canWithdraw: (currentUserID, review) => this.reviewerRouting.canSubmitterWithdraw(currentUserID, review),
    });
  }

  async getPublisherSubmission(userID: string, submissionID: string): Promise<PublisherSubmissionDetailDto> {
    await this.publishingRepository.releaseExpiredReviewLocks(submissionID);
    const actor = await this.readRepository.loadActor(userID);
    const review = await this.readRepository.loadReview(submissionID);
    if (review.submitter_id !== actor.userID) {
      throw new ForbiddenException('permission_denied');
    }

    const history = await this.readRepository.loadHistory(review.review_id);
    return this.toPublisherSubmissionDetail(review, history, actor.userID, actor.userID);
  }

  async listPublisherSubmissionFiles(userID: string, submissionID: string): Promise<PackageFileEntryDto[]> {
    await this.publishingRepository.releaseExpiredReviewLocks(submissionID);
    const actor = await this.readRepository.loadActor(userID);
    const review = await this.readRepository.loadReview(submissionID);
    if (review.submitter_id !== actor.userID) {
      throw new ForbiddenException('permission_denied');
    }
    return this.packageStorage.listPackageFilesForReview(review);
  }

  async getPublisherSubmissionFileContent(
    userID: string,
    submissionID: string,
    relativePath: string,
  ): Promise<PackageFileContentDto> {
    await this.publishingRepository.releaseExpiredReviewLocks(submissionID);
    const actor = await this.readRepository.loadActor(userID);
    const review = await this.readRepository.loadReview(submissionID);
    if (review.submitter_id !== actor.userID) {
      throw new ForbiddenException('permission_denied');
    }
    return this.packageStorage.readPackageFileContentForReview(review, relativePath);
  }

  async listReviews(userID: string): Promise<ReviewItemDto[]> {
    await this.publishingRepository.releaseExpiredReviewLocks();
    const actor = await this.readRepository.loadActor(userID);
    if (actor.role !== 'admin' || actor.adminLevel === null) {
      throw new ForbiddenException('permission_denied');
    }

    const reviews = await this.readRepository.loadReviews();
    const items: ReviewItemDto[] = [];
    for (const review of reviews) {
      if (!(await this.reviewerRouting.canActorSeeReview(actor, review))) {
        continue;
      }
      items.push(this.toReviewItem(review, actor));
    }
    return items;
  }

  async getReview(userID: string, reviewID: string): Promise<ReviewDetailDto> {
    await this.publishingRepository.releaseExpiredReviewLocks(reviewID);
    const actor = await this.readRepository.loadActor(userID);
    if (actor.role !== 'admin' || actor.adminLevel === null) {
      throw new ForbiddenException('permission_denied');
    }

    const review = await this.readRepository.loadReview(reviewID);
    if (!(await this.reviewerRouting.canActorSeeReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }
    const history = await this.readRepository.loadHistory(reviewID);
    return this.toReviewDetail(review, history, actor, actor.userID);
  }

  async listReviewFiles(userID: string, reviewID: string): Promise<PackageFileEntryDto[]> {
    await this.publishingRepository.releaseExpiredReviewLocks(reviewID);
    const actor = await this.readRepository.loadActor(userID);
    if (actor.role !== 'admin' || actor.adminLevel === null) {
      throw new ForbiddenException('permission_denied');
    }

    const review = await this.readRepository.loadReview(reviewID);
    if (!(await this.reviewerRouting.canActorSeeReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }
    return this.packageStorage.listPackageFilesForReview(review);
  }

  async getReviewFileContent(userID: string, reviewID: string, relativePath: string): Promise<PackageFileContentDto> {
    await this.publishingRepository.releaseExpiredReviewLocks(reviewID);
    const actor = await this.readRepository.loadActor(userID);
    if (actor.role !== 'admin' || actor.adminLevel === null) {
      throw new ForbiddenException('permission_denied');
    }

    const review = await this.readRepository.loadReview(reviewID);
    if (!(await this.reviewerRouting.canActorSeeReview(actor, review))) {
      throw new ForbiddenException('permission_denied');
    }
    return this.packageStorage.readPackageFileContentForReview(review, relativePath);
  }

  private toReviewItem(review: ReviewRecord, actor: ActorContext): ReviewItemDto {
    return mapReviewItem(review, actor.userID);
  }

  private async toReviewDetail(
    review: ReviewRecord,
    history: ReviewHistoryDto[],
    actor: ActorContext,
    requesterUserID: string,
  ): Promise<ReviewDetailDto> {
    const packageFiles = await this.packageStorage.listPackageFilesForReview(review);
    const packageRef = review.staged_package_object_key
      ? review.review_id
      : review.current_package_id ?? undefined;
    const packageURL = packageRef
      ? await this.skillsService.issuePackageDownloadUrl(packageRef, requesterUserID, true)
      : undefined;
    return buildReviewDetailDto(review, actor.userID, history, packageFiles, packageURL);
  }

  private async toPublisherSubmissionDetail(
    review: ReviewRecord,
    history: ReviewHistoryDto[],
    userID: string,
    requesterUserID: string,
  ): Promise<PublisherSubmissionDetailDto> {
    const packageFiles = await this.packageStorage.listPackageFilesForReview(review);
    const packageRef = review.staged_package_object_key
      ? review.review_id
      : review.current_package_id ?? undefined;
    const packageURL = packageRef
      ? await this.skillsService.issuePackageDownloadUrl(packageRef, requesterUserID, true)
      : undefined;
    return buildPublisherSubmissionDetailDto(
      review,
      history,
      packageFiles,
      this.reviewerRouting.canSubmitterWithdraw(userID, review),
      packageURL,
    );
  }
}
