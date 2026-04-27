import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { LocalBootstrap, LocalNotification, ProjectConfig, PublishDraft, ScanTargetSummary, SkillSummary, ToolConfig } from "../src/domain/p1.ts";
import { buildSkillListQuery } from "../src/services/p1Client.ts";
import {
  buildSettingsPanels,
  buildPublishPrecheck,
  buildCommunityExploreFilters,
  canAccessClientUpdateManagement,
  DEFAULT_COMMUNITY_PANE,
  deriveTopLevelNavigation,
  legacyPageForView,
  mapLegacyPageToView,
  presentConfirmWithDrawerDismissal,
  presentModalWithDrawerDismissal,
  reviewDetailOverlay,
  shouldPromptLoginForSectionNavigation,
  skillDetailOverlay
} from "../src/state/useDesktopUIState.ts";
import { isSafeExternalURL } from "../src/services/externalLinks.ts";
import { deriveDesktopNotifications, notificationBadgeLabel, resolveDesktopNotificationAction, type AppUpdateState } from "../src/state/ui/desktopNotifications.ts";
import { defaultAppUpdateState } from "../src/state/ui/clientUpdates.ts";
import { connectedServiceURL } from "../src/state/ui/aboutInfo.ts";
import { deriveCommunityLeaderboards } from "../src/state/ui/communityLeaderboards.ts";
import { buildTargetDrafts, collectInstalledSkillIssues, compareToolsByAvailability, matchesDiscoveredTargetFilter, matchesInstalledTargetFilter, targetDraftSubmitLabel } from "../src/state/ui/installedSkillSelectors.ts";
import { parseSkillFrontmatter, readSkillMarkdownFromUploadEntries, validateSkillSlug, validateUploadEntries } from "../src/state/ui/publishPackageIntrospection.ts";
import { scanTargetsSummaryMessage } from "../src/state/workspace/scanProgress.ts";
import { deriveAccountPresentation } from "../src/state/ui/accountPresentation.ts";
import { normalizePreferences, resolveDisplayLanguage } from "../src/state/ui/useDesktopPreferences.ts";
import { deriveMarketSkills, deriveVisibleNavigation, deriveWorkspaceState } from "../src/state/workspace/workspaceDerivedState.ts";
import { iconToneForLabel, iconTones } from "../src/ui/iconTone.ts";
import { themeLabel } from "../src/ui/themeLabels.ts";
import { buildDisableSkillArgs, buildEnableSkillArgs, buildUninstallSkillArgs, normalizeUninstallSkillResult } from "../src/services/tauriBridge/localCommandArgs.ts";
import { buildMarkLocalNotificationsReadArgs, buildMarkOfflineEventsSyncedArgs } from "../src/services/tauriBridge/notificationOps.ts";
import { deriveDiscoveredLocalSkills } from "../src/utils/discoveredLocalSkills.ts";
import { defaultProjectSkillsPath, defaultToolConfigPath, defaultToolSkillsPath } from "../src/utils/platformPaths.ts";
import { sanitizePhoneNumberInput, validatePhoneNumber } from "../src/utils/phoneNumber.ts";
import { mergeLocalInstalls } from "../src/state/p1WorkspaceHelpers.ts";
import { shouldCloseFromBackdropPointerDown } from "../src/ui/modalInteraction.ts";

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
  category: "开发",
  tags: ["提示", "规范"],
  compatibleTools: ["codex"],
  compatibleSystems: ["windows"],
  files: [
    { name: "SKILL.md", relativePath: "SKILL.md", size: 1_200, mimeType: "text/markdown" },
    { name: "README.md", relativePath: "README.md", size: 820, mimeType: "text/markdown" }
  ]
};

const baseSkill: SkillSummary = {
  skillID: "review-helper",
  displayName: "Review Helper",
  description: "审核辅助",
  version: "1.0.0",
  localVersion: "1.0.0",
  latestVersion: "1.0.0",
  status: "published",
  visibilityLevel: "detail_visible",
  detailAccess: "full",
  canInstall: true,
  canUpdate: false,
  installState: "installed",
  authorName: "张三",
  authorDepartment: "平台工程部",
  currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
  publishedAt: "2026-04-09T08:00:00Z",
  compatibleTools: ["codex"],
  compatibleSystems: ["windows"],
  tags: ["代码", "审查"],
  category: "开发",
  riskLevel: "low",
  starCount: 20,
  downloadCount: 100,
  starred: false,
  isScopeRestricted: false,
  hasLocalHashDrift: false,
  enabledTargets: [],
  lastEnabledAt: null
};

test("publish precheck passes for a valid folder upload with SKILL.md", () => {
  const result = buildPublishPrecheck(baseDraft);
  assert.equal(result.canSubmit, true);
  assert.equal(result.items.find((item) => item.id === "skill-doc")?.status, "pass");
  assert.equal(result.items.find((item) => item.id === "slug")?.status, "pass");
});

test("publish precheck rejects invalid slugs before submission", () => {
  const result = buildPublishPrecheck({ ...baseDraft, skillID: "Bad Slug" });
  assert.equal(result.canSubmit, false);
  assert.equal(result.items.find((item) => item.id === "slug")?.status, "warn");
});

test("phone number helpers enforce mainland mobile formatting", () => {
  assert.equal(sanitizePhoneNumberInput(" 138-0000-0001 ext.99 "), "13800000001");
  assert.equal(validatePhoneNumber("13800000001"), null);
  assert.equal(validatePhoneNumber("23800000001"), "手机号需以 1 开头。");
  assert.equal(validatePhoneNumber("1380000000a"), "手机号只能输入数字。");
});

