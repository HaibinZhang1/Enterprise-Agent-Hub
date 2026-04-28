import type {
  PublishScopeType,
  ReviewDecision,
  ReviewPrecheckItemDto,
  ReviewStatus,
  ReviewType,
  SkillStatus,
  SubmissionType,
  UserSummary,
  VisibilityLevel,
  WorkflowState
} from "../common/p1-contracts";

export interface ActorContext {
  userID: string;
  displayName: string;
  role: "normal_user" | "admin";
  adminLevel: number | null;
  departmentID: string;
  departmentName: string;
  departmentPath: string;
}

export interface DepartmentRow {
  department_id: string;
  parent_id: string | null;
  path: string;
  level: number;
}

export interface SkillRecord {
  id: string;
  skill_id: string;
  display_name: string;
  description: string;
  author_id: string | null;
  department_id: string | null;
  status: SkillStatus;
  visibility_level: VisibilityLevel;
  category: string | null;
  version: string | null;
  current_version_id: string | null;
  current_package_id: string | null;
  current_package_bucket: string | null;
  current_package_object_key: string | null;
  current_package_hash: string | null;
  current_package_size_bytes: number | null;
  current_package_file_count: number | null;
  scope_type: PublishScopeType | null;
  scope_department_ids: string[] | null;
  compatible_tools: string[] | null;
  compatible_systems: string[] | null;
  tags: string[] | null;
}

export interface SubmissionPayload {
  description: string;
  changelog: string;
  category: string;
  tags: string[];
  compatibleTools: string[];
  compatibleSystems: string[];
  packageSize?: number;
  packageFileCount?: number;
}

export interface ReviewRecord {
  review_id: string;
  skill_id: string;
  skill_display_name: string;
  submitter_id: string;
  submitter_name: string;
  submitter_department_id: string;
  submitter_department_name: string;
  submitter_department_path: string;
  submitter_parent_department_id: string | null;
  submitter_role: "normal_user" | "admin";
  submitter_admin_level: number | null;
  review_type: ReviewType;
  review_status: ReviewStatus;
  workflow_state: WorkflowState;
  claimed_from_workflow_state: Extract<WorkflowState, "manual_precheck" | "pending_review"> | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  summary: string;
  description: string;
  review_summary: string | null;
  current_reviewer_name: string | null;
  lock_owner_id: string | null;
  lock_expires_at: Date | null;
  requested_version: string | null;
  requested_visibility_level: VisibilityLevel | null;
  requested_scope_type: PublishScopeType | null;
  staged_package_bucket: string | null;
  staged_package_object_key: string | null;
  staged_package_sha256: string | null;
  staged_package_size_bytes: number | null;
  staged_package_file_count: number | null;
  decision: ReviewDecision | null;
  submission_payload: SubmissionPayload;
  precheck_results: ReviewPrecheckItemDto[] | null;
  requested_department_ids: string[] | null;
  current_version: string | null;
  current_status: SkillStatus | null;
  current_visibility_level: VisibilityLevel | null;
  current_scope_type: PublishScopeType | null;
  current_scope_department_ids: string[] | null;
  current_package_id: string | null;
  current_package_bucket: string | null;
  current_package_object_key: string | null;
  current_package_hash: string | null;
  current_package_size_bytes: number | null;
  current_package_file_count: number | null;
  submitted_at: Date;
  updated_at: Date;
}

export interface SubmissionInput {
  submissionType: SubmissionType;
  skillID: string;
  displayName: string;
  description: string;
  version: string;
  visibilityLevel: VisibilityLevel;
  scopeType: PublishScopeType;
  selectedDepartmentIDs: string[];
  changelog: string;
  category: string;
  tags: string[];
  compatibleTools: string[];
  compatibleSystems: string[];
}

export interface StagedPackageRecord {
  bucket: string;
  objectKey: string;
  sha256: string;
  sizeBytes: number;
  fileCount: number;
}

export type UploadedSubmissionFile = { originalname: string; buffer: Buffer; size: number };

export type PublisherUser = UserSummary;
