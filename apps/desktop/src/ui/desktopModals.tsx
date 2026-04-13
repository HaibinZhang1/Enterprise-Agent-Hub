import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FolderPlus, Plus, RefreshCw, Sparkles, WifiOff, X } from "lucide-react";
import type { P1WorkspaceState } from "../state/useP1Workspace";
import type { DesktopUIState } from "../state/useDesktopUIState";
import { defaultProjectSkillsPath, defaultToolConfigPath, defaultToolSkillsPath, previewCentralStorePath } from "../utils/platformPaths";
import { formatDate, localize, settingsLanguageLabel, themeLabel } from "./desktopShared";

function ModalFrame({
  title,
  eyebrow,
  children,
  onClose,
  narrow = false,
  className = ""
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section className={narrow ? `modal-panel narrow ${className}`.trim() : `modal-panel ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function SettingsOptionField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConfirmModal({ ui }: { ui: DesktopUIState }) {
  const modal = ui.confirmModal;
  if (!modal) return null;
  return (
    <ModalFrame title={modal.title} eyebrow="二次确认" onClose={ui.closeModal} narrow>
      <p>{modal.body}</p>
      {modal.detailLines?.length ? (
        <div className="stack-list compact">
          {modal.detailLines.map((line) => <small key={line}>{line}</small>)}
        </div>
      ) : null}
      <div className="inline-actions wrap modal-actions">
        <button className={modal.tone === "danger" ? "btn btn-danger" : "btn btn-primary"} onClick={() => void modal.onConfirm?.()}>
          {modal.confirmLabel}
        </button>
        <button className="btn" onClick={ui.closeModal}>取消</button>
      </div>
    </ModalFrame>
  );
}

function ProgressModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const progress = workspace.progress;
  if (!progress || !ui.preferences.showInstallResults) return null;
  const steps = progress.operation === "install" || progress.operation === "update"
    ? ["获取下载凭证", "下载包", "校验大小和文件数", "校验 SHA-256", "写入 Central Store", "完成"]
    : ["准备目标", "执行本地命令", "写入结果", "完成"];
  const currentIndex = Math.max(0, steps.findIndex((step) => progress.stage.includes(step)));
  const toneIcon = progress.result === "success" ? <CheckCircle2 size={18} /> : progress.result === "failed" ? <AlertTriangle size={18} /> : <Sparkles size={18} />;

  return (
    <ModalFrame title={`${progress.operation} · ${progress.skillID}`} eyebrow="本地写入流程" onClose={ui.closeModal} narrow>
      <div className={`callout ${progress.result === "failed" ? "warning" : "info"}`}>
        {toneIcon}
        {progress.message}
      </div>
      <div className="progress-list">
        {steps.map((step, index) => (
          <div className={index < currentIndex ? "progress-step done" : index === currentIndex ? "progress-step active" : "progress-step"} key={step}>
            <span className="step-index">{index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      {progress.result !== "running" ? (
        <div className="inline-actions wrap modal-actions">
          <button className="btn btn-primary" onClick={workspace.clearProgress}>知道了</button>
        </div>
      ) : null}
    </ModalFrame>
  );
}

function TargetsModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const modal = ui.modal;
  if (modal.type !== "targets") return null;
  const skill = workspace.skills.find((item) => item.skillID === modal.skillID) ?? workspace.installedSkills.find((item) => item.skillID === modal.skillID);
  if (!skill) return null;

  return (
    <ModalFrame title={`${skill.displayName} v${skill.localVersion ?? skill.version}`} eyebrow="目标选择" onClose={ui.closeModal}>
      {skill.isScopeRestricted ? <div className="callout warning"><AlertTriangle size={16} /> 权限已收缩：可继续使用当前版本，但不可新增启用位置。</div> : null}
      <div className="target-grid">
        {ui.targetDrafts.map((draft) => (
          <label key={draft.key} className={draft.disabled ? "target-tile disabled" : "target-tile"}>
            <input type="checkbox" checked={draft.selected} disabled={draft.disabled} onChange={() => ui.toggleTargetDraft(draft.key)} />
            <span>
              <strong>{draft.targetName}</strong>
              <small>{draft.targetPath}</small>
              <small>{draft.statusLabel} · {draft.availability.label}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="stack-list compact">
        {workspace.scanTargets
          .filter((summary) => summary.findings.some((finding) => finding.relativePath === skill.skillID))
          .map((summary) => (
            <small key={summary.id}>
              {summary.targetName}：{summary.findings.find((finding) => finding.relativePath === skill.skillID)?.message ?? "已扫描"}
            </small>
          ))}
      </div>
      <div className="inline-actions wrap modal-actions">
        <button className="btn btn-primary" onClick={() => void ui.applyTargetDrafts(skill)} disabled={skill.isScopeRestricted}>应用目标</button>
        <button className="btn" onClick={() => ui.openToolEditor()}><Plus size={15} />添加自定义工具</button>
        <button className="btn" onClick={() => ui.openProjectEditor()}><FolderPlus size={15} />添加项目</button>
      </div>
    </ModalFrame>
  );
}

function ToolEditorModal({ ui }: { ui: DesktopUIState }) {
  if (ui.modal.type !== "tool_editor") return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ui.submitToolDraft();
  }

  const editing =
    ui.toolDraft.toolID !== "custom_directory" ||
    ui.toolDraft.configPath.trim().length > 0 ||
    ui.toolDraft.skillsPath.trim().length > 0;
  const customDirectory = ui.toolDraft.toolID === "custom_directory";
  const draftToolID = ui.toolDraft.toolID ?? "custom_directory";
  const configPlaceholder = customDirectory ? "例如 ~/ai-skills/shared/config.json" : defaultToolConfigPath(draftToolID);
  const skillsPlaceholder = customDirectory ? "例如 ~/ai-skills/shared/skills" : defaultToolSkillsPath(draftToolID);

  return (
    <ModalFrame title={editing ? `编辑 ${ui.toolDraft.name}` : "添加自定义工具"} eyebrow="工具路径" onClose={ui.closeModal} narrow>
      <form className="form-stack" onSubmit={submit}>
        {customDirectory ? (
          <label className="field">
            <span>工具名称</span>
            <input value={ui.toolDraft.name} onChange={(event) => ui.setToolDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
        ) : null}
        <label className="field">
          <span>配置路径</span>
          <input value={ui.toolDraft.configPath} onChange={(event) => ui.setToolDraft((current) => ({ ...current, configPath: event.target.value }))} placeholder={configPlaceholder} />
        </label>
        <label className="field">
          <span>skills 安装路径</span>
          <input value={ui.toolDraft.skillsPath} onChange={(event) => ui.setToolDraft((current) => ({ ...current, skillsPath: event.target.value }))} placeholder={skillsPlaceholder} />
        </label>
        <label className="toggle-row">
          <span>启用当前工具配置</span>
          <input type="checkbox" checked={ui.toolDraft.enabled} onChange={(event) => ui.setToolDraft((current) => ({ ...current, enabled: event.target.checked }))} />
        </label>
        <div className="callout info">
          <CheckCircle2 size={16} />
          保存后会写入本地 SQLite 真源，并参与后续检测、启用与目录扫描。
        </div>
        <div className="inline-actions wrap modal-actions">
          <button className="btn btn-primary" type="submit">{editing ? "保存工具配置" : "保存自定义目录"}</button>
          <button className="btn" type="button" onClick={ui.closeModal}>取消</button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ProjectEditorModal({ ui }: { ui: DesktopUIState }) {
  if (ui.modal.type !== "project_editor") return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ui.submitProjectDraft();
  }

  const editing = Boolean(ui.projectDraft.projectID);
  const skillsPlaceholder = defaultProjectSkillsPath(ui.projectDraft.projectPath);

  return (
    <ModalFrame title={editing ? `编辑 ${ui.projectDraft.name}` : "添加项目"} eyebrow="项目配置" onClose={ui.closeModal} narrow>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">
          <span>项目名称</span>
          <input value={ui.projectDraft.name} onChange={(event) => ui.setProjectDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label className="field">
          <span>项目路径</span>
          <input value={ui.projectDraft.projectPath} onChange={(event) => ui.setProjectDraft((current) => ({ ...current, projectPath: event.target.value }))} />
        </label>
        <div className="inline-actions wrap">
          <button className="btn btn-small" type="button" onClick={() => void ui.pickProjectDirectoryForDraft()}>
            <FolderPlus size={15} />
            选择文件夹
          </button>
        </div>
        <label className="field">
          <span>skills 安装路径</span>
          <input value={ui.projectDraft.skillsPath} onChange={(event) => ui.setProjectDraft((current) => ({ ...current, skillsPath: event.target.value }))} placeholder={skillsPlaceholder} />
        </label>
        <label className="toggle-row">
          <span>启用项目级配置</span>
          <input type="checkbox" checked={ui.projectDraft.enabled} onChange={(event) => ui.setProjectDraft((current) => ({ ...current, enabled: event.target.checked }))} />
        </label>
        <p>若只提供项目路径，系统会默认补全为项目下的 `.codex/skills`。</p>
        <div className="inline-actions wrap modal-actions">
          <button className="btn btn-primary" type="submit">{editing ? "保存项目" : "添加项目"}</button>
          <button className="btn" type="button" onClick={ui.closeModal}>取消</button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ConnectionStatusModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  if (ui.modal.type !== "connection_status") return null;

  const status = workspace.bootstrap.connection.status;
  const title = workspace.loggedIn ? "连接状态" : "本地模式";
  const statusText =
    workspace.loggedIn
      ? status === "connected"
        ? "已连接到企业服务"
        : status === "connecting"
          ? "正在尝试恢复连接"
          : status === "offline"
            ? "离线模式"
            : "连接失败"
      : "当前仅使用本地已安装数据";

  return (
    <ModalFrame title={title} eyebrow="服务连接" onClose={ui.closeModal} narrow>
      <div className={`callout ${status === "connected" ? "info" : "warning"}`}>
        {status === "connected" ? <CheckCircle2 size={16} /> : <WifiOff size={16} />}
        {statusText}
      </div>
      <div className="definition-grid">
        <div><dt>最近错误</dt><dd>{workspace.bootstrap.connection.lastError ?? "暂无最近错误"}</dd></div>
        <div><dt>API 版本</dt><dd>{workspace.bootstrap.connection.apiVersion || "-"}</dd></div>
        <div><dt>服务端时间</dt><dd>{workspace.bootstrap.connection.serverTime ? formatDate(workspace.bootstrap.connection.serverTime) : "-"}</dd></div>
        <div><dt>当前身份</dt><dd>{workspace.currentUser.displayName}</dd></div>
      </div>
      <div className="stack-list compact">
        <small>市场搜索、安装、更新依赖在线服务；离线时仅保留本地已安装 Skill 的查看和启用/停用。</small>
        <small>审核、管理只在在线且具备权限时显示。</small>
      </div>
      <div className="inline-actions wrap modal-actions">
        {workspace.loggedIn ? (
          <button className="btn btn-primary" onClick={() => void workspace.refreshBootstrap()}>
            <RefreshCw size={15} />
            重试连接
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => { ui.closeModal(); workspace.requireAuth(null); }}>
            登录同步
          </button>
        )}
        <button className="btn" onClick={ui.closeModal}>关闭</button>
      </div>
    </ModalFrame>
  );
}

function SettingsModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  if (ui.modal.type !== "settings") return null;

  return (
    <ModalFrame
      title={localize(ui.language, "设置", "Settings")}
      eyebrow={localize(ui.language, "基础偏好", "Preferences")}
      onClose={ui.closeModal}
      className="settings-modal-shell"
    >
      <div className="settings-stack">
        <section className="settings-section">
          <h3>{localize(ui.language, "语言", "Language")}</h3>
          <SettingsOptionField
            label={localize(ui.language, "显示语言", "Display Language")}
            value={ui.preferences.language}
            onChange={(value) =>
              ui.setPreferences((current) => ({
                ...current,
                language: value as typeof current.language,
                autoDetectLanguage: value === "auto"
              }))
            }
            options={[
              { value: "auto", label: settingsLanguageLabel("auto", ui.language) },
              { value: "zh-CN", label: settingsLanguageLabel("zh-CN", ui.language) },
              { value: "en-US", label: settingsLanguageLabel("en-US", ui.language) }
            ]}
          />
          <label className="toggle-row compact">
            <span>{localize(ui.language, "按系统地区自动识别", "Follow System Language")}</span>
            <input
              type="checkbox"
              checked={ui.preferences.autoDetectLanguage}
              onChange={(event) =>
                ui.setPreferences((current) => ({
                  ...current,
                  autoDetectLanguage: event.target.checked,
                  language: event.target.checked ? "auto" : current.language === "auto" ? ui.language : current.language
                }))
              }
            />
          </label>
        </section>

        <section className="settings-section">
          <h3>{localize(ui.language, "主题", "Theme")}</h3>
          <SettingsOptionField
            label={localize(ui.language, "主题样式", "Theme")}
            value={ui.preferences.theme}
            onChange={(value) => ui.setPreferences((current) => ({ ...current, theme: value as typeof current.theme }))}
            options={[
              { value: "classic", label: themeLabel("classic", ui.language) },
              { value: "fresh", label: themeLabel("fresh", ui.language) },
              { value: "contrast", label: themeLabel("contrast", ui.language) }
            ]}
          />
          <div className="pill-row">
            <Tag tone="info">{themeLabel("classic", ui.language)}</Tag>
            <Tag tone="info">{themeLabel("fresh", ui.language)}</Tag>
            <Tag tone="info">{themeLabel("contrast", ui.language)}</Tag>
          </div>
        </section>

        <section className="settings-section">
          <h3>Central Store</h3>
          <p className="settings-path">{workspace.localCentralStorePath || previewCentralStorePath()}</p>
          <small>{localize(ui.language, "这里只展示当前路径，真实文件写入仍通过桌面命令处理。", "This only shows the current path. Real file writes still go through desktop commands.")}</small>
        </section>

        <section className="settings-section">
          <h3>{localize(ui.language, "同步", "Sync")}</h3>
          <label className="toggle-row compact">
            <span>{localize(ui.language, "显示安装/更新结果", "Show Install and Update Results")}</span>
            <input type="checkbox" checked={ui.preferences.showInstallResults} onChange={(event) => ui.setPreferences((current) => ({ ...current, showInstallResults: event.target.checked }))} />
          </label>
          <label className="toggle-row compact">
            <span>{localize(ui.language, "联网后同步本地事件", "Sync Local Events After Reconnect")}</span>
            <input type="checkbox" checked={ui.preferences.syncLocalEvents} onChange={(event) => ui.setPreferences((current) => ({ ...current, syncLocalEvents: event.target.checked }))} />
          </label>
          <div className="inline-actions wrap modal-actions start">
            <button className="btn" onClick={() => void workspace.refreshBootstrap()}>
              <RefreshCw size={15} />
              {localize(ui.language, "刷新启动上下文", "Refresh Bootstrap")}
            </button>
          </div>
        </section>

        <div className="inline-actions wrap modal-actions">
          <button className="btn btn-primary" onClick={ui.closeModal}>
            {localize(ui.language, "完成", "Done")}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

export function FlashToast({ ui }: { ui: DesktopUIState }) {
  if (!ui.flash) return null;
  return (
    <aside className={`operation-toast ${ui.flash.tone}`} role="status" onClick={ui.clearFlash}>
      <strong>{ui.flash.title}</strong>
      <span>{ui.flash.body}</span>
    </aside>
  );
}

export function DesktopModals({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  return (
    <>
      <ConfirmModal ui={ui} />
      <ProgressModal workspace={workspace} ui={ui} />
      <TargetsModal workspace={workspace} ui={ui} />
      <ToolEditorModal ui={ui} />
      <ProjectEditorModal ui={ui} />
      <ConnectionStatusModal workspace={workspace} ui={ui} />
      <SettingsModal workspace={workspace} ui={ui} />
    </>
  );
}
