import type {
  BootstrapContext,
  DepartmentNode,
  LocalBootstrap,
  LocalNotification,
  LocalSkillInstall,
  OperationProgress,
  PublisherSkillSummary,
  PublisherSubmissionDetail,
  SkillLeaderboardsResponse,
  SkillSummary
} from "../domain/p1.ts";
import { guestBootstrap } from "../fixtures/p1SeedData.ts";
import { detectDesktopPlatform } from "../utils/platformPaths.ts";

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
    localSourceType: install.sourceType,
    installState: enabledTargets.length > 0 ? "enabled" : "installed",
    enabledTargets,
    lastEnabledAt: enabledTargets[0]?.enabledAt ?? skill.lastEnabledAt,
    hasLocalHashDrift: false,
    isScopeRestricted: install.isScopeRestricted,
    canUpdate: install.sourceType !== "local_import" && install.canUpdate && install.localVersion !== skill.version
  };
}

export function localSummaryFromInstall(install: LocalSkillInstall): SkillSummary {
  const enabledTargets = normalizeLocalInstallTargets(install);
  const compatibleSystem = detectDesktopPlatform() === "windows" ? "windows" : "macos";
  return {
    skillID: install.skillID,
    displayName: install.displayName,
    description: install.sourceType === "local_import" ? "从本地工具或项目目录纳入 Central Store 管理的 Skill。" : "本机已安装的 Skill。登录后可同步市场详情、通知和管理员功能。",
    version: install.localVersion,
    localVersion: install.localVersion,
    localSourceType: install.sourceType,
    latestVersion: install.localVersion,
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "summary",
    canInstall: false,
    canUpdate: install.sourceType !== "local_import" && install.canUpdate,
    installState: enabledTargets.length > 0 ? "enabled" : "installed",
    authorName: install.sourceType === "local_import" ? "本地托管" : "本机缓存",
    authorDepartment: install.sourceType === "local_import" ? "Central Store" : "离线工作台",
    currentVersionUpdatedAt: install.updatedAt,
    publishedAt: install.installedAt,
    compatibleTools: [],
    compatibleSystems: [compatibleSystem],
    tags: install.sourceType === "local_import" ? ["本地托管"] : ["入门"],
    category: "其他",
    riskLevel: "unknown",
    starCount: 0,
    downloadCount: 0,
    starred: false,
    readme: install.sourceType === "local_import" ? "该 Skill 仅保存在本机 Central Store，不会上传服务器。" : "登录后可获取完整 README、安全摘要和远端状态。",
    reviewSummary: install.sourceType === "local_import" ? "本地导入项不会参与市场更新；卸载会删除 Central Store 与已认领目标路径。" : install.isScopeRestricted ? "权限已收缩，当前本地版本仍可继续使用。" : "离线模式下仅展示本机状态。",
    isScopeRestricted: install.isScopeRestricted,
    hasLocalHashDrift: false,
    enabledTargets,
    lastEnabledAt: enabledTargets[0]?.enabledAt ?? null
  };
}

export function isCommunityVisibleSkill(skill: SkillSummary): boolean {
  return skill.status === "published" && skill.localSourceType !== "local_import";
}

export function removeSkillFromLeaderboards(leaderboards: SkillLeaderboardsResponse | null, skillID: string): SkillLeaderboardsResponse | null {
  if (!leaderboards) return leaderboards;
  return {
    ...leaderboards,
    hot: leaderboards.hot.filter((skill) => skill.skillID !== skillID),
    stars: leaderboards.stars.filter((skill) => skill.skillID !== skillID),
    downloads: leaderboards.downloads.filter((skill) => skill.skillID !== skillID)
  };
}

export function mergeLocalInstalls(skills: SkillSummary[], localBootstrap: LocalBootstrap): SkillSummary[] {
  const installs = new Map(localBootstrap.installs.map((install) => [install.skillID, install]));
  const merged = skills.map((skill) => {
    const install = installs.get(skill.skillID);
    if (install) {
      installs.delete(skill.skillID);
    }
    return install ? applyLocalInstallToSkill(skill, install) : skill;
  });
  return [...merged, ...[...installs.values()].map(localSummaryFromInstall)];
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
