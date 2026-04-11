import { DownloadTicketResponse, PageResponse, SkillDetail, SkillSummary } from '../common/p1-contracts';
import { DownloadTicketRequest, SkillListQuery, SkillsService } from './skills.service';
export declare class SkillsController {
    private readonly skillsService;
    constructor(skillsService: SkillsService);
    list(query: SkillListQuery): PageResponse<SkillSummary>;
    detail(skillID: string): SkillDetail | SkillSummary;
    downloadTicket(skillID: string, body: DownloadTicketRequest): DownloadTicketResponse;
    star(skillID: string): {
        skillID: string;
        starred: boolean;
        starCount: number;
    };
    unstar(skillID: string): {
        skillID: string;
        starred: boolean;
        starCount: number;
    };
}
