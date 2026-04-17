import assert from "node:assert/strict";
import test from "node:test";
import { type LocalNotification, type ProjectConfig, type PublishDraft, type ScanTargetSummary, type SkillSummary, type ToolConfig } from "../src/domain/p1.ts";
import { buildSkillListQuery } from "../src/services/p1Client.ts";
import {
  buildPublishPrecheck,
  collectInstalledSkillIssues,
  presentConfirmWithDrawerDismissal,
  presentModalWithDrawerDismissal,
} from "../src/state/useDesktopUIState.ts";
import { deriveDesktopNotifications, notificationBadgeLabel, resolveDesktopNotificationAction, type AppUpdateState } from "../src/state/ui/desktopNotifications.ts";
import { buildNavigationGroups } from "../src/state/ui/desktopNavigationGroups.ts";
import { deriveMarketSkills, deriveVisibleNavigation } from "../src/state/workspace/workspaceDerivedState.ts";
import { defaultFilters } from "../src/state/workspace/workspaceTypes.ts";
import { deriveDiscoveredLocalSkills } from "../src/utils/discoveredLocalSkills.ts";
import { formatDisplayDate, parseDisplayDate } from "../src/utils/displayDate.ts";
import { defaultProjectSkillsPath, defaultToolConfigPath } from "../src/utils/platformPaths.ts";

const baseDraft: PublishDraft = {
  submissionType: "publish",
  uploadMode: "folder",
  packageName: "prompt-guardrails",
  skillID: "prompt-guardrails",
  displayName: "提示词护栏模板",
  description: "为审核与发布前流程提供护栏检查。",
  version: "1.0.0",
  scope: "current_department",
  selectedDepartmentIDs: [],
  visibility: "detail_visible",
  changelog: "首次发布",
  category: "governance",
  tags: ["prompt", "governance"],
  compatibleTools: ["codex"],
  compatibleSystems: ["windows"],
  files: [
    { name: "SKILL.md", relativePath: "SKILL.md", size: 1_200, mimeType: "text/markdown" },
    { name: "README.md", relativePath: "README.md", size: 820, mimeType: "text/markdown" }
  ]
};

test("publish precheck passes for a valid folder upload with SKILL.md", () => {
  const result = buildPublishPrecheck(baseDraft);
  assert.equal(result.canSubmit, true);
  assert.equal(result.items.find((item) => item.id === "skill-doc")?.status, "pass");
  assert.equal(result.items.find((item) => item.id === "semver")?.status, "pass");
  assert.equal(result.items.find((item) => item.id === "size")?.status, "pass");
});

test("blocking modal presentation closes the skill drawer before opening the overlay", () => {
  const calls: string[] = [];
  presentModalWithDrawerDismissal(
    { type: "targets", skillID: "ops-oncall-companion" },
    {
      closeSkillDetail: () => {
        calls.push("close-drawer");
      },
      setModal: (modal) => {
        calls.push(`modal:${modal.type}`);
      },
    }
  );

  assert.deepEqual(calls, ["close-drawer", "modal:targets"]);
});

test("clearing a confirm modal does not touch the skill drawer", () => {
  const calls: string[] = [];
  presentConfirmWithDrawerDismissal(null, {
    closeSkillDetail: () => {
      calls.push("close-drawer");
    },
    setConfirmModal: (modal) => {
      calls.push(`confirm:${modal === null ? "none" : "open"}`);
    },
  });

  assert.deepEqual(calls, ["confirm:none"]);
});

test("publish precheck blocks invalid semver and oversized packages", () => {
  const result = buildPublishPrecheck({
    ...baseDraft,
    version: "1.0",
    files: [
      { name: "SKILL.md", relativePath: "SKILL.md", size: 6 * 1024 * 1024, mimeType: "text/markdown" }
    ]
  });
  assert.equal(result.canSubmit, false);
  assert.equal(result.items.find((item) => item.id === "semver")?.status, "warn");
  assert.equal(result.items.find((item) => item.id === "size")?.status, "warn");
});

