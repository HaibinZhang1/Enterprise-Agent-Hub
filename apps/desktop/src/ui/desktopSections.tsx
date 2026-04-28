import type { ChangeEvent, Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  AlertTriangle,
  Building2,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  Download,
  FolderPlus,
  Link2,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Upload,
  Users,
  X
} from "lucide-react";
import type { AdminSkill, ClientUpdateReleaseSummary, DiscoveredLocalSkill, ExtensionInstall, MarketFilters, PluginTarget, PublishDraft, PublisherSkillSummary, PublisherSubmissionDetail, PublishScopeType, ReviewDetail, RiskLevel, SkillLeaderboardItem, SkillSummary } from "../domain/p1.ts";
import { SKILL_CATEGORIES, SKILL_TAGS } from "../domain/p1.ts";
import { buildPublishPrecheck } from "../state/ui/publishPrecheck.ts";
import { buildCommunityExploreFilters, canAccessClientUpdateManagement, type DesktopUIState } from "../state/useDesktopUIState.ts";
import type { P1WorkspaceState } from "../state/useP1Workspace.ts";
import { downloadAuthenticatedFile } from "../services/p1Client.ts";
import { isCommunityVisibleSkill } from "../state/p1WorkspaceHelpers.ts";
import {
  deriveDepartmentWorkbench,
  filterAdminUsers,
  getAdminSkillCategory,
  getAdminSkillDescription,
  getAdminSkillReviewSummary,
  getAdminSkillRiskLevel,
  getAdminUserDepartmentPath,
  getAdminUserLastLoginAt,
  getDepartmentAdminCount,
  type AdminUserRoleFilter,
  type AdminUserStatusFilter
} from "../state/ui/adminManageSelectors.ts";
import { COMMUNITY_LEADERBOARD_LIMIT, deriveCommunityLeaderboards } from "../state/ui/communityLeaderboards.ts";
import {
  displayNameFromSkillName,
  isSkillMarkdownPath,
  isZipPath,
  parseSkillFrontmatter,
  readSkillMarkdownFromUploadEntries,
  validateUploadEntries,
  validateSkillSlug,
  type UploadEntry
} from "../state/ui/publishPackageIntrospection.ts";
import {
  compareToolsByAvailability,
  matchesDiscoveredTargetFilter
} from "../state/ui/installedSkillSelectors.ts";
import {
  adapterStatusLabel,
  flattenDepartments,
  formatDate,
  projectPathStatusLabel,
  publishVisibilityLabel,
  riskLabel,
  roleLabel,
  skillInitials,
  scopeLabel,
  statusLabel,
  statusTone,
  submissionTypeLabel,
  transformStrategyLabel,
  workflowStateLabel
} from "./desktopShared.tsx";
import { iconToneForLabel } from "./iconTone.ts";
import { shouldCloseFromBackdropPointerDown } from "./modalInteraction.ts";
import { AuthGateCard, InitialBadge, PackagePreviewPanel, SectionEmpty, SectionProps, SelectField, TagPill } from "./pageCommon.tsx";
import { passwordPolicyHint, validatePasswordPolicy } from "../utils/passwordPolicy.ts";
import { phoneNumberFormatHint, sanitizePhoneNumberInput, validatePhoneNumber } from "../utils/phoneNumber.ts";

function formatMetricCount(value: number, language: "zh-CN" | "en-US") {
  return new Intl.NumberFormat(language, {
    notation: value >= 1000 ? "compact" : "standard",
    compactDisplay: "short",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function isScanningLocalTargets(workspace: P1WorkspaceState) {
  return workspace.progress?.operation === "scan" && workspace.progress.result === "running";
}

function ScanLocalTargetsButton({
  workspace,
  className = "btn",
  label = "扫描"
}: {
  workspace: P1WorkspaceState;
  className?: string;
  label?: string;
}) {
  const scanning = isScanningLocalTargets(workspace);
  const buttonClassName = [className, scanning ? "is-busy" : ""].filter(Boolean).join(" ");
  return (
    <button className={buttonClassName} type="button" onClick={() => void workspace.scanLocalTargets()} disabled={scanning} aria-busy={scanning}>
      <RefreshCw size={14} />
      {scanning ? "扫描中..." : label}
    </button>
  );
}

type UnifiedSkillTone = "neutral" | "success" | "warning" | "danger" | "info";

type UnifiedSkillView = {
  skillID: string;
  displayName: string;
  description: string;
  iconLabel: string;
  statusLabel: string;
  statusTone: UnifiedSkillTone;
  versionLabel: string;
  categoryLabel?: string;
  ownerLabel?: string;
  departmentLabel?: string;
  updatedAt?: string | null;
  visibilityLabel?: string;
  scopeLabel?: string;
  riskLabel?: string;
  riskTone?: UnifiedSkillTone;
  reviewSummary?: string;
  rowMeta: string[];
  metrics: string[];
};

function visibilityShortLabel(visibility: PublishDraft["visibility"] | null | undefined, language: "zh-CN" | "en-US") {
  return visibility ? publishVisibilityLabel(visibility, language) : "未设置";
}

function scopeShortLabel(scope: PublishScopeType | null | undefined, language: "zh-CN" | "en-US") {
  return scope ? scopeLabel(scope, language) : "未设置";
}

function adminSkillView(skill: AdminSkill, language: "zh-CN" | "en-US"): UnifiedSkillView {
  const risk = getAdminSkillRiskLevel(skill);
  return {
    skillID: skill.skillID,
    displayName: skill.displayName,
    description: getAdminSkillDescription(skill),
    iconLabel: skill.displayName,
    statusLabel: manageSkillStatusLabel(skill.status),
    statusTone: skill.status === "published" ? "success" : skill.status === "delisted" ? "warning" : "neutral",
    versionLabel: `v${skill.version}`,
    categoryLabel: getAdminSkillCategory(skill),
    ownerLabel: skill.publisherName,
    departmentLabel: skill.departmentName,
    updatedAt: skill.updatedAt,
    visibilityLabel: visibilityShortLabel(skill.visibilityLevel, language),
    riskLabel: manageRiskLabel(risk),
    riskTone: manageRiskTone(risk),
    reviewSummary: getAdminSkillReviewSummary(skill),
    rowMeta: [skill.publisherName, skill.departmentName, `v${skill.version}`],
    metrics: [`Star ${formatMetricCount(skill.starCount, language)}`, `下载 ${formatMetricCount(skill.downloadCount, language)}`]
  };
}

function localSkillView(skill: SkillSummary, ui: DesktopUIState): UnifiedSkillView {
  const issues = ui.installedView.installedSkillIssuesByID[skill.skillID] ?? [];
  return {
    skillID: skill.skillID,
    displayName: skill.displayName,
    description: skill.description,
    iconLabel: skill.displayName,
    statusLabel: statusLabel(skill, ui.language),
    statusTone: statusTone(skill),
    versionLabel: skill.localVersion ? `本地 v${skill.localVersion}` : `v${skill.version}`,
    categoryLabel: skill.category,
    ownerLabel: skill.authorName,
    departmentLabel: skill.authorDepartment,
    updatedAt: skill.currentVersionUpdatedAt,
    visibilityLabel: visibilityShortLabel(skill.visibilityLevel, ui.language),
    riskLabel: riskLabel(skill, ui.language),
    riskTone: skill.riskLevel === "high" ? "danger" : skill.riskLevel === "medium" ? "warning" : "info",
    reviewSummary: issues[0] ?? skill.reviewSummary ?? skill.readme ?? "从这里处理更新、启用范围和卸载动作。",
    rowMeta: [
      skill.authorName,
      skill.authorDepartment,
      skill.localVersion ? `本地 v${skill.localVersion}` : `远端 v${skill.version}`
    ].filter(Boolean) as string[],
    metrics: [`目标 ${skill.enabledTargets.length}`, formatDate(skill.currentVersionUpdatedAt, ui.language)]
  };
}

function discoveredSkillStatus(skill: DiscoveredLocalSkill): { label: string; tone: UnifiedSkillTone } {
  if (skill.hasCentralStoreConflict || skill.hasScanConflict) return { label: "同名冲突", tone: "warning" };
  if (skill.targets.some((target) => target.findingKind === "conflict")) return { label: "冲突副本", tone: "warning" };
  if (skill.targets.some((target) => target.findingKind === "orphan")) return { label: "孤儿副本", tone: "danger" };
  return skill.canImport ? { label: "可纳入管理", tone: "info" } : { label: "未托管", tone: "info" };
}

function discoveredSkillView(skill: DiscoveredLocalSkill): UnifiedSkillView {
  const status = discoveredSkillStatus(skill);
  const targetNames = [...new Set(skill.targets.map((target) => target.targetName))];
  return {
    skillID: skill.skillID,
    displayName: skill.displayName,
    description: skill.description,
    iconLabel: skill.displayName,
    statusLabel: status.label,
    statusTone: status.tone,
    versionLabel: `扫描 v${skill.version}`,
    reviewSummary: skill.targets[0]?.message ?? skill.description,
    rowMeta: [targetNames.slice(0, 2).join(" / "), skill.matchedMarketSkill ? "社区有同名 Skill" : "仅本地发现"].filter(Boolean),
    metrics: []
  };
}

function extensionTypeLabel(type: ExtensionInstall["extensionType"]) {
  return {
    skill: "Skill",
    mcp_server: "MCP Server",
    plugin: "Plugin",
    hook: "Hook",
    agent_cli: "Agent CLI"
  }[type] ?? type;
}

function extensionKindLabel(kind: ExtensionInstall["extensionKind"]) {
  return {
    file_backed: "可写文件型",
    config_backed: "配置型",
    native_plugin: "原生插件",
    agent_cli: "CLI"
  }[kind] ?? kind;
}

function extensionAuditLabel(status: ExtensionInstall["auditStatus"]) {
  return {
    unknown: "审计未知",
    pending: "待审计",
    passed: "审计通过",
    warning: "审计警告",
    failed: "审计失败"
  }[status] ?? status;
}

function extensionEnterpriseLabel(status: ExtensionInstall["enterpriseStatus"]) {
  return {
    allowed: "企业允许",
    disabled: "企业禁用",
    revoked: "企业撤销"
  }[status] ?? status;
}

function extensionTone(extension: ExtensionInstall): UnifiedSkillTone {
  if (extension.enterpriseStatus === "revoked") return "danger";
  if (extension.enterpriseStatus === "disabled") return "warning";
  if (!extension.writeCapability) return "info";
  return extension.targets.some((target) => target.status === "enabled") ? "success" : "neutral";
}

function extensionView(extension: ExtensionInstall): UnifiedSkillView {
  const enabledTargets = extension.targets.filter((target) => target.status === "enabled");
  const statusLabel = extension.enterpriseStatus !== "allowed"
    ? extensionEnterpriseLabel(extension.enterpriseStatus)
    : extension.writeCapability
      ? "可启用"
      : "仅审计/预检";
  return {
    skillID: extension.extensionID,
    displayName: extension.displayName,
    description: extension.manifest.description ?? `${extensionTypeLabel(extension.extensionType)} 本地扩展。`,
    iconLabel: extension.displayName,
    statusLabel,
    statusTone: extensionTone(extension),
    versionLabel: `本地 v${extension.localVersion}`,
    categoryLabel: extensionTypeLabel(extension.extensionType),
    ownerLabel: extension.sourceType === "local_import" ? "本地导入" : "Central Store",
    departmentLabel: extensionKindLabel(extension.extensionKind),
    updatedAt: extension.updatedAt,
    riskLabel: riskLabel({ riskLevel: extension.riskLevel } as SkillSummary, "zh-CN"),
    riskTone: extension.riskLevel === "high" ? "danger" : extension.riskLevel === "medium" ? "warning" : "info",
    reviewSummary: `${extensionAuditLabel(extension.auditStatus)} · ${extensionEnterpriseLabel(extension.enterpriseStatus)}`,
    rowMeta: [
      extensionKindLabel(extension.extensionKind),
      extension.sourceType === "local_import" ? "本地导入" : extension.sourceType,
      extension.writeCapability ? "可启用" : "仅审计/预检"
    ],
    metrics: [`目标 ${enabledTargets.length}`, extensionAuditLabel(extension.auditStatus)]
  };
}

function publisherSkillView(skill: PublisherSkillSummary, selectedSubmission: PublisherSubmissionDetail | null, language: "zh-CN" | "en-US"): UnifiedSkillView {
  const statusText = skill.latestWorkflowState
    ? workflowStateLabel(skill.latestWorkflowState, language)
    : skill.currentStatus
      ? manageSkillStatusLabel(skill.currentStatus)
      : "暂无提交";
  const statusToneValue: UnifiedSkillTone =
    skill.latestWorkflowState === "published" || skill.currentStatus === "published"
      ? "success"
      : skill.latestWorkflowState === "returned_for_changes" || skill.latestWorkflowState === "review_rejected" || skill.currentStatus === "delisted"
        ? "warning"
        : "info";
  const version = skill.currentVersion ?? skill.latestRequestedVersion ?? selectedSubmission?.version ?? "未发布";
  return {
    skillID: skill.skillID,
    displayName: skill.displayName,
    description: selectedSubmission?.description ?? skill.latestReviewSummary ?? "选择发布记录查看包内容、审核状态和下一步动作。",
    iconLabel: skill.displayName,
    statusLabel: statusText,
    statusTone: statusToneValue,
    versionLabel: version === "未发布" ? version : `v${version}`,
    categoryLabel: submissionTypeLabel(skill.latestSubmissionType ?? selectedSubmission?.submissionType ?? "publish", language),
    updatedAt: skill.updatedAt,
    visibilityLabel: visibilityShortLabel(skill.currentVisibilityLevel ?? skill.latestRequestedVisibilityLevel ?? selectedSubmission?.visibilityLevel, language),
    scopeLabel: scopeShortLabel(skill.currentScopeType ?? skill.latestRequestedScopeType ?? selectedSubmission?.scopeType, language),
    reviewSummary: skill.latestReviewSummary ?? selectedSubmission?.reviewSummary ?? "当前发布记录可继续查看详情、发起新版本或调整权限。",
    rowMeta: [
      skill.currentVersion ? `当前 v${skill.currentVersion}` : "未发布",
      skill.submittedAt ? `提交 ${formatDate(skill.submittedAt, language)}` : "暂无提交"
    ],
    metrics: [visibilityShortLabel(skill.currentVisibilityLevel ?? skill.latestRequestedVisibilityLevel, language), formatDate(skill.updatedAt, language)]
  };
}

function UnifiedSkillRow({
  view,
  active,
  onSelect,
  actions
}: {
  view: UnifiedSkillView;
  active: boolean;
  onSelect: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <article
      className={active ? "local-item unified-skill-row active" : "local-item unified-skill-row"}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <InitialBadge label={view.iconLabel} />
      <div className="list-row-copy">
        <strong>{view.displayName}</strong>
        <p>{view.description}</p>
        <div className="meta-strip">
          {view.categoryLabel ? <span className="metric-chip">{view.categoryLabel}</span> : null}
          {view.rowMeta.map((item) => <span className="metric-chip" key={item}>{item}</span>)}
          <span className={`status-chip ${view.statusTone}`}>{view.statusLabel}</span>
        </div>
      </div>
      <div className="skill-side">
        {actions ? <div className="skill-actions">{actions}</div> : null}
        <div className="metric-row compact">
          {view.metrics.map((item) => <span className="metric-chip" key={item}>{item}</span>)}
        </div>
      </div>
    </article>
  );
}

function UnifiedSkillInspector({
  view,
  actions,
  dangerActions,
  children,
  as = "aside",
  className = "",
  kicker = "Skill 简介"
}: {
  view: UnifiedSkillView;
  actions?: React.ReactNode;
  dangerActions?: React.ReactNode;
  children?: React.ReactNode;
  as?: "aside" | "section";
  className?: string;
  kicker?: string;
}) {
  const content = (
    <>
      <div className="detail-block">
        <div className="inspector-kicker">{kicker}</div>
        <strong>{view.displayName}</strong>
        <small>{view.skillID} · {view.versionLabel}</small>
        <p>{view.description}</p>
      </div>
      <div className="pill-row">
        <TagPill tone={view.statusTone}>{view.statusLabel}</TagPill>
        {view.riskLabel ? <TagPill tone={view.riskTone ?? "info"}>{view.riskLabel}</TagPill> : null}
        {view.categoryLabel ? <TagPill tone="neutral">{view.categoryLabel}</TagPill> : null}
      </div>
      <div className="definition-grid split">
        {view.ownerLabel ? <div><dt>发布者</dt><dd>{view.ownerLabel}</dd></div> : null}
        {view.departmentLabel ? <div><dt>部门</dt><dd>{view.departmentLabel}</dd></div> : null}
        {view.visibilityLabel ? <div><dt>公开级别</dt><dd>{view.visibilityLabel}</dd></div> : null}
        {view.scopeLabel ? <div><dt>授权范围</dt><dd>{view.scopeLabel}</dd></div> : null}
        <div><dt>更新时间</dt><dd>{formatDate(view.updatedAt ?? null)}</dd></div>
      </div>
      {view.reviewSummary ? (
        <div className="detail-block inspector-subsection">
          <h3>当前摘要</h3>
          <p>{view.reviewSummary}</p>
        </div>
      ) : null}
      {actions ? <div className="inline-actions wrap">{actions}</div> : null}
      {children}
      {dangerActions ? <div className="inline-actions wrap danger-actions">{dangerActions}</div> : null}
    </>
  );
  const panelClassName = `detail-panel inspector-panel unified-skill-inspector ${className}`.trim();
  return as === "section" ? <section className={panelClassName}>{content}</section> : <aside className={panelClassName}>{content}</aside>;
}

function manageSkillStatusLabel(status: string) {
  return {
    published: "已上架",
    delisted: "已下架",
    archived: "已归档"
  }[status] ?? status;
}

function manageRiskLabel(risk: string) {
  return {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
    unknown: "未知风险"
  }[risk] ?? risk;
}

function manageRiskTone(risk: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "low") return "success";
  return "neutral";
}

function userStatusLabel(status: string) {
  return {
    active: "正常",
    frozen: "已冻结",
    deleted: "已删除"
  }[status] ?? status;
}

function departmentStatusLabel(status: string) {
  return {
    active: "正常",
    draft: "待补齐",
    disabled: "停用"
  }[status] ?? status;
}

function departmentStatusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  if (status === "disabled") return "danger";
  return "neutral";
}

function splitCSV(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleStringItem(items: string[], item: string, maxItems?: number): string[] {
  if (items.includes(item)) {
    return items.filter((current) => current !== item);
  }
  if (maxItems && items.length >= maxItems) {
    return items;
  }
  return [...items, item];
}

function bumpPatchVersion(version: string): string {
  const [major, minor, patch] = version.split(".").map((item) => Number.parseInt(item, 10));
  if (![major, minor, patch].every(Number.isFinite)) {
    return "1.0.0";
  }
  return `${major}.${minor}.${patch + 1}`;
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="section-header-action">{action}</div> : null}
    </div>
  );
}

function SidebarItemLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="sidebar-switch-label">
      {icon}
      <span>{label}</span>
    </span>
  );
}

