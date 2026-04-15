import type { ScanTargetSummary, ToolConfig, ValidateTargetPathResult } from "../../domain/p1.ts";
import { P1_LOCAL_COMMANDS } from "@enterprise-agent-hub/shared-contracts";
import { seedTools } from "../../fixtures/p1SeedData.ts";
import { detectDesktopPlatform } from "../../utils/platformPaths.ts";
import { mapPreviewTool, mockScanSummaries } from "./preview.ts";
import { allowTauriMocks, getInvoke, isBrowserPreviewMode, mockWait, requireInvoke } from "./runtime.ts";

export async function refreshToolDetection(): Promise<ToolConfig[]> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.detectTools);
  }
  if (isBrowserPreviewMode()) {
    return [];
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(240);
  return seedTools
    .map((tool) => mapPreviewTool(tool, detectDesktopPlatform()))
    .map((tool) => (tool.toolID === "windsurf" ? { ...tool, status: "missing" } : tool));
}

export async function scanLocalTargets(): Promise<ScanTargetSummary[]> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.scanLocalTargets);
  }
  if (isBrowserPreviewMode()) {
    return [];
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(240);
  return mockScanSummaries();
}

export async function validateTargetPath(targetPath: string): Promise<ValidateTargetPathResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.validateTargetPath, { targetPath });
  }
  if (isBrowserPreviewMode()) {
    return {
      valid: false,
      writable: false,
      exists: false,
      canCreate: false,
      reason: "当前运行在浏览器预览模式；本地路径校验需要在 Tauri desktop app 中执行。"
    };
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(120);
  return {
    valid: targetPath.trim().length > 0,
    writable: targetPath.trim().length > 0,
    exists: false,
    canCreate: targetPath.trim().length > 0,
    reason: targetPath.trim().length > 0 ? null : "路径不能为空"
  };
}