test("installed skill issues cover local hash drift and unavailable targets", () => {
  const skill: SkillSummary = {
    skillID: "context-router",
    displayName: "上下文路由助手",
    description: "desc",
    version: "1.4.0",
    localVersion: "1.2.0",
    latestVersion: "1.4.0",
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "full",
    canInstall: true,
    canUpdate: true,
    installState: "update_available",
    authorName: "张三",
    authorDepartment: "平台工程部",
    currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
    publishedAt: "2026-04-09T08:00:00Z",
    compatibleTools: ["cursor"],
    compatibleSystems: ["windows"],
    tags: [],
    category: "开发效率",
    riskLevel: "low",
    starCount: 0,
    downloadCount: 0,
    starred: false,
    isScopeRestricted: false,
    hasLocalHashDrift: true,
    enabledTargets: [
      {
        targetType: "tool",
        targetID: "cursor",
        targetName: "Cursor",
        targetPath: "D:\\cursor\\rules",
        requestedMode: "symlink",
        resolvedMode: "copy",
        fallbackReason: "symlink_permission_denied",
        enabledAt: "2026-04-10T08:40:00Z"
      },
      {
        targetType: "project",
        targetID: "removed-project",
        targetName: "Removed Project",
        targetPath: "D:\\workspace\\Removed\\.codex\\skills",
        requestedMode: "symlink",
        resolvedMode: "symlink",
        fallbackReason: null,
        enabledAt: "2026-04-10T08:40:00Z"
      }
    ],
    lastEnabledAt: "2026-04-10T08:40:00Z"
  };
  const tools: ToolConfig[] = [
    {
      toolID: "cursor",
      name: "Cursor",
      displayName: "Cursor",
      configPath: "D:\\cursor\\settings.json",
      detectedPath: null,
      configuredPath: "D:\\cursor\\rules",
      skillsPath: "D:\\cursor\\rules",
      enabled: true,
      status: "invalid",
      adapterStatus: "invalid",
      detectionMethod: "manual",
      transform: "cursor_rule",
      transformStrategy: "cursor_rule",
      enabledSkillCount: 0,
      lastScannedAt: "2026-04-10T08:40:00Z"
    }
  ];
  const projects: ProjectConfig[] = [];
  const scanTargets: ScanTargetSummary[] = [
    {
      id: "tool:cursor",
      targetType: "tool",
      targetID: "cursor",
      targetName: "Cursor",
      targetPath: "D:\\cursor\\rules",
      transformStrategy: "cursor_rule",
      scannedAt: "2026-04-10T08:40:00Z",
      counts: { managed: 0, unmanaged: 0, conflict: 1, orphan: 0 },
      findings: [
        {
          id: "tool:cursor:context-router",
          kind: "conflict",
          skillID: "context-router",
          targetType: "tool",
          targetID: "cursor",
          targetName: "Cursor",
          targetPath: "D:\\cursor\\rules\\context-router",
          relativePath: "context-router",
          checksum: "drifted",
          message: "目标内容与登记产物不一致，可能被手动修改或被其他流程覆盖。"
        }
      ],
      lastError: null
    }
  ];

  const issues = collectInstalledSkillIssues(skill, { tools, projects, scanTargets });

  assert.match(issues.join(" | "), /本地内容已变更/);
  assert.match(issues.join(" | "), /路径不可用/);
  assert.match(issues.join(" | "), /项目已移除/);
  assert.match(issues.join(" | "), /登记产物不一致/);
});

test("platform path helpers emit mac-friendly defaults when requested", () => {
  assert.equal(defaultToolConfigPath("cursor", "macos"), "~/.cursor/cli-config.json");
  assert.equal(
    defaultProjectSkillsPath("/Users/demo/EnterpriseAgentHub", "macos"),
    "/Users/demo/EnterpriseAgentHub/.codex/skills"
  );
});

test("platform path helpers preserve windows project suffix conventions", () => {
  assert.equal(
    defaultProjectSkillsPath("D:\\workspace\\EnterpriseAgentHub", "windows"),
    "D:\\workspace\\EnterpriseAgentHub\\.codex\\skills"
  );
});

test("market query builder keeps installed/enabled local-only while sending category and date filters", () => {
  const params = buildSkillListQuery(
    {
      query: "review helper",
      department: "平台工程部",
      compatibleTool: "codex",
      installed: "installed",
      enabled: "enabled",
      accessScope: "authorized_only",
      category: "governance",
      riskLevel: "low",
      publishedWithin: "30d",
      updatedWithin: "7d",
      sort: "download_count"
    },
    new Date("2026-04-13T00:00:00.000Z")
  );

  assert.equal(params.get("q"), "review helper");
  assert.equal(params.get("departmentID"), "平台工程部");
  assert.equal(params.get("compatibleTool"), "codex");
  assert.equal(params.get("accessScope"), "authorized_only");
  assert.equal(params.get("category"), "governance");
  assert.equal(params.get("riskLevel"), "low");
  assert.equal(params.get("sort"), "download_count");
  assert.equal(params.get("publishedSince"), "2026-03-14T00:00:00.000Z");
  assert.equal(params.get("updatedSince"), "2026-04-06T00:00:00.000Z");
  assert.equal(params.get("installed"), null);
  assert.equal(params.get("enabled"), null);
});

