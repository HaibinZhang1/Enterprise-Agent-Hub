import assert from "node:assert/strict";
import test from "node:test";
import { PendingBackendError, type ProjectConfig, type PublishDraft, type ScanTargetSummary, type SkillSummary, type ToolConfig } from "../src/domain/p1.ts";
import { prototypeActionClient } from "../src/services/prototypeActionClient.ts";
import { buildPublishPrecheck, collectInstalledSkillIssues } from "../src/state/useDesktopUIState.ts";

const baseDraft: PublishDraft = {
  uploadMode: "folder",
  packageName: "prompt-guardrails",
  skillID: "prompt-guardrails",
  displayName: "提示词护栏模板",
  version: "1.0.0",
  scope: "current_department",
  visibility: "detail_visible",
  changelog: "首次发布",
  files: [
    { name: "SKILL.md", size: 1_200, mimeType: "text/markdown" },
    { name: "README.md", size: 820, mimeType: "text/markdown" }
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
      { name: "SKILL.md", size: 6 * 1024 * 1024, mimeType: "text/markdown" }
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
