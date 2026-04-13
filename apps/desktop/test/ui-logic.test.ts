import assert from "node:assert/strict";
import test from "node:test";
import { PendingBackendError, type ProjectConfig, type PublishDraft, type ScanTargetSummary, type SkillSummary, type ToolConfig } from "../src/domain/p1.ts";
import { buildSkillListQuery } from "../src/services/p1Client.ts";
import { prototypeActionClient } from "../src/services/prototypeActionClient.ts";
import { buildPublishPrecheck, collectInstalledSkillIssues } from "../src/state/useDesktopUIState.ts";
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

test("prototype backend actions reject with explicit pending backend errors", async () => {
  await assert.rejects(
    () => prototypeActionClient.submitPublishDraft(baseDraft),
    (error: unknown) => error instanceof PendingBackendError && error.code === "pending_backend" && error.action === "publish.submit"
  );

  await assert.rejects(
    () => prototypeActionClient.submitReviewDecision({ reviewID: "rv_001", decision: "approve", comment: "looks good" }),
    (error: unknown) => error instanceof PendingBackendError && error.action === "review.decision"
  );
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
