import type { AuthState, PageID } from "../../domain/p1.ts";

export const adminPages: PageID[] = ["review", "admin_departments", "admin_users", "admin_skills"];

export type WorkspacePageNavigationResolution =
  | { action: "set_page"; page: PageID }
  | { action: "require_auth"; page: PageID };

export function resolveWorkspacePageNavigation(input: {
  readonly page: PageID;
  readonly authState: AuthState;
  readonly visibleNavigation: readonly PageID[];
}): WorkspacePageNavigationResolution {
  if (input.page === "notifications") {
    return { action: "set_page", page: "home" };
  }

  if (input.page === "market" && input.authState !== "authenticated") {
    return { action: "require_auth", page: input.page };
  }

  if (adminPages.includes(input.page)) {
    if (input.authState !== "authenticated") {
      return { action: "require_auth", page: input.page };
    }
    if (!input.visibleNavigation.includes(input.page)) {
      return { action: "set_page", page: "home" };
    }
  }

  return { action: "set_page", page: input.page };
}
