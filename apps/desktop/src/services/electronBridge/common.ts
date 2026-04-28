import { PendingLocalCommandError } from "../../domain/p1.ts";

export function pendingLocalCommand(action: string): PendingLocalCommandError {
  return new PendingLocalCommandError(
    action,
    "当前运行在浏览器预览模式；登录和远端页面可用，但本地 Store/Adapter 操作需要在 Electron desktop app 中执行。"
  );
}

export function localCommandErrorMessage(error: unknown, fallbackAction = "本地命令"): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return `${fallbackAction} 执行失败，请稍后重试。`;
}
