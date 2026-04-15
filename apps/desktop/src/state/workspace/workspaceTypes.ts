import type {
  AuthState,
  BootstrapContext,
  LocalBootstrap,
  LocalNotification,
  MarketFilters,
  PageID,
  ScanTargetSummary
} from "../../domain/p1";

export const defaultFilters: MarketFilters = {
  query: "",
  department: "all",
  compatibleTool: "all",
  installed: "all",
  enabled: "all",
  accessScope: "include_public",
  category: "all",
  riskLevel: "all",
  publishedWithin: "all",
  updatedWithin: "all",
  sort: "composite"
};

export const guestNavigation: PageID[] = ["home", "market", "my_installed", "publisher", "tools", "projects", "notifications", "settings"];
export const emptyLocalNotifications: LocalNotification[] = [];

export type HandleRemoteError = (error: unknown, options?: { reopenLogin?: boolean }) => Promise<boolean>;
export type RequireAuthenticatedAction = (page: PageID | null, action: () => Promise<void> | void) => boolean;

export type WorkspaceConnectionInputs = {
  authState: AuthState;
  bootstrap: BootstrapContext;
};

export type LocalRefreshActions = {
  refreshLocalBootstrap: () => Promise<LocalBootstrap>;
  refreshLocalScans: () => Promise<ScanTargetSummary[]>;
};