test("skill metadata parser reads SKILL.md frontmatter for publish autofill", async () => {
  const markdown = `---\nname: ppt-generator\ndescription: 将用户讲稿一键生成乔布斯风极简科技感竖屏HTML演示稿。\n---\n\n# PPT Generator\n`;
  assert.deepEqual(parseSkillFrontmatter(markdown), {
    name: "ppt-generator",
    description: "将用户讲稿一键生成乔布斯风极简科技感竖屏HTML演示稿。"
  });
  assert.equal(validateSkillSlug("ppt-generator").valid, true);

  const file = new File([markdown], "SKILL.md", { type: "text/markdown" });
  assert.equal(await readSkillMarkdownFromUploadEntries([{ file, relativePath: "ppt-generator/SKILL.md" }]), markdown);
});

test("publish upload validation rejects loose files and non-zip package uploads", () => {
  const skillFile = new File(["# Skill"], "SKILL.md", { type: "text/markdown" });
  const imageFile = new File(["png"], "logo.png", { type: "image/png" });
  const zipFile = new File(["zip"], "skill.zip", { type: "application/zip" });

  assert.match(validateUploadEntries([{ file: imageFile, relativePath: "logo.png" }], "folder") ?? "", /请选择文件夹/);
  assert.match(validateUploadEntries([{ file: imageFile, relativePath: "logo.png" }], "zip") ?? "", /\.zip/);
  assert.match(validateUploadEntries([{ file: imageFile, relativePath: "skill/logo.png" }], "folder") ?? "", /SKILL\.md/);
  assert.equal(validateUploadEntries([{ file: skillFile, relativePath: "skill/SKILL.md" }], "folder"), null);
  assert.equal(validateUploadEntries([{ file: zipFile, relativePath: "skill.zip" }], "zip"), null);
});

test("icon tones are stable and limited to the quiet palette", () => {
  const label = "Review Helper";

  assert.equal(iconToneForLabel(label), iconToneForLabel(label));
  assert.ok(iconTones.includes(iconToneForLabel(label)));
  assert.ok(iconTones.includes(iconToneForLabel("提示词护栏模板")));
});

test("blocking modal presentation closes the skill detail before opening the overlay", () => {
  const calls: string[] = [];
  presentModalWithDrawerDismissal(
    { type: "targets", skillID: "ops-oncall-companion" },
    {
      closeSkillDetail: () => {
        calls.push("close-detail");
      },
      setModal: (modal) => {
        calls.push(`modal:${modal.type}`);
      }
    }
  );

  assert.deepEqual(calls, ["close-detail", "modal:targets"]);
});

test("skill detail opens through overlay state instead of a replacement stage", () => {
  assert.deepEqual(skillDetailOverlay("codex-review-helper", "community"), {
    kind: "skill_detail",
    skillID: "codex-review-helper",
    source: "community"
  });
  assert.equal(
    legacyPageForView({
      section: "community",
      communityPane: "skills",
      localPane: "skills",
      managePane: "reviews",
      overlay: skillDetailOverlay("codex-review-helper", "community")
    }),
    "market"
  );
});

test("review detail opens as a management overlay without replacing the review page", () => {
  assert.deepEqual(reviewDetailOverlay("review-123"), {
    kind: "review_detail",
    reviewID: "review-123"
  });
  assert.equal(
    legacyPageForView({
      section: "manage",
      communityPane: "skills",
      localPane: "skills",
      managePane: "reviews",
      overlay: reviewDetailOverlay("review-123")
    }),
    "review"
  );
});

test("clearing a confirm modal does not touch the skill detail overlay", () => {
  const calls: string[] = [];
  presentConfirmWithDrawerDismissal(null, {
    closeSkillDetail: () => {
      calls.push("close-detail");
    },
    setConfirmModal: (modal) => {
      calls.push(`confirm:${modal === null ? "none" : "open"}`);
    }
  });

  assert.deepEqual(calls, ["confirm:none"]);
});

test("new top-level navigation only shows manage when admin capability is available", () => {
  assert.equal(DEFAULT_COMMUNITY_PANE, "home");
  assert.deepEqual(deriveTopLevelNavigation({ isAdminConnected: false }), ["community", "home", "local"]);
  assert.deepEqual(deriveTopLevelNavigation({ isAdminConnected: true }), ["community", "home", "local", "manage"]);
});

test("community top-level navigation prompts login for guests before switching", () => {
  assert.equal(shouldPromptLoginForSectionNavigation({ section: "community", loggedIn: false }), true);
  assert.equal(shouldPromptLoginForSectionNavigation({ section: "community", loggedIn: true }), false);
  assert.equal(shouldPromptLoginForSectionNavigation({ section: "home", loggedIn: false }), false);
});

test("legacy pages map into the new section model", () => {
  assert.deepEqual(mapLegacyPageToView("market"), { section: "community", communityPane: "skills" });
  assert.deepEqual(mapLegacyPageToView("my_installed"), { section: "local", localPane: "skills" });
  assert.deepEqual(mapLegacyPageToView("admin_users"), { section: "manage", managePane: "users" });
  assert.equal(
    legacyPageForView({
      section: "community",
      communityPane: "home",
      localPane: "skills",
      managePane: "reviews",
      overlay: { kind: "none" }
    }),
    "market"
  );
  assert.equal(
    legacyPageForView({
      section: "manage",
      communityPane: "home",
      localPane: "skills",
      managePane: "client_updates",
      overlay: { kind: "none" }
    }),
    "admin_users"
  );
  assert.equal(
    legacyPageForView({
      section: "manage",
      communityPane: "home",
      localPane: "skills",
      managePane: "reviews",
      overlay: { kind: "none" }
    }),
    "review"
  );
  assert.equal(
    legacyPageForView({
      section: "community",
      communityPane: "home",
      localPane: "skills",
      managePane: "reviews",
      overlay: { kind: "publisher", pane: "compose" }
    }),
    "publisher"
  );
});

