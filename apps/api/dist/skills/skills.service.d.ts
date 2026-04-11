import { DownloadTicketResponse, PageResponse, SkillDetail, SkillSummary } from '../common/p1-contracts';
export interface SkillListQuery {
    q?: string;
    departmentID?: string;
    compatibleTool?: string;
    installed?: string;
    enabled?: string;
    accessScope?: string;
    category?: string;
    riskLevel?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
}
export interface DownloadTicketRequest {
    purpose?: 'install' | 'update';
    targetVersion?: string;
    localVersion?: string | null;
}
export declare class SkillsService {
    list(query: SkillListQuery): PageResponse<SkillSummary>;
    detail(skillID: string): SkillDetail | SkillSummary;
    downloadTicket(skillID: string, request: DownloadTicketRequest): DownloadTicketResponse;
    star(skillID: string, starred: boolean): {
        skillID: string;
        starred: boolean;
        starCount: number;
    };
    private find;
    private matches;
    private sort;
}
