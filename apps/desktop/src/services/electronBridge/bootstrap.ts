import type { ExtensionInstall, LocalBootstrap, LocalSkillInstall } from "../../domain/p1.ts";
import { P1_LOCAL_COMMANDS } from "@enterprise-agent-hub/shared-contracts";
import { seedProjects, seedTools } from "../../fixtures/p1SeedData.ts";
import { detectDesktopPlatform, previewCentralStorePath } from "../../utils/platformPaths.ts";
import { browserPreviewBootstrap, mapPreviewProject, mapPreviewTool, seedLocalExtensions, seedLocalInstalls } from "./preview.ts";
import { allowElectronMocks, getInvoke, isBrowserPreviewMode, mockWait, requireInvoke } from "./runtime.ts";

export async function getLocalBootstrap(): Promise<LocalBootstrap> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.getLocalBootstrap);
  }
  if (isBrowserPreviewMode()) {
    return browserPreviewBootstrap();
  }
  if (!allowElectronMocks) {
    await requireInvoke();
  }
  await mockWait();
  return {
    installs: seedLocalInstalls(),
    extensions: seedLocalExtensions(),
    tools: seedTools.map((tool) => mapPreviewTool(tool, detectDesktopPlatform())),
    projects: seedProjects.map((project) => mapPreviewProject(project, detectDesktopPlatform())),
    notifications: [],
    offlineEvents: [],
    pendingOfflineEventCount: 0,
    unreadLocalNotificationCount: 0,
    centralStorePath: previewCentralStorePath()
  };
}

export async function listLocalInstalls(): Promise<LocalSkillInstall[]> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.listLocalInstalls);
  }
  if (isBrowserPreviewMode()) {
    return [];
  }
  if (!allowElectronMocks) {
    await requireInvoke();
  }
  await mockWait();
  return seedLocalInstalls();
}

export async function listLocalExtensions(): Promise<ExtensionInstall[]> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.listLocalExtensions);
  }
  if (isBrowserPreviewMode()) {
    return [];
  }
  if (!allowElectronMocks) {
    await requireInvoke();
  }
  await mockWait();
  return seedLocalExtensions();
}