test("community home search builds a clean results-page filter set", () => {
  assert.deepEqual(buildCommunityExploreFilters("  review helper  "), {
    query: "review helper",
    department: "all",
    compatibleTool: "all",
    installed: "all",
    enabled: "all",
    accessScope: "include_public",
    category: "all",
    tags: [],
    riskLevel: "all",
    publishedWithin: "all",
    updatedWithin: "all",
    sort: "relevance"
  });
  assert.equal(buildCommunityExploreFilters("   ").sort, "composite");
});

test("community home renders as a standalone page before the sidebar workspace", () => {
  const sourcePath = fileURLToPath(new URL("../src/ui/desktopSections.tsx", import.meta.url));
  const source = readFileSync(sourcePath, "utf8");
  const homeBranchIndex = source.indexOf('if (ui.communityPane === "home")');
  const workspaceLayoutIndex = source.indexOf('<div className="workspace-layout">');

  assert.ok(homeBranchIndex >= 0);
  assert.ok(workspaceLayoutIndex >= 0);
  assert.ok(homeBranchIndex < workspaceLayoutIndex);
  assert.match(source.slice(homeBranchIndex, workspaceLayoutIndex), /community-landing-page/);
});

test("client update management is limited to first-level admins in UI helpers", () => {
  assert.equal(canAccessClientUpdateManagement({ adminLevel: 1 }), true);
  assert.equal(canAccessClientUpdateManagement({ adminLevel: 2 }), false);
  assert.equal(canAccessClientUpdateManagement({ adminLevel: null }), false);
});

test("notification actions route old review and publisher events into the new IA targets", () => {
  const appUpdate: AppUpdateState = {
    ...defaultAppUpdateState("0.1.0"),
    available: true,
    latestVersion: "0.1.3",
    summary: "更新说明",
    highlights: ["a"],
    occurredAt: "2026-04-18T09:00:00.000Z",
    unread: true,
    actionLabel: "立即更新"
  };
  const notifications: LocalNotification[] = [
    {
      notificationID: "notify-review",
      type: "connection_restored",
      title: "你有新的待审核任务",
      summary: "review-123 已进入审核",
      relatedSkillID: "review-helper",
      targetPage: "review",
      occurredAt: "2026-04-18T10:00:00.000Z",
      unread: true,
      source: "remote"
    },
    {
      notificationID: "notify-skill",
      type: "skill_update_available",
      title: "Review Helper 有新版本可更新",
      summary: "1.0.1 可更新",
      relatedSkillID: "review-helper",
      targetPage: "my_installed",
      occurredAt: "2026-04-18T09:30:00.000Z",
      unread: true,
      source: "remote"
    }
  ];

  const desktopNotifications = deriveDesktopNotifications({ appUpdate, notifications });
  const reviewNotification = desktopNotifications.find((item) => item.notificationID === "notify-review");
  const skillNotification = desktopNotifications.find((item) => item.notificationID === "notify-skill");

  assert.equal(notificationBadgeLabel(12), "9+");
  assert.ok(reviewNotification);
  assert.ok(skillNotification);

  assert.deepEqual(
    resolveDesktopNotificationAction(reviewNotification!, {
      reviews: [{ reviewID: "review-123", skillID: "review-helper" }],
      publisherSubmissions: [{ submissionID: "submission-1", skillID: "review-helper" }]
    }),
    { kind: "review", reviewID: "review-123", skillID: "review-helper" }
  );

  assert.deepEqual(
    resolveDesktopNotificationAction(skillNotification!, {
      reviews: [],
      publisherSubmissions: []
    }),
    { kind: "my_installed", installedFilter: "updates", skillID: "review-helper" }
  );
});

test("structured publishing notifications route by object type without title matching", () => {
  const appUpdate: AppUpdateState = defaultAppUpdateState("0.1.0");
  const notifications: LocalNotification[] = [
    {
      notificationID: "notify-structured-review",
      type: "skill_review_task",
      title: "审核任务",
      summary: "等待处理",
      objectType: "review",
      objectID: "rv_001",
      action: "/admin/reviews/rv_001",
      relatedSkillID: null,
      targetPage: "review",
      occurredAt: "2026-04-18T10:00:00.000Z",
      unread: true,
      source: "server"
    },
    {
      notificationID: "notify-structured-publisher",
      type: "skill_review_progress",
      title: "发布进度",
      summary: "审核通过",
      objectType: "publisher_submission",
      objectID: "rv_002",
      action: "/publisher/submissions/rv_002",
      relatedSkillID: null,
      targetPage: "publisher",
      occurredAt: "2026-04-18T10:01:00.000Z",
      unread: true,
      source: "server"
    }
  ];

  const desktopNotifications = deriveDesktopNotifications({ appUpdate, notifications });
  const reviewNotification = desktopNotifications.find((item) => item.notificationID === "notify-structured-review");
  const publisherNotification = desktopNotifications.find((item) => item.notificationID === "notify-structured-publisher");

  assert.deepEqual(
    resolveDesktopNotificationAction(reviewNotification!, {
      reviews: [],
      publisherSubmissions: []
    }),
    { kind: "review", reviewID: "rv_001", skillID: null }
  );
  assert.deepEqual(
    resolveDesktopNotificationAction(publisherNotification!, {
      reviews: [],
      publisherSubmissions: []
    }),
    { kind: "publisher", submissionID: "rv_002", skillID: null }
  );
});

test("opencode defaults point to the config directory on Windows", () => {
  assert.equal(
    defaultToolConfigPath("opencode", "windows"),
    "%USERPROFILE%\\.config\\opencode\\opencode.json"
  );
  assert.equal(
    defaultToolSkillsPath("opencode", "windows"),
    "%USERPROFILE%\\.config\\opencode\\skills"
  );
});

