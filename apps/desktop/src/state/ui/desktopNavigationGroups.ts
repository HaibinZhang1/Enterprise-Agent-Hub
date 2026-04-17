import type { NavigationPageID } from "../../domain/p1.ts";

export type ShellNavigationPageID = Exclude<NavigationPageID, "notifications">;
export type UserNavigationPageID = "home" | "market" | "my_installed" | "publisher" | "target_management";
export type AdminNavigationPageID = "review" | "admin_departments" | "admin_users" | "admin_skills";

export interface NavigationGroup {
  id: "user" | "admin";
  pages: ShellNavigationPageID[];
}

const userNavigationPages: UserNavigationPageID[] = ["home", "market", "my_installed", "publisher", "target_management"];
const adminNavigationPages: AdminNavigationPageID[] = ["review", "admin_departments", "admin_users", "admin_skills"];

export function buildNavigationGroups(visibleNavigation: readonly ShellNavigationPageID[]): NavigationGroup[] {
  const userPages = userNavigationPages.filter((page) => visibleNavigation.includes(page));
  const adminPages = adminNavigationPages.filter((page) => visibleNavigation.includes(page));
  return [
    { id: "user", pages: userPages },
    { id: "admin", pages: adminPages },
  ];
}

export function isAdminNavigationPage(page: ShellNavigationPageID): page is AdminNavigationPageID {
  return adminNavigationPages.includes(page as AdminNavigationPageID);
}
