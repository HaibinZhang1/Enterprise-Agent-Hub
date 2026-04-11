"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsService = void 0;
const common_1 = require("@nestjs/common");
const p1_contracts_1 = require("../common/p1-contracts");
const p1_seed_1 = require("../database/p1-seed");
let SkillsService = class SkillsService {
    list(query) {
        const page = positiveInt(query.page, 1);
        const pageSize = positiveInt(query.pageSize, 20, 100);
        const summaries = p1_seed_1.p1Skills.map(p1_seed_1.summarizeSkill).filter((skill) => this.matches(skill, query));
        const sorted = this.sort(summaries, query.sort ?? 'composite', query.q);
        const start = (page - 1) * pageSize;
        return (0, p1_contracts_1.pageOf)(sorted.slice(start, start + pageSize), page, pageSize, sorted.length);
    }
    detail(skillID) {
        const skill = this.find(skillID);
        if (skill.detailAccess === 'none') {
            throw new common_1.ForbiddenException('当前用户无权查看该 Skill');
        }
        if (skill.detailAccess === 'summary') {
            return (0, p1_seed_1.summarizeSkill)(skill);
        }
        return skill;
    }
    downloadTicket(skillID, request) {
        const skill = this.find(skillID);
        if (!skill.canInstall && !skill.canUpdate) {
            throw new common_1.ForbiddenException(skill.cannotInstallReason ?? '当前用户无权安装该 Skill');
        }
        if (skill.status === 'delisted' || skill.status === 'archived') {
            throw new common_1.ForbiddenException(skill.status === 'delisted' ? 'skill_delisted' : 'scope_restricted');
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
    star(skillID, starred) {
        const skill = this.find(skillID);
        const starCount = Math.max(0, skill.starCount + (starred ? 1 : -1));
        return { skillID: skill.skillID, starred, starCount };
    }
    find(skillID) {
        const skill = p1_seed_1.p1Skills.find((candidate) => candidate.skillID === skillID);
        if (!skill) {
            throw new common_1.NotFoundException('Skill 不存在或不可见');
        }
        return skill;
    }
    matches(skill, query) {
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
    sort(skills, sort, q) {
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
};
exports.SkillsService = SkillsService;
exports.SkillsService = SkillsService = __decorate([
    (0, common_1.Injectable)()
], SkillsService);
function positiveInt(value, fallback, max = 100) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
}
function relevanceScore(skill, q) {
    const term = q?.toLowerCase();
    const ftsHit = term && `${skill.skillID} ${skill.displayName}`.toLowerCase().includes(term) ? 100 : 0;
    const statusWeight = skill.status === 'published' ? 10 : 0;
    return ftsHit + statusWeight + skill.starCount + skill.downloadCount / 10;
}
