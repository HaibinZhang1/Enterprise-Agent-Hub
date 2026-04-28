import type { ScanTargetSummary, ToolConfig, ValidateTargetPathResult } from "../../domain/p1.ts";
import { P1_LOCAL_COMMANDS } from "@enterprise-agent-hub/shared-contracts";
import { seedTools } from "../../fixtures/p1SeedData.ts";
import { detectDesktopPlatform } from "../../utils/platformPaths.ts";
import { mapPreviewTool, mockScanSummaries } from "./preview.ts";
import { allowTauriMocks, getInvoke, isBrowserPreviewMode, mockWait, requireInvoke } from "./runtime.ts";

const readOnlyExtensionScanSeeds = [
  {
    extensionID: "p0-mcp-server-precheck",
    extensionType: "mcp_server",
    extensionKind: "config_backed",
    relativePath: ".mcp.json",
    message: "MCP Server 在 P0 仅审计/预检，不可纳入或写入配置。"
  },
  {
    extensionID: "p0-native-plugin-precheck",
    extensionType: "plugin",
    extensionKind: "native_plugin",
    relativePath: ".plugins",
    message: "原生 Plugin 在 P0 仅审计/预检，不可纳入或加载运行时。"
  },
  {
    extensionID: "p0-hook-precheck",
    extensionType: "hook",
    extensionKind: "config_backed",
    relativePath: ".hooks",
    message: "Hook 在 P0 仅审计/预检，不可纳入或写入配置。"
  },
  {
    extensionID: "p0-agent-cli-precheck",
    extensionType: "agent_cli",
    extensionKind: "agent_cli",
    relativePath: ".agent-cli",
    message: "Agent CLI 在 P0 仅审计/预检，不安装外部二进制。"
  }
] as const;

export function appendReadOnlyExtensionScanFindings(summary: ScanTargetSummary): ScanTargetSummary {
  return {
    ...summary,
    counts: { ...summary.counts, unmanaged: summary.counts.unmanaged + readOnlyExtensionScanSeeds.length },
    findings: [
      ...summary.findings,
      ...readOnlyExtensionScanSeeds.map((seed) => ({
        id: `${summary.targetType}:${summary.targetID}:${seed.extensionID}`,
        kind: "unmanaged" as const,
        skillID: null,
        extensionID: seed.extensionID,
        extensionType: seed.extensionType,
        extensionKind: seed.extensionKind,
        writeCapability: false,
        enterpriseStatus: "allowed" as const,
        targetType: summary.targetType,
        targetID: summary.targetID,
        targetName: summary.targetName,
        targetPath: summary.targetPath,
        relativePath: seed.relativePath,
        checksum: null,
        canImport: false,
        importDisplayName: seed.extensionID,
        importDescription: seed.message,
        importVersion: "0.0.0-policy",
        message: seed.message
      }))
    ]
  };
}

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

export async function scanExtensionTargets(): Promise<ScanTargetSummary[]> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.scanExtensionTargets);
  }
  if (isBrowserPreviewMode()) {
    return [];
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(240);
  return mockScanSummaries().map(appendReadOnlyExtensionScanFindings);
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
