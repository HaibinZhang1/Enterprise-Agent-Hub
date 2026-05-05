import type { ConnectionStatus, PreferenceState } from "../../domain/p1.ts";
import type { DisplayLanguage } from "../../ui/desktopShared.tsx";
import { themeLabel } from "../../ui/themeLabels.ts";
import type { AppUpdateState } from "./clientUpdates.ts";

export interface SettingsPanelSummary {
  id: "general" | "agent" | "local" | "sync" | "about";
  title: string;
  description: string;
  status: string;
}

function appUpdateSettingsStatus(appUpdate: AppUpdateState): string {
  if (appUpdate.status === "mandatory_update") return "必须更新";
  if (appUpdate.status === "unsupported_version") return "版本过低";
  return appUpdate.available ? "有更新" : "已是最新";
}

export function buildSettingsPanels(input: {
  language: DisplayLanguage;
  theme: PreferenceState["theme"];
  hasAgentKey: boolean;
  connectionStatus: ConnectionStatus;
  appUpdate: AppUpdateState;
}): SettingsPanelSummary[] {
  return [
    { id: "general", title: "常规偏好", description: "语言、主题", status: themeLabel(input.theme, input.language) },
    { id: "agent", title: "Agent 接入", description: "模型服务、API Key", status: input.hasAgentKey ? "已保存" : "待配置" },
    { id: "local", title: "本地环境", description: "Central Store、服务地址", status: input.connectionStatus === "connected" ? "已连接" : "本地可用" },
    { id: "sync", title: "同步与更新", description: "通知、启动上下文", status: appUpdateSettingsStatus(input.appUpdate) },
    { id: "about", title: "关于", description: "软件信息、版本、仓库", status: `v${input.appUpdate.currentVersion}` }
  ];
}
