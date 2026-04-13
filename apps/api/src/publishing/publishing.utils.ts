import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { PublishScopeType, ReviewPrecheckItemDto, VisibilityLevel } from '../common/p1-contracts';

export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  allowedTools?: string[];
}

export function parseSimpleFrontmatter(source: string): ParsedFrontmatter {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return {};
  }

  const block = match[1];
  const lines = block.split('\n');
  const parsed: ParsedFrontmatter = {};
  let currentListKey: 'allowedTools' | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }
    if (currentListKey && /^\s*-\s+/.test(rawLine)) {
      const value = rawLine.replace(/^\s*-\s+/, '').trim();
      if (!parsed[currentListKey]) {
        parsed[currentListKey] = [];
      }
      parsed[currentListKey]!.push(value);
      continue;
    }
    currentListKey = null;

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) {
      continue;
    }
    const [, key, value] = pair;
    if (key === 'name') {
      parsed.name = value.trim();
    } else if (key === 'description') {
      parsed.description = value.trim();
    } else if (key === 'allowed-tools') {
      currentListKey = 'allowedTools';
      if (value.trim()) {
        parsed.allowedTools = value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        currentListKey = null;
      }
    }
  }
  return parsed;
}

export function normalizeRelativeUploadPath(value: string): string {
  const trimmed = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const collapsed = normalize(trimmed).replace(/\\/g, '/');
  if (!collapsed || collapsed.startsWith('..') || collapsed.includes('/../') || collapsed === '.') {
    throw new Error(`invalid relative upload path: ${value}`);
  }
  return collapsed;
}

export function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value.trim());
}

export function compareSemver(left: string, right: string): number {
  const leftParts = left.split('.').map((item) => Number.parseInt(item, 10));
  const rightParts = right.split('.').map((item) => Number.parseInt(item, 10));
  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export function visibilityRank(level: VisibilityLevel): number {
  switch (level) {
    case 'private':
      return 0;
    case 'summary_visible':
      return 1;
    case 'detail_visible':
      return 2;
    case 'public_installable':
      return 3;
  }
}

export function scopeRank(scope: PublishScopeType): number {
  switch (scope) {
    case 'current_department':
      return 0;
    case 'selected_departments':
      return 1;
    case 'department_tree':
      return 2;
    case 'all_employees':
      return 3;
  }
}

export function isPermissionExpansion(input: {
  currentVisibilityLevel: VisibilityLevel;
  currentScopeType: PublishScopeType;
  nextVisibilityLevel: VisibilityLevel;
  nextScopeType: PublishScopeType;
  currentSelectedDepartmentIDs?: string[];
  nextSelectedDepartmentIDs?: string[];
}): boolean {
  if (visibilityRank(input.nextVisibilityLevel) > visibilityRank(input.currentVisibilityLevel)) {
    return true;
  }
  if (scopeRank(input.nextScopeType) > scopeRank(input.currentScopeType)) {
    return true;
  }
  if (input.currentScopeType === 'selected_departments' && input.nextScopeType === 'selected_departments') {
    const current = new Set(input.currentSelectedDepartmentIDs ?? []);
    return (input.nextSelectedDepartmentIDs ?? []).some((departmentID) => !current.has(departmentID));
  }
  return false;
}

export function createManifestJson(input: {
  skillID: string;
  displayName: string;
  description: string;
  version: string;
  visibilityLevel: VisibilityLevel;
  scopeType: PublishScopeType;
  selectedDepartmentIDs: string[];
  compatibleTools: string[];
  compatibleSystems: string[];
  tags: string[];
  category: string;
}): string {
  return `${JSON.stringify(
    {
      skillID: input.skillID,
      displayName: input.displayName,
      description: input.description,
      version: input.version,
      visibilityLevel: input.visibilityLevel,
      scopeType: input.scopeType,
      selectedDepartmentIDs: input.selectedDepartmentIDs,
      compatibleTools: input.compatibleTools,
      compatibleSystems: input.compatibleSystems,
      tags: input.tags,
      category: input.category,
    },
    null,
    2,
  )}\n`;
}

export async function collectDirectoryFileCount(rootDir: string): Promise<number> {
  const queue = [rootDir];
  let count = 0;
  while (queue.length > 0) {
    const current = queue.pop()!;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(next);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }
  return count;
}

export function sha256WithPrefix(buffer: Buffer): string {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

export function buildPrecheckItems(input: {
  hasSkillMd: boolean;
  frontmatterNameMatches: boolean;
  versionValid: boolean;
  versionIncrementValid: boolean;
  sizeValid: boolean;
  fileCountValid: boolean;
  visibilityValid: boolean;
  scopeValid: boolean;
  warnings: string[];
}): ReviewPrecheckItemDto[] {
  const items: ReviewPrecheckItemDto[] = [
    {
      id: 'skill-md',
      label: '存在 SKILL.md',
      status: input.hasSkillMd ? 'pass' : 'warn',
      message: input.hasSkillMd ? '已识别到入口文件 SKILL.md。' : '缺少 SKILL.md，需人工复核。',
    },
    {
      id: 'frontmatter-name',
      label: 'frontmatter 名称一致',
      status: input.frontmatterNameMatches ? 'pass' : 'warn',
      message: input.frontmatterNameMatches
        ? 'frontmatter 中的 name 与 skillID 一致或未声明。'
        : 'frontmatter 中的 name 与提交 skillID 不一致，需人工复核。',
    },
    {
      id: 'semver',
      label: '版本号合法',
      status: input.versionValid ? 'pass' : 'warn',
      message: input.versionValid ? '版本号符合 x.y.z 规范。' : '版本号不符合 x.y.z 规范，需人工复核。',
    },
    {
      id: 'version-order',
      label: '版本递增',
      status: input.versionIncrementValid ? 'pass' : 'warn',
      message: input.versionIncrementValid ? '提交版本高于当前已发布版本。' : '提交版本未高于当前版本，需人工复核。',
    },
    {
      id: 'size',
      label: '包体积限制',
      status: input.sizeValid ? 'pass' : 'warn',
      message: input.sizeValid ? '包体积不超过 5MB。' : '包体积超过 5MB，需人工复核。',
    },
    {
      id: 'file-count',
      label: '文件数量限制',
      status: input.fileCountValid ? 'pass' : 'warn',
      message: input.fileCountValid ? '文件数量不超过 100。' : '文件数量超过 100，需人工复核。',
    },
    {
      id: 'visibility',
      label: '公开级别有效',
      status: input.visibilityValid ? 'pass' : 'warn',
      message: input.visibilityValid ? '公开级别字段有效。' : '公开级别字段非法，需人工复核。',
    },
    {
      id: 'scope',
      label: '授权范围有效',
      status: input.scopeValid ? 'pass' : 'warn',
      message: input.scopeValid ? '授权范围字段有效。' : '授权范围字段非法，需人工复核。',
    },
  ];
  for (const [index, warning] of input.warnings.entries()) {
    items.push({
      id: `warning-${index + 1}`,
      label: `人工复核 ${index + 1}`,
      status: 'warn',
      message: warning,
    });
  }
  return items;
}

export function hasWarnings(items: ReviewPrecheckItemDto[]): boolean {
  return items.some((item) => item.status === 'warn');
}

export function readSkillMarkdown(skillDir: string): string {
  return readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
}

export async function statSize(path: string): Promise<number> {
  return (await stat(path)).size;
}
