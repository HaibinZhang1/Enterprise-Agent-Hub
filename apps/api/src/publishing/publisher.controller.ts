import { Body, Controller, Get, Param, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { MenuPermissionGuard } from '../auth/menu-permission.guard';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { RequireMenuPermission } from '../auth/require-menu-permission.decorator';
import {
  PackageFileContentDto,
  PackageFileEntryDto,
  PublisherSkillSummaryDto,
  PublisherSubmissionDetailDto,
} from '../common/p1-contracts';
import { PublishingService } from './publishing.service';

@Controller('publisher')
@UseGuards(P1AuthGuard, MenuPermissionGuard)
@RequireMenuPermission('publisher')
export class PublisherController {
  constructor(private readonly publishingService: PublishingService) {}

  @Get('skills')
  listSkills(@Req() request: P1AuthenticatedRequest): Promise<PublisherSkillSummaryDto[]> {
    return this.publishingService.listPublisherSkills(request.p1UserID ?? '');
  }

  @Post('skills/:skillID/delist')
  delistSkill(
    @Req() request: P1AuthenticatedRequest,
    @Param('skillID') skillID: string,
  ): Promise<PublisherSkillSummaryDto[]> {
    return this.publishingService.setPublisherSkillStatus(request.p1UserID ?? '', skillID, 'delist');
  }

  @Post('skills/:skillID/relist')
  relistSkill(
    @Req() request: P1AuthenticatedRequest,
    @Param('skillID') skillID: string,
  ): Promise<PublisherSkillSummaryDto[]> {
    return this.publishingService.setPublisherSkillStatus(request.p1UserID ?? '', skillID, 'relist');
  }

  @Post('skills/:skillID/archive')
  archiveSkill(
    @Req() request: P1AuthenticatedRequest,
    @Param('skillID') skillID: string,
  ): Promise<PublisherSkillSummaryDto[]> {
    return this.publishingService.setPublisherSkillStatus(request.p1UserID ?? '', skillID, 'archive');
  }

  @Get('submissions/:submissionID')
  detail(
    @Req() request: P1AuthenticatedRequest,
    @Param('submissionID') submissionID: string,
  ): Promise<PublisherSubmissionDetailDto> {
    return this.publishingService.getPublisherSubmission(request.p1UserID ?? '', submissionID);
  }

  @Get('submissions/:submissionID/files')
  listSubmissionFiles(
    @Req() request: P1AuthenticatedRequest,
    @Param('submissionID') submissionID: string,
  ): Promise<PackageFileEntryDto[]> {
    return this.publishingService.listPublisherSubmissionFiles(request.p1UserID ?? '', submissionID);
  }

  @Get('submissions/:submissionID/file-content')
  submissionFileContent(
    @Req() request: P1AuthenticatedRequest,
    @Param('submissionID') submissionID: string,
    @Query('path') relativePath: string,
  ): Promise<PackageFileContentDto> {
    return this.publishingService.getPublisherSubmissionFileContent(
      request.p1UserID ?? '',
      submissionID,
      relativePath,
    );
  }

  @Post('submissions')
  @UseInterceptors(AnyFilesInterceptor({ preservePath: true }))
  submit(
    @Req() request: P1AuthenticatedRequest,
    @Body() body: Record<string, string | undefined>,
    @UploadedFiles() files: Array<{ originalname: string; buffer: Buffer; size: number }>,
  ): Promise<PublisherSubmissionDetailDto> {
    return this.publishingService.submitSubmission(request.p1UserID ?? '', body, files ?? []);
  }

  @Post('submissions/:submissionID/withdraw')
  withdraw(
    @Req() request: P1AuthenticatedRequest,
    @Param('submissionID') submissionID: string,
  ): Promise<PublisherSubmissionDetailDto> {
    return this.publishingService.withdrawSubmission(request.p1UserID ?? '', submissionID);
  }
}
