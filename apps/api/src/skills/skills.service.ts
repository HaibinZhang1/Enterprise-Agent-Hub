import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DownloadTicketResponse,
  PageResponse,
  SkillDetail,
  SkillSummary,
  pageOf,
} from '../common/p1-contracts';
import { p1Skills, summarizeSkill } from '../database/p1-seed';

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

@Injectable()
export class SkillsService {
  list(query: SkillListQuery): PageResponse<SkillSummary> {
    const page = positiveInt(query.page, 1);
    const pageSize = positiveInt(query.pageSize, 20, 100);
    const summaries = p1Skills.map(summarizeSkill).filter((skill) => this.matches(skill, query));
    const sorted = this.sort(summaries, query.sort ?? 'composite', query.q);
    const start = (page - 1) * pageSize;
    return pageOf(sorted.slice(start, start + pageSize), page, pageSize, sorted.length);
  }

  detail(skillID: string): SkillDetail | SkillSummary {
    const skill = this.find(skillID);
    if (skill.detailAccess === 'none') {
      throw new ForbiddenException('当前用户无权查看该 Skill');
    }

    if (skill.detailAccess === 'summary') {
      return summarizeSkill(skill);
    }

    return skill;
  }

  downloadTicket(skillID: string, request: DownloadTicketRequest): DownloadTicketResponse {
    const skill = this.find(skillID);
    if (!skill.canInstall && !skill.canUpdate) {
      throw new ForbiddenException(skill.cannotInstallReason ?? '当前用户无权安装该 Skill');
    }
    if (skill.status === 'delisted' || skill.status === 'archived') {
      throw new ForbiddenException(skill.status === 'delisted' ? 'skill_delisted' : 'scope_restricted');
    }

    const version = request.targetVersion ?? skill.version;
    const packageRef = `pkg_${skill.skillID}_${version.replaceAll('.', '_')}`;
    return {
      skillID: skill.skillID,
      version,
      packageRef,
      packageURL: `https://internal.example/download/${packageRef}?ticket=p1-dev-ticket`,
      packageHash: 'sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      packageSize: 102400,
      packageFileCount: 12,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  star(skillID: string, starred: boolean): { skillID: string; starred: boolean; starCount: number } {
    const skill = this.find(skillID);
    const starCount = Math.max(0, skill.starCount + (starred ? 1 : -1));
    return { skillID: skill.skillID, starred, starCount };
  }

  private find(skillID: string): SkillDetail {
    const skill = p1Skills.find((candidate) => candidate.skillID === skillID);
    if (!skill) {
      throw new NotFoundException('Skill 不存在或不可见');
    }
    return skill;
  }

  private matches(skill: SkillSummary, query: SkillListQuery): boolean {
    if (query.q) {
      const haystack = [
        skill.skillID,
        skill.displayName,
        skill.description,
        skill.authorName,
        skill.authorDepartment,
        ...(skill.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query.q.toLowerCase())) {
        return false;
      }
    }
    if (query.departmentID && query.departmentID !== skill.authorDepartment) {
      return false;
    }
    if (query.compatibleTool && !skill.compatibleTools.includes(query.compatibleTool)) {
      return false;
    }
    if (query.category && query.category !== skill.category) {
      return false;
    }
    if (query.riskLevel && query.riskLevel !== skill.riskLevel) {
      return false;
    }
    if (query.installed === 'true' && skill.installState === 'not_installed') {
      return false;
    }
    if (query.enabled === 'true' && skill.installState !== 'enabled') {
      return false;
    }
    if (query.accessScope === 'authorized_only' && skill.detailAccess === 'none') {
      return false;
    }
    return true;
  }

  private sort(skills: SkillSummary[], sort: string, q?: string): SkillSummary[] {
    const copy = [...skills];
    switch (sort) {
      case 'latest_published':
      case 'recently_updated':
        return copy.sort((a, b) => b.currentVersionUpdatedAt.localeCompare(a.currentVersionUpdatedAt));
      case 'download_count':
        return copy.sort((a, b) => b.downloadCount - a.downloadCount);
      case 'star_count':
        return copy.sort((a, b) => b.starCount - a.starCount);
      case 'relevance':
      case 'composite':
      default:
        return copy.sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q));
    }
  }
}

function positiveInt(value: string | undefined, fallback: number, max = 100): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function relevanceScore(skill: SkillSummary, q?: string): number {
  const term = q?.toLowerCase();
  const ftsHit = term && `${skill.skillID} ${skill.displayName}`.toLowerCase().includes(term) ? 100 : 0;
  const statusWeight = skill.status === 'published' ? 10 : 0;
  return ftsHit + statusWeight + skill.starCount + skill.downloadCount / 10;
}
