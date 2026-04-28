import { Body, Controller, Get, Param, Patch, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import type {
  ClientUpdateReleaseSummaryDto,
  CreateClientUpdateReleaseRequestDto,
  PublishClientUpdateReleaseRequestDto,
  RegisterClientUpdateArtifactRequestDto,
  UpdateClientUpdateRolloutRequestDto,
} from '../common/p1-contracts';
import { ClientUpdatesService } from './client-updates.service';

@Controller('admin/client-updates')
@UseGuards(P1AuthGuard)
export class ClientUpdatesAdminController {
  constructor(private readonly clientUpdates: ClientUpdatesService) {}

  @Get('releases')
  list(@Req() request: P1AuthenticatedRequest): Promise<ClientUpdateReleaseSummaryDto[]> {
    return this.clientUpdates.listAdminReleases(request.p1UserID ?? '');
  }

  @Get('releases/:releaseID')
  detail(@Req() request: P1AuthenticatedRequest, @Param('releaseID') releaseID: string): Promise<ClientUpdateReleaseSummaryDto> {
    return this.clientUpdates.getAdminRelease(request.p1UserID ?? '', releaseID);
  }

  @Post('releases')
  create(
    @Req() request: P1AuthenticatedRequest,
    @Body() body: CreateClientUpdateReleaseRequestDto,
  ): Promise<ClientUpdateReleaseSummaryDto> {
    return this.clientUpdates.createAdminRelease(request.p1UserID ?? '', body);
  }

  @Post('releases/:releaseID/artifact')
  @UseInterceptors(AnyFilesInterceptor())
  registerArtifact(
    @Req() request: P1AuthenticatedRequest,
    @Param('releaseID') releaseID: string,
    @Body() body: RegisterClientUpdateArtifactRequestDto,
    @UploadedFiles() files: Array<{ originalname: string; buffer: Buffer; size: number }>,
  ): Promise<ClientUpdateReleaseSummaryDto> {
    return this.clientUpdates.registerAdminArtifact(request.p1UserID ?? '', releaseID, body, files?.[0]);
  }

  @Post('releases/:releaseID/publish')
  publish(
    @Req() request: P1AuthenticatedRequest,
    @Param('releaseID') releaseID: string,
    @Body() body: PublishClientUpdateReleaseRequestDto,
  ): Promise<ClientUpdateReleaseSummaryDto> {
    return this.clientUpdates.publishAdminRelease(request.p1UserID ?? '', releaseID, body);
  }

  @Patch('releases/:releaseID/rollout')
  rollout(
    @Req() request: P1AuthenticatedRequest,
    @Param('releaseID') releaseID: string,
    @Body() body: UpdateClientUpdateRolloutRequestDto,
  ): Promise<ClientUpdateReleaseSummaryDto> {
    return this.clientUpdates.updateAdminRollout(request.p1UserID ?? '', releaseID, body);
  }

  @Post('releases/:releaseID/pause')
  pause(@Req() request: P1AuthenticatedRequest, @Param('releaseID') releaseID: string): Promise<ClientUpdateReleaseSummaryDto> {
    return this.clientUpdates.pauseAdminRelease(request.p1UserID ?? '', releaseID);
  }

  @Post('releases/:releaseID/yank')
  yank(@Req() request: P1AuthenticatedRequest, @Param('releaseID') releaseID: string): Promise<ClientUpdateReleaseSummaryDto> {
    return this.clientUpdates.yankAdminRelease(request.p1UserID ?? '', releaseID);
  }
}
