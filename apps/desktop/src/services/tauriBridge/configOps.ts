import type { ProjectConfig, ProjectDirectorySelection, ToolConfig } from "../../domain/p1.ts";
import { P1_LOCAL_COMMANDS } from "@enterprise-agent-hub/shared-contracts";
import { seedTools } from "../../fixtures/p1SeedData.ts";
import { defaultProjectSkillsPath, defaultToolConfigPath, defaultToolSkillsCandidates, detectDesktopPlatform } from "../../utils/platformPaths.ts";
import { pendingLocalCommand } from "./common.ts";
import { mapPreviewTool } from "./preview.ts";
import { allowTauriMocks, getInvoke, isBrowserPreviewMode, mockWait, requireInvoke } from "./runtime.ts";

export async function saveToolConfig(tool: { toolID: string; name?: string; configPath: string; skillsPath: string; enabled?: boolean }): Promise<ToolConfig> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.saveToolConfig, { tool });
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("save_tool_config");
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(180);
  const base = seedTools.find((item) => item.toolID === tool.toolID);
  const platform = detectDesktopPlatform();
  const baseTool = base ? mapPreviewTool(base, platform) : null;
  return {
    toolID: tool.toolID,
    name: tool.name ?? base?.name ?? tool.toolID,
    displayName: tool.name ?? base?.displayName ?? tool.toolID,
    configPath: tool.configPath || baseTool?.configPath || defaultToolConfigPath(tool.toolID, platform),
    detectedPath: baseTool?.detectedPath ?? defaultToolSkillsCandidates(tool.toolID, platform)[0] ?? null,
    configuredPath: tool.configPath || null,
    skillsPath: tool.skillsPath,
    enabled: tool.enabled ?? true,
    status: "manual",
    adapterStatus: "manual",
    detectionMethod: "manual",
    transform: baseTool?.transform ?? "generic_directory",
    transformStrategy: baseTool?.transformStrategy ?? "generic_directory",
    enabledSkillCount: 0,
    lastScannedAt: null
  };
}

export async function deleteToolConfig(toolID: string): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    await invoke(P1_LOCAL_COMMANDS.deleteToolConfig, { toolID });
    return;
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("delete_tool_config");
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(120);
}

export async function saveProjectConfig(project: { projectID?: string; name: string; projectPath: string; skillsPath: string; enabled?: boolean }): Promise<ProjectConfig> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.saveProjectConfig, { project });
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("save_project_config");
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(200);
  const platform = detectDesktopPlatform();
  return {
    projectID: project.projectID ?? project.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: project.name,
    displayName: project.name,
    projectPath: project.projectPath,
    skillsPath: project.skillsPath || defaultProjectSkillsPath(project.projectPath, platform),
    enabled: project.enabled ?? true,
    enabledSkillCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function deleteProjectConfig(projectID: string): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    await invoke(P1_LOCAL_COMMANDS.deleteProjectConfig, { projectID });
    return;
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("delete_project_config");
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(120);
}

export async function pickProjectDirectory(): Promise<ProjectDirectorySelection | null> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.pickProjectDirectory);
  }
  if (isBrowserPreviewMode()) {
    return null;
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(120);
  return {
    projectPath: detectDesktopPlatform() === "windows" ? "D:\\workspace\\selected-project" : "~/workspace/selected-project"
  };
}
