import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillsModule } from '../skills/skills.module';
import { PackageStorageService } from './package-storage.service';
import { PublishingPrecheckService } from './publishing-precheck.service';
import { PublishingPublicationService } from './publishing-publication.service';
import { PublishingReadRepository } from './publishing-read.repository';
import { PublishingReadService } from './publishing-read.service';
import { PublishingRepository } from './publishing.repository';
import { PublishingReviewService } from './publishing-review.service';
import { PublisherController } from './publisher.controller';
import { PublishingService } from './publishing.service';
import { PublishingSubmissionService } from './publishing-submission.service';
import { ReviewerRoutingService } from './reviewer-routing.service';

@Module({
  imports: [AuthModule, SkillsModule],
  controllers: [PublisherController],
  providers: [
    PublishingService,
    PublishingReadService,
    PublishingReadRepository,
    PublishingSubmissionService,
    PublishingReviewService,
    PublishingPrecheckService,
    PublishingPublicationService,
    PackageStorageService,
    PublishingRepository,
    ReviewerRoutingService,
  ],
  exports: [PublishingService],
})
export class PublishingModule {}
