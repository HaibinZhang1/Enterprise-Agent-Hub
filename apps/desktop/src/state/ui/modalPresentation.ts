import type { DesktopModalState } from "../../domain/p1.ts";

export interface ConfirmModalState extends Exclude<DesktopModalState, { type: "none" | "targets" | "local_import" | "tool_editor" | "project_editor" | "connection_status" | "app_update" | "settings" }> {
  onConfirm?: () => Promise<void> | void;
}

export function presentModalWithDrawerDismissal(
  nextModal: DesktopModalState,
  handlers: {
    closeSkillDetail: () => void;
    setModal: (nextModal: DesktopModalState) => void;
  }
): void {
  handlers.closeSkillDetail();
  handlers.setModal(nextModal);
}

export function presentConfirmWithDrawerDismissal(
  nextConfirm: ConfirmModalState | null,
  handlers: {
    closeSkillDetail: () => void;
    setConfirmModal: (nextConfirm: ConfirmModalState | null) => void;
  }
): void {
  if (nextConfirm) {
    handlers.closeSkillDetail();
  }
  handlers.setConfirmModal(nextConfirm);
}
