import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiErrorCode,
  InstallMode,
  LOCAL_COMMAND_NAMES,
  P1_LOCAL_COMMANDS,
  NotificationType,
  P1_API_ROUTES,
  SKILL_CATEGORIES,
  SKILL_TAGS,
  SkillStatus
} from "../dist/index.js";

test("P1 enums preserve documented lower_snake_case values", () => {
  assert.equal(SkillStatus.Published, "published");
  assert.equal(NotificationType.EnableResult, "enable_result");
  assert.equal(NotificationType.ClientUpdate, "client_update");
  assert.equal(ApiErrorCode.PermissionDenied, "permission_denied");
  assert.equal(ApiErrorCode.ResourceNotFound, "resource_not_found");
});

test("enable/install mode supports symlink-first and copy fallback", () => {
  assert.deepEqual(Object.values(InstallMode).sort(), ["copy", "symlink"]);
});

test("cut-slice route and Tauri command names are centralized", () => {
  assert.equal(P1_API_ROUTES.desktopBootstrap, "/desktop/bootstrap");
  assert.equal(P1_API_ROUTES.clientUpdatesCheck, "/client-updates/check");
  assert.equal(P1_API_ROUTES.clientUpdateDownloadTicket, "/client-updates/releases/:releaseID/download-ticket");
  assert.equal(P1_API_ROUTES.skillDownloadTicket, "/skills/:skillID/download-ticket");
  assert.equal(P1_API_ROUTES.adminClientUpdateReleases, "/admin/client-updates/releases");
  assert.equal(P1_API_ROUTES.adminClientUpdatePublish, "/admin/client-updates/releases/:releaseID/publish");
  assert.equal(P1_API_ROUTES.adminDepartments, "/admin/departments");
  assert.equal(P1_API_ROUTES.adminReviews, "/admin/reviews");
  assert.equal(P1_API_ROUTES.publisherSkills, "/publisher/skills");
  assert.equal(P1_LOCAL_COMMANDS.detectTools, "detect_tools");
  assert.ok(LOCAL_COMMAND_NAMES.includes("install_skill_package"));
  assert.ok(LOCAL_COMMAND_NAMES.includes("enable_skill"));
  assert.ok(LOCAL_COMMAND_NAMES.includes("mark_offline_events_synced"));
});

test("skill taxonomy constants stay short and Chinese", () => {
  assert.deepEqual(SKILL_CATEGORIES.slice(0, 3), ["开发", "测试", "文档"]);
  assert.ok(SKILL_CATEGORIES.includes("其他"));
  assert.ok(SKILL_TAGS.includes("代码"));
  assert.ok(SKILL_TAGS.includes("培训"));
  assert.ok(SKILL_TAGS.every((tag) => tag.length <= 3));
});
