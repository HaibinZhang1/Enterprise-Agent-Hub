import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PackageFileContentDto,
  PackageFileEntryDto,
  PublisherSkillSummaryDto,
  PublisherSubmissionDetailDto,
  ReviewDetailDto,
  ReviewItemDto,
} from '../common/p1-contracts';
import { logInfo } from '../common/structured-log';
import { PublishingPrecheckService } from './publishing-precheck.service';
import { PublishingReadService } from './publishing-read.service';
import { PublishingReviewService } from './publishing-review.service';
import { PublishingSubmissionService } from './publishing-submission.service';
import { PRECHECK_QUEUE } from './publishing.service.constants';
import type { UploadedSubmissionFile } from './publishing.types';

@Injectable()
export class PublishingService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private queue: Queue<{ reviewID: string }> | null = null;
  private worker: Worker<{ reviewID: string }> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly readService: PublishingReadService,
    private readonly submissionService: PublishingSubmissionService,
    private readonly reviewService: PublishingReviewService,
    private readonly precheckService: PublishingPrecheckService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      return;
    }

    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(PRECHECK_QUEUE, { connection: this.redis });
    this.worker = new Worker(
      PRECHECK_QUEUE,
      async (job) => {
        await this.precheckService.processSystemPrecheck(job.data.reviewID);
      },
      { connection: this.redis },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.redis?.quit();
  }

  async listPublisherSkills(userID: string): Promise<PublisherSkillSummaryDto[]> {
    return this.readService.listPublisherSkills(userID);
  }

  async getPublisherSubmission(userID: string, submissionID: string): Promise<PublisherSubmissionDetailDto> {
    return this.readService.getPublisherSubmission(userID, submissionID);
  }

  async submitSubmission(
    userID: string,
    body: Record<string, string | undefined>,
    files: UploadedSubmissionFile[],
  ): Promise<PublisherSubmissionDetailDto> {
    const startedAt = Date.now();
    const { actorUserID, reviewID } = await this.submissionService.createSubmission(userID, body, files);
    await this.enqueueSystemPrecheck(reviewID);
    logInfo({
      event: 'publishing.submission.created',
      domain: 'publisher-submission',
      action: 'submit_submission',
      actorID: actorUserID,
      entityID: reviewID,
      result: 'ok',
      durationMs: Date.now() - startedAt,
      detail: { skillID: body.skillID ?? '', submissionType: body.submissionType ?? 'publish' },
    });
    return this.readService.getPublisherSubmission(actorUserID, reviewID);
  }

  async withdrawSubmission(userID: string, submissionID: string): Promise<PublisherSubmissionDetailDto> {
    const { actorUserID } = await this.submissionService.withdrawSubmission(userID, submissionID);
    return this.readService.getPublisherSubmission(actorUserID, submissionID);
  }

  async setPublisherSkillStatus(
    userID: string,
    skillID: string,
    nextStatus: 'delist' | 'relist' | 'archive',
  ): Promise<PublisherSkillSummaryDto[]> {
    const actorUserID = await this.submissionService.setPublisherSkillStatus(userID, skillID, nextStatus);
    return this.readService.listPublisherSkills(actorUserID);
  }

  async listPublisherSubmissionFiles(userID: string, submissionID: string): Promise<PackageFileEntryDto[]> {
    return this.readService.listPublisherSubmissionFiles(userID, submissionID);
  }

  async getPublisherSubmissionFileContent(
    userID: string,
    submissionID: string,
    relativePath: string,
  ): Promise<PackageFileContentDto> {
    return this.readService.getPublisherSubmissionFileContent(userID, submissionID, relativePath);
  }

  async listReviews(userID: string): Promise<ReviewItemDto[]> {
    return this.readService.listReviews(userID);
  }

  async getReview(userID: string, reviewID: string): Promise<ReviewDetailDto> {
    return this.readService.getReview(userID, reviewID);
  }

  async listReviewFiles(userID: string, reviewID: string): Promise<PackageFileEntryDto[]> {
    return this.readService.listReviewFiles(userID, reviewID);
  }

  async getReviewFileContent(userID: string, reviewID: string, relativePath: string): Promise<PackageFileContentDto> {
    return this.readService.getReviewFileContent(userID, reviewID, relativePath);
  }

  async claimReview(userID: string, reviewID: string): Promise<ReviewDetailDto> {
    const actorUserID = await this.reviewService.claimReview(userID, reviewID);
    return this.readService.getReview(actorUserID, reviewID);
  }

  async passPrecheck(userID: string, reviewID: string, comment: string): Promise<ReviewDetailDto> {
    const actorUserID = await this.reviewService.passPrecheck(userID, reviewID, comment);
    return this.readService.getReview(actorUserID, reviewID);
  }

  async approveReview(userID: string, reviewID: string, comment: string): Promise<ReviewDetailDto> {
    const actorUserID = await this.reviewService.approveReview(userID, reviewID, comment);
    return this.readService.getReview(actorUserID, reviewID);
  }

  async returnReview(userID: string, reviewID: string, comment: string): Promise<ReviewDetailDto> {
    const actorUserID = await this.reviewService.returnReview(userID, reviewID, comment);
    return this.readService.getReview(actorUserID, reviewID);
  }

  async rejectReview(userID: string, reviewID: string, comment: string): Promise<ReviewDetailDto> {
    const actorUserID = await this.reviewService.rejectReview(userID, reviewID, comment);
    return this.readService.getReview(actorUserID, reviewID);
  }

  async processSystemPrecheck(reviewID: string): Promise<void> {
    await this.precheckService.processSystemPrecheck(reviewID);
  }

  private async enqueueSystemPrecheck(reviewID: string): Promise<void> {
    await this.precheckService.markQueued(reviewID);
    if (this.queue) {
      await this.queue.add(reviewID, { reviewID }, { removeOnComplete: 10, removeOnFail: 10 });
    }
    setTimeout(() => {
      void this.precheckService.processSystemPrecheck(reviewID);
    }, this.queue ? 250 : 0);
  }
}
