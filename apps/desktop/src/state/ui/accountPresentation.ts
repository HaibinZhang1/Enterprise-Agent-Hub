import type { P1WorkspaceState } from "../useP1Workspace.ts";

type DisplayLanguage = "zh-CN" | "en-US";
export type AccountPresenceTone = "connected" | "offline";

export interface AccountPresentation {
  buttonLabel: string;
  connectionTone: AccountPresenceTone;
  connectionLabel: string;
}

function localize(language: DisplayLanguage, zhCN: string, enUS: string): string {
  return language === "en-US" ? enUS : zhCN;
}

export function deriveAccountPresentation(input: {
  user: P1WorkspaceState["currentUser"];
  loggedIn: boolean;
  connectionStatus: P1WorkspaceState["bootstrap"]["connection"]["status"];
  language?: DisplayLanguage;
}): AccountPresentation {
  const language = input.language ?? "zh-CN";
  const connectionTone: AccountPresenceTone = input.loggedIn && input.connectionStatus === "connected" ? "connected" : "offline";
  const connectionLabel =
    input.loggedIn && input.connectionStatus === "connected"
      ? localize(language, "已连接", "Connected")
      : input.loggedIn
        ? localize(language, "离线", "Offline")
        : localize(language, "本地", "Local");

  if (!input.loggedIn) {
    return {
      buttonLabel: localize(language, "本地模式", "Local Mode"),
      connectionTone,
      connectionLabel
    };
  }

  return {
    buttonLabel: input.user.username,
    connectionTone,
    connectionLabel
  };
}
