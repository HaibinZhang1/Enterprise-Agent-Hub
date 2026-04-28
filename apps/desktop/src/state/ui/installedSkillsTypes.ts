export type InstalledListFilter = "all" | "enabled" | "updates" | "scope_restricted" | "issues";
export type InstalledTargetFilterType = "all" | "tool" | "project";
export type InstalledTargetFilterValue = "all" | `${Exclude<InstalledTargetFilterType, "all">}:${string}`;