function InlineModal({
  title,
  eyebrow,
  children,
  onClose,
  narrow = true
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
  narrow?: boolean;
}) {
  return (
    <div
      className="overlay-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (shouldCloseFromBackdropPointerDown(event)) {
          onClose();
        }
      }}
    >
      <section className={narrow ? "overlay-panel narrow manage-form-modal" : "overlay-panel manage-form-modal"} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="overlay-body">{children}</div>
      </section>
    </div>
  );
}

function ToolBrandMark({ toolID, label, large = false }: { toolID: string; label: string; large?: boolean }) {
  const normalizedToolID = toolID.toLowerCase();
  const className = `tool-brand-mark${large ? " large" : ""}`;

  if (normalizedToolID === "codex") {
    return (
      <span className={`${className} codex`} aria-label={`${label} 图标`} role="img">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94A3.02 3.02 0 0 1 3.07 3.949v3.785a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.342a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a3 3 0 0 1 1.173 1.207 2.96 2.96 0 0 1-.27 3.2 3.05 3.05 0 0 1-1.36.997V8.279a.52.52 0 0 0-.276-.445m1.36-2.015-.097-.057-3.226-1.855a.53.53 0 0 0-.53 0L6.249 6.153V4.598a.04.04 0 0 1 .019-.04L9.533 2.7a3.07 3.07 0 0 1 3.257.139c.474.325.843.778 1.066 1.303.223.526.289 1.103.191 1.664zM5.503 8.575 4.139 7.8a.05.05 0 0 1-.026-.037V4.049c0-.57.166-1.127.476-1.607s.752-.864 1.275-1.105a3.08 3.08 0 0 1 3.234.41l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.758-1 1.762 1v2l-1.755 1-1.762-1z" />
        </svg>
      </span>
    );
  }

  if (normalizedToolID === "claude") {
    return (
      <span className={`${className} claude`} aria-label={`${label} 图标`} role="img">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
        </svg>
      </span>
    );
  }

  if (normalizedToolID === "cursor") {
    return (
      <span className={`${className} cursor`} aria-label={`${label} 图标`} role="img">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
        </svg>
      </span>
    );
  }

  if (normalizedToolID === "windsurf") {
    return (
      <span className={`${className} windsurf`} aria-label={`${label} 图标`} role="img">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23.55 5.067c-1.2038-.002-2.1806.973-2.1806 2.1765v4.8676c0 .972-.8035 1.7594-1.7597 1.7594-.568 0-1.1352-.286-1.4718-.7659l-4.9713-7.1003c-.4125-.5896-1.0837-.941-1.8103-.941-1.1334 0-2.1533.9635-2.1533 2.153v4.8957c0 .972-.7969 1.7594-1.7596 1.7594-.57 0-1.1363-.286-1.4728-.7658L.4076 5.1598C.2822 4.9798 0 5.0688 0 5.2882v4.2452c0 .2147.0656.4228.1884.599l5.4748 7.8183c.3234.462.8006.8052 1.3509.9298 1.3771.313 2.6446-.747 2.6446-2.0977v-4.893c0-.972.7875-1.7593 1.7596-1.7593h.003a1.798 1.798 0 0 1 1.4718.7658l4.9723 7.0994c.4135.5905 1.05.941 1.8093.941 1.1587 0 2.1515-.9645 2.1515-2.153v-4.8948c0-.972.7875-1.7594 1.7596-1.7594h.194a.22.22 0 0 0 .2204-.2202v-4.622a.22.22 0 0 0-.2203-.2203Z" />
        </svg>
      </span>
    );
  }

  if (normalizedToolID === "opencode") {
    return (
      <span className={`${className} opencode`} aria-label={`${label} 图标`} role="img">
        <svg viewBox="0 0 240 300" aria-hidden="true">
          <path d="M180 240H60V120H180V240Z" fill="#CFCECD" />
          <path d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z" fill="#211E1E" />
        </svg>
      </span>
    );
  }

  return (
    <span className={`${className} custom icon-tone-${iconToneForLabel(label)}`} aria-label={`${label} 图标`} role="img">
      <span>{skillInitials(label)}</span>
    </span>
  );
}

