import { BadRequestException } from '@nestjs/common';
import {
  PublishScopeType,
  SubmissionType,
  VisibilityLevel,
} from '../common/p1-contracts';
import type { SubmissionInput } from './publishing.types';

const SKILL_CATEGORIES = ['开发', '测试', '文档', '设计', '运维', '安全', '集成', '自动化', '数据', '知识', '其他'] as const;
const skillSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semverPattern = /^\d+\.\d+\.\d+$/;
const SKILL_TAGS = [
  '代码',
  '审查',
  '重构',
  '提示',
  '规范',
  '清单',
  '文档',
  '写作',
  '测试',
  '验收',
  '前端',
  '可访问',
  '设计',
  '运维',
  '值班',
  '事故',
  '安全',
  '权限',
  '集成',
  '适配',
  '自动化',
  '发布',
  '数据',
  '分析',
  '入门',
  '培训',
] as const;

export function parseSubmissionInput(body: Record<string, string | undefined>): SubmissionInput {
  const submissionType = (body.submissionType ?? 'publish') as SubmissionType;
  const skillID = (body.skillID ?? '').trim();
  const displayName = (body.displayName ?? '').trim();
  const description = (body.description ?? '').trim();
  const version = (body.version ?? '').trim();
  const visibilityLevel = (body.visibilityLevel ?? 'private') as VisibilityLevel;
  const scopeType = (body.scopeType ?? 'current_department') as PublishScopeType;
  const changelog = (body.changelog ?? '').trim();
  const category = (body.category ?? '').trim();
  const tags = uniqueStrings(parseStringList(body.tags));
  const compatibleTools = parseStringList(body.compatibleTools);
  const compatibleSystems = parseStringList(body.compatibleSystems);
  const selectedDepartmentIDs = parseStringList(body.selectedDepartmentIDs);

  if (!['publish', 'update', 'permission_change'].includes(submissionType) || !skillID || !displayName || !description) {
    throw new BadRequestException('validation_failed');
  }
  if (!skillSlugPattern.test(skillID)) {
    throw new BadRequestException('validation_failed');
  }
  if (submissionType !== 'permission_change' && (!version || !changelog)) {
    throw new BadRequestException('validation_failed');
  }
  if (submissionType !== 'permission_change' && !semverPattern.test(version)) {
    throw new BadRequestException('validation_failed');
  }
  if (!isVisibilityLevel(visibilityLevel) || !isScopeType(scopeType)) {
    throw new BadRequestException('validation_failed');
  }
  if (scopeType === 'selected_departments' && selectedDepartmentIDs.length === 0) {
    throw new BadRequestException('validation_failed');
  }
  if (submissionType !== 'permission_change' && (!isSkillCategory(category) || !isSkillTagList(tags))) {
    throw new BadRequestException('validation_failed');
  }

  return {
    submissionType,
    skillID,
    displayName,
    description,
    version,
    visibilityLevel,
    scopeType,
    selectedDepartmentIDs,
    changelog,
    category: submissionType === 'permission_change' ? category || '其他' : category,
    tags,
    compatibleTools,
    compatibleSystems,
  };
}

export function buildSubmissionSummary(input: SubmissionInput): string {
  const typeLabel =
    input.submissionType === 'publish'
      ? '首次发布'
      : input.submissionType === 'update'
        ? '更新发布'
        : '权限变更';
  return `${typeLabel}：${input.displayName}（${input.skillID}）`;
}

function parseStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Ignore JSON parse errors and fall back to CSV parsing.
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  const next: string[] = [];
  for (const value of values) {
    if (!next.includes(value)) {
      next.push(value);
    }
  }
  return next;
}

function isSkillCategory(value: string): boolean {
  return includesString(SKILL_CATEGORIES, value);
}

function isSkillTagList(values: string[]): boolean {
  if (values.length < 1 || values.length > 5) {
    return false;
  }
  return values.every((value) => includesString(SKILL_TAGS, value));
}

function includesString(values: readonly string[], value: string): boolean {
  return values.some((item) => item === value);
}

function isVisibilityLevel(value: string | null | undefined): value is VisibilityLevel {
  return ['private', 'summary_visible', 'detail_visible', 'public_installable'].includes(value ?? '');
}

function isScopeType(value: string | null | undefined): value is PublishScopeType {
  return ['current_department', 'department_tree', 'selected_departments', 'all_employees'].includes(value ?? '');
}
