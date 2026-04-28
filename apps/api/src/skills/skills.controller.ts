import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MenuPermissionGuard } from '../auth/menu-permission.guard';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { RequireMenuPermission } from '../auth/require-menu-permission.decorator';
import { DownloadTicketResponse, PageResponse, SkillDetail, SkillLeaderboardsResponse, SkillSummary } from '../common/p1-contracts';
import { DownloadTicketRequest, SkillListQuery, SkillsService } from './skills.service';

@Controller('skills')
@UseGuards(P1AuthGuard, MenuPermissionGuard)
@RequireMenuPermission('market')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  list(@Req() request: P1AuthenticatedRequest, @Query() query: SkillListQuery): Promise<PageResponse<SkillSummary>> {
    return this.skillsService.list(query, request.p1UserID ?? undefined);
  }

  @Get('leaderboards')
  leaderboards(@Req() request: P1AuthenticatedRequest): Promise<SkillLeaderboardsResponse> {
    return this.skillsService.leaderboards(request.p1UserID ?? undefined);
  }

  @Get(':skillID')
  detail(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string): Promise<SkillDetail | SkillSummary> {
    return this.skillsService.detail(skillID, request.p1UserID ?? undefined);
  }

  @Post(':skillID/download-ticket')
  downloadTicket(
    @Req() request: P1AuthenticatedRequest,
    @Param('skillID') skillID: string,
    @Body() body: DownloadTicketRequest,
  ): Promise<DownloadTicketResponse> {
    return this.skillsService.downloadTicket(skillID, body, request.p1UserID ?? undefined);
  }

  @Post(':skillID/star')
  star(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string): Promise<{ skillID: string; starred: boolean; starCount: number }> {
    return this.skillsService.star(request.p1UserID ?? '', skillID, true);
  }

  @Delete(':skillID/star')
  unstar(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string): Promise<{ skillID: string; starred: boolean; starCount: number }> {
    return this.skillsService.star(request.p1UserID ?? '', skillID, false);
  }
}