test("workspace visible navigation still honors backend permissions and publish feature", () => {
  const visible = deriveVisibleNavigation({
    authState: "authenticated",
    bootstrap: {
      user: {
        username: "lin",
        phoneNumber: "13800001001",
        role: "admin",
        adminLevel: 4,
        departmentID: "d1",
        departmentName: "平台工程部",
        locale: "zh-CN"
      },
      connection: {
        status: "connected",
        serverTime: "2026-04-18T10:00:00.000Z",
        apiVersion: "1.0.0"
      },
      features: {
        p1Desktop: true,
        publishSkill: true,
        reviewWorkbench: true,
        adminManage: true,
        mcpManage: false,
        pluginManage: false
      },
      counts: {
        installedCount: 1,
        enabledCount: 0,
        updateAvailableCount: 0,
        unreadNotificationCount: 0
      },
      navigation: ["home", "market", "my_installed", "review", "admin_users"],
      menuPermissions: ["home", "market", "my_installed", "review", "admin_users"]
    }
  });

  assert.deepEqual(visible, ["home", "market", "my_installed", "publisher", "review", "admin_users"]);
});

test("offline authenticated navigation keeps cached admin entries until permission is revoked", () => {
  const bootstrap = {
    user: {
      username: "lin",
      phoneNumber: "13800001001",
      role: "admin",
      adminLevel: 1,
      departmentID: "d1",
      departmentName: "平台工程部",
      locale: "zh-CN"
    },
    connection: {
      status: "offline",
      serverTime: "2026-04-18T10:00:00.000Z",
      apiVersion: "1.0.0",
      lastError: "无法连接服务"
    },
    features: {
      p1Desktop: true,
      publishSkill: true,
      reviewWorkbench: true,
      adminManage: true,
      mcpManage: false,
      pluginManage: false
    },
    counts: {
      installedCount: 1,
      enabledCount: 0,
      updateAvailableCount: 0,
      unreadNotificationCount: 0
    },
    navigation: ["home", "market", "my_installed", "publisher", "target_management", "review", "admin_users"],
    menuPermissions: ["home", "market", "my_installed", "publisher", "target_management", "review", "admin_users"]
  } as const;
  const visible = deriveVisibleNavigation({
    authState: "authenticated",
    bootstrap
  });

  assert.deepEqual(visible, ["home", "market", "my_installed", "publisher", "target_management", "review", "admin_users"]);
  assert.equal(
    deriveWorkspaceState({
      authState: "authenticated",
      bootstrap,
      departments: [],
      filters: {
        query: "",
        department: "all",
        compatibleTool: "all",
        installed: "all",
        enabled: "all",
        accessScope: "include_public",
        category: "all",
        tags: [],
        riskLevel: "all",
        publishedWithin: "all",
        updatedWithin: "all",
        sort: "composite"
      },
      notifications: [],
      scanTargets: [],
      selectedDepartmentID: null,
      selectedSkillID: "",
      skills: []
    }).isAdminConnected,
    true
  );
});

test("auto language prefers authenticated user locale over browser locale", () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language: "en-US" }
  });

  try {
    assert.equal(
      resolveDisplayLanguage({ language: "auto", autoDetectLanguage: true, theme: "classic", showInstallResults: true, syncLocalEvents: true }, "zh-CN"),
      "zh-CN"
    );
  } finally {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
  }
});

test("theme labels include the global dark theme", () => {
  assert.equal(themeLabel("dark", "zh-CN"), "暗色");
  assert.equal(themeLabel("dark", "en-US"), "Dark");
});

test("guest account presentation keeps settings as a local-first experience", () => {
  assert.deepEqual(
    deriveAccountPresentation({
      user: {
        username: "本地模式",
        phoneNumber: "",
        role: "guest",
        departmentID: "local",
        departmentName: "离线工作台",
        locale: "zh-CN"
      },
      loggedIn: false,
      connectionStatus: "offline",
      language: "zh-CN"
    }),
    {
      buttonLabel: "本地模式",
      connectionTone: "offline",
      connectionLabel: "本地"
    }
  );
});

test("authenticated service failures are shown as service issues rather than local mode", () => {
  assert.deepEqual(
    deriveAccountPresentation({
      user: {
        username: "系统管理员",
        phoneNumber: "13800000002",
        role: "admin",
        adminLevel: 1,
        departmentID: "dept_company",
        departmentName: "集团",
        locale: "zh-CN"
      },
      loggedIn: true,
      connectionStatus: "failed",
      language: "zh-CN"
    }),
    {
      buttonLabel: "系统管理员",
      connectionTone: "failed",
      connectionLabel: "服务异常"
    }
  );
});

test("connected service url only appears after a successful connection", () => {
  assert.equal(
    connectedServiceURL({
      connectionStatus: "connected",
      apiBaseURL: "https://intranet.example.com/api"
    }),
    "https://intranet.example.com/api"
  );
  assert.equal(
    connectedServiceURL({
      connectionStatus: "offline",
      apiBaseURL: "https://intranet.example.com/api"
    }),
    null
  );
});

test("settings navigation includes the about panel and current version", () => {
  const panels = buildSettingsPanels({
    language: "zh-CN",
    theme: "classic",
    hasAgentKey: false,
    connectionStatus: "offline",
    appUpdate: {
      ...defaultAppUpdateState("0.1.0"),
      occurredAt: "2026-04-21T00:00:00.000Z"
    }
  });

  assert.ok(panels.some((panel) => panel.id === "about" && panel.status === "v0.1.0"));
});

test("external link helper only accepts http and https urls", () => {
  assert.equal(isSafeExternalURL("https://github.com/HaibinZhang1/EnterpriseAgentHub"), true);
  assert.equal(isSafeExternalURL("http://127.0.0.1:3000"), true);
  assert.equal(isSafeExternalURL("file:///tmp/demo"), false);
  assert.equal(isSafeExternalURL("javascript:alert(1)"), false);
});

test("preferences normalize unsupported saved themes back to classic", () => {
  const preferences = normalizePreferences({ theme: "legacy-blue" as never });
  assert.equal(preferences.theme, "classic");

  const darkPreferences = normalizePreferences({ theme: "dark" });
  assert.equal(darkPreferences.theme, "dark");
});

