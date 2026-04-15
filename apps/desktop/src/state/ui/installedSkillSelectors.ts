import type { ActionAvailability, PublishDraft, SkillSummary, TargetDraft } from "../../domain/p1.ts";
import type { P1WorkspaceState } from "../useP1Workspace.ts";

function buildPendingAvailability(kind: ActionAvailability["kind"], label: string, reason: string): ActionAvailability {
  return { kind, label, reason };
}

function findScanSummary(workspace: P1WorkspaceState, targetType: "tool" | "project", targetID: string) {
  return workspace.scanTargets.find((summary) => summary.targetType === targetType && summary.targetID === targetID) ?? null;
}

export function findSkillScanFinding(workspace: P1WorkspaceState, skillID: string, targetType: "tool" | "project", targetID: string) {
  const summary = findScanSummary(workspace, targetType, targetID);
  return summary?.findings.find((finding) => finding.relativePath === skillID) ?? null;
}

function uniq(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))];
}

export function buildTargetDrafts(skill: SkillSummary, workspace: P1WorkspaceState): TargetDraft[] {
  const enabledKeys = new Set(skill.enabledTargets.map((target) => `${target.targetType}:${target.targetID}`));
  const toolDrafts = workspace.tools.map((tool) => {
    const live =
      tool.enabled &&
      tool.skillsPath.trim().length > 0 &&
      tool.adapterStatus !== "missing" &&
      tool.adapterStatus !== "invalid" &&
      tool.adapterStatus !== "disabled";
    const scanSummary = findScanSummary(workspace, "tool", tool.toolID);
    const conflictCount = (scanSummary?.counts.conflict ?? 0) + (scanSummary?.counts.unmanaged ?? 0) + (scanSummary?.counts.orphan ?? 0);
    return {
      key: `tool:${tool.toolID}`,
      targetType: "tool" as const,
      targetID: tool.toolID,
      targetName: tool.name,
      targetPath: tool.skillsPath,
      disabled: !live,
      statusLabel: tool.enabled ? `${tool.adapterStatus}${conflictCount > 0 ? ` · 异常 ${conflictCount}` : ""}` : "disabled",
      selected: enabledKeys.has(`tool:${tool.toolID}`),
      availability: live
        ? { kind: "live" as const, label: "已接入", reason: "当前可直接调用 Tauri 命令配置该目标。" }
        : buildPendingAvailability("pending_local_command", "不可用", "请先修复工具检测状态、路径或启用状态。")
    };
  });

  const projectDrafts = workspace.projects.map((project) => ({
    key: `project:${project.projectID}`,
    targetType: "project" as const,
    targetID: project.projectID,
    targetName: project.name,
    targetPath: project.skillsPath,
    disabled: !project.enabled,
    statusLabel: project.enabled ? `项目级优先${findScanSummary(workspace, "project", project.projectID)?.counts.conflict ? ` · 异常 ${findScanSummary(workspace, "project", project.projectID)?.counts.conflict}` : ""}` : "已停用",
    selected: enabledKeys.has(`project:${project.projectID}`),
    availability: project.enabled
      ? { kind: "live" as const, label: "已接入", reason: "项目级目标已接到 Tauri SQLite 真源与分发命令。" }
      : buildPendingAvailability("pending_local_command", "不可用", "启用项目后才可作为目标使用。")
  }));

  return [...toolDrafts, ...projectDrafts];
}

export function collectInstalledSkillIssues(skill: SkillSummary, workspace: Pick<P1WorkspaceState, "tools" | "projects" | "scanTargets">): string[] {
  const issues: string[] = [];

  if (skill.hasLocalHashDrift) {
    issues.push("本地内容已变更，更新时会直接覆盖。");
  }

  for (const target of skill.enabledTargets) {
    if (target.lastError) {
      issues.push(target.lastError);
    }

    if (target.targetType === "tool") {
      const tool = workspace.tools.find((item) => item.toolID === target.targetID);
      if (!tool) {
        issues.push(`${target.targetName} 目标已不存在，请重新启用或停用。`);
        continue;
      }
      if (!tool.enabled || tool.status === "disabled") {
        issues.push(`${target.targetName} 已停用，当前启用位置不可用。`);
      } else if (tool.status === "missing") {
        issues.push(`${target.targetName} 未检测到，请修复路径后再启用。`);
      } else if (tool.status === "invalid") {
        issues.push(`${target.targetName} 路径不可用，请修改路径。`);
      }
      const finding = findSkillScanFinding(workspace as P1WorkspaceState, skill.skillID, "tool", target.targetID);
      if (finding?.kind === "conflict") {
        issues.push(`${target.targetName} 目标内容与登记产物不一致，请确认是否需要覆盖。`);
      }
      if (finding?.kind === "orphan") {
        issues.push(`${target.targetName} 的托管目标缺失，请重新启用。`);
      }
    }

    if (target.targetType === "project") {
      const project = workspace.projects.find((item) => item.projectID === target.targetID);
      if (!project) {
        issues.push(`${target.targetName} 项目已移除，请重新配置项目路径。`);
        continue;
      }
      if (!project.enabled) {
        issues.push(`${target.targetName} 已停用，项目级启用不再生效。`);
      }
      const finding = findSkillScanFinding(workspace as P1WorkspaceState, skill.skillID, "project", target.targetID);
      if (finding?.kind === "conflict") {
        issues.push(`${target.targetName} 项目目标内容与登记产物不一致，请确认是否需要覆盖。`);
      }
      if (finding?.kind === "orphan") {
        issues.push(`${target.targetName} 项目目标缺失，请重新启用。`);
      }
    }
  }

  return uniq(issues);
}

export function matchesInstalledFilter(skill: SkillSummary, filter: "all" | "enabled" | "updates" | "scope_restricted" | "issues", issues: string[]): boolean {
  switch (filter) {
    case "enabled":
      return skill.enabledTargets.length > 0;
    case "updates":
      return skill.installState === "update_available";
    case "scope_restricted":
      return skill.isScopeRestricted;
    case "issues":
      return issues.length > 0;
    case "all":
    default:
      return true;
  }
}
