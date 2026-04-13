import type { DiscoveredLocalSkill, ScanTargetSummary, SkillSummary } from "../domain/p1.ts";

const IGNORED_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico"];

function humanizeSkillID(skillID: string): string {
  return skillID
    .split(/[-_]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function inferSkillID(summary: ScanTargetSummary, finding: ScanTargetSummary["findings"][number]): string | null {
  const raw = (finding.skillID ?? finding.relativePath.split(/[\\/]/).pop() ?? "").trim();
  if (!raw || raw.startsWith(".")) return null;

  if (!finding.skillID) {
    const normalized = raw.toLocaleLowerCase();
    if (IGNORED_EXTENSIONS.some((extension) => normalized.endsWith(extension))) {
      return null;
    }
    if (summary.targetType === "tool" && summary.targetID === "windsurf" && normalized === "global_rules") {
      return null;
    }
  }

  return raw;
}

function sourceLabel(targets: DiscoveredLocalSkill["targets"]): string {
  if (targets.some((target) => target.findingKind === "conflict")) return "目录内容与登记不一致";
  if (targets.some((target) => target.findingKind === "orphan")) return "目录有托管痕迹但登记缺失";
  return "从本地目录扫描发现";
}

function defaultDescription(marketSkill: SkillSummary | undefined, targets: DiscoveredLocalSkill["targets"]) {
  if (targets.some((target) => target.findingKind === "conflict")) {
    return "目录内容与登记产物不一致，建议先确认来源和覆盖策略。";
  }
  if (targets.some((target) => target.findingKind === "orphan")) {
    return "目录存在托管痕迹但本地登记缺失，建议尽快修复来源。";
  }
  if (marketSkill) {
    return "市场里已有同名 skill，可查看详情后决定是否纳入 Central Store 管理。";
  }
  return "从本地工具或项目目录扫描发现未托管副本，当前还不在 Central Store 管理范围内。";
}

export function deriveDiscoveredLocalSkills(input: {
  installedSkills: SkillSummary[];
  marketSkills: SkillSummary[];
  scanTargets: ScanTargetSummary[];
}): DiscoveredLocalSkill[] {
  const installedSkillIDs = new Set(input.installedSkills.map((skill) => skill.skillID.toLocaleLowerCase()));
  const marketSkillsByID = new Map(input.marketSkills.map((skill) => [skill.skillID.toLocaleLowerCase(), skill]));
  const discoveredByID = new Map<string, DiscoveredLocalSkill>();

  for (const summary of input.scanTargets) {
    for (const finding of summary.findings) {
      if (finding.kind === "managed") continue;
      const skillID = inferSkillID(summary, finding);
      if (!skillID) continue;

      const normalizedSkillID = skillID.toLocaleLowerCase();
      if (installedSkillIDs.has(normalizedSkillID)) continue;

      const marketSkill = marketSkillsByID.get(normalizedSkillID);
      const current = discoveredByID.get(normalizedSkillID) ?? {
        skillID,
        displayName: marketSkill?.displayName ?? humanizeSkillID(skillID),
        description: "",
        sourceLabel: "",
        matchedMarketSkill: Boolean(marketSkill),
        targets: []
      };

      current.targets.push({
        targetType: finding.targetType,
        targetID: finding.targetID,
        targetName: finding.targetName,
        targetPath: finding.targetPath,
        relativePath: finding.relativePath,
        findingKind: finding.kind as DiscoveredLocalSkill["targets"][number]["findingKind"],
        message: finding.message
      });
      current.sourceLabel = sourceLabel(current.targets);
      current.description = defaultDescription(marketSkill, current.targets);
      discoveredByID.set(normalizedSkillID, current);
    }
  }

  return [...discoveredByID.values()]
    .map((skill) => ({
      ...skill,
      targets: [...skill.targets].sort((left, right) => left.targetName.localeCompare(right.targetName) || left.relativePath.localeCompare(right.relativePath))
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}
