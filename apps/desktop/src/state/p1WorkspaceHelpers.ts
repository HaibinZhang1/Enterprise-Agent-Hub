import type {
  BootstrapContext,
  DepartmentNode,
  LocalBootstrap,
  LocalNotification,
  LocalSkillInstall,
  OperationProgress,
  PublisherSkillSummary,
  PublisherSubmissionDetail,
  SkillSummary
} from "../domain/p1";
import { guestBootstrap } from "../fixtures/p1SeedData";
import { detectDesktopPlatform } from "../utils/platformPaths";

export function notificationFromProgress(progress: OperationProgress, fallbackReason?: string | null): LocalNotification {
  const isSuccess = progress.result === "success";
  return {
    notificationID: `local_${crypto.randomUUID()}`,
    type: `${progress.operation}_result` as LocalNotification["type"],
    title: `${progress.operation} ${isSuccess ? "完成" : "失败"}: ${progress.skillID}`,
    summary: fallbackReason
      ? `${progress.message}；symlink 已降级为 copy（${fallbackReason}）。`
      : progress.message,
    relatedSkillID: progress.skillID,
    targetPage: progress.operation === "install" || progress.operation === "update" ? "my_installed" : "target_management",
    occurredAt: new Date().toISOString(),
    unread: true,
    source: "local"
  };
}

export function applySkill(skills: SkillSummary[], skillID: string, updater: (skill: SkillSummary) => SkillSummary): SkillSummary[] {
  return skills.map((skill) => (skill.skillID === skillID ? updater(skill) : skill));
}

export function upsertPublisherSkillSummary(
  current: PublisherSkillSummary[],
  submission: PublisherSubmissionDetail
): PublisherSkillSummary[] {
  const existing = current.find((item) => item.skillID === submission.skillID) ?? null;
  const nextSummary: PublisherSkillSummary = {
    skillID: submission.skillID,
    displayName: submission.displayName,
    publishedSkillExists: existing?.publishedSkillExists ?? Boolean(submission.currentVersion),
    currentVersion: submission.currentVersion ?? existing?.currentVersion ?? null,
    currentStatus: existing?.currentStatus ?? null,
    currentVisibilityLevel: submission.currentVisibilityLevel ?? existing?.currentVisibilityLevel ?? null,
    currentScopeType: submission.currentScopeType ?? existing?.currentScopeType ?? null,
    latestSubmissionID: submission.submissionID,
    latestSubmissionType: submission.submissionType,
    latestWorkflowState: submission.workflowState,
    latestReviewStatus: submission.reviewStatus,
    latestDecision: submission.decision ?? null,
    latestRequestedVersion: submission.version,
    latestRequestedVisibilityLevel: submission.visibilityLevel,
    latestRequestedScopeType: submission.scopeType,
    latestReviewSummary: submission.reviewSummary ?? null,
    submittedAt: submission.submittedAt,
    updatedAt: submission.updatedAt,
    canWithdraw: submission.canWithdraw,
    availableStatusActions: existing?.availableStatusActions ?? []
  };

  if (!existing) {
    return [nextSummary, ...current].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  return current
    .map((item) => (item.skillID === submission.skillID ? nextSummary : item))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function normalizeLocalInstallTargets(install: LocalSkillInstall): SkillSummary["enabledTargets"] {
  return install.enabledTargets.map((target) => ({
    ...target,
    fallbackReason: target.fallbackReason ?? null
  }));
}

export function applyLocalInstallToSkill(skill: SkillSummary, install: LocalSkillInstall): SkillSummary {
  const enabledTargets = normalizeLocalInstallTargets(install);
  return {
    ...skill,
    localVersion: install.localVersion,
    installState: enabledTargets.length > 0 ? "enabled" : "installed",
    enabledTargets,
    lastEnabledAt: enabledTargets[0]?.enabledAt ?? skill.lastEnabledAt,
    hasLocalHashDrift: false,
    isScopeRestricted: install.isScopeRestricted,
    canUpdate: install.canUpdate && install.localVersion !== skill.version
  };
}

export function localSummaryFromInstall(install: LocalSkillInstall): SkillSummary {
  const enabledTargets = normalizeLocalInstallTargets(install);
  const compatibleSystem = detectDesktopPlatform() === "windows" ? "windows" : "macos";
  return {
    skillID: install.skillID,
    displayName: install.displayName,
    description: "本机已安装的 Skill。登录后可同步市场详情、通知和管理员功能。",
    version: install.localVersion,
    localVersion: install.localVersion,
    latestVersion: install.localVersion,
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "summary",
    canInstall: false,
    canUpdate: install.canUpdate,
    installState: enabledTargets.length > 0 ? "enabled" : "installed",
    authorName: "本机缓存",
    authorDepartment: "离线工作台",
    currentVersionUpdatedAt: install.updatedAt,
    publishedAt: install.installedAt,
    compatibleTools: [],
    compatibleSystems: [compatibleSystem],
    tags: ["本机"],
    category: "本地已安装",
    riskLevel: "unknown",
    starCount: 0,
    downloadCount: 0,
    starred: false,
    readme: "登录后可获取完整 README、安全摘要和远端状态。",
    reviewSummary: install.isScopeRestricted ? "权限已收缩，当前本地版本仍可继续使用。" : "离线模式下仅展示本机状态。",
    isScopeRestricted: install.isScopeRestricted,
    hasLocalHashDrift: false,
    enabledTargets,
    lastEnabledAt: enabledTargets[0]?.enabledAt ?? null
  };
}

export function mergeLocalInstalls(skills: SkillSummary[], localBootstrap: LocalBootstrap): SkillSummary[] {
  const installs = new Map(localBootstrap.installs.map((install) => [install.skillID, install]));
  return skills.map((skill) => {
    const install = installs.get(skill.skillID);
    return install ? applyLocalInstallToSkill(skill, install) : skill;
  });
}

export function buildGuestBootstrap(localBootstrap: LocalBootstrap, message?: string): BootstrapContext {
  return {
    ...guestBootstrap,
    connection: {
      ...guestBootstrap.connection,
      lastError: message ?? guestBootstrap.connection.lastError
    },
    counts: {
      installedCount: localBootstrap.installs.length,
      enabledCount: localBootstrap.installs.filter((install) => install.enabledTargets.length > 0).length,
      updateAvailableCount: localBootstrap.installs.filter((install) => install.canUpdate).length,
      unreadNotificationCount: localBootstrap.unreadLocalNotificationCount
    }
  };
}

export function upsertNotifications(current: LocalNotification[], incoming: LocalNotification[]): LocalNotification[] {
  const next = [...current];
  const indexByID = new Map(current.map((notification, index) => [notification.notificationID, index]));
  for (const notification of incoming) {
    const existingIndex = indexByID.get(notification.notificationID);
    if (existingIndex === undefined) {
      indexByID.set(notification.notificationID, next.length);
      next.push(notification);
      continue;
    }
    next[existingIndex] = notification;
  }
  return next.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function mergeNotifications(remoteNotifications: LocalNotification[], localNotifications: LocalNotification[]): LocalNotification[] {
  return upsertNotifications(localNotifications, remoteNotifications);
}

export function findDepartment(nodes: DepartmentNode[], departmentID: string | null): DepartmentNode | null {
  if (!departmentID) return null;
  for (const node of nodes) {
    if (node.departmentID === departmentID) return node;
    const match = findDepartment(node.children, departmentID);
    if (match) return match;
  }
  return null;
}
