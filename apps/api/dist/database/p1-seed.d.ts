import { NotificationDto, SkillDetail, SkillSummary, UserSummary } from '../common/p1-contracts';
export declare const p1User: UserSummary;
export declare const p1Skills: SkillDetail[];
export declare const p1Notifications: NotificationDto[];
export declare function summarizeSkill(skill: SkillDetail): SkillSummary;
