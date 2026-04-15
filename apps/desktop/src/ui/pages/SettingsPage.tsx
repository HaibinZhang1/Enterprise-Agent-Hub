import type { PreferenceState } from "../../domain/p1.ts";
import { previewCentralStorePath } from "../../utils/platformPaths.ts";
import { localize, settingsLanguageLabel, themeLabel } from "../desktopShared.tsx";
import { PageProps, PreferenceToggle, SelectField, TagPill } from "./pageCommon.tsx";
import { RefreshCw } from "lucide-react";

export function SettingsPage({ workspace, ui }: PageProps) {
  function updatePreference<K extends keyof PreferenceState>(key: K, value: PreferenceState[K]) {
    ui.setPreferences((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">{localize(ui.language, "基础偏好", "Preferences")}</div>
          <h1>{localize(ui.language, "设置", "Settings")}</h1>
          <p>{localize(ui.language, "语言、主题和同步偏好都保存在本地，不依赖远端接口。", "Language, theme, and sync preferences are stored locally and do not depend on the server.")}</p>
        </div>
        <TagPill tone="info">{themeLabel(ui.preferences.theme, ui.language)}</TagPill>
      </section>

      <div className="card-grid">
        <section className="panel">
          <h2>{localize(ui.language, "语言", "Language")}</h2>
          <SelectField
            label={localize(ui.language, "显示语言", "Display Language")}
            value={ui.preferences.language}
            options={[
              { value: "auto", label: settingsLanguageLabel("auto", ui.language) },
              { value: "zh-CN", label: settingsLanguageLabel("zh-CN", ui.language) },
              { value: "en-US", label: settingsLanguageLabel("en-US", ui.language) }
            ]}
            onChange={(value) =>
              ui.setPreferences((current) => ({
                ...current,
                language: value as PreferenceState["language"],
                autoDetectLanguage: value === "auto"
              }))
            }
          />
          <PreferenceToggle label={localize(ui.language, "按系统地区自动识别", "Follow System Language")} checked={ui.preferences.autoDetectLanguage} onChange={(value) => updatePreference("autoDetectLanguage", value)} />
        </section>
        <section className="panel">
          <h2>{localize(ui.language, "主题", "Theme")}</h2>
          <SelectField
            label={localize(ui.language, "主题", "Theme")}
            value={ui.preferences.theme}
            options={[
              { value: "classic", label: themeLabel("classic", ui.language) },
              { value: "fresh", label: themeLabel("fresh", ui.language) },
              { value: "contrast", label: themeLabel("contrast", ui.language) }
            ]}
            onChange={(value) => updatePreference("theme", value as PreferenceState["theme"])}
          />
          <div className="pill-row">
            <TagPill>{themeLabel("classic", ui.language)}</TagPill>
            <TagPill>{themeLabel("fresh", ui.language)}</TagPill>
            <TagPill>{themeLabel("contrast", ui.language)}</TagPill>
          </div>
        </section>
        <section className="panel">
          <h2>Central Store</h2>
          <p>{workspace.localCentralStorePath || previewCentralStorePath()}</p>
          <small>{localize(ui.language, "前端只展示路径；真实文件写入仍通过 Tauri 命令完成。", "The frontend only shows the path. Real file writes still go through Tauri commands.")}</small>
        </section>
        <section className="panel">
          <h2>{localize(ui.language, "同步偏好", "Sync")}</h2>
          <PreferenceToggle label={localize(ui.language, "显示安装/更新结果", "Show Install and Update Results")} checked={ui.preferences.showInstallResults} onChange={(value) => updatePreference("showInstallResults", value)} />
          <PreferenceToggle label={localize(ui.language, "联网后同步本地事件", "Sync Local Events After Reconnect")} checked={ui.preferences.syncLocalEvents} onChange={(value) => updatePreference("syncLocalEvents", value)} />
          <div className="inline-actions">
            <button className="btn" onClick={() => void workspace.refreshBootstrap()}><RefreshCw size={15} />{localize(ui.language, "刷新启动上下文", "Refresh Bootstrap")}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
