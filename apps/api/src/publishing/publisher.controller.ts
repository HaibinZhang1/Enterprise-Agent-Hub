import { Body, Controller, Get, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { MenuPermissionGuard } from '../auth/menu-permission.guard';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { RequireMenuPermission } from '../auth/require-menu-permission.decorator';
import { PublisherSkillSummaryDto, PublisherSubmissionDetailDto } from '../common/p1-contracts';
import { PublishingService } from './publishing.service';

@Controller('publisher')
@UseGuards(P1AuthGuard, MenuPermissionGuard)
@RequireMenuPermission('my_installed')
export class PublisherController {
  constructor(private readonly publishingService: PublishingService) {}

  @Get('skills')
  listSkills(@Req() request: P1AuthenticatedRequest): Promise<PublisherSkillSummaryDto[]> {
    return this.publishingService.listPublisherSkills(request.p1UserID ?? '');
  }

  @Get('submissions/:submissionID')
  detail(
    @Req() request: P1AuthenticatedRequest,
    @Param('submissionID') submissionID: string,
  ): Promise<PublisherSubmissionDetailDto> {
    return this.publishingService.getPublisherSubmission(request.p1UserID ?? '', submissionID);
  }

  @Post('submissions')
  @UseInterceptors(AnyFilesInterceptor())
  submit(
    @Req() request: P1AuthenticatedRequest,
    @Body() body: Record<string, string | undefined>,
    @UploadedFiles() files: Array<{ originalname: string; buffer: Buffer; size: number }>,
  ): Promise<PublisherSubmissionDetailDto> {
    return this.publishingService.submitSubmission(request.p1User!, body, files ?? []);
  }

  @Post('submissions/:submissionID/withdraw')
  withdraw(
    @Req() request: P1AuthenticatedRequest,
    @Param('submissionID') submissionID: string,
  ): Promise<PublisherSubmissionDetailDto> {
    return this.publishingService.withdrawSubmission(request.p1UserID ?? '', submissionID);
  }
}
