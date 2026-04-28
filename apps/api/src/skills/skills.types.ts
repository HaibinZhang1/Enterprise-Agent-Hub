import type { Readable } from 'node:stream';
import type { DetailAccess, RiskLevel, SkillStatus, VisibilityLevel } from '../common/p1-contracts';

export interface SkillListQuery {
  q?: string;
  departmentID?: string;
  compatibleTool?: string;
  installed?: string;
  enabled?: string;
  accessScope?: string;
  category?: string;
  tags?: string;
  riskLevel?: string;
  publishedSince?: string;
  updatedSince?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

export interface DownloadTicketRequest {
  purpose?: 'install' | 'update';
  targetVersion?: string;
  localVersion?: string | null;
}

export interface SkillRow {
  id: string;
  skill_id: string;
  display_name: string;
  description: string;
  status: SkillStatus;
  visibility_level: VisibilityLevel;
  category: string | null;
  updated_at: Date | string;
  version: string;
  risk_level: string | null;
  risk_description: string | null;
  review_summary: string | null;
  published_at: Date | string;
  author_name: string | null;
  author_department: string | null;
  tags: string[] | null;
  compatible_tools: string[] | null;
  compatible_systems: string[] | null;
  scope_type: 'current_department' | 'department_tree' | 'selected_departments' | 'all_employees' | null;
  scope_department_ids: string[] | null;
  scope_department_paths: string[] | null;
  star_count: string;
  starred: boolean;
  download_count: string;
}

export interface ListedSkillRow extends SkillRow {
  total_count: string;
}

export interface SkillLeaderboardRow extends SkillRow {
  recent_star_count: string;
  recent_download_count: string;
  hot_score: string;
}

export interface PackageRow {
  id: string;
  skill_id: string;
  version: string;
  bucket: string;
  sha256: string;
  size_bytes: number;
  file_count: number;
  object_key: string;
  content_type: string;
}

export interface SkillVersionRow {
  version: string;
  changelog: string | null;
  risk_level: RiskLevel | null;
  published_at: Date | string;
}

export interface DownloadablePackage {
  stream: Readable;
  contentType: string;
  contentLength: number;
  fileName: string;
}

export interface RequesterScope {
  user_id: string;
  department_id: string;
  department_path: string;
}

export interface PackageDownloadTicketRow {
  ticket: string;
  package_ref: string;
  user_id: string | null;
  purpose: 'published' | 'staged';
  requires_auth: boolean;
  expires_at: Date;
}

export interface SkillListQueryPlan {
  page: number;
  pageSize: number;
  text: string;
  values: unknown[];
}

export interface SkillLeaderboardQueryPlan {
  text: string;
  values: unknown[];
}

export interface SkillAuthorization {
  isAuthorized: boolean;
  detailAccess: DetailAccess;
}
