import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiErrorCode,
  InstallMode,
  LOCAL_COMMAND_NAMES,
  NotificationType,
  P1_API_ROUTES,
  SkillStatus
} from "../dist/index.js";

test("P1 enums preserve documented lower_snake_case values", () => {
  assert.equal(SkillStatus.Published, "published");
  assert.equal(NotificationType.EnableResult, "enable_result");
  assert.equal(ApiErrorCode.PermissionDenied, "permission_denied");
  assert.equal(ApiErrorCode.ResourceNotFound, "resource_not_found");
});

test("enable/install mode supports symlink-first and copy fallback", () => {
  assert.deepEqual(Object.values(InstallMode).sort(), ["copy", "symlink"]);
});

test("cut-slice route and Tauri command names are centralized", () => {
  assert.equal(P1_API_ROUTES.desktopBootstrap, "/desktop/bootstrap");
  assert.equal(P1_API_ROUTES.skillDownloadTicket, "/skills/:skillID/download-ticket");
  assert.equal(P1_API_ROUTES.adminDepartments, "/admin/departments");
  assert.equal(P1_API_ROUTES.adminReviews, "/admin/reviews");
  assert.ok(LOCAL_COMMAND_NAMES.includes("install_skill_package"));
  assert.ok(LOCAL_COMMAND_NAMES.includes("enable_skill"));
  assert.ok(LOCAL_COMMAND_NAMES.includes("flush_offline_events"));
});
