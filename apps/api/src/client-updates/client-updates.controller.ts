import { Controller, Get, Param, Post, Query, Req, Res, StreamableFile, UseGuards, Body } from '@nestjs/common';
import type { Response } from 'express';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { AuthService } from '../auth/auth.service';
import type {
  ClientUpdateCheckRequestDto,
  ClientUpdateCheckResponseDto,
  ClientUpdateDownloadTicketResponseDto,
  ReportClientUpdateEventRequestDto,
  ReportClientUpdateEventResponseDto,
} from '../common/p1-contracts';
import { ClientUpdatesService } from './client-updates.service';

@Controller('client-updates')
export class ClientUpdatesController {
  constructor(
    private readonly clientUpdates: ClientUpdatesService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(P1AuthGuard)
  @Post('check')
  check(
    @Req() request: P1AuthenticatedRequest,
    @Body() body: ClientUpdateCheckRequestDto,
  ): Promise<ClientUpdateCheckResponseDto> {
    return this.clientUpdates.check(request.p1UserID ?? '', body);
  }

  @UseGuards(P1AuthGuard)
  @Post('releases/:releaseID/download-ticket')
  issueDownloadTicket(
    @Req() request: P1AuthenticatedRequest,
    @Param('releaseID') releaseID: string,
  ): Promise<ClientUpdateDownloadTicketResponseDto> {
    return this.clientUpdates.issueDownloadTicket(request.p1UserID ?? '', releaseID);
  }

  @UseGuards(P1AuthGuard)
  @Post('events')
  reportEvent(
    @Req() request: P1AuthenticatedRequest,
    @Body() body: ReportClientUpdateEventRequestDto,
  ): Promise<ReportClientUpdateEventResponseDto> {
    return this.clientUpdates.reportEvent(request.p1UserID ?? '', body);
  }

  @Get('releases/:releaseID/download')
  async download(
    @Param('releaseID') releaseID: string,
    @Query('ticket') ticket: string | undefined,
    @Req() request: P1AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const requesterUserID = await this.resolveRequesterUserID(request.header('authorization'));
    const file = await this.clientUpdates.downloadRelease(releaseID, ticket, requesterUserID);
    response.set({
      'content-type': 'application/octet-stream',
      'content-length': String(file.contentLength),
      'content-disposition': `attachment; filename="${file.fileName}"`,
      'cache-control': 'private, max-age=600',
    });
    return new StreamableFile(file.stream);
  }

  private async resolveRequesterUserID(authorization: string | undefined): Promise<string | null> {
    const [scheme, token] = (authorization ?? '').split(/\s+/, 2);
    if (scheme !== 'Bearer' || !token?.startsWith('p1-session:')) {
      return null;
    }
    try {
      const session = await this.authService.authenticateAccessToken(token.slice('p1-session:'.length));
      return session.userID;
    } catch {
      return null;
    }
  }
}
