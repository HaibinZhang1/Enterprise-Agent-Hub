import type { ScanTargetSummary } from "../../domain/p1.ts";

export function scanTargetsSummaryMessage(summaries: ScanTargetSummary[]): string {
  const abnormalCount = summaries.reduce((total, summary) => total + summary.counts.unmanaged + summary.counts.conflict + summary.counts.orphan + (summary.lastError ? 1 : 0), 0);
  return `扫描完成：已扫描 ${summaries.length} 个目标，发现 ${abnormalCount} 个需关注项。`;
}

export function scanTargetsErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? `扫描失败：${error.message}` : "扫描失败：请稍后重试。";
}
