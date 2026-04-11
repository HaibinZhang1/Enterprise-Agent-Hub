import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { DownloadTicketResponse, PageResponse, SkillDetail, SkillSummary } from '../common/p1-contracts';
import { DownloadTicketRequest, SkillListQuery, SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  list(@Query() query: SkillListQuery): PageResponse<SkillSummary> {
    return this.skillsService.list(query);
  }

  @Get(':skillID')
  detail(@Param('skillID') skillID: string): SkillDetail | SkillSummary {
    return this.skillsService.detail(skillID);
  }

  @Post(':skillID/download-ticket')
  downloadTicket(
    @Param('skillID') skillID: string,
    @Body() body: DownloadTicketRequest,
  ): DownloadTicketResponse {
    return this.skillsService.downloadTicket(skillID, body);
  }

  @Post(':skillID/star')
  star(@Param('skillID') skillID: string): { skillID: string; starred: boolean; starCount: number } {
    return this.skillsService.star(skillID, true);
  }

  @Delete(':skillID/star')
  unstar(@Param('skillID') skillID: string): { skillID: string; starred: boolean; starCount: number } {
    return this.skillsService.star(skillID, false);
  }
}