function HomeHero({ workspace, ui }: SectionProps) {
  const starterPrompts = [
    "梳理当前工作区可用的 Skills",
    "根据需求文档生成发布前检查清单",
    "检查本地技能目录是否存在异常"
  ];
  const connected = workspace.loggedIn && workspace.bootstrap.connection.status === "connected";
  const accessLabel = connected ? "在线权限" : "完全访问权限";
  const installedSkillCount = workspace.skills.filter((skill) => skill.localVersion !== null).length;
  const discoveredSkillCount = workspace.discoveredLocalSkills.length;
  const localStatusLabel = discoveredSkillCount > 0 ? `${discoveredSkillCount} 待处理` : `${installedSkillCount} 已纳管`;
  const publishStatusLabel = connected ? "发布中心" : workspace.loggedIn ? "恢复连接后" : "登录后";
  const quickActions = [
    {
      key: "community",
      icon: <Sparkles size={16} />,
      label: "社区",
      meta: connected ? "在线市场" : "缓存市场",
      onClick: () => ui.openCommunityPane("skills")
    },
    {
      key: "local",
      icon: <PackageCheck size={16} />,
      label: "本地",
      meta: localStatusLabel,
      onClick: () => ui.openLocalPane("skills")
    },
    {
      key: "publish",
      icon: <Upload size={16} />,
      label: "发布",
      meta: publishStatusLabel,
      onClick: () => (connected ? ui.openCommunityPane("publish") : workspace.requireAuth("publisher"))
    }
  ];

  return (
    <section className="home-hero-shell">
      <section className="hero-surface hero-feature-home">
        <div className="hero-copy hero-copy-home">
          <div className="home-copy-block">
            <h1 className="home-title">
              <span className="home-title-text">Agent 探索</span>
              <span className="home-title-status">（功能开发中）</span>
            </h1>
          </div>
          <form className="prompt-composer">
            <div className="prompt-composer-shell">
              <textarea
                name="query"
                className="prompt-composer-input"
                value={workspace.filters.query}
                placeholder="向 Agent 提问，@ 添加文件，/ 输入命令，$ 使用技能"
                onChange={(event) => workspace.setFilters((current) => ({ ...current, query: event.target.value }))}
              />
              <div className="prompt-composer-toolbar">
                <div className="prompt-toolbar-left">
                  <button className="composer-icon-button" type="button" aria-label="添加">
                    <Plus size={18} />
                  </button>
                  <button className="composer-pill" type="button">
                    {accessLabel}
                  </button>
                </div>
                <div className="prompt-toolbar-right">
                  <button className="composer-text-button" type="button">GLM-5.1</button>
                  <button className="composer-text-button" type="button">超高</button>
                  <button className="composer-icon-button muted" type="button" aria-label="语音">◌</button>
                  <button className="composer-submit" type="button" aria-label="发送">↑</button>
                </div>
              </div>
            </div>
          </form>
          <div className="home-starter-row">
            <div className="home-starter-label">
              <Sparkles size={14} />
              <span>开始探索</span>
            </div>
            <div className="home-starter-actions">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="home-starter-chip"
                  type="button"
                  onClick={() => workspace.setFilters((current) => ({ ...current, query: prompt }))}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          <div className="home-quick-strip" aria-label="快捷入口">
            {quickActions.map((action) => (
              <button key={action.key} className={`home-quick-action home-quick-action-${action.key}`} type="button" onClick={action.onClick}>
                <span className="home-quick-action-main">
                  {action.icon}
                  <strong>{action.label}</strong>
                </span>
                <small>{action.meta}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

export function HomeSection({ workspace, ui }: SectionProps) {
  return (
    <div className="stage-page home-page">
      <HomeHero workspace={workspace} ui={ui} />
    </div>
  );
}

function CommunitySkillCard({ workspace, ui, skill }: SectionProps & { skill: SkillSummary }) {
  const metadataChips = [
    skill.localVersion ? `本地 v${skill.localVersion}` : null,
    skill.authorName,
    skill.authorDepartment,
    `v${skill.version}`
  ].filter(Boolean);

  return (
    <article
      className="market-card"
      role="button"
      tabIndex={0}
      data-testid="market-skill-card"
      data-skill-id={skill.skillID}
      onClick={() => ui.openSkillDetail(skill.skillID, "community")}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          ui.openSkillDetail(skill.skillID, "community");
        }
      }}
    >
      <div className="market-card-body skill-row-main">
        <div className="market-card-head">
          <div className="market-card-title-row">
            <InitialBadge label={skill.displayName} />
            <div className="market-card-title">
              <strong>{skill.displayName}</strong>
              <p>{skill.description}</p>
            </div>
          </div>
          <TagPill tone={statusTone(skill)}>{statusLabel(skill, ui.language)}</TagPill>
        </div>
        <div className="pill-row">
          <TagPill tone="neutral">{skill.category}</TagPill>
          {skill.tags.slice(0, 3).map((tag) => <TagPill key={tag} tone="info">{tag}</TagPill>)}
          {skill.tags.length > 3 ? <TagPill tone="info">+{skill.tags.length - 3}</TagPill> : null}
        </div>
        <div className="market-metadata">
          {metadataChips.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="market-metrics">
          <button
            className="market-metric-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void workspace.toggleStar(skill.skillID);
            }}
            aria-label={skill.starred ? `取消收藏 ${skill.displayName}` : `收藏 ${skill.displayName}`}
          >
            <Star size={14} fill={skill.starred ? "currentColor" : "none"} />
            <span>{formatMetricCount(skill.starCount, ui.language)}</span>
          </button>
          <span>
            <Download size={14} />
            {formatMetricCount(skill.downloadCount, ui.language)}
          </span>
        </div>
      </div>
    </article>
  );
}

type CommunityLeaderboardKind = "hot" | "stars" | "downloads";

function useResolvedCommunityLeaderboards(workspace: P1WorkspaceState) {
  const fallbackLeaderboards = useMemo(() => deriveCommunityLeaderboards(workspace.skills.filter(isCommunityVisibleSkill)), [workspace.skills]);
  return workspace.bootstrap.connection.status === "connected" ? workspace.leaderboards ?? fallbackLeaderboards : fallbackLeaderboards;
}

function CommunityLeaderboardList({
  title,
  skills,
  ui,
  metric
}: {
  title: string;
  skills: SkillLeaderboardItem[];
  ui: SectionProps["ui"];
  metric: CommunityLeaderboardKind;
}) {
  return (
    <div className="stack-list compact" aria-label={title}>
      {skills.map((skill, index) => {
        const publisher = skill.authorName ?? "未知发布者";
        const department = skill.authorDepartment ?? "未归属部门";
        return (
          <button
            className="leaderboard-row community-leaderboard-row"
            data-testid="community-leaderboard-row"
            data-ranking-kind={metric}
            key={`${metric}:${skill.skillID}`}
            type="button"
            onClick={() => ui.openSkillDetail(skill.skillID, "community")}
            aria-label={`${title}，第 ${index + 1} 名，${skill.displayName}，${publisher}，${department}，Star ${skill.starCount}，下载 ${skill.downloadCount}，打开详情`}
          >
            <span className="leaderboard-rank" aria-hidden="true">{index + 1}</span>
            <InitialBadge label={skill.displayName} />
            <span className="leaderboard-copy">
              <strong>{skill.displayName}</strong>
              <small>{publisher} · {department}</small>
              <TagPill tone="neutral">{skill.category}</TagPill>
            </span>
            <span className="leaderboard-metrics" aria-hidden="true">
              <small>
                <Star size={12} />
                {formatMetricCount(skill.starCount, ui.language)}
              </small>
              <small>
                <Download size={12} />
                {formatMetricCount(skill.downloadCount, ui.language)}
              </small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CommunityHomeLeaderboardCard({
  title,
  icon,
  skills,
  metric,
  ui,
  emptyBody
}: {
  title: string;
  icon: ReactNode;
  skills: SkillLeaderboardItem[];
  metric: CommunityLeaderboardKind;
  ui: SectionProps["ui"];
  emptyBody: string;
}) {
  const visibleSkills = skills.slice(0, COMMUNITY_LEADERBOARD_LIMIT);

  return (
    <section className={`stage-panel community-home-leaderboard-card ${metric}`}>
      <div className="community-home-card-head">
        <span className={`community-home-card-icon ${metric}`}>{icon}</span>
        <h2>{title}</h2>
      </div>
      {visibleSkills.length === 0 ? <SectionEmpty title="暂无榜单数据" body={emptyBody} /> : null}
      {visibleSkills.length > 0 ? (
        <CommunityLeaderboardList title={title} skills={visibleSkills} ui={ui} metric={metric} />
      ) : null}
    </section>
  );
}

function CommunityHome({ workspace, ui }: SectionProps) {
  const [searchDraft, setSearchDraft] = useState(workspace.filters.query);
  const leaderboards = useResolvedCommunityLeaderboards(workspace);
  const leaderboardCards = [
    {
      kind: "hot",
      label: "热榜",
      icon: <CircleGauge size={16} />,
      skills: leaderboards.hot,
      emptyBody: "近 7 天暂无热度数据。"
    },
    {
      kind: "stars",
      label: "Star 榜",
      icon: <Star size={16} />,
      skills: leaderboards.stars,
      emptyBody: "登录后会根据社区真实数据展示榜单。"
    },
    {
      kind: "downloads",
      label: "下载榜",
      icon: <Download size={16} />,
      skills: leaderboards.downloads,
      emptyBody: "登录后会根据社区真实数据展示榜单。"
    }
  ] as const;
  const exploreEntries = [
    {
      id: "skills",
      label: "技能探索",
      status: `${workspace.skills.filter(isCommunityVisibleSkill).length} Skills`,
      icon: <Sparkles size={20} />,
      onClick: () => ui.openCommunityPane("skills")
    },
    {
      id: "mcp",
      label: "MCP 探索",
      status: "预留入口",
      icon: <Link2 size={20} />,
      onClick: () => ui.openCommunityPane("mcp")
    },
    {
      id: "plugins",
      label: "插件探索",
      status: "预留入口",
      icon: <PackageCheck size={20} />,
      onClick: () => ui.openCommunityPane("plugins")
    }
  ] as const;

  useEffect(() => {
    setSearchDraft(workspace.filters.query);
  }, [workspace.filters.query]);

  function exploreCommunity(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    workspace.setFilters(buildCommunityExploreFilters(searchDraft));
    ui.openCommunityPane("skills");
  }

  function openPublish() {
    if (workspace.loggedIn && workspace.bootstrap.connection.status === "connected") {
      ui.openCommunityPane("publish");
      return;
    }
    workspace.requireAuth("publisher");
  }

  return (
    <div className="community-home" data-testid="community-home">
      <section className="stage-panel community-home-hero">
        <div className="community-home-hero-copy">
          <h1>EnterpriseAgentHub社区</h1>
          <p>发现、安装和管理企业内部可用的 Skills、MCP 和插件</p>
        </div>
        <form className="community-home-search" onSubmit={exploreCommunity}>
          <label className="community-home-search-shell">
            <Search size={18} />
            <input
              aria-label="搜索社区资源"
              type="search"
              value={searchDraft}
              placeholder="搜索 Skills、MCP、插件、作者、部门或标签"
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>
          <div className="community-home-actions">
            <button className="btn btn-primary" type="submit">
              <Sparkles size={16} />
              探索
            </button>
            <button className="btn" type="button" onClick={openPublish}>
              <Upload size={16} />
              发布
            </button>
          </div>
        </form>
      </section>

      <section className="community-home-section community-home-ranking-section" aria-labelledby="community-home-ranking-title">
        <div className="community-home-section-head">
          <h2 id="community-home-ranking-title">榜单</h2>
          <p>聚焦近期热度、收藏和安装趋势，快速发现团队正在采用的资源。</p>
        </div>
        <div className="community-home-leaderboards" aria-label="社区核心榜单">
          {leaderboardCards.map((card) => (
            <CommunityHomeLeaderboardCard
              key={card.kind}
              title={card.label}
              icon={card.icon}
              skills={card.skills}
              metric={card.kind}
              ui={ui}
              emptyBody={card.emptyBody}
            />
          ))}
        </div>
      </section>

      <section className="community-home-section community-home-expansion-section" aria-labelledby="community-home-expansion-title">
        <div className="community-home-section-head">
          <h2 id="community-home-expansion-title">拓展</h2>
          <p>从 Skills、MCP 到插件，进入更完整的企业能力目录。</p>
        </div>
        <div className="community-home-entry-grid" aria-label="探索入口">
          {exploreEntries.map((entry) => (
            <button key={entry.id} className={`community-home-entry-card ${entry.id}`} type="button" onClick={entry.onClick}>
              <span className="community-home-entry-icon">{entry.icon}</span>
              <span className="community-home-entry-copy">
                <strong>{entry.label}</strong>
                <small>{entry.status}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CommunityPlaceholder({ title }: { title: string }) {
  return (
    <section className="stage-panel placeholder-panel">
      <strong>{title} 预留入口</strong>
      <p>当前版本保留导航与占位态，后续再接入真实 MCP / 插件功能。</p>
    </section>
  );
}

type WebkitFileSystemFileEntry = {
  isFile: true;
  isDirectory: false;
  name: string;
  file: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
};

type WebkitFileSystemDirectoryEntry = {
  isFile: false;
  isDirectory: true;
  name: string;
  createReader: () => {
    readEntries: (success: (entries: WebkitFileSystemEntry[]) => void, failure?: (error: DOMException) => void) => void;
  };
};

type WebkitFileSystemEntry = WebkitFileSystemFileEntry | WebkitFileSystemDirectoryEntry;

async function entriesFromDataTransfer(dataTransfer: DataTransfer): Promise<UploadEntry[]> {
  const itemEntries = await Promise.all(
    Array.from(dataTransfer.items)
      .map((item) => {
        const getEntry = (item as DataTransferItem & { webkitGetAsEntry?: () => WebkitFileSystemEntry | null }).webkitGetAsEntry;
        return getEntry?.call(item) ?? null;
      })
      .filter((entry): entry is WebkitFileSystemEntry => Boolean(entry))
      .map((entry) => entriesFromFileSystemEntry(entry, ""))
  );
  const flattened = itemEntries.flat();
  if (flattened.length > 0) return flattened;

  return Array.from(dataTransfer.files).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
  }));
}

async function entriesFromFileSystemEntry(entry: WebkitFileSystemEntry, parentPath: string): Promise<UploadEntry[]> {
  const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
    return [{ file, relativePath }];
  }

  const children = await readAllDirectoryEntries(entry);
  const nested = await Promise.all(children.map((child) => entriesFromFileSystemEntry(child, relativePath)));
  return nested.flat();
}

async function readAllDirectoryEntries(entry: WebkitFileSystemDirectoryEntry): Promise<WebkitFileSystemEntry[]> {
  const reader = entry.createReader();
  const result: WebkitFileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<WebkitFileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    result.push(...batch);
  }
  return result;
}

function inferUploadMode(entries: UploadEntry[]): "zip" | "folder" {
  return entries.length === 1 && isZipPath(entries[0].relativePath) ? "zip" : "folder";
}

function inferPackageName(entries: UploadEntry[], uploadMode: PublishDraft["uploadMode"]): string {
  if (uploadMode === "zip") return entries[0]?.file.name ?? entries[0]?.relativePath ?? "skill.zip";
  return entries[0]?.relativePath.split("/")[0] ?? "skill-folder";
}

function CommunityPublisherWorkspace({
  workspace,
  ui,
  pane
}: SectionProps & { pane: "publish" | "mine" }) {
  const [draft, setDraft] = useState<PublishDraft>(() => emptyPublishDraft());
	  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
	  const [tagInput, setTagInput] = useState("");
	  const [toolInput, setToolInput] = useState("");
	  const [systemInput, setSystemInput] = useState("windows");
	  const [uploadError, setUploadError] = useState<string | null>(null);
	  const [dropActive, setDropActive] = useState(false);
	  const [submitAttempted, setSubmitAttempted] = useState(false);
		  const [submitting, setSubmitting] = useState(false);
		  const publishPrecheck = buildPublishPrecheck(draft);
		  const slugValidation = validateSkillSlug(draft.skillID);
		  const duplicatePublishedSlug =
		    draft.submissionType === "publish" &&
		    draft.skillID.trim().length > 0 &&
		    (
          workspace.skills.some(
            (skill) => isCommunityVisibleSkill(skill) && skill.skillID.toLocaleLowerCase() === draft.skillID.trim().toLocaleLowerCase()
          ) ||
          workspace.publisherData.publisherSkills.some(
            (skill) => skill.skillID.toLocaleLowerCase() === draft.skillID.trim().toLocaleLowerCase() && skill.currentStatus !== "archived"
          )
        );

  const selectedPublisherSkill =
    workspace.publisherData.publisherSkills.find((skill) => skill.latestSubmissionID === workspace.publisherData.selectedPublisherSubmissionID)
    ?? workspace.publisherData.publisherSkills[0]
    ?? null;
  const selectedSubmission = workspace.publisherData.selectedPublisherSubmission;

  const canSubmitPermissionChange =
    draft.skillID.trim().length > 0 &&
    draft.displayName.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    (draft.scope !== "selected_departments" || draft.selectedDepartmentIDs.length > 0);
	  const canSubmitDraft = draft.submissionType === "permission_change" ? canSubmitPermissionChange && !duplicatePublishedSlug : publishPrecheck.canSubmit && !duplicatePublishedSlug;
	  const folderInputProps = { webkitdirectory: "", directory: "" } as { [key: string]: string };
	  const showSlugValidation = submitAttempted || draft.skillID.trim().length > 0;
	  const visiblePrecheckIssues = [
	    ...(duplicatePublishedSlug
	      ? [{
	          id: "slug-duplicate",
	          label: "Slug 已存在",
	          status: "warn" as const,
	          message: "该 Slug 已有已发布 Skill，请使用更新发布或更换 Slug。"
	        }]
	      : []),
	    ...publishPrecheck.items.filter((item) => {
	      if (item.status !== "warn") return false;
	      if (item.id === "slug" && !submitAttempted && draft.skillID.trim().length === 0) return false;
	      return true;
	    })
	  ];
	  const shouldShowPrecheckIssues = visiblePrecheckIssues.length > 0 && (submitAttempted || draft.files.length > 0 || draft.skillID.trim().length > 0);

  function applyDraftLists(nextDraft: PublishDraft) {
    setDraft(nextDraft);
    setTagInput(nextDraft.tags.join(", "));
    setToolInput(nextDraft.compatibleTools.join(", "));
    setSystemInput(nextDraft.compatibleSystems.join(", "));
  }

  function clearDraft() {
    applyDraftLists(emptyPublishDraft());
    setUploadEntries([]);
    setUploadError(null);
    setSubmitAttempted(false);
  }

  function resetDraft(submissionType: PublishDraft["submissionType"] = "publish", source?: PublisherSkillSummary) {
    const sourceSubmission =
      source?.latestSubmissionID && workspace.publisherData.selectedPublisherSubmission?.submissionID === source.latestSubmissionID
        ? workspace.publisherData.selectedPublisherSubmission
        : null;

	    applyDraftLists({
	      submissionType,
	      uploadMode: "none",
	      packageName: "",
	      skillEntryPath: null,
	      skillID: source?.skillID ?? "",
      displayName: source?.displayName ?? "",
      description: sourceSubmission?.description ?? "",
      version:
        submissionType === "update"
          ? bumpPatchVersion(source?.currentVersion ?? sourceSubmission?.currentVersion ?? "1.0.0")
          : source?.currentVersion ?? sourceSubmission?.currentVersion ?? "1.0.0",
      scope: source?.currentScopeType ?? "current_department",
      selectedDepartmentIDs: sourceSubmission?.selectedDepartmentIDs ?? [],
      visibility: source?.currentVisibilityLevel ?? "private",
      changelog: "",
      category: sourceSubmission?.category ?? source?.category ?? "",
      tags: [...(sourceSubmission?.tags ?? source?.tags ?? [])],
      compatibleTools: [],
      compatibleSystems: ["windows"],
      files: []
	    });
	    setUploadEntries([]);
	    setUploadError(null);
	    setSubmitAttempted(false);
	    ui.openCommunityPane("publish");
	  }

		  async function applyUploadEntries(entries: UploadEntry[], uploadMode = inferUploadMode(entries)) {
		    if (entries.length === 0) return;
		    const validationMessage = validateUploadEntries(entries, uploadMode);
		    if (validationMessage) {
		      setUploadError(validationMessage);
		      setUploadEntries([]);
		      setDraft((current) => ({ ...current, uploadMode: "none", packageName: "", skillEntryPath: null, files: [] }));
		      return;
		    }
		    const packageName = inferPackageName(entries, uploadMode);
	    const visibleFiles = entries.map((entry) => ({
	      name: entry.relativePath,
	      relativePath: entry.relativePath,
	      size: entry.file.size,
	      mimeType: entry.file.type || "application/octet-stream"
	    }));
	    const directSkillEntryPath = entries.find((entry) => isSkillMarkdownPath(entry.relativePath))?.relativePath ?? null;
	    let skillEntryPath = directSkillEntryPath;
	    let metadata = {};

		    try {
		      const skillMarkdown = await readSkillMarkdownFromUploadEntries(entries);
		      if (!skillMarkdown) {
		        setUploadError(uploadMode === "zip" ? "ZIP 包必须包含 SKILL.md。" : "Skill 文件夹必须包含 SKILL.md。");
		        setUploadEntries([]);
		        setDraft((current) => ({ ...current, uploadMode: "none", packageName: "", skillEntryPath: null, files: [] }));
		        return;
		      }
		      if (skillMarkdown) {
		        metadata = parseSkillFrontmatter(skillMarkdown);
		        skillEntryPath = skillEntryPath ?? "SKILL.md";
		      }
	      setUploadError(null);
		    } catch (error) {
		      setUploadError(error instanceof Error ? error.message : "无法解析上传包中的 SKILL.md。");
		      setUploadEntries([]);
		      setDraft((current) => ({ ...current, uploadMode: "none", packageName: "", skillEntryPath: null, files: [] }));
		      return;
		    }

	    setUploadEntries(entries);
	    setDraft((current) => {
	      const next: PublishDraft = {
	        ...current,
	        uploadMode,
	        packageName,
	        skillEntryPath,
	        files: visibleFiles
	      };
	      const skillMetadata = metadata as { name?: string; description?: string };
	      if (skillMetadata.name) {
	        if (current.submissionType === "publish" && !current.skillID.trim()) {
	          next.skillID = skillMetadata.name.trim();
	        }
	        if (!current.displayName.trim()) {
	          next.displayName = displayNameFromSkillName(skillMetadata.name);
	        }
	      }
	      if (skillMetadata.description) {
	        next.description = skillMetadata.description.trim();
	      }
	      if (current.submissionType !== "permission_change" && !current.changelog.trim()) {
	        next.changelog = current.submissionType === "publish" ? "首次发布" : "版本更新";
	      }
	      return next;
	    });
	  }

	  function handleZipUpload(event: ChangeEvent<HTMLInputElement>) {
	    const file = event.target.files?.[0];
	    if (!file) return;
	    void applyUploadEntries([{ file, relativePath: file.name }], "zip");
	    event.currentTarget.value = "";
	  }

	  function handleFolderUpload(event: ChangeEvent<HTMLInputElement>) {
	    const files = Array.from(event.target.files ?? []);
	    if (files.length === 0) return;
    const entries = files.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
	      return { file, relativePath };
	    });
	    void applyUploadEntries(entries, "folder");
	    event.currentTarget.value = "";
	  }

	  async function handleDrop(event: React.DragEvent<HTMLElement>) {
	    event.preventDefault();
	    setDropActive(false);
	    const entries = await entriesFromDataTransfer(event.dataTransfer);
	    await applyUploadEntries(entries);
	  }

	  async function submitDraft(event: FormEvent<HTMLFormElement>) {
	    event.preventDefault();
	    setSubmitAttempted(true);
	    if (!canSubmitDraft || submitting) return;
	    setSubmitting(true);
	    const formData = new FormData();
	    formData.set("submissionType", draft.submissionType);
	    formData.set("skillID", draft.skillID.trim());
	    formData.set("displayName", draft.displayName.trim());
	    formData.set("description", draft.description.trim());
	    formData.set("version", draft.version.trim());
	    formData.set("scopeType", draft.scope);
	    formData.set("selectedDepartmentIDs", JSON.stringify(draft.selectedDepartmentIDs));
	    formData.set("visibilityLevel", draft.visibility);
	    formData.set("changelog", draft.changelog.trim());
	    formData.set("category", draft.category.trim());
	    formData.set("tags", JSON.stringify(draft.tags));
	    formData.set("compatibleTools", JSON.stringify(splitCSV(toolInput)));
	    formData.set("compatibleSystems", JSON.stringify(splitCSV(systemInput)));
	    formData.set("fileRelativePaths", JSON.stringify(uploadEntries.map((entry) => entry.relativePath)));
	    for (const entry of uploadEntries) {
	      formData.append("files", entry.file, entry.relativePath);
	    }
	    try {
	      const submitted = await workspace.publisherData.submitPublisherSubmission(formData);
	      if (submitted !== false) {
	        clearDraft();
	        ui.openCommunityPane("mine");
	      }
	    } finally {
	      setSubmitting(false);
	    }
	  }

  async function loadSubmissionFileContent(relativePath: string) {
    if (!selectedSubmission) {
      throw new Error("未选择提交记录");
    }
    return workspace.publisherData.getSubmissionFileContent(selectedSubmission.submissionID, relativePath);
  }

  if (!workspace.loggedIn) {
    return (
      <AuthGateCard
        title="登录后进入作者工作台"
        body="发布、更新、权限变更与提交流程都统一保留在社区内部。"
        onLogin={() => workspace.requireAuth("publisher")}
      />
    );
  }

  if (pane === "publish") {
    return (
      <section className="stage-panel publish-center-shell">
        <form className="publish-form-scroll" data-testid="publish-form" onSubmit={submitDraft}>
          <div className="publish-title-block">
            <h1>提交发布申请</h1>
            <p>上传您的 Skill 文件。只有审核通过后，Skill 才会正式展示在社区 Skill 广场。</p>
          </div>

          <div className="publish-workbench">
            <div className="publish-primary-column">
              <section className="publish-form-section publish-upload-section" aria-labelledby="publish-package-heading">
                <div className="publish-section-head">
                  <h2 id="publish-package-heading">Skill 文件</h2>
                  <p>上传文件夹或 zip 包，系统会从 SKILL.md 读取基础元数据。</p>
                </div>
                <section
                  className={dropActive ? "publish-dropzone active" : "publish-dropzone"}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDropActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                    setDropActive(false);
                  }}
                  onDrop={(event) => void handleDrop(event)}
                >
                  <div className="publish-dropzone-icon"><Upload size={30} strokeWidth={1.9} /></div>
                  <strong>{draft.files.length > 0 ? `已选择 ${draft.files.length} 个文件` : "拖拽文件夹或 zip 包到此处"}</strong>
                  <p>{draft.files.length > 0 ? draft.files.slice(0, 3).map((file) => file.relativePath).join("、") : "请确保文件夹或压缩包中包含 SKILL.md 文件（最多 100 个，总大小不超过 5.00 MB）"}</p>
                  {draft.skillEntryPath ? <TagPill tone="success">已解析 {draft.skillEntryPath}</TagPill> : null}
                  {uploadError ? (
                    <div className="callout warning publish-upload-callout">
                      <AlertTriangle size={16} />
                      <span>
                        <strong>上传未通过预检查</strong>
                        <small>{uploadError}</small>
                      </span>
                    </div>
                  ) : null}
                  <div className="publish-upload-actions">
                    <label className="btn btn-primary">
                      <FolderPlus size={16} />
                      选择文件夹
                      <input type="file" multiple {...folderInputProps} data-testid="publish-folder-input" onChange={handleFolderUpload} style={{ display: "none" }} />
                    </label>
                    <label className="btn">
                      <Upload size={16} />
                      选择 zip 文件
                      <input type="file" accept=".zip,application/zip" data-testid="publish-zip-input" onChange={handleZipUpload} style={{ display: "none" }} />
                    </label>
                  </div>
                </section>
              </section>

              <section className="publish-form-section" aria-labelledby="publish-basic-heading">
                <div className="publish-section-head">
                  <h2 id="publish-basic-heading">基础信息</h2>
                  <p>名称、版本和变更说明会进入审核单与社区展示。</p>
                </div>
                <div className="publish-identity-grid">
                  <div className="field-stack">
                    <label className="publish-label">提交类型 <span className="required-mark">*</span></label>
                    <select value={draft.submissionType} onChange={(event) => resetDraft(event.target.value as PublishDraft["submissionType"], selectedPublisherSkill ?? undefined)}>
                      <option value="publish">首次发布</option>
                      <option value="update">更新发布</option>
                      <option value="permission_change">权限变更</option>
                    </select>
                  </div>

                  <div className="field-stack">
                    <label className="publish-label">版本号 <span className="required-mark">*</span></label>
                    <input data-testid="publish-version" value={draft.version} disabled={draft.submissionType === "permission_change"} onChange={(event) => setDraft((current) => ({ ...current, version: event.target.value }))} />
                  </div>

                  <div className="field-stack">
                    <label className="publish-label">Slug <span className="required-mark">*</span></label>
                    <input
                      className={showSlugValidation && !slugValidation.valid ? "field-invalid" : ""}
                      data-testid="publish-skill-id"
                      value={draft.skillID}
                      placeholder="Skill 的唯一标识符，仅允许小写字母、数字和连字符"
                      disabled={draft.submissionType !== "publish"}
                      aria-invalid={showSlugValidation ? !slugValidation.valid : undefined}
                      onBlur={() => setDraft((current) => ({ ...current, skillID: current.skillID.trim() }))}
                      onChange={(event) => setDraft((current) => ({ ...current, skillID: event.target.value }))}
                    />
                    {showSlugValidation ? (
                      <small className={slugValidation.valid ? "field-hint success" : "field-hint warning"}>{slugValidation.message}</small>
                    ) : null}
                  </div>

                  <div className="field-stack">
                    <label className="publish-label">显示名称 <span className="required-mark">*</span></label>
                    <input data-testid="publish-display-name" value={draft.displayName} placeholder="Skill 显示名称" onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} />
                  </div>

                  <div className="field-stack publish-field-wide">
                    <label className="publish-label">描述</label>
                    <textarea data-testid="publish-description" value={draft.description} placeholder="该描述会从 SKILL.md 文件的 description 字段中自动提取，也支持手动修改" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                  </div>

                  <div className="field-stack publish-field-wide">
                    <label className="publish-label">变更说明</label>
                    <textarea data-testid="publish-changelog" value={draft.changelog} placeholder="描述本次版本的主要变更内容" disabled={draft.submissionType === "permission_change"} onChange={(event) => setDraft((current) => ({ ...current, changelog: event.target.value }))} />
                  </div>
                </div>
              </section>
            </div>

            <div className="publish-secondary-column" aria-label="发布范围与分类">
              <section className="publish-form-section" aria-labelledby="publish-scope-heading">
                <div className="publish-section-head">
                  <h2 id="publish-scope-heading">公开与授权</h2>
                  <p>控制谁能看到、谁能安装。</p>
                </div>
                <div className="publish-scope-grid">
                  <div className="field-stack">
                    <label className="publish-label">公开级别 <span className="required-mark">*</span></label>
                    <div className="publish-select-shell">
                      <div className="publish-select-value">
                        <strong>{publishVisibilityLabel(draft.visibility, ui.language)}</strong>
                        <p>可选：非公开、摘要公开、详情公开、全员可安装。</p>
                      </div>
                      <select aria-label="公开级别" value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value as PublishDraft["visibility"] }))}>
                        <option value="private">默认不公开</option>
                        <option value="summary_visible">摘要公开</option>
                        <option value="detail_visible">详情公开</option>
                        <option value="public_installable">全员可安装</option>
                      </select>
                    </div>
                  </div>

                  <div className="field-stack">
                    <label className="publish-label">授权范围</label>
                    <div className="publish-select-shell">
                      <div className="publish-select-value">
                        <strong>{scopeLabel(draft.scope, ui.language)}</strong>
                        <p>决定哪些部门或员工可见、可安装。</p>
                      </div>
                      <select aria-label="授权范围" value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as PublishDraft["scope"] }))}>
                        <option value="current_department">本部门</option>
                        <option value="department_tree">本部门及下级部门</option>
                        <option value="selected_departments">指定多个部门</option>
                        <option value="all_employees">全员可用</option>
                      </select>
                    </div>
                  </div>

                  {draft.scope === "selected_departments" ? (
                    <div className="field-stack publish-field-wide">
                      <label className="publish-label">指定部门</label>
                      <select
                        multiple
                        value={draft.selectedDepartmentIDs}
                        onChange={(event) => {
                          const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                          setDraft((current) => ({ ...current, selectedDepartmentIDs: values }));
                        }}
                      >
                        {flattenDepartments(workspace.adminData.departments).map((department) => (
                          <option key={department.departmentID} value={department.departmentID}>{department.path}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="publish-form-section" aria-labelledby="publish-taxonomy-heading">
                <div className="publish-section-head">
                  <h2 id="publish-taxonomy-heading">分类与兼容性</h2>
                  <p>用于社区筛选、搜索和安装前判断。</p>
                </div>
                <div className="publish-meta-grid">
                  <label className="field-stack publish-meta-wide">
                    <span className="publish-label">分类</span>
                    <select data-testid="publish-category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                      <option value="">请选择分类</option>
                      {SKILL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <div className="field-stack publish-tag-select publish-meta-wide">
                    <span className="publish-label">标签</span>
                    <div className="tag-row compact" data-testid="publish-tags" aria-label="发布标签">
                      {SKILL_TAGS.map((tag) => {
                        const active = draft.tags.includes(tag);
                        const disabled = !active && draft.tags.length >= 5;
                        return (
                          <button
                            key={tag}
                            className={active ? "tag-filter active" : "tag-filter"}
                            type="button"
                            disabled={disabled}
                            aria-pressed={active}
                            onClick={() => {
                              setDraft((current) => {
                                const tags = toggleStringItem(current.tags, tag, 5);
                                setTagInput(tags.join(", "));
                                return { ...current, tags };
                              });
                            }}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    <small className="field-hint">选择 1-5 个中文短标签。</small>
                  </div>
                  <label className="field-stack">
                    <span className="publish-label">适用工具</span>
                    <input data-testid="publish-tools" value={toolInput} placeholder="codex, claude" onChange={(event) => { const value = event.target.value; setToolInput(value); setDraft((current) => ({ ...current, compatibleTools: splitCSV(value) })); }} />
                  </label>
                  <label className="field-stack">
                    <span className="publish-label">适用系统</span>
                    <input data-testid="publish-systems" value={systemInput} placeholder="windows, macos" onChange={(event) => { const value = event.target.value; setSystemInput(value); setDraft((current) => ({ ...current, compatibleSystems: splitCSV(value) })); }} />
                  </label>
                </div>
              </section>
            </div>
          </div>

	          {shouldShowPrecheckIssues ? (
	            <div className="detail-block publish-precheck-card">
	              <h3>需要修正的问题</h3>
	              <div className="stack-list compact">
	                {visiblePrecheckIssues.map((item) => (
	                  <div className="micro-row" key={item.id}>
	                    <strong>{item.label}</strong>
	                    <small>{item.message}</small>
	                  </div>
	                ))}
	              </div>
	            </div>
	          ) : null}

		          <div className="publish-submit-row">
	            {submitAttempted && !canSubmitDraft ? (
	              <div className="callout warning publish-submit-warning">
	                <AlertTriangle size={16} />
	                <span>
		                  <strong>还有必填项或预检查未通过</strong>
		                  <small>请按上方问题提示补齐后再次发布。</small>
		                </span>
	              </div>
	            ) : null}
		            <button className="btn btn-primary publish-submit-button" type="submit" data-testid="publish-submit" disabled={submitting}>{submitting ? "正在提交..." : submitButtonLabel(draft.submissionType)}</button>
		          </div>
        </form>
      </section>
    );
  }

  const selectedPublisherSkillView = selectedPublisherSkill ? publisherSkillView(selectedPublisherSkill, selectedSubmission, ui.language) : null;

  return (
    <div className="publisher-detail-layout publisher-page-layout">
      <section className="stage-panel list-panel">
        {workspace.publisherData.publisherSkills.length === 0 ? <SectionEmpty title="还没有发布记录" body="从左侧“发布”入口上传 ZIP 或文件夹后，这里会展示你的提交记录和审核状态。" /> : null}
        <div className="stack-list">
          {workspace.publisherData.publisherSkills.map((skill) => {
            const canResubmit = ["returned_for_changes", "review_rejected", "withdrawn"].includes(skill.latestWorkflowState ?? "");
            const rowSubmission = selectedSubmission?.skillID === skill.skillID ? selectedSubmission : null;
            const view = publisherSkillView(skill, rowSubmission, ui.language);
            return (
              <div key={skill.skillID} data-testid="publisher-skill-row" data-skill-id={skill.skillID}>
                <UnifiedSkillRow
                  view={view}
                  active={selectedPublisherSkill?.skillID === skill.skillID}
                  onSelect={() => workspace.publisherData.setSelectedPublisherSubmissionID(skill.latestSubmissionID ?? null)}
	                  actions={
	                    <>
	                      <button
	                        className="btn btn-small"
	                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          ui.openSkillDetail(skill.skillID, "community");
                        }}
                      >
                        完整详情
                      </button>
                      {canResubmit ? (
                        <button className="btn btn-small" type="button" onClick={(event) => { event.stopPropagation(); resetDraft(skill.latestSubmissionType ?? "publish", skill); }}>重新提交</button>
                      ) : null}
	                      {skill.publishedSkillExists && skill.currentStatus !== "archived" ? (
	                        <>
	                          <button className="btn btn-small" type="button" onClick={(event) => { event.stopPropagation(); resetDraft("update", skill); }}>发布新版本</button>
	                          <button className="btn btn-small" type="button" onClick={(event) => { event.stopPropagation(); resetDraft("permission_change", skill); }}>修改权限</button>
                        </>
                      ) : null}
                      {skill.canWithdraw && skill.latestSubmissionID ? (
                        <button className="btn btn-small" type="button" onClick={(event) => { event.stopPropagation(); void workspace.publisherData.withdrawPublisherSubmission(skill.latestSubmissionID ?? ""); }}>撤回</button>
                      ) : null}
                      {skill.availableStatusActions.includes("delist") ? (
                        <button className="btn btn-small" type="button" onClick={(event) => { event.stopPropagation(); void workspace.publisherData.delistPublisherSkill(skill.skillID); }}>下架</button>
                      ) : null}
                      {skill.availableStatusActions.includes("relist") ? (
                        <button className="btn btn-small" type="button" onClick={(event) => { event.stopPropagation(); void workspace.publisherData.relistPublisherSkill(skill.skillID); }}>上架</button>
                      ) : null}
                      {skill.availableStatusActions.includes("archive") ? (
                        <button className="btn btn-danger btn-small" type="button" onClick={(event) => { event.stopPropagation(); void workspace.publisherData.archivePublisherSkill(skill.skillID); }}>
                          <Archive size={14} />
                          归档
                        </button>
                      ) : null}
                    </>
                  }
                />
              </div>
            );
          })}
        </div>
      </section>

      {!selectedPublisherSkill || !selectedPublisherSkillView ? (
        <section className="stage-panel detail-panel wide inspector-panel">
          <SectionEmpty title="选择一条提交查看详情" />
        </section>
      ) : (
        <UnifiedSkillInspector
          as="section"
          className="wide publisher-summary-panel"
          view={selectedPublisherSkillView}
	          actions={
	            <>
	              <button className="btn" type="button" onClick={() => ui.openSkillDetail(selectedPublisherSkill.skillID, "community")}>
	                完整详情
	              </button>
	              {selectedPublisherSkill.publishedSkillExists && selectedPublisherSkill.currentStatus !== "archived" ? (
	                <>
	                  <button className="btn btn-primary" type="button" onClick={() => resetDraft("update", selectedPublisherSkill)}>发布新版本</button>
	                  <button className="btn" type="button" onClick={() => resetDraft("permission_change", selectedPublisherSkill)}>修改权限</button>
                </>
              ) : null}
            </>
          }
          dangerActions={
            selectedPublisherSkill.availableStatusActions.includes("archive") ? (
              <button className="btn btn-danger" type="button" onClick={() => void workspace.publisherData.archivePublisherSkill(selectedPublisherSkill.skillID)}>
                归档
              </button>
            ) : null
          }
        >
          {selectedSubmission ? (
            <>
              <div className="detail-block">
                <h3>分类与标签</h3>
                <div className="pill-row">
                  <TagPill tone="neutral">{selectedSubmission.category}</TagPill>
                  {selectedSubmission.tags.map((tag) => <TagPill key={tag} tone="info">{tag}</TagPill>)}
                </div>
              </div>
              {selectedSubmission.packageURL ? (
                <div className="inline-actions wrap">
                <button className="btn btn-small" type="button" onClick={() => void downloadAuthenticatedFile(selectedSubmission.packageURL ?? "", `${selectedSubmission.skillID ?? "submission"}.zip`)}>
                  <Download size={14} />
                  下载包
                </button>
                {selectedSubmission.canWithdraw ? (
                  <button className="btn btn-small" type="button" onClick={() => void workspace.publisherData.withdrawPublisherSubmission(selectedSubmission.submissionID ?? "")}>
                    撤回提交
                  </button>
                ) : null}
              </div>
              ) : null}
              <PackagePreviewPanel
                files={selectedSubmission.packageFiles}
                packageURL={selectedSubmission.packageURL}
                downloadName={`${selectedSubmission.skillID}.zip`}
                loadContent={loadSubmissionFileContent}
                ui={ui}
              />
              <div className="detail-block">
                <h3>预检查结果</h3>
                {selectedSubmission.precheckResults.length === 0 ? (
                  <p>等待系统初审。</p>
                ) : (
                  <div className="stack-list compact">
                    {selectedSubmission.precheckResults.map((item) => (
                      <div className="micro-row" key={item.id}>
                        <strong>{item.label}</strong>
                        <small>{item.message}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="detail-block">
              <h3>提交详情</h3>
              <p>当前 Skill 暂无可查看的最新提交包，可发起新版本或权限变更。</p>
            </div>
          )}
        </UnifiedSkillInspector>
      )}
    </div>
  );
}

function emptyPublishDraft(): PublishDraft {
  return {
    submissionType: "publish",
    uploadMode: "none",
    packageName: "",
    skillEntryPath: null,
    skillID: "",
    displayName: "",
    description: "",
    version: "1.0.0",
    scope: "current_department",
    selectedDepartmentIDs: [],
    visibility: "private",
    changelog: "",
    category: "",
    tags: [],
    compatibleTools: [],
    compatibleSystems: ["windows"],
    files: []
  };
}

function submitButtonLabel(submissionType: PublishDraft["submissionType"]): string {
  if (submissionType === "update") return "提交版本更新";
  if (submissionType === "permission_change") return "提交权限变更";
  return "提交发布申请";
}

export function CommunitySection({ workspace, ui }: SectionProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const activeTags = workspace.filters.tags;
  const frequentCategories = useMemo<string[]>(() => {
    const categoryCounts = new Map<string, number>();

    for (const skill of workspace.skills) {
      if (!isCommunityVisibleSkill(skill)) continue;
      categoryCounts.set(skill.category, (categoryCounts.get(skill.category) ?? 0) + 1);
    }

    const rankedCategories = [...workspace.categories].sort((left, right) => {
      const countDelta = (categoryCounts.get(right) ?? 0) - (categoryCounts.get(left) ?? 0);
      if (countDelta !== 0) return countDelta;
      return workspace.categories.indexOf(left) - workspace.categories.indexOf(right);
    });
    const categoriesWithResults = rankedCategories.filter((category) => (categoryCounts.get(category) ?? 0) > 0);

    return (categoriesWithResults.length >= 4 ? categoriesWithResults : rankedCategories).slice(0, 4);
  }, [workspace.categories, workspace.skills]);
  const primaryCategories: string[] = ["all", ...frequentCategories];
  const visibleCategoryFilters =
    workspace.filters.category !== "all" && !primaryCategories.includes(workspace.filters.category)
      ? [...primaryCategories, workspace.filters.category]
      : primaryCategories;
  const allCategories: string[] = ["all", ...workspace.categories];
  const allCategoryFilters =
    workspace.filters.category !== "all" && !allCategories.includes(workspace.filters.category)
      ? [...allCategories, workspace.filters.category]
      : allCategories;
  const hiddenCategoryFilterActive = workspace.filters.category !== "all" && !frequentCategories.includes(workspace.filters.category);
  const hiddenFilterCount = activeTags.length + (hiddenCategoryFilterActive ? 1 : 0);
  const moreFiltersActive = filtersExpanded || hiddenFilterCount > 0;
  const isCommunityResultsEmpty = workspace.marketSkills.length === 0;
  const communityScopeLabel = workspace.loggedIn
    ? workspace.bootstrap.connection.status === "connected"
      ? "企业服务在线"
      : "离线缓存模式"
    : "游客缓存模式";
  const communitySortLabel = {
    composite: "综合排序",
    latest_published: "最新发布",
    recently_updated: "最近更新",
    download_count: "下载量优先",
    star_count: "Star 优先",
    relevance: "相关度优先"
  }[workspace.filters.sort];
  const discoverEntries = [
    { id: "home", label: "首页", icon: <CircleGauge size={16} /> },
    { id: "skills", label: "Skills", icon: <Sparkles size={16} /> },
    { id: "mcp", label: "MCP", icon: <Link2 size={16} /> },
    { id: "plugins", label: "插件", icon: <PackageCheck size={16} /> }
  ] as const;
  const authorEntries = [
    { id: "publish", label: "发布", icon: <Upload size={16} /> },
    { id: "mine", label: "我的", icon: <Users size={16} /> }
  ] as const;
  const renderCategoryFilter = (category: string) => {
    const active = workspace.filters.category === category;
    const label = category === "all" ? "全部" : category;

    return (
      <button
        key={category}
        className={active ? "tag-filter active" : "tag-filter"}
        type="button"
        onClick={() => workspace.setFilters((current) => ({ ...current, category }))}
      >
        {label}
      </button>
    );
  };

  if (ui.communityPane === "home") {
    return (
      <div className="stage-page workspace-page community-page community-landing-page">
        <CommunityHome workspace={workspace} ui={ui} />
      </div>
    );
  }

  return (
    <div className="stage-page workspace-page community-page">
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <div className="sidebar-title">社区入口</div>
          {discoverEntries.map((item) => (
            <button
              key={item.id}
              className={ui.communityPane === item.id ? "sidebar-switch active" : "sidebar-switch"}
              type="button"
              onClick={() => ui.openCommunityPane(item.id)}
            >
              <SidebarItemLabel icon={item.icon} label={item.label} />
            </button>
          ))}
          <div className="sidebar-divider" />
          {authorEntries.map((item) => (
            <button
              key={item.id}
              className={ui.communityPane === item.id ? "sidebar-switch active" : "sidebar-switch"}
              type="button"
              data-testid={item.id === "publish" ? "my-skills-publish-tab" : "my-skills-published-tab"}
              onClick={() => ui.openCommunityPane(item.id)}
            >
              <SidebarItemLabel icon={item.icon} label={item.label} />
            </button>
          ))}
        </aside>
        <div className="workspace-main">
          {ui.communityPane === "skills" ? (
            <div className="community-content">
              {!workspace.loggedIn ? (
                <AuthGateCard
                  title="登录后同步完整社区"
                  body="游客状态下优先展示本机与缓存数据。登录后可搜索完整市场、安装 Skill 和进入发布中心。"
                  onLogin={() => workspace.requireAuth("market")}
                />
              ) : null}
              <section className="stage-panel community-filter-panel">
                <div className="meta-strip">
                  <span className="metric-chip">当前 {workspace.marketSkills.length} 个结果</span>
                  <span className="metric-chip">{communityScopeLabel}</span>
                </div>
                <div className="search-sort-row">
                  <label className="search-shell">
                    <Search size={16} />
                    <input
                      aria-label="搜索市场 Skill"
                      type="search"
                      value={workspace.filters.query}
                      placeholder="搜索名称、描述、标签、作者或部门"
                      onChange={(event) => workspace.setFilters((current) => ({ ...current, query: event.target.value }))}
                    />
                  </label>
                  <select
                    className="sort-select"
                    aria-label="排序"
                    value={workspace.filters.sort}
                    onChange={(event) => workspace.setFilters((current) => ({ ...current, sort: event.target.value as MarketFilters["sort"] }))}
                  >
                    <option value="composite">综合排序</option>
                    <option value="latest_published">最新发布</option>
                    <option value="recently_updated">最近更新</option>
                    <option value="download_count">下载量</option>
                    <option value="star_count">Star 数</option>
                    <option value="relevance">相关度</option>
                  </select>
                </div>
                <div className="tag-row community-primary-filters">
                  {visibleCategoryFilters.map(renderCategoryFilter)}
                  <button
                    className={moreFiltersActive ? "tag-filter tag-disclosure active" : "tag-filter tag-disclosure"}
                    type="button"
                    aria-expanded={filtersExpanded}
                    aria-label={`${filtersExpanded ? "收起" : "展开"}更多筛选`}
                    onClick={() => setFiltersExpanded((current) => !current)}
                  >
                    <span>更多筛选{hiddenFilterCount > 0 ? ` ${hiddenFilterCount}` : ""}</span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                </div>
                {filtersExpanded ? (
                  <div className="more-filter-panel">
                    <div className="filter-block">
                      <span className="filter-label">完整分类</span>
                      <div className="tag-row compact">
                        {allCategoryFilters.map(renderCategoryFilter)}
                      </div>
                    </div>
                    <div className="filter-block">
                      <span className="filter-label">标签</span>
                      <div className="tag-row compact">
                        <button
                          className={activeTags.length === 0 ? "tag-filter active" : "tag-filter"}
                          type="button"
                          onClick={() => workspace.setFilters((current) => ({ ...current, tags: [] }))}
                        >
                          全部标签
                        </button>
                        {workspace.tags.map((tag) => {
                          const active = activeTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              className={active ? "tag-filter active" : "tag-filter"}
                              type="button"
                              aria-pressed={active}
                              onClick={() => workspace.setFilters((current) => ({ ...current, tags: toggleStringItem(current.tags, tag) }))}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
              <div className="community-grid-layout" data-empty={isCommunityResultsEmpty ? "true" : undefined}>
                <section className="stage-panel community-results-panel" data-empty={isCommunityResultsEmpty ? "true" : undefined}>
                  <div className="meta-strip">
                    <span className="metric-chip">{workspace.filters.category === "all" ? "全部分类" : workspace.filters.category}</span>
                    <span className="metric-chip">{communitySortLabel}</span>
                  </div>
                  {isCommunityResultsEmpty ? <SectionEmpty title="没有符合筛选的 Skill" body="换一个搜索词或标签再试一次。" /> : null}
                  <div className="market-grid">
                    {workspace.marketSkills.map((skill) => (
                      <CommunitySkillCard key={skill.skillID} workspace={workspace} ui={ui} skill={skill} />
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
          {ui.communityPane === "mcp" || ui.communityPane === "plugins" ? (
            <CommunityPlaceholder title={ui.communityPane === "mcp" ? "MCP" : "插件"} />
          ) : null}
          {ui.communityPane === "publish" || ui.communityPane === "mine" ? (
            <CommunityPublisherWorkspace workspace={workspace} ui={ui} pane={ui.communityPane} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LocalSkillDetail({ workspace, ui, skill }: SectionProps & { skill: SkillSummary }) {
  const issues = ui.installedView.installedSkillIssuesByID[skill.skillID] ?? [];
  const primaryAction = skill.installState === "update_available" ? "更新" : "启用范围";
  const view = localSkillView(skill, ui);

  return (
    <UnifiedSkillInspector
      view={{ ...view, reviewSummary: issues[0] ?? view.reviewSummary }}
      actions={
        <>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => (skill.installState === "update_available" ? ui.openInstallConfirm(skill, "update") : ui.openTargetsModal(skill))}
          >
            {primaryAction}
          </button>
          <button className="btn" type="button" onClick={() => ui.openSkillDetail(skill.skillID, "local")}>
            完整详情
          </button>
        </>
      }
      dangerActions={
        <button className="btn btn-danger" type="button" onClick={() => ui.openUninstallConfirm(skill)}>
          卸载
        </button>
      }
    >
      <div className="detail-block">
        <h3>已启用位置</h3>
        {skill.enabledTargets.length === 0 ? <p>当前还没有启用目标。</p> : null}
        <div className="stack-list compact">
          {skill.enabledTargets.map((target) => (
            <div className="micro-row" key={`${target.targetType}:${target.targetID}`}>
              <strong>{target.targetName}</strong>
              <small>{target.targetPath}</small>
            </div>
          ))}
        </div>
      </div>
    </UnifiedSkillInspector>
  );
}

function LocalSkillRow({
  skill,
  workspace,
  ui,
  active
}: {
  skill: SkillSummary;
  workspace: P1WorkspaceState;
  ui: DesktopUIState;
  active: boolean;
}) {
  const issues = ui.installedView.installedSkillIssuesByID[skill.skillID] ?? [];
  const primaryAction = skill.installState === "update_available" ? "更新" : "启用";
  const view = localSkillView(skill, ui);

  return (
    <UnifiedSkillRow
      view={{ ...view, description: issues[0] ?? view.description }}
      active={active}
      onSelect={() => workspace.selectSkill(skill.skillID)}
      actions={
        <>
          <button
            className="btn btn-primary btn-small"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (skill.installState === "update_available") {
                ui.openInstallConfirm(skill, "update");
                return;
              }
              ui.openTargetsModal(skill);
            }}
          >
            {primaryAction}
          </button>
          <button
            className="btn btn-small"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              ui.openSkillDetail(skill.skillID, "local");
            }}
          >
            详情
          </button>
          <button
            className="btn btn-danger btn-small"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              ui.openUninstallConfirm(skill);
            }}
          >
            卸载
          </button>
        </>
      }
    />
  );
}

function LocalDiscoveredSkillRow({
  skill,
  workspace,
  ui,
  active
}: {
  skill: DiscoveredLocalSkill;
  workspace: P1WorkspaceState;
  ui: DesktopUIState;
  active: boolean;
}) {
  const view = discoveredSkillView(skill);
  const marketSkill = workspace.skills.find((item) => item.skillID === skill.skillID && item.localVersion === null) ?? null;

  return (
    <UnifiedSkillRow
      view={view}
      active={active}
      onSelect={() => workspace.selectSkill(skill.skillID)}
      actions={
        <>
          <button
            className="btn btn-primary btn-small"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (skill.hasCentralStoreConflict || skill.hasScanConflict) {
                ui.openLocalImportModal(skill.skillID);
                return;
              }
              void workspace.importLocalSkill(skill, skill.skillID, "rename");
            }}
            disabled={!skill.canImport}
          >
            纳入管理
          </button>
          {marketSkill ? (
            <button
              className="btn btn-small"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                ui.openSkillDetail(skill.skillID, "community");
              }}
            >
              社区详情
            </button>
          ) : null}
	        </>
	      }
	    />
  );
}

function LocalDiscoveredSkillDetail({
  skill,
  workspace,
  ui
}: SectionProps & { skill: DiscoveredLocalSkill }) {
  const view = discoveredSkillView(skill);
  const marketSkill = workspace.skills.find((item) => item.skillID === skill.skillID && item.localVersion === null) ?? null;

  return (
    <UnifiedSkillInspector
      view={view}
      actions={
        <>
          {marketSkill ? (
            <button className="btn btn-primary" type="button" onClick={() => ui.openSkillDetail(skill.skillID, "community")}>
              查看社区详情
            </button>
          ) : null}
	          <button className="btn btn-primary" type="button" onClick={() => ui.openLocalImportModal(skill.skillID)} disabled={!skill.canImport}>
	            纳入管理
	          </button>
	          <ScanLocalTargetsButton workspace={workspace} label="重新扫描" />
	        </>
	      }
    >
      <div className="detail-block">
        <h3>发现位置</h3>
        <div className="stack-list compact">
          {skill.targets.map((target) => (
            <div className="micro-row" key={`${target.targetType}:${target.targetID}:${target.relativePath}`}>
              <strong>{target.targetName}</strong>
              <small>{target.targetPath}</small>
              <small>{target.message}</small>
            </div>
          ))}
        </div>
      </div>
    </UnifiedSkillInspector>
  );
}

function LocalExtensionRow({
  extension,
  active,
  onSelect
}: {
  extension: ExtensionInstall;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <UnifiedSkillRow
      view={extensionView(extension)}
      active={active}
      onSelect={onSelect}
      actions={
        <button className="btn btn-small" type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }}>
          查看
        </button>
      }
    />
  );
}

function LocalExtensionTargetRow({
  target,
  onDisable
}: {
  target: PluginTarget;
  onDisable?: (target: PluginTarget) => void;
}) {
  return (
    <div className="micro-row">
      <strong>{target.targetName}</strong>
      <small>{target.targetType} · {target.targetAgent} · {target.status}</small>
      {target.targetPath ? <small>{target.targetPath}</small> : null}
      {target.denialReason ? <small>{target.denialReason}</small> : null}
      {target.status === "enabled" && onDisable ? (
        <button className="btn btn-small" type="button" onClick={() => onDisable(target)}>
          停用
        </button>
      ) : null}
    </div>
  );
}

function LocalExtensionDetail({ extension, workspace }: SectionProps & { extension: ExtensionInstall }) {
  const view = extensionView(extension);
  const enabledTargets = extension.targets.filter((target) => target.status === "enabled");
  const targetOptions = useMemo(
    () => [
      ...workspace.tools
        .filter((tool) => tool.enabled && tool.adapterStatus !== "missing")
        .map((tool) => ({
          id: `tool:${tool.toolID}`,
          targetType: "tool" as const,
          targetID: tool.toolID,
          label: tool.displayName || tool.name
        })),
      ...workspace.projects
        .filter((project) => project.enabled)
        .map((project) => ({
          id: `project:${project.projectID}`,
          targetType: "project" as const,
          targetID: project.projectID,
          label: project.displayName || project.name
        }))
    ],
    [workspace.projects, workspace.tools]
  );
  const [targetValue, setTargetValue] = useState("");
  const [requestedMode, setRequestedMode] = useState<"symlink" | "copy">("symlink");
  const selectedTarget = targetOptions.find((target) => target.id === targetValue) ?? targetOptions[0] ?? null;
  const canEnableExtension = extension.writeCapability && extension.enterpriseStatus === "allowed" && selectedTarget !== null;

  useEffect(() => {
    if (selectedTarget && selectedTarget.id !== targetValue) {
      setTargetValue(selectedTarget.id);
    }
  }, [selectedTarget, targetValue]);

  return (
    <UnifiedSkillInspector
      view={view}
      kicker="Extension 简介"
      actions={
        <>
          {extension.writeCapability ? <ScanLocalTargetsButton workspace={workspace} label="扫描目标" /> : null}
          <button
            className="btn btn-primary"
            type="button"
            disabled={!canEnableExtension}
            onClick={() => {
              if (!selectedTarget) return;
              void workspace.enableExtension(
                extension.extensionID,
                selectedTarget.targetType,
                selectedTarget.targetID,
                requestedMode
              ).catch(() => undefined);
            }}
          >
            {extension.writeCapability ? "启用到目标" : "仅审计/预检"}
          </button>
        </>
      }
    >
      <div className="definition-grid split">
        <div><dt>扩展类型</dt><dd>{extensionTypeLabel(extension.extensionType)}</dd></div>
        <div><dt>写入类型</dt><dd>{extensionKindLabel(extension.extensionKind)}</dd></div>
        <div><dt>企业状态</dt><dd>{extensionEnterpriseLabel(extension.enterpriseStatus)}</dd></div>
        <div><dt>写入能力</dt><dd>{extension.writeCapability ? "可启用" : "仅审计/预检"}</dd></div>
      </div>
      <div className="detail-block">
        <h3>权限与风险</h3>
        <div className="pill-row">
          {extension.permissions.length === 0 ? <TagPill tone="neutral">暂无权限声明</TagPill> : null}
          {extension.permissions.map((permission) => (
            <TagPill key={permission.id} tone={permission.riskLevel === "high" ? "danger" : permission.riskLevel === "medium" ? "warning" : "info"}>
              {permission.label}
            </TagPill>
          ))}
        </div>
      </div>
      {extension.writeCapability ? (
        <div className="detail-block">
          <h3>启用目标</h3>
          <div className="definition-grid split">
            <div>
              <dt>目标</dt>
              <dd>
                <select
                  className="sort-select"
                  aria-label="选择 Extension 启用目标"
                  value={selectedTarget?.id ?? ""}
                  onChange={(event) => setTargetValue(event.target.value)}
                  disabled={targetOptions.length === 0 || extension.enterpriseStatus !== "allowed"}
                >
                  {targetOptions.length === 0 ? <option value="">没有可用目标</option> : null}
                  {targetOptions.map((target) => (
                    <option key={target.id} value={target.id}>{target.label}</option>
                  ))}
                </select>
              </dd>
            </div>
            <div>
              <dt>写入模式</dt>
              <dd>
                <select
                  className="sort-select"
                  aria-label="选择 Extension 写入模式"
                  value={requestedMode}
                  onChange={(event) => setRequestedMode(event.target.value as "symlink" | "copy")}
                  disabled={extension.enterpriseStatus !== "allowed"}
                >
                  <option value="symlink">symlink 优先</option>
                  <option value="copy">copy</option>
                </select>
              </dd>
            </div>
          </div>
          {extension.enterpriseStatus !== "allowed" ? (
            <div className="callout warning"><AlertTriangle size={16} /> 企业策略已限制该扩展，不能新增启用。</div>
          ) : null}
        </div>
      ) : null}
      <div className="detail-block">
        <h3>目标状态</h3>
        {extension.targets.length === 0 ? <p>{extension.writeCapability ? "当前还没有启用目标。" : "P0 不为该类型创建启用目标。"}</p> : null}
        <div className="stack-list compact">
          {extension.targets.map((target) => (
            <LocalExtensionTargetRow
              key={target.id}
              target={target}
              onDisable={extension.writeCapability ? (currentTarget) => {
                void workspace.disableExtension(
                  extension.extensionID,
                  currentTarget.targetID,
                  currentTarget.targetType
                ).catch(() => undefined);
              } : undefined}
            />
          ))}
        </div>
        {enabledTargets.length > 0 && extension.enterpriseStatus !== "allowed" ? (
          <div className="callout warning"><AlertTriangle size={16} /> 企业策略已限制该扩展，新增启用会被阻止。</div>
        ) : null}
      </div>
    </UnifiedSkillInspector>
  );
}

function LocalToolsAndProjects({
  workspace,
  ui,
  pane
}: SectionProps & { pane: "tools" | "projects" }) {
  const [query, setQuery] = useState("");

  const entities = pane === "tools"
    ? [...workspace.tools].sort(compareToolsByAvailability).map((tool) => ({
        id: tool.toolID,
        title: tool.displayName || tool.name,
        subtitle: transformStrategyLabel(tool.transformStrategy, ui.language),
        body: tool.skillsPath || "未配置",
        meta: adapterStatusLabel(tool.adapterStatus, ui.language)
      }))
    : workspace.projects.map((project) => ({
        id: project.projectID,
        title: project.name,
        subtitle: project.projectPath,
        body: project.skillsPath,
        meta: projectPathStatusLabel(project.projectPathStatus, ui.language)
      }));
  const filteredEntities = entities.filter((entity) => {
    if (!query.trim()) return true;
    const keyword = `${entity.title} ${entity.subtitle} ${entity.body} ${entity.meta}`.toLowerCase();
    return keyword.includes(query.trim().toLowerCase());
  });

  return (
    <div className="local-single-list-shell">
      <section className="stage-panel list-panel local-list-panel">
        <div className="local-filter-shell">
          <div className="meta-strip">
            <span className="metric-chip">当前 {filteredEntities.length} 项</span>
          </div>
          <div className="search-sort-row list-toolbar-row">
            <label className="search-shell">
              <Search size={16} />
              <input
                aria-label={pane === "tools" ? "搜索工具" : "搜索项目"}
                type="search"
                value={query}
                placeholder={pane === "tools" ? "搜索工具名称或安装路径" : "搜索项目名称或项目路径"}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="inline-actions">
              <ScanLocalTargetsButton workspace={workspace} />
              {pane === "tools" ? (
                <button className="btn btn-primary" type="button" onClick={() => ui.openToolEditor()}>
                  <Plus size={14} />
                  添加工具
                </button>
              ) : (
                <button className="btn btn-primary" type="button" onClick={() => ui.openProjectEditor()}>
                  <FolderPlus size={14} />
                  添加项目
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="selection-list">
          {filteredEntities.length === 0 ? (
            <SectionEmpty title={pane === "tools" ? "还没有工具配置" : "还没有项目配置"} body={pane === "tools" ? "添加工具后可查看路径、状态和已启用 Skill。" : "添加项目后可查看项目路径和当前生效 Skill。"} />
          ) : null}
          {filteredEntities.map((entity) => (
            <article key={entity.id} className="local-item static-row">
              {pane === "tools" ? <ToolBrandMark toolID={entity.id} label={entity.title} /> : <span className={`entity-mark icon-tone-${iconToneForLabel(entity.title)}`}>{skillInitials(entity.title)}</span>}
              <div className="list-row-copy">
                <strong>{entity.title}</strong>
                <p>{entity.subtitle}</p>
                <div className="meta-strip">
                  <span className="metric-chip">{entity.meta}</span>
                  <span className="metric-chip">{entity.body}</span>
                </div>
              </div>
              <div className="skill-side">
                <div className="skill-actions">
                  {pane === "tools" ? (
                    <>
                      <button
                        className="btn btn-small"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const tool = workspace.tools.find((item) => item.toolID === entity.id);
                          if (tool) {
                            ui.openToolEditor(tool);
                          }
                        }}
                      >
                        编辑路径
                      </button>
                      <button
                        className="btn btn-small"
                        type="button"
                        disabled={(() => {
                          const tool = workspace.tools.find((item) => item.toolID === entity.id);
                          if (!tool) return true;
                          if (tool.enabledSkillCount > 0) return true;
                          return tool.toolID === "custom_directory" && !tool.configuredPath && !tool.skillsPath.trim();
                        })()}
                        onClick={(event) => {
                          event.stopPropagation();
                          ui.confirmDeleteToolConfig(entity.id);
                        }}
                      >
                        删除
                      </button>
                    </>
                  ) : null}
                  {pane === "projects" ? (
                    <>
                      <button
                        className="btn btn-small"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const project = workspace.projects.find((item) => item.projectID === entity.id);
                          if (project) {
                            ui.openProjectEditor(project);
                          }
                        }}
                      >
                        启用管理
                      </button>
                      <button
                        className="btn btn-small"
                        type="button"
                        disabled={(workspace.projects.find((item) => item.projectID === entity.id)?.enabledSkillCount ?? 0) > 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          ui.confirmDeleteProjectConfig(entity.id);
                        }}
                      >
                        删除
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LocalSection({ workspace, ui }: SectionProps) {
  const [extensionQuery, setExtensionQuery] = useState("");
  const [selectedExtensionID, setSelectedExtensionID] = useState("");
  const selectedSkill = useMemo(() => {
    const filtered = ui.installedView.filteredInstalledSkills;
    return filtered.find((skill) => skill.skillID === workspace.selectedSkillID) ?? null;
  }, [ui.installedView.filteredInstalledSkills, workspace.selectedSkillID]);
  const filteredDiscoveredSkills = useMemo(() => {
    const query = ui.installedView.installedQuery.trim().toLocaleLowerCase();
    return workspace.discoveredLocalSkills.filter((skill) => {
      const matchesFilter = ui.installedView.installedFilter === "all" || ui.installedView.installedFilter === "issues";
      if (!matchesFilter) return false;
      if (!matchesDiscoveredTargetFilter(skill, ui.installedView.installedTargetFilterType, ui.installedView.installedTargetFilterID)) return false;
      if (!query) return true;
      const text = [
        skill.skillID,
        skill.displayName,
        skill.description,
        skill.sourceLabel,
        ...skill.targets.flatMap((target) => [target.targetName, target.targetPath, target.relativePath, target.message])
      ].join(" ").toLocaleLowerCase();
      return text.includes(query);
    });
  }, [
    ui.installedView.installedFilter,
    ui.installedView.installedQuery,
    ui.installedView.installedTargetFilterID,
    ui.installedView.installedTargetFilterType,
    workspace.discoveredLocalSkills
  ]);
  const selectedDiscoveredSkill = useMemo(
    () =>
      selectedSkill
        ? null
        : filteredDiscoveredSkills.find((skill) => skill.skillID === workspace.selectedSkillID) ?? null,
    [filteredDiscoveredSkills, selectedSkill, workspace.selectedSkillID]
  );
  const hasLocalSkillRows = ui.installedView.filteredInstalledSkills.length > 0 || filteredDiscoveredSkills.length > 0;
  const isLocalSkillsEmptyState = !hasLocalSkillRows && !selectedSkill && !selectedDiscoveredSkill;
  const filteredExtensions = useMemo(() => {
    const query = extensionQuery.trim().toLocaleLowerCase();
    return workspace.localExtensions.filter((extension) => {
      if (!query) return true;
      const text = [
        extension.extensionID,
        extension.displayName,
        extension.extensionType,
        extension.extensionKind,
        extension.enterpriseStatus,
        extension.auditStatus,
        ...extension.permissions.map((permission) => permission.label),
        ...extension.targets.flatMap((target) => [target.targetName, target.targetPath ?? "", target.status, target.denialReason ?? ""])
      ].join(" ").toLocaleLowerCase();
      return text.includes(query);
    });
  }, [extensionQuery, workspace.localExtensions]);
  const selectedExtension = useMemo(
    () => filteredExtensions.find((extension) => extension.extensionID === selectedExtensionID) ?? filteredExtensions[0] ?? null,
    [filteredExtensions, selectedExtensionID]
  );

  useEffect(() => {
    const nextSkillID =
      selectedSkill?.skillID ??
      selectedDiscoveredSkill?.skillID ??
      ui.installedView.filteredInstalledSkills[0]?.skillID ??
      filteredDiscoveredSkills[0]?.skillID ??
      "";
    if (nextSkillID && workspace.selectedSkillID !== nextSkillID) {
      workspace.selectSkill(nextSkillID);
    }
  }, [filteredDiscoveredSkills, selectedDiscoveredSkill, selectedSkill, ui.installedView.filteredInstalledSkills, workspace]);

  useEffect(() => {
    if (!selectedExtension && selectedExtensionID) {
      setSelectedExtensionID("");
      return;
    }
    if (!selectedExtensionID && filteredExtensions[0]) {
      setSelectedExtensionID(filteredExtensions[0].extensionID);
    }
  }, [filteredExtensions, selectedExtension, selectedExtensionID]);

  const sidebarItems = [
    { id: "skills", label: "Skills", icon: <Sparkles size={16} /> },
    { id: "extensions", label: "扩展", icon: <PackageCheck size={16} /> },
    { id: "tools", label: "工具", icon: <CircleGauge size={16} /> },
    { id: "projects", label: "项目", icon: <FolderPlus size={16} /> }
  ] as const;

  return (
    <div className="stage-page workspace-page local-page">
      <div className="workspace-layout workspace-grid local-workspace">
        <aside className="workspace-sidebar side-switcher">
          <div className="sidebar-title">本地入口</div>
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className={ui.localPane === item.id ? "sidebar-switch active" : "sidebar-switch"}
              type="button"
              onClick={() => ui.openLocalPane(item.id)}
            >
              <SidebarItemLabel icon={item.icon} label={item.label} />
            </button>
          ))}
        </aside>
        <div className="workspace-main local-main">
          {ui.localPane === "skills" ? (
            <div className="list-detail-shell local-browser has-detail" data-empty={isLocalSkillsEmptyState ? "true" : undefined}>
              <section className="stage-panel list-panel local-list-panel" data-empty={isLocalSkillsEmptyState ? "true" : undefined}>
                <div className="local-filter-shell">
                  <div className="meta-strip">
                    <span className="metric-chip">已纳管 {ui.installedView.filteredInstalledSkills.length}</span>
                    <span className="metric-chip">待处理 {filteredDiscoveredSkills.length}</span>
                  </div>
                  <div className="search-sort-row list-toolbar-row">
                    <label className="search-shell">
                      <Search size={16} />
                      <input
                        aria-label="搜索本地 Skill"
                        type="search"
                        value={ui.installedView.installedQuery}
                        placeholder="搜索 Skill 名称、skillID 或异常摘要"
                        onChange={(event) => ui.installedView.setInstalledQuery(event.target.value)}
                      />
                    </label>
                    <ScanLocalTargetsButton workspace={workspace} />
                  </div>
                  <div className="inline-actions wrap">
                    {([
                      ["all", "全部"],
                      ["enabled", "已启用"],
                      ["updates", "待更新"],
                      ["scope_restricted", "权限收缩"],
                      ["issues", "异常"]
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        className={ui.installedView.installedFilter === key ? "btn btn-primary btn-small" : "btn btn-small"}
                        type="button"
                        onClick={() => ui.installedView.setInstalledFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
	                  </div>
	                  <div className="search-sort-row local-target-filter-row">
	                    <select
	                      className="sort-select"
	                      aria-label="按目标过滤 Skill"
	                      value={ui.installedView.installedTargetFilterValue}
	                      onChange={(event) => ui.installedView.setInstalledTargetFilterValue(event.target.value as typeof ui.installedView.installedTargetFilterValue)}
	                    >
	                      <option value="all">全部目标</option>
	                      {ui.installedView.installedTargetOptions.map((target) => (
	                        <option key={target.id} value={target.id}>{target.label}</option>
	                      ))}
	                    </select>
	                  </div>
                </div>
                <div className="selection-list">
                  {!hasLocalSkillRows ? (
                    <SectionEmpty title="没有符合条件的本地 Skill" body="切换筛选或清空搜索词后再试一次。" />
                  ) : null}
                  {ui.installedView.filteredInstalledSkills.map((skill) => {
                    return (
                      <LocalSkillRow
                        key={skill.skillID}
                        skill={skill}
                        workspace={workspace}
                        ui={ui}
                        active={selectedSkill?.skillID === skill.skillID}
                      />
                    );
                  })}
                  {filteredDiscoveredSkills.map((skill) => (
                    <LocalDiscoveredSkillRow
                      key={`discovered:${skill.skillID}`}
                      skill={skill}
                      workspace={workspace}
                      ui={ui}
                      active={!selectedSkill && selectedDiscoveredSkill?.skillID === skill.skillID}
                    />
                  ))}
                </div>
              </section>
              {selectedSkill ? (
                <LocalSkillDetail workspace={workspace} ui={ui} skill={selectedSkill} />
              ) : selectedDiscoveredSkill ? (
                <LocalDiscoveredSkillDetail workspace={workspace} ui={ui} skill={selectedDiscoveredSkill} />
              ) : (
                <aside className="detail-panel inspector-panel detail-placeholder-panel"><SectionEmpty title="选择一个 Skill 查看详情" body="详情区会集中展示版本、范围、风险摘要和下一步动作。" compact align="start" /></aside>
              )}
            </div>
          ) : null}

          {ui.localPane === "extensions" ? (
            <div className="list-detail-shell local-browser has-detail" data-empty={filteredExtensions.length === 0 ? "true" : undefined}>
              <section className="stage-panel list-panel local-list-panel" data-empty={filteredExtensions.length === 0 ? "true" : undefined}>
                <div className="local-filter-shell">
                  <div className="meta-strip">
                    <span className="metric-chip">扩展 {filteredExtensions.length}</span>
                    <span className="metric-chip">可启用 {filteredExtensions.filter((extension) => extension.writeCapability).length}</span>
                    <span className="metric-chip">只读 {filteredExtensions.filter((extension) => !extension.writeCapability).length}</span>
                  </div>
                  <div className="search-sort-row list-toolbar-row">
                    <label className="search-shell">
                      <Search size={16} />
                      <input
                        aria-label="搜索本地扩展"
                        type="search"
                        value={extensionQuery}
                        placeholder="搜索扩展名称、类型、审计或目标状态"
                        onChange={(event) => setExtensionQuery(event.target.value)}
                      />
                    </label>
                    <ScanLocalTargetsButton workspace={workspace} />
                  </div>
                </div>
                <div className="selection-list">
                  {filteredExtensions.length === 0 ? <SectionEmpty title="没有符合条件的扩展" body="已安装 Skill 会自动投影为 file-backed Extension；非文件型扩展在 P0 仅展示审计/预检状态。" /> : null}
                  {filteredExtensions.map((extension) => (
                    <LocalExtensionRow
                      key={extension.extensionID}
                      extension={extension}
                      active={selectedExtension?.extensionID === extension.extensionID}
                      onSelect={() => setSelectedExtensionID(extension.extensionID)}
                    />
                  ))}
                </div>
              </section>
              {selectedExtension ? (
                <LocalExtensionDetail workspace={workspace} ui={ui} extension={selectedExtension} />
              ) : (
                <aside className="detail-panel inspector-panel detail-placeholder-panel"><SectionEmpty title="选择一个扩展查看详情" body="详情区会展示类型、权限、审计、企业状态和目标状态。" compact align="start" /></aside>
              )}
            </div>
          ) : null}

          {ui.localPane === "tools" ? <LocalToolsAndProjects workspace={workspace} ui={ui} pane="tools" /> : null}
          {ui.localPane === "projects" ? <LocalToolsAndProjects workspace={workspace} ui={ui} pane="projects" /> : null}
        </div>
      </div>
    </div>
  );
}

function ManageSidebar({ workspace, ui }: SectionProps) {
  const items: Array<{ id: "reviews" | "skills" | "departments" | "users" | "client_updates"; label: string; icon: ReactNode }> = [
    { id: "reviews", label: "审核", icon: <ClipboardCheck size={16} /> },
    { id: "skills", label: "Skills", icon: <Sparkles size={16} /> },
    { id: "departments", label: "部门", icon: <Building2 size={16} /> },
    { id: "users", label: "用户", icon: <Users size={16} /> },
    ...(canAccessClientUpdateManagement(workspace.currentUser)
      ? [{ id: "client_updates" as const, label: "客户端更新", icon: <Upload size={16} /> }]
      : [])
  ];

  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-title">管理入口</div>
      {items.map((item) => (
        <button
          key={item.id}
          className={ui.managePane === item.id ? "sidebar-switch active" : "sidebar-switch"}
          type="button"
          onClick={() => ui.openManagePane(item.id)}
        >
          <SidebarItemLabel icon={item.icon} label={item.label} />
        </button>
      ))}
    </aside>
  );
}

function reviewStatusTone(review: Pick<ReviewDetail, "reviewStatus">): "success" | "warning" | "danger" | "info" | "neutral" {
  if (review.reviewStatus === "reviewed") return "success";
  if (review.reviewStatus === "in_review") return "warning";
  return "info";
}

function riskToneForLevel(risk: RiskLevel): "success" | "warning" | "danger" | "info" | "neutral" {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "low") return "success";
  return "neutral";
}

function reviewRiskText(risk: RiskLevel) {
  return {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
    unknown: "未知风险"
  }[risk];
}

function reviewChangeLines(review: ReviewDetail, language: "zh-CN" | "en-US") {
  if (review.reviewType === "permission_change") {
    const currentScope = review.currentScopeType ? scopeLabel(review.currentScopeType, language) : "未设置";
    const requestedScope = review.requestedScopeType ? scopeLabel(review.requestedScopeType, language) : currentScope;
    const currentVisibility = review.currentVisibilityLevel ? publishVisibilityLabel(review.currentVisibilityLevel, language) : "未设置";
    const requestedVisibility = review.requestedVisibilityLevel ? publishVisibilityLabel(review.requestedVisibilityLevel, language) : currentVisibility;
    return [
      `授权范围：${currentScope} -> ${requestedScope}`,
      `公开级别：${currentVisibility} -> ${requestedVisibility}`
    ];
  }

  if (review.reviewType === "update") {
    return [
      `版本：${review.currentVersion ?? "未发布"} -> ${review.requestedVersion ?? "未填写"}`,
      review.summary || review.reviewSummary || "暂无变更摘要"
    ];
  }

  return [
    `目标版本：${review.requestedVersion ?? review.currentVersion ?? "未填写"}`,
    `公开级别：${review.requestedVisibilityLevel ? publishVisibilityLabel(review.requestedVisibilityLevel, language) : "未设置"}`,
    `授权范围：${review.requestedScopeType ? scopeLabel(review.requestedScopeType, language) : "未设置"}`
  ];
}

function ManageReviewsPane({ workspace, ui }: SectionProps) {
  useEffect(() => {
    if (!workspace.adminData.selectedReviewID && workspace.adminData.reviews[0]) {
      workspace.adminData.setSelectedReviewID(workspace.adminData.reviews[0].reviewID);
    }
  }, [workspace]);

  const selectedReview = workspace.adminData.selectedReview;
  const warningPrechecks = selectedReview?.precheckResults.filter((item) => item.status === "warn") ?? [];
  const latestHistory = selectedReview?.history[selectedReview.history.length - 1] ?? null;
  const selectedChangeLines = selectedReview ? reviewChangeLines(selectedReview, ui.language) : [];
  const pendingCount = workspace.adminData.reviews.filter((review) => review.reviewStatus === "pending").length;
  const inReviewCount = workspace.adminData.reviews.filter((review) => review.reviewStatus === "in_review").length;
  const reviewedCount = workspace.adminData.reviews.filter((review) => review.reviewStatus === "reviewed").length;

  return (
    <div className="manage-pane-grid reviews">
      <section className="stage-panel list-panel">
        <div className="manage-panel-toolbar stack">
          <div className="meta-strip">
            <span className="metric-chip">待审核 {pendingCount}</span>
            <span className="metric-chip">审核中 {inReviewCount}</span>
            <span className="metric-chip">已审核 {reviewedCount}</span>
          </div>
          <div className="inline-actions wrap">
            {([
              ["pending", "待审核"],
              ["in_review", "审核中"],
              ["reviewed", "已审核"]
            ] as const).map(([tab, label]) => (
              <button key={tab} className={ui.reviewTab === tab ? "btn btn-primary btn-small" : "btn btn-small"} type="button" onClick={() => ui.setReviewTab(tab)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="stack-list">
          {ui.filteredReviews.length === 0 ? <SectionEmpty title="当前没有审核单" body="待审核、审核中和已审核会根据当前筛选展示在这里。" /> : null}
          {ui.filteredReviews.map((review) => (
            <button
              key={review.reviewID}
              className={selectedReview?.reviewID === review.reviewID ? "selection-row active" : "selection-row"}
              type="button"
              data-testid="review-row"
              data-skill-id={review.skillID}
              onClick={() => workspace.adminData.setSelectedReviewID(review.reviewID)}
            >
              <div className="selection-row-main">
                <InitialBadge label={review.skillDisplayName} />
                <span>
                  <strong>{review.skillDisplayName}</strong>
                  <small>{review.submitterName} · {submissionTypeLabel(review.reviewType, ui.language)}</small>
                </span>
              </div>
              <span className="selection-row-meta">
                <TagPill tone={reviewStatusTone(review)}>
                  {workflowStateLabel(review.workflowState, ui.language)}
                </TagPill>
                <small>{formatDate(review.submittedAt, ui.language)}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="stage-panel detail-panel wide inspector-panel manage-review-detail" data-testid="review-detail-panel">
        {!selectedReview ? (
          <SectionEmpty title="选择一条审核单查看摘要" body="工作台右侧用于快速判断，完整处理请进入审核详情。" />
        ) : (
          <>
            <div className="detail-block">
              <div className="pill-row">
                <TagPill tone={reviewStatusTone(selectedReview)}>
                  {workflowStateLabel(selectedReview.workflowState, ui.language)}
                </TagPill>
                <TagPill tone={riskToneForLevel(selectedReview.riskLevel)}>
                  {reviewRiskText(selectedReview.riskLevel)}
                </TagPill>
                <TagPill tone="neutral">{submissionTypeLabel(selectedReview.reviewType, ui.language)}</TagPill>
              </div>
              <h3>{selectedReview.skillDisplayName}</h3>
              <p>{selectedReview.summary || selectedReview.description}</p>
            </div>
            <div className="definition-grid split">
              <div><dt>提交人</dt><dd>{selectedReview.submitterName}</dd></div>
              <div><dt>部门</dt><dd>{selectedReview.submitterDepartmentName}</dd></div>
              <div><dt>当前版本</dt><dd>{selectedReview.currentVersion ?? "-"}</dd></div>
              <div><dt>目标版本</dt><dd>{selectedReview.requestedVersion ?? "-"}</dd></div>
              <div><dt>公开级别</dt><dd>{selectedReview.requestedVisibilityLevel ?? "-"}</dd></div>
              <div><dt>当前审核人</dt><dd>{selectedReview.currentReviewerName ?? "未锁定"}</dd></div>
              <div><dt>分类</dt><dd>{selectedReview.category}</dd></div>
              <div><dt>标签</dt><dd>{selectedReview.tags.length > 0 ? selectedReview.tags.join("、") : "-"}</dd></div>
            </div>
            <div className="detail-block inspector-subsection">
              <h3>本次变更</h3>
              <div className="stack-list compact">
                {selectedChangeLines.map((line) => (
                  <div className="micro-row" key={line}>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="detail-block inspector-subsection">
              <h3>预检查概览</h3>
              {selectedReview.precheckResults.length === 0 ? <p>系统初审尚未返回结果。</p> : null}
              {selectedReview.precheckResults.length > 0 ? (
                <p>{warningPrechecks.length > 0 ? `有 ${warningPrechecks.length} 个警告项，进入详情查看处理建议。` : "未发现警告项，可进入详情完成最终判断。"}</p>
              ) : null}
              {warningPrechecks[0] ? (
                <div className="micro-row">
                  <strong>{warningPrechecks[0].label}</strong>
                  <small>{warningPrechecks[0].message}</small>
                </div>
              ) : null}
            </div>
            <div className="detail-block inspector-subsection">
              <h3>最近历史</h3>
              {latestHistory ? (
                <div className="micro-row">
                  <strong>{latestHistory.actorName} · {workflowStateLabel(latestHistory.action, ui.language)}</strong>
                  <small>{latestHistory.comment ?? "无补充说明"} · {formatDate(latestHistory.createdAt, ui.language)}</small>
                </div>
              ) : (
                <p>暂无审核历史。</p>
              )}
            </div>
            <div className="inline-actions wrap">
              <button className="btn btn-primary" type="button" onClick={() => ui.openReviewDetail(selectedReview.reviewID)}>
                打开审核详情
              </button>
              <button className="btn" type="button" onClick={() => ui.openSkillDetail(selectedReview.skillID, "manage")}>
                Skill 详情
              </button>
            </div>
            <div className="detail-block review-summary-note">
              <p>最终审核动作、审核意见、文件预览和完整历史统一在全屏审核详情中处理。</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ManageSkillsPane({ workspace, ui }: SectionProps) {
  const [selectedSkillID, setSelectedSkillID] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "delisted" | "archived">("all");
  const managedSkills = workspace.adminData.adminSkills;
  const visibleManagedSkills = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return managedSkills.filter((skill) => {
      if (statusFilter !== "all" && skill.status !== statusFilter) return false;
      if (!keyword) return true;
      return [
        skill.displayName,
        skill.skillID,
        skill.publisherName,
        skill.departmentName,
        getAdminSkillCategory(skill),
        getAdminSkillDescription(skill)
      ].join(" ").toLowerCase().includes(keyword);
    });
  }, [managedSkills, query, statusFilter]);

  useEffect(() => {
    setSelectedSkillID((current) => (visibleManagedSkills.some((skill) => skill.skillID === current) ? current : visibleManagedSkills[0]?.skillID ?? null));
  }, [visibleManagedSkills]);

  const statusCounts = {
    all: managedSkills.length,
    published: managedSkills.filter((skill) => skill.status === "published").length,
    delisted: managedSkills.filter((skill) => skill.status === "delisted").length,
    archived: managedSkills.filter((skill) => skill.status === "archived").length
  } as const;

  const selectedSkill = managedSkills.find((skill) => skill.skillID === selectedSkillID) ?? null;
  const selectedSkillView = selectedSkill ? adminSkillView(selectedSkill, ui.language) : null;

  return (
    <div className="manage-pane-grid skills-workbench">
      <section className="stage-panel list-panel manage-list-panel manage-skills-list-panel">
        <div className="local-filter-shell manage-skills-filter">
          <label className="search-shell">
            <Search size={16} />
            <input
              aria-label="搜索管理 Skill"
              type="search"
              value={query}
              placeholder="搜索 Skill 名称、skillID、发布者或部门"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="inline-actions wrap">
            {([
              ["all", "全部"],
              ["published", "已上架"],
              ["delisted", "已下架"],
              ["archived", "已归档"]
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={statusFilter === key ? "btn btn-primary btn-small" : "btn btn-small"}
                type="button"
                onClick={() => setStatusFilter(key)}
              >
                <span>{label}</span>
                <span className="filter-button-count" aria-hidden="true">{statusCounts[key]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="selection-list">
          {visibleManagedSkills.length === 0 ? <SectionEmpty title="暂无符合条件的 Skill" body="保持在线后会加载可管理范围内的 Skill，或换一个筛选条件。" /> : null}
          {visibleManagedSkills.map((skill) => {
            const view = adminSkillView(skill, ui.language);
            return (
              <UnifiedSkillRow
                key={skill.skillID}
                view={view}
                active={selectedSkill?.skillID === skill.skillID}
                onSelect={() => setSelectedSkillID(skill.skillID)}
                actions={
                  <button
                    className="btn btn-small"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      ui.openSkillDetail(skill.skillID, "manage");
                    }}
                  >
                    完整详情
                  </button>
                }
              />
            );
          })}
        </div>
      </section>
      {!selectedSkill || !selectedSkillView ? (
        <aside className="detail-panel inspector-panel manage-summary-panel">
          <SectionEmpty title="选择一个 Skill 查看详情" body="详情区会展示发布者、风险、公开级别和可执行治理动作。" compact align="start" />
        </aside>
      ) : (
        <UnifiedSkillInspector
          view={selectedSkillView}
          className="manage-summary-panel"
          actions={
            <>
              <button className="btn" type="button" onClick={() => ui.openSkillDetail(selectedSkill.skillID, "manage")}>
                完整详情
              </button>
              {selectedSkill.status === "published" ? (
                <button className="btn" type="button" onClick={() => void workspace.adminData.delistAdminSkill(selectedSkill.skillID)}>
                  下架
                </button>
              ) : null}
              {selectedSkill.status === "delisted" ? (
                <button className="btn" type="button" onClick={() => void workspace.adminData.relistAdminSkill(selectedSkill.skillID)}>
                  上架
                </button>
              ) : null}
            </>
          }
          dangerActions={
            selectedSkill.status !== "archived" ? (
              <button className="btn btn-danger" type="button" onClick={() => void workspace.adminData.archiveAdminSkill(selectedSkill.skillID)}>
                归档
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
}

function ManageDepartmentsPane({ workspace }: { workspace: P1WorkspaceState }) {
  const [createName, setCreateName] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [departmentView, setDepartmentView] = useState<"children" | "users" | "skills">("children");
  const [expandedDepartmentIDs, setExpandedDepartmentIDs] = useState<Set<string>>(() => new Set());
  const selectedDepartment = workspace.adminData.selectedDepartment;

  useEffect(() => {
    if (!workspace.adminData.selectedDepartment && workspace.adminData.departments[0]) {
      workspace.adminData.setSelectedDepartmentID(workspace.adminData.departments[0].departmentID);
    }
  }, [workspace]);

  useEffect(() => {
    setExpandedDepartmentIDs((current) => {
      const next = new Set(current);
      workspace.adminData.departments.forEach((department) => next.add(department.departmentID));
      if (workspace.adminData.selectedDepartment?.departmentID) next.add(workspace.adminData.selectedDepartment.departmentID);
      return next;
    });
  }, [workspace.adminData.departments, workspace.adminData.selectedDepartment]);

  useEffect(() => {
    if (selectedDepartment) {
      setRenameName(selectedDepartment.name);
    }
  }, [selectedDepartment]);

  const departmentWorkbench = useMemo(
    () =>
      deriveDepartmentWorkbench({
        departments: workspace.adminData.departments,
        users: workspace.adminData.adminUsers,
        skills: workspace.adminData.adminSkills,
        selectedDepartmentID: selectedDepartment?.departmentID ?? null,
        expandedDepartmentIDs
      }),
    [expandedDepartmentIDs, selectedDepartment?.departmentID, workspace.adminData.adminSkills, workspace.adminData.adminUsers, workspace.adminData.departments]
  );
  const directUsers = selectedDepartment ? workspace.adminData.adminUsers.filter((user) => user.departmentID === selectedDepartment.departmentID) : [];
  const directManagers = directUsers.filter((user) => user.role === "admin");
  const canDeleteDepartment = Boolean(selectedDepartment && selectedDepartment.level > 0 && departmentWorkbench.childDepartments.length === 0 && directUsers.length === 0);
  const createParentDepartment = selectedDepartment ?? workspace.adminData.departments[0] ?? null;
  const createActionLabel = createParentDepartment?.level === 0 ? "新增一级部门" : "新增下级部门";

  const toggleDepartmentExpanded = (departmentID: string) => {
    setExpandedDepartmentIDs((current) => {
      const next = new Set(current);
      if (next.has(departmentID)) next.delete(departmentID);
      else next.add(departmentID);
      return next;
    });
  };

  return (
    <div className="manage-pane-grid departments-workbench">
      <section className="stage-panel list-panel manage-tree-panel">
        <div className="local-filter-shell">
          <div className="manage-list-toolbar-row">
            <button className="btn btn-primary" type="button" onClick={() => setCreateModalOpen(true)} disabled={!createParentDepartment}>
              <Plus size={14} />
              {createActionLabel}
            </button>
          </div>
        </div>
        <div className="department-tree-list">
          {departmentWorkbench.visibleRows.length === 0 ? <SectionEmpty title="暂无部门数据" body="保持在线后会加载可管理范围内的部门树。" /> : null}
          {departmentWorkbench.visibleRows.map((row) => {
            const isActive = selectedDepartment?.departmentID === row.department.departmentID;
            return (
              <div className={isActive ? "department-tree-row active" : "department-tree-row"} key={row.department.departmentID} style={{ paddingLeft: `${row.depth * 14}px` }}>
                <button
                  className="tree-toggle"
                  type="button"
                  aria-label={row.expanded ? "收起部门" : "展开部门"}
                  disabled={!row.hasChildren}
                  onClick={() => toggleDepartmentExpanded(row.department.departmentID)}
                >
                  {row.hasChildren ? (row.expanded ? "−" : "+") : "·"}
                </button>
                <button className="department-tree-select" type="button" onClick={() => workspace.adminData.setSelectedDepartmentID(row.department.departmentID)}>
                  <span>
                    <strong>{row.department.name}</strong>
                    <small>{row.department.path}</small>
                  </span>
                  <span className="department-tree-metrics">
                    <small>{row.department.userCount} 人</small>
                    <small>{getDepartmentAdminCount(row.department, workspace.adminData.adminUsers)} 直接管理员</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="stage-panel detail-panel department-workspace-panel manage-center-panel">
        {!selectedDepartment ? (
          <SectionEmpty title="选择一个部门" />
        ) : (
          <>
            <div className="manage-panel-head">
              <div className="section-copy">
                <div className="eyebrow">部门概览</div>
                <h3>{selectedDepartment.name}</h3>
                <p>当前部门的结构、成员与 Skill 投影。</p>
              </div>
              <div className="meta-strip">
                <span className="metric-chip">{selectedDepartment.path}</span>
                <span className="metric-chip">L{selectedDepartment.level}</span>
                <span className={`status-chip ${departmentStatusTone(selectedDepartment.status)}`}>{departmentStatusLabel(selectedDepartment.status)}</span>
              </div>
            </div>

            <div className="manage-metrics-grid">
              <article className="manage-metric-card"><span>直属下级</span><strong>{departmentWorkbench.childDepartments.length}</strong></article>
              <article className="manage-metric-card"><span>范围用户</span><strong>{departmentWorkbench.scopedUsers.length}</strong></article>
              <article className="manage-metric-card"><span>直属管理员</span><strong>{directManagers.length}</strong></article>
              <article className="manage-metric-card"><span>Skill 数</span><strong>{departmentWorkbench.scopedSkills.length}</strong></article>
            </div>

            <div className="manage-subtabs">
              {([
                ["children", "直属下级部门"],
                ["users", "本部门用户"],
                ["skills", "部门 Skills"]
              ] as const).map(([view, label]) => (
                <button key={view} className={departmentView === view ? "pill-button active" : "pill-button"} type="button" onClick={() => setDepartmentView(view)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="manage-list-header">
              <strong>{departmentView === "children" ? "直属下级部门" : departmentView === "users" ? "本部门用户" : "部门 Skills 概览"}</strong>
            </div>

            <div className="scroll-area">
              <div className="manage-data-list">
                {departmentView === "children" ? (
                  departmentWorkbench.childDepartments.length === 0 ? <div className="manage-empty-card"><strong>当前没有下级部门</strong><p>可以从列表顶栏新增下级部门。</p></div> :
                    departmentWorkbench.childDepartments.map((department) => (
                      <button key={department.departmentID} className="manage-data-row" type="button" onClick={() => workspace.adminData.setSelectedDepartmentID(department.departmentID)}>
                        <div className="manage-data-row-main">
                          <InitialBadge label={department.name} />
                          <div><strong>{department.name}</strong><p>{department.path}</p></div>
                        </div>
                        <div className="manage-data-row-meta">
                          <span className={`status-chip ${departmentStatusTone(department.status)}`}>{departmentStatusLabel(department.status)}</span>
                          <small>{department.userCount} 人</small>
                          <small>{department.skillCount} Skills</small>
                        </div>
                      </button>
                    ))
                ) : null}
                {departmentView === "users" ? (
                  directUsers.length === 0 ? <div className="manage-empty-card"><strong>当前部门还没有直接归属用户</strong><p>如果需要在该节点开户，可以从“管理 / 用户”进入。</p></div> :
                    directUsers.map((user) => (
                      <div className="manage-data-row static-row" key={user.phoneNumber}>
                        <div className="manage-data-row-main">
                          <InitialBadge label={user.username} />
                          <div><strong>{user.username}</strong><p>{user.phoneNumber} · {user.role === "admin" ? `管理员 L${user.adminLevel ?? "?"}` : "普通用户"}</p></div>
                        </div>
                        <div className="manage-data-row-meta">
                          <span className={`status-chip ${user.status === "active" ? "success" : user.status === "frozen" ? "warning" : "neutral"}`}>{userStatusLabel(user.status)}</span>
                          <small>已发布 {user.publishedSkillCount}</small>
                        </div>
                      </div>
                    ))
                ) : null}
                {departmentView === "skills" ? (
                  departmentWorkbench.scopedSkills.length === 0 ? <div className="manage-empty-card"><strong>当前没有可展示的 Skills</strong><p>这个节点仍可保留部门结构，用于后续分配成员与权限范围。</p></div> :
                    departmentWorkbench.scopedSkills.map((skill) => (
                      <div className="manage-data-row static-row" key={skill.skillID}>
                        <div className="manage-data-row-main">
                          <InitialBadge label={skill.displayName} />
                          <div><strong>{skill.displayName}</strong><p>{skill.publisherName}</p></div>
                        </div>
                        <div className="manage-data-row-meta">
                          <span className="metric-chip">{manageSkillStatusLabel(skill.status)}</span>
                        </div>
                      </div>
                    ))
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>
      <aside className="stage-panel manage-inspector-panel">
        {!selectedDepartment ? (
          <SectionEmpty title="选择一个部门查看详情" body="详情区会展示层级、管理员、治理范围和维护动作。" compact align="start" />
        ) : (
          <>
            <div className="detail-block">
              <div className="inspector-kicker">部门详情</div>
              <strong>{selectedDepartment.name}</strong>
              <small>{selectedDepartment.path}</small>
            </div>
            <div className="detail-grid">
              <div className="meta-detail"><strong>L{selectedDepartment.level}</strong><p>层级</p></div>
              <div className="meta-detail"><strong>{departmentStatusLabel(selectedDepartment.status)}</strong><p>当前状态</p></div>
              <div className="meta-detail"><strong>{departmentWorkbench.scopedUsers.length}</strong><p>范围成员</p></div>
              <div className="meta-detail"><strong>{departmentWorkbench.scopedSkills.length}</strong><p>治理对象</p></div>
            </div>
            <div className="detail-section">
              <strong>当前部门管理员</strong>
              <div className="detail-list">
                {directManagers.length === 0 ? <div className="detail-list-item">暂未分配管理员</div> : null}
                {directManagers.map((manager) => (
                  <div className="detail-list-item" key={manager.phoneNumber}>{manager.username} · 管理员 L{manager.adminLevel ?? "?"}</div>
                ))}
              </div>
            </div>
            <div className="detail-block inspector-subsection">
              <h3>{selectedDepartment.level === 0 ? "维护集团节点" : "维护部门"}</h3>
              <form className="inline-form" onSubmit={(event) => {
                event.preventDefault();
                if (renameName.trim().length === 0) return;
                void workspace.adminData.updateDepartment(selectedDepartment.departmentID, renameName.trim());
              }}>
                <input value={renameName} onChange={(event) => setRenameName(event.target.value)} />
                <button className="btn" type="submit">保存</button>
              </form>
            </div>
            <div className="danger-panel">
              <strong>危险区</strong>
              <p>{canDeleteDepartment ? "当前节点为空，可执行删除。" : "当前节点不可删除。根节点禁止删除；非空节点需要先清空下级部门和直属用户。"}</p>
              <button className="btn btn-danger" type="button" disabled={!canDeleteDepartment} onClick={() => selectedDepartment && void workspace.adminData.deleteDepartment(selectedDepartment.departmentID)}>删除部门</button>
            </div>
          </>
        )}
      </aside>
      {createModalOpen ? (
        <InlineModal title={createActionLabel} eyebrow="部门结构" onClose={() => setCreateModalOpen(false)}>
          <form className="form-stack compact" onSubmit={(event) => {
            event.preventDefault();
            if (!createParentDepartment || createName.trim().length === 0) return;
            void workspace.adminData.createDepartment(createParentDepartment.departmentID, createName.trim());
            setCreateName("");
            setCreateModalOpen(false);
          }}>
            <div className="callout info">
              <Building2 size={16} />
              <span>
                <strong>父级部门：{createParentDepartment?.name ?? "未选择"}</strong>
                <small>{createParentDepartment?.path ?? "请先选择一个部门节点"}</small>
              </span>
            </div>
            <label className="field">
              <span>部门名称</span>
              <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder={createParentDepartment?.level === 0 ? "输入一级部门名称" : "输入下级部门名称"} autoFocus />
            </label>
            <div className="inline-actions wrap">
              <button className="btn btn-primary" type="submit" disabled={!createParentDepartment || createName.trim().length === 0}>
                <Plus size={14} />
                {createParentDepartment?.level === 0 ? "创建一级部门" : "创建部门"}
              </button>
              <button className="btn" type="button" onClick={() => setCreateModalOpen(false)}>取消</button>
            </div>
          </form>
        </InlineModal>
      ) : null}
    </div>
  );
}

function ManageUsersPane({ workspace, language }: { workspace: P1WorkspaceState; language: "zh-CN" | "en-US" }) {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [userFilters, setUserFilters] = useState<{ query: string; role: AdminUserRoleFilter; status: AdminUserStatusFilter }>({
    query: "",
    role: "all",
    status: "all"
  });
  const [newUser, setNewUser] = useState({
    username: "",
    phoneNumber: "",
    departmentID: "",
    role: "normal_user" as "normal_user" | "admin",
    adminLevel: "4"
  });
  const [userEdit, setUserEdit] = useState({
    username: "",
    phoneNumber: "",
    departmentID: "",
    role: "normal_user" as "normal_user" | "admin",
    adminLevel: "4"
  });
  const [passwordEdit, setPasswordEdit] = useState({
    password: "",
    confirmPassword: ""
  });
  const [deleteConfirmPhoneNumber, setDeleteConfirmPhoneNumber] = useState<string | null>(null);

  const roleOptions = useMemo(
    () =>
      language === "en-US"
        ? [
            { value: "normal_user", label: "User" },
            { value: "admin", label: "Admin" }
          ]
        : [
            { value: "normal_user", label: "普通用户" },
            { value: "admin", label: "管理员" }
          ],
    [language]
  );
  const departmentOptions = useMemo(() => flattenDepartments(workspace.adminData.departments), [workspace.adminData.departments]);
  const filteredUsers = useMemo(() => filterAdminUsers(workspace.adminData.adminUsers, userFilters), [userFilters, workspace.adminData.adminUsers]);

  useEffect(() => {
    setSelectedPhoneNumber((current) => (filteredUsers.some((user) => user.phoneNumber === current) ? current : filteredUsers[0]?.phoneNumber ?? null));
  }, [filteredUsers]);

  useEffect(() => {
    setNewUser((current) => ({
      ...current,
      departmentID: current.departmentID || workspace.adminData.selectedDepartment?.departmentID || departmentOptions[0]?.departmentID || ""
    }));
  }, [departmentOptions, workspace.adminData.selectedDepartment]);

  const selectedUser = workspace.adminData.adminUsers.find((user) => user.phoneNumber === selectedPhoneNumber) ?? null;

  useEffect(() => {
    if (!selectedUser) return;
    setUserEdit({
      username: selectedUser.username,
      phoneNumber: selectedUser.phoneNumber,
      departmentID: selectedUser.departmentID,
      role: selectedUser.role,
      adminLevel: String(selectedUser.adminLevel ?? 4)
    });
    setPasswordEdit({
      password: "",
      confirmPassword: ""
    });
    setDeleteConfirmPhoneNumber(null);
  }, [selectedUser]);

  const nextPasswordError = passwordEdit.password.trim() ? validatePasswordPolicy(passwordEdit.password) : null;
  const passwordMismatch = passwordEdit.confirmPassword.length > 0 && passwordEdit.password !== passwordEdit.confirmPassword;
  const canSubmitPassword = Boolean(selectedUser && passwordEdit.password.trim() && passwordEdit.confirmPassword.trim() && !nextPasswordError && !passwordMismatch);
  const newUserPhoneError = newUser.phoneNumber.trim() ? validatePhoneNumber(newUser.phoneNumber) : null;
  const userEditPhoneError = userEdit.phoneNumber.trim().length === 0 ? "请输入手机号。" : validatePhoneNumber(userEdit.phoneNumber);
  const canSaveUserProfile = Boolean(selectedUser && userEdit.username.trim() && userEdit.departmentID && !userEditPhoneError);
  const canCreateUser = Boolean(newUser.departmentID && newUser.username.trim() && newUser.phoneNumber.trim() && !newUserPhoneError);
  const deleteConfirmationArmed = Boolean(selectedUser && deleteConfirmPhoneNumber === selectedUser.phoneNumber);

  return (
    <div className="manage-hub manage-hub-users users-workbench">
      <section className="stage-panel manage-center-panel manage-list-panel">
        <div className="manage-panel-toolbar stack">
          <div className="manage-list-toolbar-row">
            <button className="btn btn-primary" type="button" onClick={() => setCreateUserModalOpen(true)}>
              <Plus size={14} />
              新增用户
            </button>
          </div>
          <label className="search-shell">
            <Search size={16} />
            <input
              aria-label="搜索管理用户"
              type="search"
              value={userFilters.query}
              placeholder="搜索用户名称、手机号或部门路径"
              onChange={(event) => setUserFilters((current) => ({ ...current, query: event.target.value }))}
            />
          </label>
          <div className="manage-filter-groups">
            {([
              ["all", "全部角色"],
              ["admin", "管理员"],
              ["normal_user", "普通用户"]
            ] as const).map(([role, label]) => (
              <button
                key={role}
                className={userFilters.role === role ? "pill-button active" : "pill-button"}
                type="button"
                onClick={() => setUserFilters((current) => ({ ...current, role }))}
              >
                {label}
              </button>
            ))}
            {([
              ["all", "全部状态"],
              ["active", "正常"],
              ["frozen", "冻结"],
              ["deleted", "删除"]
            ] as const).map(([status, label]) => (
              <button
                key={status}
                className={userFilters.status === status ? "pill-button active" : "pill-button"}
                type="button"
                onClick={() => setUserFilters((current) => ({ ...current, status }))}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="meta-strip">
            <span className="metric-chip">当前结果 {filteredUsers.length}</span>
            <span className="metric-chip">正常 {filteredUsers.filter((user) => user.status === "active").length}</span>
            <span className="metric-chip">冻结 {filteredUsers.filter((user) => user.status === "frozen").length}</span>
          </div>
        </div>
        <div className="manage-data-list manage-user-list">
          {filteredUsers.length === 0 ? <SectionEmpty title="没有符合条件的用户" body="调整搜索词、角色或状态筛选后再试一次。" /> : null}
          {filteredUsers.map((user) => (
            <button
              key={user.phoneNumber}
              className={selectedUser?.phoneNumber === user.phoneNumber ? "manage-user-row active" : "manage-user-row"}
              type="button"
              onClick={() => setSelectedPhoneNumber(user.phoneNumber)}
            >
              <div className="manage-data-row-main">
                <InitialBadge label={user.username} />
                <span>
                  <strong>{user.username}</strong>
                  <small>{getAdminUserDepartmentPath(user)} · {user.phoneNumber}</small>
                </span>
              </div>
              <span className="manage-user-stats">
                <TagPill tone={user.status === "active" ? "success" : user.status === "frozen" ? "warning" : "neutral"}>{userStatusLabel(user.status)}</TagPill>
                {user.passwordMustChange ? <TagPill tone="warning">待首次改密</TagPill> : null}
                <small>{user.role === "admin" ? `管理员 L${user.adminLevel ?? "?"}` : "普通用户"}</small>
                <small>已发布 {user.publishedSkillCount}</small>
                <small>☆ {user.starCount}</small>
                <small>{formatDate(getAdminUserLastLoginAt(user))}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <aside className="stage-panel manage-inspector-panel governance-panel">
        {!selectedUser ? (
          <SectionEmpty title="选择一个用户进行治理" body="详情区会集中展示账号状态、部门归属和高风险动作。" compact align="start" />
        ) : (
          <>
            <div className="detail-block">
              <div className="inspector-kicker">账号治理</div>
              <strong>{selectedUser.username}</strong>
              <small>{selectedUser.phoneNumber}</small>
            </div>
            <div className="pill-row">
              <TagPill tone={selectedUser.status === "active" ? "success" : selectedUser.status === "frozen" ? "warning" : "neutral"}>{userStatusLabel(selectedUser.status)}</TagPill>
              {selectedUser.passwordMustChange ? <TagPill tone="warning">待首次改密</TagPill> : null}
              <TagPill tone="info">{selectedUser.role === "admin" ? `管理员 L${selectedUser.adminLevel ?? "?"}` : "普通用户"}</TagPill>
            </div>
            <div className="detail-grid">
              <div className="meta-detail"><strong>{selectedUser.publishedSkillCount}</strong><p>已发布 Skill</p></div>
              <div className="meta-detail"><strong>{selectedUser.starCount}</strong><p>Star 数</p></div>
              <div className="meta-detail"><strong>{formatDate(getAdminUserLastLoginAt(selectedUser))}</strong><p>最近登录</p></div>
              <div className="meta-detail"><strong>{getAdminUserDepartmentPath(selectedUser)}</strong><p>所属部门</p></div>
            </div>
            <div className="detail-block inspector-subsection governance-section">
              <div className="governance-section-head">
                <h3>资料</h3>
                <p>维护可见身份和部门归属；权限单独处理。</p>
              </div>
              <form className="form-stack compact" onSubmit={(event) => {
                event.preventDefault();
                if (!canSaveUserProfile) return;
                void workspace.adminData.updateAdminUser(selectedUser.phoneNumber, {
                  username: userEdit.username.trim(),
                  phoneNumber: userEdit.phoneNumber.trim(),
                  departmentID: userEdit.departmentID
                });
              }}>
                <label className="field"><span>用户名称</span><input value={userEdit.username} onChange={(event) => setUserEdit((current) => ({ ...current, username: event.target.value }))} /></label>
                <label className="field">
                  <span>手机号</span>
                  <input
                    value={userEdit.phoneNumber}
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    pattern="1[0-9]{10}"
                    className={userEditPhoneError ? "field-invalid" : ""}
                    aria-invalid={userEditPhoneError ? true : undefined}
                    onChange={(event) => setUserEdit((current) => ({ ...current, phoneNumber: sanitizePhoneNumberInput(event.target.value) }))}
                  />
                  <small className={userEditPhoneError ? "field-hint warning" : "field-hint"}>{userEditPhoneError ?? phoneNumberFormatHint}</small>
                </label>
                <label className="field">
                  <span>所属部门</span>
                  <select value={userEdit.departmentID} onChange={(event) => setUserEdit((current) => ({ ...current, departmentID: event.target.value }))}>
                    {departmentOptions.map((department) => (
                      <option key={department.departmentID} value={department.departmentID}>{department.path}</option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary" type="submit" disabled={!canSaveUserProfile}>保存资料</button>
              </form>
            </div>
            <div className="detail-block inspector-subsection governance-section">
              <div className="governance-section-head">
                <h3>安全</h3>
                <p>修改密码会立即撤销该用户的现有会话。</p>
              </div>
              <form className="form-stack compact" onSubmit={(event) => {
                event.preventDefault();
                if (!selectedUser || !canSubmitPassword) return;
                void workspace.adminData.changeAdminUserPassword(selectedUser.phoneNumber, passwordEdit.password.trim());
              }}>
                <label className="field"><span>新密码</span><input value={passwordEdit.password} type="password" autoComplete="new-password" onChange={(event) => setPasswordEdit((current) => ({ ...current, password: event.target.value }))} /></label>
                <label className="field"><span>确认新密码</span><input value={passwordEdit.confirmPassword} type="password" autoComplete="new-password" onChange={(event) => setPasswordEdit((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
                <small className={passwordMismatch || nextPasswordError ? "field-hint warning" : "field-hint"}>{passwordMismatch ? "两次输入的密码不一致。" : nextPasswordError ?? passwordPolicyHint}</small>
                <button className="btn" type="submit" disabled={!canSubmitPassword}>保存新密码</button>
              </form>
            </div>
            <div className="detail-block inspector-subsection governance-section">
              <div className="governance-section-head">
                <h3>权限</h3>
                <p>只调整角色和管理员等级，不改动账号资料。</p>
              </div>
              <form className="form-stack compact" onSubmit={(event) => {
                event.preventDefault();
                if (!selectedUser) return;
                void workspace.adminData.updateAdminUser(selectedUser.phoneNumber, {
                  role: userEdit.role,
                  adminLevel: userEdit.role === "admin" ? Number(userEdit.adminLevel) : null
                });
              }}>
                <SelectField label="角色" value={userEdit.role} options={roleOptions} onChange={(value) => setUserEdit((current) => ({ ...current, role: value as "normal_user" | "admin" }))} />
                {userEdit.role === "admin" ? (
                  <label className="field"><span>管理员等级</span><input value={userEdit.adminLevel} onChange={(event) => setUserEdit((current) => ({ ...current, adminLevel: event.target.value }))} /></label>
                ) : null}
                <button className="btn" type="submit">保存权限</button>
              </form>
            </div>
            <details className="danger-panel danger-panel-folded">
              <summary className="danger-summary">
                <span>
                  <strong>危险区</strong>
                  <small>冻结登录或删除账号</small>
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="danger-panel-body">
                <div className="danger-action-group">
                  <div className="danger-action-copy">
                    <strong>{selectedUser.status === "frozen" ? "解冻账号" : "冻结账号"}</strong>
                    <p>{selectedUser.status === "frozen" ? "解冻后可恢复登录和会话续期。" : "冻结后立即使现有会话失效，并隐藏管理入口。"}</p>
                  </div>
                  {selectedUser.status === "frozen" ? (
                    <button className="btn" type="button" onClick={() => void workspace.adminData.unfreezeAdminUser(selectedUser.phoneNumber)}>
                      解冻
                    </button>
                  ) : (
                    <button className="btn" type="button" onClick={() => void workspace.adminData.freezeAdminUser(selectedUser.phoneNumber)}>
                      冻结
                    </button>
                  )}
                </div>
                <div className="danger-action-group">
                  <div className="danger-action-copy">
                    <strong>删除用户</strong>
                    <p>删除会移除该账号的管理关系；已发布 Skill 不自动迁移。</p>
                    {deleteConfirmationArmed ? <small className="danger-confirm-copy">再次点击确认删除。</small> : null}
                  </div>
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => {
                      if (!deleteConfirmationArmed) {
                        setDeleteConfirmPhoneNumber(selectedUser.phoneNumber);
                        return;
                      }
                      setDeleteConfirmPhoneNumber(null);
                      void workspace.adminData.deleteAdminUser(selectedUser.phoneNumber);
                    }}
                  >
                    {deleteConfirmationArmed ? "确认删除用户" : "删除用户"}
                  </button>
                </div>
              </div>
            </details>
          </>
        )}
      </aside>
      {createUserModalOpen ? (
        <InlineModal title="新增用户" eyebrow="账号治理" onClose={() => setCreateUserModalOpen(false)}>
          <form className="form-stack compact" onSubmit={(event) => {
            event.preventDefault();
            if (!canCreateUser) return;
            void workspace.adminData.createAdminUser({
              username: newUser.username.trim(),
              phoneNumber: newUser.phoneNumber.trim(),
              departmentID: newUser.departmentID,
              role: newUser.role,
              adminLevel: newUser.role === "admin" ? Number(newUser.adminLevel) : null
            });
            setCreateUserModalOpen(false);
            setNewUser((current) => ({ ...current, username: "", phoneNumber: "" }));
          }}>
            <label className="field"><span>用户名称</span><input value={newUser.username} onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))} autoFocus /></label>
            <label className="field">
              <span>手机号</span>
              <input
                value={newUser.phoneNumber}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={11}
                pattern="1[0-9]{10}"
                className={newUserPhoneError ? "field-invalid" : ""}
                aria-invalid={newUserPhoneError ? true : undefined}
                onChange={(event) => setNewUser((current) => ({ ...current, phoneNumber: sanitizePhoneNumberInput(event.target.value) }))}
              />
              <small className={newUserPhoneError ? "field-hint warning" : "field-hint"}>{newUserPhoneError ?? phoneNumberFormatHint}</small>
            </label>
            <div className="callout info">
              新账号初始密码为 EAgentHub123!，首次登录只能用于完成强制改密。
            </div>
            <label className="field">
              <span>所属部门</span>
              <select value={newUser.departmentID} onChange={(event) => setNewUser((current) => ({ ...current, departmentID: event.target.value }))}>
                {departmentOptions.map((department) => (
                  <option key={department.departmentID} value={department.departmentID}>{department.path}</option>
                ))}
              </select>
            </label>
            <SelectField label="角色" value={newUser.role} options={roleOptions} onChange={(value) => setNewUser((current) => ({ ...current, role: value as "normal_user" | "admin" }))} />
            {newUser.role === "admin" ? (
              <label className="field"><span>管理员等级</span><input value={newUser.adminLevel} onChange={(event) => setNewUser((current) => ({ ...current, adminLevel: event.target.value }))} /></label>
            ) : null}
            <div className="inline-actions wrap">
              <button className="btn btn-primary" type="submit" disabled={!canCreateUser}>
                <Users size={14} />
                创建用户
              </button>
              <button className="btn" type="button" onClick={() => setCreateUserModalOpen(false)}>取消</button>
            </div>
          </form>
        </InlineModal>
      ) : null}
    </div>
  );
}

const clientUpdateVersionPattern = /^\d+\.\d+\.\d+$/;

function inferClientUpdateVersion(fileName: string): string {
  return fileName.match(/(?:^|[^\d])(\d+\.\d+\.\d+)(?:[^\d]|$)/)?.[1] ?? "";
}

function formatClientUpdateSize(sizeBytes: number | null | undefined): string {
  if (!sizeBytes || !Number.isFinite(sizeBytes)) return "-";
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function clientUpdateStatusLabel(status: ClientUpdateReleaseSummary["status"]): string {
  if (status === "published") return "已推送";
  if (status === "paused") return "已暂停";
  if (status === "yanked") return "已撤回";
  return "草稿";
}

function clientUpdateStatusTone(status: ClientUpdateReleaseSummary["status"]): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "published") return "success";
  if (status === "paused") return "warning";
  if (status === "yanked") return "danger";
  return "info";
}

function latestPublishedClientUpdate(releases: ClientUpdateReleaseSummary[]): ClientUpdateReleaseSummary | null {
  return [...releases]
    .filter((release) => release.status === "published")
    .sort((left, right) => Date.parse(right.publishedAt ?? right.updatedAt) - Date.parse(left.publishedAt ?? left.updatedAt))[0] ?? null;
}

function ManageClientUpdatesPane({ workspace, ui }: SectionProps) {
  const isL1Admin = canAccessClientUpdateManagement(workspace.currentUser);
  const refreshClientUpdateReleases = workspace.adminData.refreshClientUpdateReleases;
  const pushClientUpdateExe = workspace.adminData.pushClientUpdateExe;
  const pauseClientUpdateRelease = workspace.adminData.pauseClientUpdateRelease;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pausingReleaseID, setPausingReleaseID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isL1Admin) return;
    void refreshClientUpdateReleases().catch((refreshError) => {
      setError(refreshError instanceof Error ? refreshError.message : "客户端更新记录加载失败。");
    });
  }, [isL1Admin, refreshClientUpdateReleases]);

  const releases = useMemo(
    () => [...workspace.adminData.clientUpdateReleases].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [workspace.adminData.clientUpdateReleases]
  );
  const currentRelease = useMemo(() => latestPublishedClientUpdate(releases), [releases]);
  const canPush = Boolean(selectedFile && clientUpdateVersionPattern.test(version.trim()) && !busy);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".exe")) {
      setSelectedFile(null);
      setError("请上传 Windows EXE 安装包。");
      return;
    }
    setSelectedFile(file);
    setVersion((current) => current.trim() || inferClientUpdateVersion(file.name));
  }

  async function onPush(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("请先选择 EXE 安装包。");
      return;
    }
    if (!clientUpdateVersionPattern.test(version.trim())) {
      setError("版本号请填写为 x.y.z 格式，例如 1.2.3。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pushClientUpdateExe({ file: selectedFile, version: version.trim() });
      setSelectedFile(null);
      setVersion("");
      setFileInputKey((current) => current + 1);
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : "客户端更新推送失败。");
    } finally {
      setBusy(false);
    }
  }

  async function pauseRelease(releaseID: string) {
    setPausingReleaseID(releaseID);
    setError(null);
    try {
      await pauseClientUpdateRelease(releaseID);
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : "暂停推送失败。");
    } finally {
      setPausingReleaseID(null);
    }
  }

  if (!isL1Admin) {
    return (
      <section className="stage-panel">
        <SectionEmpty title="仅一级管理员可推送客户端更新" body="客户端安装包会影响所有桌面端用户，请使用一级管理员账号操作。" />
      </section>
    );
  }

  return (
    <div className="manage-pane-grid client-updates-workbench">
      <section className="stage-panel list-panel">
        <div className="manage-panel-toolbar stack">
          <div>
            <p className="eyebrow">当前线上版本</p>
            <h3>{currentRelease?.version ?? "暂无已推送版本"}</h3>
          </div>
          {currentRelease ? (
            <div className="meta-strip">
              <span className="metric-chip">{formatClientUpdateSize(currentRelease.artifact?.sizeBytes)}</span>
              <span className="metric-chip">{formatDate(currentRelease.publishedAt ?? currentRelease.updatedAt, ui.language)}</span>
            </div>
          ) : null}
        </div>

        <form className="form-stack compact client-update-push-form" onSubmit={onPush}>
          <label className={selectedFile ? "client-update-upload-card has-file" : "client-update-upload-card"}>
            <input key={fileInputKey} type="file" accept=".exe,application/x-msdownload" aria-label="上传 EXE 安装包" onChange={onFileChange} />
            <span className="client-update-upload-icon">
              <Upload size={22} strokeWidth={1.9} />
            </span>
            <span className="client-update-upload-copy">
              <span className="client-update-upload-label">上传 EXE</span>
              <strong>{selectedFile ? selectedFile.name : "选择 Windows EXE 安装包"}</strong>
              <small>{selectedFile ? `${formatClientUpdateSize(selectedFile.size)} · 点击可重新选择` : "支持 .exe 文件，系统会尝试从文件名识别版本号"}</small>
            </span>
            <span className="client-update-upload-action">{selectedFile ? "更换文件" : "浏览文件"}</span>
          </label>
          {selectedFile ? (
            <div className="client-update-file-summary">
              <PackageCheck size={16} />
              <span>
                <strong>{selectedFile.name}</strong>
                <small>{formatClientUpdateSize(selectedFile.size)}</small>
              </span>
            </div>
          ) : null}
          <label className="field">
            <span>确认版本号</span>
            <input value={version} placeholder="1.2.3" inputMode="decimal" onChange={(event) => setVersion(event.target.value)} />
          </label>
          {error ? <small className="field-hint warning">{error}</small> : null}
          <button className="btn btn-primary" type="submit" disabled={!canPush}>
            <Upload size={14} />
            {busy ? "推送中..." : "推送给客户端"}
          </button>
        </form>
      </section>

      <section className="stage-panel detail-panel wide inspector-panel">
        <div className="detail-block">
          <p className="eyebrow">历史版本</p>
          <h3>客户端更新记录</h3>
        </div>
        <div className="stack-list">
          {releases.length === 0 ? <SectionEmpty title="暂无客户端更新记录" body="上传 EXE 并确认版本号后，会在这里看到推送记录。" compact align="start" /> : null}
          {releases.map((release) => (
            <article className="micro-row" key={release.releaseID} data-testid="client-update-release-row">
              <div>
                <strong>v{release.version}</strong>
                <small>
                  {release.artifact?.packageName ?? "尚未上传安装包"} · {formatClientUpdateSize(release.artifact?.sizeBytes)}
                </small>
              </div>
              <span className="selection-row-meta">
                <TagPill tone={clientUpdateStatusTone(release.status)}>{clientUpdateStatusLabel(release.status)}</TagPill>
                <small>{formatDate(release.publishedAt ?? release.updatedAt, ui.language)}</small>
                {release.status === "published" ? (
                  <button className="btn btn-small" type="button" onClick={() => void pauseRelease(release.releaseID)} disabled={pausingReleaseID === release.releaseID}>
                    {pausingReleaseID === release.releaseID ? "暂停中..." : "暂停推送"}
                  </button>
                ) : null}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ManageSection({ workspace, ui }: SectionProps) {
  if (!workspace.isAdminConnected) {
    return (
      <div className="stage-page workspace-page manage-page">
        <AuthGateCard title="管理入口仅对在线管理员开放" body="登录并保持连接后，可统一处理审核、Skills、部门、用户和客户端更新。" onLogin={() => workspace.requireAuth("review")} />
      </div>
    );
  }

  return (
    <div className="stage-page workspace-page manage-page">
      <div className="workspace-layout">
        <ManageSidebar workspace={workspace} ui={ui} />
        <div className="workspace-main">
          {ui.managePane === "reviews" ? <ManageReviewsPane workspace={workspace} ui={ui} /> : null}
          {ui.managePane === "skills" ? <ManageSkillsPane workspace={workspace} ui={ui} /> : null}
          {ui.managePane === "departments" ? <ManageDepartmentsPane workspace={workspace} /> : null}
          {ui.managePane === "users" ? <ManageUsersPane workspace={workspace} language={ui.language} /> : null}
          {ui.managePane === "client_updates" ? <ManageClientUpdatesPane workspace={workspace} ui={ui} /> : null}
        </div>
      </div>
    </div>
  );
}
