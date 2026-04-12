import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { DownloadTicketResponse, PageResponse, SkillDetail, SkillSummary } from '../common/p1-contracts';
import { DownloadTicketRequest, SkillListQuery, SkillsService } from './skills.service';

@Controller('skills')
@UseGuards(P1AuthGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  list(@Query() query: SkillListQuery): Promise<PageResponse<SkillSummary>> {
    return this.skillsService.list(query);
  }

  @Get(':skillID')
  detail(@Param('skillID') skillID: string): Promise<SkillDetail | SkillSummary> {
    return this.skillsService.detail(skillID);
  }

  @Post(':skillID/download-ticket')
  downloadTicket(
    @Param('skillID') skillID: string,
    @Body() body: DownloadTicketRequest,
  ): Promise<DownloadTicketResponse> {
    return this.skillsService.downloadTicket(skillID, body);
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
