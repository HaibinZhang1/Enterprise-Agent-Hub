import type { PageID } from "../../domain/p1.ts";

export type TopLevelSection = "home" | "community" | "local" | "manage";
export type CommunityPane = "home" | "skills" | "mcp" | "plugins" | "publish" | "mine";
export type LocalPane = "skills" | "extensions" | "tools" | "projects";
export type ManagePane = "reviews" | "skills" | "departments" | "users" | "client_updates";
export type PublisherPane = "compose" | "mine";

export const DEFAULT_COMMUNITY_PANE: CommunityPane = "home";

export type OverlayState =
  | { kind: "none" }
  | { kind: "skill_detail"; skillID: string; source: TopLevelSection }
  | { kind: "review_detail"; reviewID: string }
  | { kind: "publisher"; pane: PublisherPane };

export function deriveTopLevelNavigation(input: {
  isAdminConnected: boolean;
}): TopLevelSection[] {
  return input.isAdminConnected ? ["community", "home", "local", "manage"] : ["community", "home", "local"];
}

export function shouldPromptLoginForSectionNavigation(input: {
  section: TopLevelSection;
  loggedIn: boolean;
}): boolean {
  return input.section === "community" && !input.loggedIn;
}

export function canAccessClientUpdateManagement(input: { adminLevel?: number | null }): boolean {
  return input.adminLevel === 1;
}

export function mapLegacyPageToView(page: PageID): {
  section: TopLevelSection;
  communityPane?: CommunityPane;
  localPane?: LocalPane;
  managePane?: ManagePane;
} {
  switch (page) {
    case "market":
      return { section: "community", communityPane: "skills" };
    case "my_installed":
      return { section: "local", localPane: "skills" };
    case "target_management":
      return { section: "local", localPane: "tools" };
    case "review":
      return { section: "manage", managePane: "reviews" };
    case "admin_departments":
      return { section: "manage", managePane: "departments" };
    case "admin_users":
      return { section: "manage", managePane: "users" };
    case "admin_skills":
      return { section: "manage", managePane: "skills" };
    case "publisher":
      return { section: "community", communityPane: "mine" };
    case "notifications":
    case "home":
    case "detail":
    default:
      return { section: "home" };
  }
}

export function legacyPageForView(input: {
  section: TopLevelSection;
  communityPane: CommunityPane;
  localPane: LocalPane;
  managePane: ManagePane;
  overlay: OverlayState;
}): Exclude<PageID, "detail" | "notifications"> {
  if (input.overlay.kind === "publisher") return "publisher";
  if (input.overlay.kind === "review_detail") return "review";

  switch (input.section) {
    case "community":
      return input.communityPane === "publish" || input.communityPane === "mine" ? "publisher" : "market";
    case "local":
      return input.localPane === "skills" || input.localPane === "extensions" ? "my_installed" : "target_management";
    case "manage":
      switch (input.managePane) {
        case "reviews":
          return "review";
        case "skills":
          return "admin_skills";
        case "departments":
          return "admin_departments";
        case "users":
          return "admin_users";
        case "client_updates":
          return "admin_users";
      }
    case "home":
    default:
      return "home";
  }
}

export function skillDetailOverlay(skillID: string, source: TopLevelSection): OverlayState {
  return { kind: "skill_detail", skillID, source };
}

export function reviewDetailOverlay(reviewID: string): OverlayState {
  return { kind: "review_detail", reviewID };
}

export function isDetailOverlay(overlay: OverlayState): boolean {
  return overlay.kind === "skill_detail" || overlay.kind === "review_detail";
}