test("target drafts localize adapter status labels in Chinese", () => {
  const drafts = buildTargetDrafts(baseSkill, {
    tools: [
      {
        toolID: "codex",
        name: "Codex",
        displayName: "Codex",
        configPath: "/Users/demo/.codex/config.toml",
        detectedPath: "/Users/demo/.codex/skills",
        configuredPath: null,
        skillsPath: "/Users/demo/.codex/skills",
        enabled: true,
        status: "detected",
        adapterStatus: "detected",
        detectionMethod: "default_path",
        transform: "codex_skill",
        transformStrategy: "codex_skill",
        enabledSkillCount: 0,
        lastScannedAt: "2026-04-10T08:40:00Z"
      }
    ],
    projects: [],
    scanTargets: []
  } as never, "zh-CN");

  assert.equal(drafts[0]?.statusLabel, "已检测");
});

test("target drafts only include available tools and enabled projects", () => {
  const drafts = buildTargetDrafts(baseSkill, {
    tools: [
      {
        toolID: "missing-tool",
        name: "Missing Tool",
        displayName: "Missing Tool",
        configPath: "",
        detectedPath: null,
        configuredPath: null,
        skillsPath: "",
        enabled: true,
        status: "missing",
        adapterStatus: "missing",
        detectionMethod: "default_path",
        transform: "codex_skill",
        transformStrategy: "codex_skill",
        enabledSkillCount: 0,
        lastScannedAt: null
      },
      {
        toolID: "codex",
        name: "Codex",
        displayName: "Codex",
        configPath: "/Users/demo/.codex/config.toml",
        detectedPath: "/Users/demo/.codex/skills",
        configuredPath: null,
        skillsPath: "/Users/demo/.codex/skills",
        enabled: true,
        status: "detected",
        adapterStatus: "detected",
        detectionMethod: "default_path",
        transform: "codex_skill",
        transformStrategy: "codex_skill",
        enabledSkillCount: 0,
        lastScannedAt: "2026-04-10T08:40:00Z"
      }
    ],
    projects: [
      {
        projectID: "disabled-project",
        name: "Disabled Project",
        displayName: "Disabled Project",
        projectPath: "/repo/disabled",
        skillsPath: "/repo/disabled/.codex/skills",
        projectPathStatus: "valid",
        projectPathStatusReason: null,
        enabled: false,
        enabledSkillCount: 0,
        createdAt: "2026-04-10T08:40:00Z",
        updatedAt: "2026-04-10T08:40:00Z"
      },
      {
        projectID: "repo",
        name: "Repo",
        displayName: "Repo",
        projectPath: "/repo",
        skillsPath: "/repo/.codex/skills",
        projectPathStatus: "valid",
        projectPathStatusReason: null,
        enabled: true,
        enabledSkillCount: 0,
        createdAt: "2026-04-10T08:40:00Z",
        updatedAt: "2026-04-10T08:40:00Z"
      }
    ],
    scanTargets: []
  } as never, "zh-CN");

  assert.deepEqual(drafts.map((draft) => draft.key), ["tool:codex", "project:repo"]);
});

test("available tools sort ahead of missing tools", () => {
  const tools: ToolConfig[] = [
    {
      toolID: "missing-tool",
      name: "Missing Tool",
      displayName: "Missing Tool",
      configPath: "",
      detectedPath: null,
      configuredPath: null,
      skillsPath: "",
      enabled: true,
      status: "missing",
      adapterStatus: "missing",
      detectionMethod: "default_path",
      transform: "codex_skill",
      transformStrategy: "codex_skill",
      enabledSkillCount: 0,
      lastScannedAt: null
    },
    {
      toolID: "codex",
      name: "Codex",
      displayName: "Codex",
      configPath: "/Users/demo/.codex/config.toml",
      detectedPath: "/Users/demo/.codex/skills",
      configuredPath: null,
      skillsPath: "/Users/demo/.codex/skills",
      enabled: true,
      status: "detected",
      adapterStatus: "detected",
      detectionMethod: "default_path",
      transform: "codex_skill",
      transformStrategy: "codex_skill",
      enabledSkillCount: 0,
      lastScannedAt: "2026-04-10T08:40:00Z"
    }
  ];

  assert.deepEqual([...tools].sort(compareToolsByAvailability).map((tool) => tool.toolID), ["codex", "missing-tool"]);
});