test("workspace market derivation filters guest data locally by query, category, access, and install state", () => {
  const skills: SkillSummary[] = [
    {
      skillID: "review-helper",
      displayName: "Review Helper",
      description: "审核辅助",
      version: "1.0.0",
      localVersion: "1.0.0",
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: false,
      canUpdate: false,
      installState: "installed",
      currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
      publishedAt: "2026-04-09T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: ["review"],
      category: "governance",
      riskLevel: "low",
      starCount: 2,
      downloadCount: 4,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null
    },
    {
      skillID: "private-summary",
      displayName: "Private Summary",
      description: "权限摘要",
      version: "1.0.0",
      localVersion: null,
      status: "published",
      visibilityLevel: "summary_visible",
      detailAccess: "summary",
      canInstall: true,
      canUpdate: false,
      installState: "not_installed",
      currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
      publishedAt: "2026-04-09T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: ["private"],
      category: "governance",
      riskLevel: "low",
      starCount: 10,
      downloadCount: 10,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null
    }
  ];

  const result = deriveMarketSkills({
    authState: "guest",
    bootstrap: {
      connection: { status: "offline", serverURL: null, lastError: null },
      counts: { installedCount: 0, enabledCount: 0, updateAvailableCount: 0, unreadNotificationCount: 0 },
      features: { publishSkill: false, reviewWorkbench: false, adminManage: false },
      menuPermissions: [],
      navigation: [],
      user: null
    },
    filters: {
      ...defaultFilters,
      query: "review",
      installed: "installed",
      accessScope: "authorized_only",
      category: "governance"
    },
    skills
  });

  assert.deepEqual(result.map((skill) => skill.skillID), ["review-helper"]);
});

test("workspace market derivation keeps connected authenticated remote order except local install/enabled filters", () => {
  const skills: SkillSummary[] = [
    {
      skillID: "second-but-higher-score",
      displayName: "Second",
      description: "desc",
      version: "1.0.0",
      localVersion: null,
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: true,
      canUpdate: false,
      installState: "not_installed",
      currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
      publishedAt: "2026-04-09T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: [],
      category: "governance",
      riskLevel: "low",
      starCount: 100,
      downloadCount: 100,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null
    },
    {
      skillID: "first-installed",
      displayName: "First",
      description: "desc",
      version: "1.0.0",
      localVersion: "1.0.0",
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: false,
      canUpdate: false,
      installState: "enabled",
      currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
      publishedAt: "2026-04-09T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: [],
      category: "governance",
      riskLevel: "low",
      starCount: 1,
      downloadCount: 1,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [
        {
          targetType: "tool",
          targetID: "codex",
          targetName: "Codex",
          targetPath: "/Users/demo/.codex/skills",
          requestedMode: "symlink",
          resolvedMode: "symlink",
          fallbackReason: null,
          enabledAt: "2026-04-10T08:40:00Z"
        }
      ],
      lastEnabledAt: "2026-04-10T08:40:00Z"
    }
  ];

  const result = deriveMarketSkills({
    authState: "authenticated",
    bootstrap: {
      connection: { status: "connected", serverURL: "http://localhost:3000", lastError: null },
      counts: { installedCount: 0, enabledCount: 0, updateAvailableCount: 0, unreadNotificationCount: 0 },
      features: { publishSkill: true, reviewWorkbench: true, adminManage: true },
      menuPermissions: ["review", "admin_departments", "admin_users", "admin_skills"],
      navigation: ["home", "market"],
      user: null
    },
    filters: {
      ...defaultFilters,
      installed: "installed",
      enabled: "enabled",
      sort: "composite"
    },
    skills
  });

  assert.deepEqual(result.map((skill) => skill.skillID), ["first-installed"]);
});

