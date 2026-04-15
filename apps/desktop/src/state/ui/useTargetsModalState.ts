import { useCallback, useState } from "react";
import type { DesktopModalState, SkillSummary, TargetDraft } from "../../domain/p1.ts";
import type { P1WorkspaceState } from "../useP1Workspace.ts";
import { buildTargetDrafts, findSkillScanFinding } from "./installedSkillSelectors.ts";

export function useTargetsModalState(input: {
  workspace: P1WorkspaceState;
  closeModal: () => void;
  setModal: (modal: DesktopModalState) => void;
  setConfirmModal: (input: {
    type: "confirm";
    title: string;
    body: string;
    confirmLabel: string;
    tone: "primary" | "danger";
    detailLines: string[];
    onConfirm: () => Promise<void>;
  }) => void;
  setFlash: (flash: { tone: "info" | "warning" | "danger" | "success"; title: string; body: string } | null) => void;
}) {
  const { workspace, closeModal, setModal, setConfirmModal, setFlash } = input;
  const [targetDrafts, setTargetDrafts] = useState<TargetDraft[]>([]);

  const openTargetsModal = useCallback((skill: SkillSummary) => {
    setTargetDrafts(buildTargetDrafts(skill, workspace));
    setModal({ type: "targets", skillID: skill.skillID });
  }, [setModal, workspace]);

  const toggleTargetDraft = useCallback((key: string) => {
    setTargetDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, selected: !draft.selected } : draft)));
  }, []);

  const applyTargetDrafts = useCallback(async (skill: SkillSummary) => {
    const sourceDrafts = buildTargetDrafts(skill, workspace);
    const changedDrafts = targetDrafts.filter((draft) => {
      const source = sourceDrafts.find((item) => item.key === draft.key);
      return source && source.selected !== draft.selected;
    });

    if (changedDrafts.length === 0) {
      setFlash({ tone: "info", title: "没有变更", body: "当前目标选择与现有状态一致。" });
      closeModal();
      return;
    }

    const blockedDrafts = changedDrafts.filter((draft) => draft.availability.kind !== "live");
    if (blockedDrafts.length > 0) {
      setFlash({
        tone: "warning",
        title: "存在不可用目标",
        body: `请先修复这些目标后再启用：${blockedDrafts.map((draft) => draft.targetName).join("、")}。`
      });
      closeModal();
      return;
    }

    const applyChanges = async (overwriteKeys = new Set<string>()) => {
      for (const draft of changedDrafts) {
        if (!draft.selected) {
          await workspace.disableSkill(skill.skillID, draft.targetID, draft.targetType);
          continue;
        }
        await workspace.enableSkill(
          skill.skillID,
          draft.targetType,
          draft.targetID,
          "symlink",
          overwriteKeys.has(draft.key)
        );
      }
      closeModal();
    };

    const conflictingDrafts = changedDrafts.filter((draft) => {
      if (!draft.selected) return false;
      const finding = findSkillScanFinding(workspace, skill.skillID, draft.targetType, draft.targetID);
      return finding !== null && finding.kind !== "managed";
    });

    if (conflictingDrafts.length > 0) {
      const overwriteKeys = new Set(conflictingDrafts.map((draft) => draft.key));
      setModal({ type: "none" });
      setConfirmModal({
        type: "confirm",
        title: `覆盖目标内容：${skill.displayName}`,
        body: "检测到目标目录中已有未托管或异常内容。确认后会直接覆盖这些位置。",
        confirmLabel: "确认覆盖并启用",
        tone: "danger",
        detailLines: conflictingDrafts.map((draft) => {
          const finding = findSkillScanFinding(workspace, skill.skillID, draft.targetType, draft.targetID);
          return `${draft.targetName} · ${finding?.message ?? draft.targetPath}`;
        }),
        onConfirm: async () => {
          closeModal();
          await applyChanges(overwriteKeys);
        }
      });
      return;
    }

    await applyChanges();
  }, [closeModal, setConfirmModal, setFlash, setModal, targetDrafts, workspace]);

  return {
    targetDrafts,
    openTargetsModal,
    toggleTargetDraft,
    applyTargetDrafts,
  };
}
