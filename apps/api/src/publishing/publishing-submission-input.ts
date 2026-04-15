import { BadRequestException } from '@nestjs/common';
import {
  PublishScopeType,
  SubmissionType,
  VisibilityLevel,
} from '../common/p1-contracts';
import type { SubmissionInput } from './publishing.types';

export function parseSubmissionInput(body: Record<string, string | undefined>): SubmissionInput {
  const submissionType = (body.submissionType ?? 'publish') as SubmissionType;
  const skillID = (body.skillID ?? '').trim();
  const displayName = (body.displayName ?? '').trim();
  const description = (body.description ?? '').trim();
  const version = (body.version ?? '').trim();
  const visibilityLevel = (body.visibilityLevel ?? 'private') as VisibilityLevel;
  const scopeType = (body.scopeType ?? 'current_department') as PublishScopeType;
  const changelog = (body.changelog ?? '').trim();
  const category = (body.category ?? 'uncategorized').trim() || 'uncategorized';
  const tags = parseStringList(body.tags);
  const compatibleTools = parseStringList(body.compatibleTools);
  const compatibleSystems = parseStringList(body.compatibleSystems);
  const selectedDepartmentIDs = parseStringList(body.selectedDepartmentIDs);

  if (!['publish', 'update', 'permission_change'].includes(submissionType) || !skillID || !displayName || !description) {
    throw new BadRequestException('validation_failed');
  }
  if (submissionType !== 'permission_change' && (!version || !changelog)) {
    throw new BadRequestException('validation_failed');
  }
  if (!isVisibilityLevel(visibilityLevel) || !isScopeType(scopeType)) {
    throw new BadRequestException('validation_failed');
  }
  if (scopeType === 'selected_departments' && selectedDepartmentIDs.length === 0) {
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
    category,
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

function isVisibilityLevel(value: string | null | undefined): value is VisibilityLevel {
  return ['private', 'summary_visible', 'detail_visible', 'public_installable'].includes(value ?? '');
}

function isScopeType(value: string | null | undefined): value is PublishScopeType {
  return ['current_department', 'department_tree', 'selected_departments', 'all_employees'].includes(value ?? '');
}
