import type { LocalEvent, RequestedMode, SkillSummary, TargetType } from "../../domain/p1.ts";

export function buildEnableSkillArgs(input: {
  skill: Pick<SkillSummary, "skillID" | "localVersion" | "version">;
  targetType: TargetType;
  targetID: string;
  requestedMode: RequestedMode;
  allowOverwrite?: boolean;
}) {
  return {
    skillId: input.skill.skillID,
    version: input.skill.localVersion ?? input.skill.version,
    targetType: input.targetType,
    targetId: input.targetID,
    preferredMode: input.requestedMode,
    allowOverwrite: input.allowOverwrite ?? false
  };
}

export function buildDisableSkillArgs(input: {
  skillID: string;
  targetType: TargetType;
  targetID: string;
}) {
  return {
    skillId: input.skillID,
    targetType: input.targetType,
    targetId: input.targetID
  };
}

export function buildUninstallSkillArgs(skillID: string) {
  return { skillId: skillID };
}

type UninstallSkillResultWire = {
  removedTargetIDs?: string[];
  removedTargetIds?: string[];
  failedTargetIDs?: string[];
  failedTargetIds?: string[];
  event: LocalEvent;
};

export function normalizeUninstallSkillResult(result: UninstallSkillResultWire): {
  removedTargetIDs: string[];
  failedTargetIDs: string[];
  event: LocalEvent;
} {
  return {
    removedTargetIDs: result.removedTargetIDs ?? result.removedTargetIds ?? [],
    failedTargetIDs: result.failedTargetIDs ?? result.failedTargetIds ?? [],
    event: result.event
  };
}
