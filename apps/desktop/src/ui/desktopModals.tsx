import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FolderPlus, Plus, RefreshCw, Sparkles, WifiOff, X } from "lucide-react";
import type { P1WorkspaceState } from "../state/useP1Workspace";
import type { DesktopUIState } from "../state/useDesktopUIState";
import { formatDate } from "./desktopShared";

function ModalFrame({
  title,
  eyebrow,
  children,
  onClose,
  narrow = false
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
  narrow?: boolean;
}) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section className={narrow ? "modal-panel narrow" : "modal-panel"} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
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
          <input value={ui.toolDraft.configPath} onChange={(event) => ui.setToolDraft((current) => ({ ...current, configPath: event.target.value }))} placeholder="例如 %USERPROFILE%\\.cursor\\settings.json" />
        </label>
        <label className="field">
          <span>skills 安装路径</span>
          <input value={ui.toolDraft.skillsPath} onChange={(event) => ui.setToolDraft((current) => ({ ...current, skillsPath: event.target.value }))} />
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
        <label className="field">
          <span>skills 安装路径</span>
          <input value={ui.projectDraft.skillsPath} onChange={(event) => ui.setProjectDraft((current) => ({ ...current, skillsPath: event.target.value }))} />
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
    </>
  );
}
