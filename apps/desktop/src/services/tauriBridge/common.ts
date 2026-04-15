import { PendingLocalCommandError } from "../../domain/p1.ts";

export function pendingLocalCommand(action: string): PendingLocalCommandError {
  return new PendingLocalCommandError(
    action,
    "当前运行在浏览器预览模式；登录和远端页面可用，但本地 Store/Adapter 操作需要在 Tauri desktop app 中执行。"
  );
}