test("market skill derivation still filters and sorts by query and category", () => {
  const result = deriveMarketSkills({
    authState: "authenticated",
    bootstrap: {
      user: {
        username: "lin",
        phoneNumber: "13800001001",
        role: "admin",
        adminLevel: 4,
        departmentID: "d1",
        departmentName: "平台工程部",
        locale: "zh-CN"
      },
      connection: {
        status: "connected",
        serverTime: "2026-04-18T10:00:00.000Z",
        apiVersion: "1.0.0"
      },
      features: {
        p1Desktop: true,
        publishSkill: true,
        reviewWorkbench: true,
        adminManage: true,
        mcpManage: false,
        pluginManage: false
      },
      counts: {
        installedCount: 1,
        enabledCount: 0,
        updateAvailableCount: 0,
        unreadNotificationCount: 0
      },
      navigation: ["home", "market"],
      menuPermissions: ["home", "market"]
    },
    filters: {
      query: "review",
      department: "all",
      compatibleTool: "all",
      installed: "all",
      enabled: "all",
      accessScope: "include_public",
      category: "开发",
      tags: ["审查"],
      riskLevel: "all",
      publishedWithin: "all",
      updatedWithin: "all",
      sort: "download_count"
    },
    skills: [
      baseSkill,
      {
        ...baseSkill,
        skillID: "doc-helper",
        displayName: "Doc Helper",
        category: "文档",
        tags: ["文档"],
        downloadCount: 10,
        description: "文档辅助"
      }
    ]
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.skillID, "review-helper");
});

test("market skill derivation excludes locally managed imports from community results", () => {
  const result = deriveMarketSkills({
    authState: "authenticated",
    bootstrap: {
      user: {
        username: "lin",
        phoneNumber: "13800001001",
        role: "admin",
        adminLevel: 4,
        departmentID: "d1",
        departmentName: "平台工程部",
        locale: "zh-CN"
      },
      connection: {
        status: "connected",
        serverTime: "2026-04-18T10:00:00.000Z",
        apiVersion: "1.0.0"
      },
      features: {
        p1Desktop: true,
        publishSkill: true,
        reviewWorkbench: true,
        adminManage: true,
        mcpManage: false,
        pluginManage: false
      },
      counts: {
        installedCount: 1,
        enabledCount: 0,
        updateAvailableCount: 0,
        unreadNotificationCount: 0
      },
      navigation: ["home", "market"],
      menuPermissions: ["home", "market"]
    },
    filters: {
      query: "",
      department: "all",
      compatibleTool: "all",
      installed: "all",
      enabled: "all",
      accessScope: "include_public",
      category: "all",
      tags: [],
      riskLevel: "all",
      publishedWithin: "all",
      updatedWithin: "all",
      sort: "composite"
    },
    skills: [
      baseSkill,
      {
        ...baseSkill,
        skillID: "local-helper",
        displayName: "Local Helper",
        localVersion: "0.0.0-local",
        localSourceType: "local_import",
        authorName: "本地托管",
        authorDepartment: "Central Store"
      }
    ]
  });

  assert.deepEqual(result.map((skill) => skill.skillID), ["review-helper"]);
});

test("community leaderboards expose hot fallback plus independent download and star rankings", () => {
  const skills: SkillSummary[] = [
    { ...baseSkill, skillID: "download-first", displayName: "下载最高", starCount: 10, downloadCount: 900 },
    { ...baseSkill, skillID: "star-first", displayName: "Star 最高", starCount: 300, downloadCount: 20 },
    { ...baseSkill, skillID: "balanced", displayName: "均衡增长", starCount: 90, downloadCount: 500 }
  ];

  const leaderboards = deriveCommunityLeaderboards(skills, 2);

  assert.deepEqual(leaderboards.hot, []);
  assert.deepEqual(leaderboards.downloads.map((skill) => skill.skillID), ["download-first", "balanced"]);
  assert.deepEqual(leaderboards.stars.map((skill) => skill.skillID), ["star-first", "balanced"]);
  assert.equal(leaderboards.downloads[0]?.recentDownloadCount, 0);
  assert.equal(leaderboards.downloads[0]?.hotScore, 0);
  assert.equal(
    deriveCommunityLeaderboards(Array.from({ length: 11 }, (_, index) => ({ ...baseSkill, skillID: `skill-${index}`, displayName: `Skill ${index}`, starCount: index }))).stars.length,
    10
  );
});

test("community leaderboard UI defaults to hot tab without carousel timer", () => {
  const sourcePath = fileURLToPath(new URL("../src/ui/desktopSections.tsx", import.meta.url));
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /useState<CommunityLeaderboardKind>\("hot"\)/);
  assert.match(source, /label: "热榜"/);
  assert.doesNotMatch(source, /setInterval\(\(\) => \{\s*setActiveLeaderboard/s);
  assert.doesNotMatch(source, /leaderboardPaused/);
  assert.doesNotMatch(source, /leaderboard-carousel-track/);
});

test("target draft submit label switches to disable when all targets are unchecked", () => {
  assert.equal(targetDraftSubmitLabel([{ selected: true }, { selected: false }]), "应用目标");
  assert.equal(targetDraftSubmitLabel([{ selected: false }, { selected: false }]), "停用Skill");
  assert.equal(targetDraftSubmitLabel([]), "应用目标");
});

test("modal backdrop dismiss uses pointer start target instead of click release target", () => {
  const backdrop = new EventTarget();
  const panel = new EventTarget();
  const overlaysSource = readFileSync(fileURLToPath(new URL("../src/ui/desktopOverlays.tsx", import.meta.url)), "utf8");
  const sectionsSource = readFileSync(fileURLToPath(new URL("../src/ui/desktopSections.tsx", import.meta.url)), "utf8");

  assert.equal(shouldCloseFromBackdropPointerDown({ target: backdrop, currentTarget: backdrop }), true);
  assert.equal(shouldCloseFromBackdropPointerDown({ target: panel, currentTarget: backdrop }), false);
  assert.doesNotMatch(overlaysSource, /<div className="overlay-backdrop" role="presentation" onClick=\{onClose\}>/);
  assert.doesNotMatch(sectionsSource, /<div className="overlay-backdrop" role="presentation" onClick=\{onClose\}>/);
});

test("installed skill issues cover local hash drift and unavailable targets", () => {
  const skill: SkillSummary = {
    ...baseSkill,
    skillID: "context-router",
    displayName: "上下文路由助手",
    version: "1.4.0",
    localVersion: "1.2.0",
    latestVersion: "1.4.0",
    canUpdate: true,
    installState: "update_available",
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
          canImport: false,
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

test("platform path helpers emit expected defaults", () => {
  assert.equal(defaultToolConfigPath("cursor", "macos"), "~/.cursor/cli-config.json");
  assert.equal(defaultProjectSkillsPath("/Users/demo/EnterpriseAgentHub", "macos"), "/Users/demo/EnterpriseAgentHub/.codex/skills");
});

test("local command args use Tauri camelCase IDs", () => {
  assert.deepEqual(
    buildEnableSkillArgs({
      skill: { skillID: "ops-oncall-companion", localVersion: "1.2.0", version: "1.2.0" },
      targetType: "tool",
      targetID: "codex",
      requestedMode: "symlink"
    }),
    {
      skillId: "ops-oncall-companion",
      version: "1.2.0",
      targetType: "tool",
      targetId: "codex",
      preferredMode: "symlink",
      allowOverwrite: false
    }
  );
  assert.deepEqual(buildDisableSkillArgs({ skillID: "ops-oncall-companion", targetType: "project", targetID: "repo" }), {
    skillId: "ops-oncall-companion",
    targetType: "project",
    targetId: "repo"
  });
  assert.deepEqual(buildUninstallSkillArgs("ops-oncall-companion"), { skillId: "ops-oncall-companion" });
  assert.deepEqual(buildMarkOfflineEventsSyncedArgs(["evt-1", "evt-2"]), {
    eventIds: ["evt-1", "evt-2"],
    eventIDs: ["evt-1", "evt-2"]
  });
  assert.deepEqual(buildMarkLocalNotificationsReadArgs(["notice-1"]), {
    notificationIds: ["notice-1"],
    notificationIDs: ["notice-1"],
    all: false
  });
  assert.deepEqual(buildMarkLocalNotificationsReadArgs("all"), {
    notificationIds: [],
    notificationIDs: [],
    all: true
  });
});

test("uninstall result normalizer accepts Rust and legacy ID spellings", () => {
  const event = {
    eventID: "event-1",
    eventType: "uninstall_result",
    skillID: "ops-oncall-companion",
    version: "1.0.0",
    targetType: "tool",
    targetID: "codex",
    targetPath: "/tmp/codex",
    requestedMode: "copy",
    resolvedMode: "copy",
    occurredAt: "2026-04-19T00:00:00Z",
    result: "success"
  } as const;

  assert.deepEqual(normalizeUninstallSkillResult({ removedTargetIds: ["codex"], failedTargetIds: [], event }), {
    removedTargetIDs: ["codex"],
    failedTargetIDs: [],
    event
  });
});

test("discovered local skills include unmanaged tool and project skills", () => {
  const discovered = deriveDiscoveredLocalSkills({
    installedSkills: [{ ...baseSkill, skillID: "managed-skill" }],
    marketSkills: [{ ...baseSkill, skillID: "tool-helper", displayName: "Tool Helper", localVersion: null }],
    scanTargets: [
      {
        id: "tool:codex",
        targetType: "tool",
        targetID: "codex",
        targetName: "Codex",
        targetPath: "/Users/demo/.codex/skills",
        transformStrategy: "codex_skill",
        scannedAt: "2026-04-19T00:00:00Z",
        counts: { managed: 1, unmanaged: 1, conflict: 0, orphan: 0 },
        findings: [
          {
            id: "tool:codex:tool-helper",
            kind: "unmanaged",
            skillID: null,
            targetType: "tool",
            targetID: "codex",
            targetName: "Codex",
            targetPath: "/Users/demo/.codex/skills/tool-helper",
            relativePath: "tool-helper",
            checksum: "sha256:tool",
            canImport: true,
            importDisplayName: "Tool Helper",
            importDescription: "Tool helper local skill",
            importVersion: "1.0.0",
            message: "发现未托管目录，启用时不会在未确认前覆盖。"
          },
          {
            id: "tool:codex:managed-skill",
            kind: "managed",
            skillID: "managed-skill",
            targetType: "tool",
            targetID: "codex",
            targetName: "Codex",
            targetPath: "/Users/demo/.codex/skills/managed-skill",
            relativePath: "managed-skill",
            checksum: "sha256:managed",
            canImport: false,
            message: "目标内容与本地登记一致，处于托管状态。"
          },
          {
            id: "tool:codex:no-skill-md",
            kind: "unmanaged",
            skillID: "no-skill-md",
            targetType: "tool",
            targetID: "codex",
            targetName: "Codex",
            targetPath: "/Users/demo/.codex/skills/no-skill-md",
            relativePath: "no-skill-md",
            checksum: "sha256:no-skill",
            canImport: false,
            message: "发现未托管目录，但根目录缺少 SKILL.md，仅记录在扫描结果中。"
          }
        ],
        lastError: null
      },
      {
        id: "project:repo",
        targetType: "project",
        targetID: "repo",
        targetName: "Repo",
        targetPath: "/repo/.codex/skills",
        transformStrategy: "codex_skill",
        scannedAt: "2026-04-19T00:00:00Z",
        counts: { managed: 0, unmanaged: 1, conflict: 0, orphan: 0 },
        findings: [
          {
            id: "project:repo:project-helper",
            kind: "unmanaged",
            skillID: null,
            targetType: "project",
            targetID: "repo",
            targetName: "Repo",
            targetPath: "/repo/.codex/skills/project-helper",
            relativePath: "project-helper",
            checksum: "sha256:project",
            canImport: true,
            importDisplayName: "Project Helper",
            importDescription: "Project helper local skill",
            importVersion: "1.0.0",
            message: "发现未托管目录，启用时不会在未确认前覆盖。"
          }
        ],
        lastError: null
      }
    ]
  });

  assert.deepEqual(discovered.map((skill) => skill.skillID), ["project-helper", "tool-helper"]);
  assert.equal(discovered.find((skill) => skill.skillID === "tool-helper")?.matchedMarketSkill, true);
  assert.equal(discovered.some((skill) => skill.skillID === "no-skill-md"), false);
  assert.equal(discovered.find((skill) => skill.skillID === "tool-helper")?.version, "1.0.0");
});

test("discovered local skills keep conflict and orphan entries that still expose skill metadata", () => {
  const discovered = deriveDiscoveredLocalSkills({
    installedSkills: [],
    marketSkills: [],
    scanTargets: [
      {
        id: "tool:codex",
        targetType: "tool",
        targetID: "codex",
        targetName: "Codex",
        targetPath: "C:\\Users\\demo\\.codex\\skills",
        transformStrategy: "codex_skill",
        scannedAt: "2026-04-19T00:00:00Z",
        counts: { managed: 0, unmanaged: 0, conflict: 1, orphan: 1 },
        findings: [
          {
            id: "tool:codex:conflicted-skill",
            kind: "conflict",
            skillID: "conflicted-skill",
            targetType: "tool",
            targetID: "codex",
            targetName: "Codex",
            targetPath: "C:\\Users\\demo\\.codex\\skills\\conflicted-skill",
            relativePath: "conflicted-skill",
            checksum: "sha256:conflict",
            canImport: false,
            importDisplayName: "Conflicted Skill",
            importDescription: "Existing target content drifted from the managed copy.",
            importVersion: "1.2.0",
            message: "检测到冲突副本。"
          },
          {
            id: "tool:codex:orphaned-skill",
            kind: "orphan",
            skillID: "orphaned-skill",
            targetType: "tool",
            targetID: "codex",
            targetName: "Codex",
            targetPath: "C:\\Users\\demo\\.codex\\skills\\orphaned-skill",
            relativePath: "orphaned-skill",
            checksum: "sha256:orphan",
            canImport: false,
            importDisplayName: "Orphaned Skill",
            importDescription: "Managed marker exists but the enable record is missing.",
            importVersion: "0.0.0-local",
            message: "检测到孤儿副本。"
          }
        ],
        lastError: null
      }
    ]
  });

  assert.deepEqual(discovered.map((skill) => skill.skillID), ["conflicted-skill", "orphaned-skill"]);
  assert.equal(discovered.every((skill) => skill.canImport === false), true);
  assert.equal(discovered.find((skill) => skill.skillID === "conflicted-skill")?.targets[0]?.findingKind, "conflict");
  assert.equal(discovered.find((skill) => skill.skillID === "orphaned-skill")?.targets[0]?.findingKind, "orphan");
});

test("local skills can be filtered by tool and project targets", () => {
  const installedSkill: SkillSummary = {
    ...baseSkill,
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
    ]
  };
  const discoveredSkill = deriveDiscoveredLocalSkills({
    installedSkills: [],
    marketSkills: [],
    scanTargets: [
      {
        id: "project:repo",
        targetType: "project",
        targetID: "repo",
        targetName: "Repo",
        targetPath: "/repo/.codex/skills",
        transformStrategy: "codex_skill",
        scannedAt: "2026-04-19T00:00:00Z",
        counts: { managed: 0, unmanaged: 1, conflict: 0, orphan: 0 },
        findings: [
          {
            id: "project:repo:project-helper",
            kind: "unmanaged",
            skillID: null,
            targetType: "project",
            targetID: "repo",
            targetName: "Repo",
            targetPath: "/repo/.codex/skills/project-helper",
            relativePath: "project-helper",
            checksum: "sha256:project",
            canImport: true,
            importDisplayName: "Project Helper",
            importDescription: "Project helper local skill",
            importVersion: "1.0.0",
            message: "发现未托管目录。"
          }
        ],
        lastError: null
      }
    ]
  })[0];
  assert.ok(discoveredSkill);

  assert.equal(matchesInstalledTargetFilter(installedSkill, "tool", "codex"), true);
  assert.equal(matchesInstalledTargetFilter(installedSkill, "project", "repo"), false);
  assert.equal(matchesDiscoveredTargetFilter(discoveredSkill, "project", "repo"), true);
  assert.equal(matchesDiscoveredTargetFilter(discoveredSkill, "tool", "codex"), false);
});

test("scan summary message reports target and issue counts", () => {
  assert.equal(
    scanTargetsSummaryMessage([
      {
        id: "tool:codex",
        targetType: "tool",
        targetID: "codex",
        targetName: "Codex",
        targetPath: "/Users/demo/.codex/skills",
        transformStrategy: "codex_skill",
        scannedAt: "2026-04-19T00:00:00Z",
        counts: { managed: 1, unmanaged: 2, conflict: 1, orphan: 0 },
        findings: [],
        lastError: "permission denied"
      }
    ]),
    "扫描完成：已扫描 1 个目标，发现 4 个需关注项。"
  );
});

test("mergeLocalInstalls appends local-only imports in authenticated market state", () => {
  const merged = mergeLocalInstalls([{ ...baseSkill, skillID: "remote-skill" }], {
    installs: [
      {
        skillID: "local-helper",
        displayName: "Local Helper",
        localVersion: "0.0.0-local",
        localHash: "sha256:local",
        sourcePackageHash: "sha256:local",
        sourceType: "local_import",
        installedAt: "2026-04-19T00:00:00Z",
        updatedAt: "2026-04-19T00:00:00Z",
        localStatus: "enabled",
        centralStorePath: "/tmp/central-store/skills/local-helper/0.0.0-local",
        enabledTargets: [],
        hasUpdate: false,
        isScopeRestricted: false,
        canUpdate: false
      }
    ],
    tools: [],
    projects: [],
    notifications: [],
    offlineEvents: [],
    pendingOfflineEventCount: 0,
    unreadLocalNotificationCount: 0,
    centralStorePath: "/tmp/central-store"
  } satisfies LocalBootstrap);

  assert.deepEqual(merged.map((skill) => skill.skillID), ["remote-skill", "local-helper"]);
  assert.equal(merged.find((skill) => skill.skillID === "local-helper")?.canUpdate, false);
  assert.equal(merged.find((skill) => skill.skillID === "local-helper")?.authorName, "本地托管");
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
      category: "开发",
      tags: ["代码", "审查"],
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
  assert.equal(params.get("category"), "开发");
  assert.equal(params.get("tags"), "代码,审查");
  assert.equal(params.get("riskLevel"), "low");
  assert.equal(params.get("sort"), "download_count");
  assert.equal(params.get("installed"), null);
  assert.equal(params.get("enabled"), null);
});
