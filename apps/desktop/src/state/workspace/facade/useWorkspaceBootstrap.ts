import type { LocalBootstrap, PageID, SkillSummary } from "../../../domain/p1";
import { p1Client } from "../../../services/p1Client";
import { desktopBridge } from "../../../services/desktopBridge";
import {
  buildGuestBootstrap,
  localSummaryFromInstall,
  mergeLocalInstalls,
  mergeNotifications
} from "../../p1WorkspaceHelpers";

export async function moveWorkspaceToGuest(input: {
  message?: string;
  localBootstrapRef: { current: LocalBootstrap | null };
  refreshLocalBootstrap: () => Promise<LocalBootstrap>;
  setAuthState: (state: "guest") => void;
  setBootstrap: (value: ReturnType<typeof buildGuestBootstrap>) => void;
  setLeaderboards?: (value: null) => void;
  setLeaderboardsLoading?: (value: false) => void;
  setSkills: (skills: SkillSummary[] | ((current: SkillSummary[]) => SkillSummary[])) => void;
  setExtensions: (extensions: LocalBootstrap["extensions"]) => void;
  setOfflineEvents: (events: LocalBootstrap["offlineEvents"]) => void;
  setScanTargets: (targets: Awaited<ReturnType<typeof desktopBridge.scanLocalTargets>>) => void;
  setNotifications: (notifications: LocalBootstrap["notifications"]) => void;
  resetPublisherState: () => void;
  resetAdminReviewState: () => void;
  setSelectedSkillID: (value: string | ((current: string) => string)) => void;
  setActivePageState: (value: (current: PageID) => PageID) => void;
}) {
  const localBootstrap = input.localBootstrapRef.current ?? (await input.refreshLocalBootstrap());
  const localScanTargets = await desktopBridge.scanLocalTargets().catch(() => []);
  const localSkills = localBootstrap.installs.map(localSummaryFromInstall);
  input.setAuthState("guest");
  input.setBootstrap(buildGuestBootstrap(localBootstrap, input.message));
  input.setLeaderboards?.(null);
  input.setLeaderboardsLoading?.(false);
  input.setSkills(localSkills);
  input.setExtensions(localBootstrap.extensions ?? []);
  input.setOfflineEvents(localBootstrap.offlineEvents);
  input.setScanTargets(localScanTargets);
  input.setNotifications(localBootstrap.notifications);
  input.resetPublisherState();
  input.resetAdminReviewState();
  input.setSelectedSkillID((current) => (localSkills.some((skill) => skill.skillID === current) ? current : localSkills[0]?.skillID ?? ""));
  input.setActivePageState((current) =>
    current === "market" ||
    current === "review" ||
    current === "admin_departments" ||
    current === "admin_users" ||
    current === "admin_skills" ||
    current === "notifications"
      ? "home"
      : current
  );
}

export async function hydrateAuthenticatedWorkspace(input: {
  localBootstrap?: LocalBootstrap;
  localBootstrapRef: { current: LocalBootstrap | null };
  refreshLocalBootstrap: () => Promise<LocalBootstrap>;
  remoteMarketFilters: Record<string, unknown>;
  setAuthState: (state: "authenticated") => void;
  setBootstrap: (bootstrap: Awaited<ReturnType<typeof p1Client.bootstrap>>) => void;
  setSkills: (skills: SkillSummary[] | ((current: SkillSummary[]) => SkillSummary[])) => void;
  setTools: (tools: LocalBootstrap["tools"]) => void;
  setExtensions: (extensions: LocalBootstrap["extensions"]) => void;
  setProjects: (projects: LocalBootstrap["projects"]) => void;
  setOfflineEvents: (events: LocalBootstrap["offlineEvents"]) => void;
  setScanTargets: (targets: Awaited<ReturnType<typeof desktopBridge.scanLocalTargets>>) => void;
  setNotifications: (notifications: LocalBootstrap["notifications"]) => void;
  setSelectedSkillID: (value: string | ((current: string) => string)) => void;
}) {
  const currentLocalBootstrap = input.localBootstrap ?? input.localBootstrapRef.current ?? (await input.refreshLocalBootstrap());
  const localScanTargets = await desktopBridge.scanLocalTargets().catch(() => []);
  input.localBootstrapRef.current = currentLocalBootstrap;
  const [remoteBootstrap, remoteSkills, remoteNotifications] = await Promise.all([
    p1Client.bootstrap(),
    p1Client.listSkills(input.remoteMarketFilters as never),
    p1Client.listNotifications()
  ]);
  await desktopBridge.upsertLocalNotifications(remoteNotifications).catch(() => undefined);
  const mergedSkills = mergeLocalInstalls(remoteSkills, currentLocalBootstrap);
  const mergedNotifications = mergeNotifications(remoteNotifications, currentLocalBootstrap.notifications);
  input.setAuthState("authenticated");
  input.setBootstrap(remoteBootstrap);
  input.setSkills(mergedSkills);
  input.setTools(currentLocalBootstrap.tools);
  input.setExtensions(currentLocalBootstrap.extensions ?? []);
  input.setProjects(currentLocalBootstrap.projects);
  input.setOfflineEvents(currentLocalBootstrap.offlineEvents);
  input.setScanTargets(localScanTargets);
  input.setNotifications(mergedNotifications);
  input.setSelectedSkillID((current) => (mergedSkills.some((skill) => skill.skillID === current) ? current : mergedSkills[0]?.skillID ?? ""));
  return remoteBootstrap;
}