test("workspace market derivation applies query and sort while connected", () => {
  const skills: SkillSummary[] = [
    {
      skillID: "review-helper",
      displayName: "Review Helper",
      description: "review tooling",
      version: "1.0.0",
      localVersion: null,
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: true,
      canUpdate: false,
      installState: "not_installed",
      currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
      publishedAt: "2026-04-09T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: ["review"],
      category: "governance",
      riskLevel: "low",
      starCount: 5,
      downloadCount: 10,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null,
    },
    {
      skillID: "review-heavy",
      displayName: "Review Heavy",
      description: "review tooling",
      version: "1.0.0",
      localVersion: null,
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: true,
      canUpdate: false,
      installState: "not_installed",
      currentVersionUpdatedAt: "2026-04-10T08:00:00Z",
      publishedAt: "2026-04-10T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: ["review"],
      category: "governance",
      riskLevel: "low",
      starCount: 50,
      downloadCount: 80,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null,
    },
    {
      skillID: "ops-helper",
      displayName: "Ops Helper",
      description: "ops tooling",
      version: "1.0.0",
      localVersion: null,
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: true,
      canUpdate: false,
      installState: "not_installed",
      currentVersionUpdatedAt: "2026-04-08T08:00:00Z",
      publishedAt: "2026-04-08T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: ["ops"],
      category: "governance",
      riskLevel: "low",
      starCount: 100,
      downloadCount: 100,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null,
    },
  ];

  const result = deriveMarketSkills({
    authState: "authenticated",
    bootstrap: {
      connection: { status: "connected", serverURL: "http://localhost:3000", lastError: null },
      counts: { installedCount: 0, enabledCount: 0, updateAvailableCount: 0, unreadNotificationCount: 0 },
      features: { publishSkill: true, reviewWorkbench: true, adminManage: true },
      menuPermissions: ["review"],
      navigation: ["home", "market"],
      user: null,
    },
    filters: {
      ...defaultFilters,
      query: "review",
      sort: "download_count",
    },
    skills,
  });

  assert.deepEqual(result.map((skill) => skill.skillID), ["review-heavy", "review-helper"]);
});

test("visible navigation injects publisher for authenticated users with publish access", () => {
  const navigation = deriveVisibleNavigation({
    authState: "authenticated",
    bootstrap: {
      connection: { status: "connected", serverURL: "http://localhost:3000", lastError: null },
      counts: { installedCount: 0, enabledCount: 0, updateAvailableCount: 0, unreadNotificationCount: 0 },
      features: { publishSkill: true, reviewWorkbench: false, adminManage: false },
      menuPermissions: ["home", "market", "my_installed", "target_management"],
      navigation: ["home", "market", "my_installed", "target_management"],
      user: null,
    }
  });

  assert.deepEqual(navigation, ["home", "market", "my_installed", "publisher", "target_management"]);
});

test("visible navigation does not inject publisher when publish access is disabled", () => {
  const navigation = deriveVisibleNavigation({
    authState: "authenticated",
    bootstrap: {
      connection: { status: "connected", serverURL: "http://localhost:3000", lastError: null },
      counts: { installedCount: 0, enabledCount: 0, updateAvailableCount: 0, unreadNotificationCount: 0 },
      features: { publishSkill: false, reviewWorkbench: false, adminManage: false },
      menuPermissions: ["home", "market", "my_installed", "target_management"],
      navigation: ["home", "market", "my_installed", "target_management"],
      user: null,
    }
  });

  assert.deepEqual(navigation, ["home", "market", "my_installed", "target_management"]);
});

test("navigation groups split user and admin sections", () => {
  const groups = buildNavigationGroups(["home", "market", "my_installed", "publisher", "target_management", "review", "admin_users"]);
  assert.deepEqual(groups, [
    { id: "user", pages: ["home", "market", "my_installed", "publisher", "target_management"] },
    { id: "admin", pages: ["review", "admin_users"] },
  ]);
});

test("desktop notifications collapse to the supported kinds and keep only the newest 20 items", () => {
  const notifications: LocalNotification[] = [
    ...Array.from({ length: 22 }, (_, index) => ({
      notificationID: `visible-${index}`,
      type: index % 2 === 0 ? "skill_update_available" : ("pending_review" as LocalNotification["type"]),
      title: index % 2 === 0 ? `Skill 更新 ${index}` : `你有新的待审核任务 ${index}`,
      summary: index % 2 === 0 ? "请前往已安装页面查看更新。" : "有新的审核任务等待处理。",
      relatedSkillID: index % 2 === 0 ? "context-router" : "codex-review-helper",
      targetPage: index % 2 === 0 ? "my_installed" : "review",
      occurredAt: `2026-04-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
      unread: index % 3 !== 0,
      source: "server" as const
    })),
    {
      notificationID: "hidden-local-enable",
      type: "enable_result",
      title: "本地启用成功",
      summary: "不应再进入通知面板。",
      relatedSkillID: "context-router",
      targetPage: "target_management",
      occurredAt: "2026-04-16T13:00:00.000Z",
      unread: true,
      source: "local"
    },
    {
      notificationID: "hidden-path",
      type: "target_path_invalid",
      title: "路径异常",
      summary: "不应再进入通知面板。",
      relatedSkillID: null,
      targetPage: "target_management",
      occurredAt: "2026-04-16T13:05:00.000Z",
      unread: true,
      source: "local"
    }
  ];

  const appUpdate: AppUpdateState = {
    available: true,
    currentVersion: "0.1.0",
    latestVersion: "0.1.3",
    summary: "软件更新占位通知。",
    highlights: ["修复通知入口", "补充更新弹窗"],
    occurredAt: "2026-04-16T15:00:00.000Z",
    unread: true,
    releaseURL: null,
    actionLabel: "查看更新"
  };

  const items = deriveDesktopNotifications({ notifications, appUpdate });

  assert.equal(items.length, 20);
  assert.ok(items.some((item) => item.kind === "app_update"));
  assert.ok(items.every((item) => item.kind === "skill_update" || item.kind === "review_progress" || item.kind === "app_update"));
  assert.ok(items.every((item) => item.rawType !== "enable_result" && item.rawType !== "target_path_invalid"));
  assert.ok(items[0]!.occurredAt >= items[items.length - 1]!.occurredAt);
});

test("notification badge labels follow 0 / 1-9 / 9+ rules", () => {
  assert.equal(notificationBadgeLabel(0), null);
  assert.equal(notificationBadgeLabel(4), "4");
  assert.equal(notificationBadgeLabel(10), "9+");
  assert.equal(notificationBadgeLabel(24), "9+");
});

test("desktop notification action mapping resolves review, publisher, skill update, and app update targets", () => {
  const reviewAction = resolveDesktopNotificationAction(
    {
      notificationID: "n-review",
      kind: "review_progress",
      title: "你有新的待审核任务",
      summary: "请处理 review rv_001。",
      occurredAt: "2026-04-16T12:00:00.000Z",
      unread: true,
      relatedSkillID: "codex-review-helper",
      rawNotificationID: "n-review",
      rawType: "pending_review",
      source: "server"
    },
    {
      reviews: [{ reviewID: "rv_001", skillID: "codex-review-helper" }],
      publisherSubmissions: [{ submissionID: "sub_readme-polisher_20260411", skillID: "readme-polisher" }]
    }
  );

  assert.deepEqual(reviewAction, {
    kind: "review",
    reviewID: "rv_001",
    skillID: "codex-review-helper"
  });

  const publisherAction = resolveDesktopNotificationAction(
    {
      notificationID: "n-publisher",
      kind: "review_progress",
      title: "README 改写助手被退回修改",
      summary: "submissionID sub_readme-polisher_20260411 需要重新提交。",
      occurredAt: "2026-04-16T11:00:00.000Z",
      unread: true,
      relatedSkillID: "readme-polisher",
      rawNotificationID: "n-publisher",
      rawType: "returned_for_changes",
      source: "server"
    },
    {
      reviews: [{ reviewID: "rv_001", skillID: "codex-review-helper" }],
      publisherSubmissions: [{ submissionID: "sub_readme-polisher_20260411", skillID: "readme-polisher" }]
    }
  );

  assert.deepEqual(publisherAction, {
    kind: "publisher",
    submissionID: "sub_readme-polisher_20260411",
    skillID: "readme-polisher"
  });

  const skillUpdateAction = resolveDesktopNotificationAction(
    {
      notificationID: "n-update",
      kind: "skill_update",
      title: "上下文路由助手有新版本",
      summary: "请前往已安装页面查看。",
      occurredAt: "2026-04-16T10:00:00.000Z",
      unread: true,
      relatedSkillID: "context-router",
      rawNotificationID: "n-update",
      rawType: "skill_update_available",
      source: "server"
    },
    {
      reviews: [],
      publisherSubmissions: []
    }
  );

  assert.deepEqual(skillUpdateAction, {
    kind: "my_installed",
    installedFilter: "updates",
    skillID: "context-router"
  });

  const appUpdateAction = resolveDesktopNotificationAction(
    {
      notificationID: "app_update_0.1.3",
      kind: "app_update",
      title: "桌面客户端可更新到 0.1.3",
      summary: "软件更新占位通知。",
      occurredAt: "2026-04-16T09:00:00.000Z",
      unread: true,
      relatedSkillID: null,
      rawNotificationID: null,
      rawType: "app_update",
      source: "app_update"
    },
    {
      reviews: [],
      publisherSubmissions: []
    }
  );

  assert.deepEqual(appUpdateAction, { kind: "app_update" });
});

test("display date parser accepts p1-local timestamps from desktop local state", () => {
  assert.equal(parseDisplayDate("p1-local-1776065472870")?.getTime(), 1776065472870);
  assert.notEqual(formatDisplayDate("p1-local-1776065472870"), "-");
});

test("display date formatter tolerates invalid timestamps without throwing", () => {
  assert.equal(parseDisplayDate("not-a-date"), null);
  assert.equal(formatDisplayDate("not-a-date"), "-");
});

test("discovered local skills include unmanaged tool directories and ignore hidden/system entries", () => {
  const installedSkills: SkillSummary[] = [
    {
      skillID: "context-router",
      displayName: "上下文路由助手",
      description: "desc",
      version: "1.4.0",
      localVersion: "1.4.0",
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: false,
      canUpdate: false,
      installState: "enabled",
      currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
      publishedAt: "2026-04-09T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: [],
      category: "开发效率",
      riskLevel: "low",
      starCount: 0,
      downloadCount: 0,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null
    }
  ];

  const marketSkills: SkillSummary[] = [
    {
      skillID: "plan",
      displayName: "Plan",
      description: "市场里已有同名 skill。",
      version: "1.0.0",
      localVersion: null,
      status: "published",
      visibilityLevel: "detail_visible",
      detailAccess: "full",
      canInstall: true,
      canUpdate: false,
      installState: "not_installed",
      currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
      publishedAt: "2026-04-09T08:00:00Z",
      compatibleTools: ["codex"],
      compatibleSystems: ["macos"],
      tags: [],
      category: "开发效率",
      riskLevel: "low",
      starCount: 0,
      downloadCount: 0,
      starred: false,
      isScopeRestricted: false,
      hasLocalHashDrift: false,
      enabledTargets: [],
      lastEnabledAt: null
    }
  ];

  const scanTargets: ScanTargetSummary[] = [
    {
      id: "tool:codex",
      targetType: "tool",
      targetID: "codex",
      targetName: "Codex",
      targetPath: "/Users/demo/.codex/skills",
      transformStrategy: "codex_skill",
      scannedAt: "2026-04-10T08:40:00Z",
      counts: { managed: 1, unmanaged: 2, conflict: 0, orphan: 0 },
      findings: [
        {
          id: "tool:codex:context-router",
          kind: "managed",
          skillID: "context-router",
          targetType: "tool",
          targetID: "codex",
          targetName: "Codex",
          targetPath: "/Users/demo/.codex/skills/context-router",
          relativePath: "context-router",
          checksum: "managed",
          message: "目标内容与本地登记一致，处于托管状态。"
        },
        {
          id: "tool:codex:plan",
          kind: "unmanaged",
          skillID: null,
          targetType: "tool",
          targetID: "codex",
          targetName: "Codex",
          targetPath: "/Users/demo/.codex/skills/plan",
          relativePath: "plan",
          checksum: "unmanaged",
          message: "发现未托管目录，启用时不会在未确认前覆盖。"
        },
        {
          id: "tool:codex:.system",
          kind: "unmanaged",
          skillID: null,
          targetType: "tool",
          targetID: "codex",
          targetName: "Codex",
          targetPath: "/Users/demo/.codex/skills/.system",
          relativePath: ".system",
          checksum: "hidden",
          message: "隐藏目录。"
        },
        {
          id: "tool:windsurf:global_rules.md",
          kind: "unmanaged",
          skillID: null,
          targetType: "tool",
          targetID: "windsurf",
          targetName: "Windsurf",
          targetPath: "/Users/demo/.codeium/windsurf/memories/global_rules.md",
          relativePath: "global_rules.md",
          checksum: "file",
          message: "不是独立 skill 目录。"
        }
      ],
      lastError: null
    }
  ];

  const discovered = deriveDiscoveredLocalSkills({ installedSkills, marketSkills, scanTargets });

  assert.equal(discovered.length, 1);
  assert.equal(discovered[0]?.skillID, "plan");
  assert.equal(discovered[0]?.matchedMarketSkill, true);
  assert.equal(discovered[0]?.targets.length, 1);
  assert.match(discovered[0]?.description ?? "", /市场里已有同名 skill|纳入 Central Store 管理/);
});
