import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderPlus,
  LogIn,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  WifiOff,
  X
} from "lucide-react";
import type { AdminSkill, OperationProgress, PreferenceState, PublishDraft, PublisherSkillSummary, ReviewAction, ReviewDetail, SkillSummary } from "../domain/p1.ts";
import { SKILL_CATEGORIES, SKILL_TAGS } from "../domain/p1.ts";
import { buildSettingsPanels, type DesktopUIState, type FlashMessage, type OverlayState, type PublisherPane } from "../state/useDesktopUIState.ts";
import { openExternalURL } from "../services/externalLinks.ts";
import type { P1WorkspaceState } from "../state/useP1Workspace.ts";
import { buildPublishPrecheck } from "../state/ui/publishPrecheck.ts";
import { targetDraftSubmitLabel } from "../state/ui/installedSkillSelectors.ts";
import { connectedServiceURL, ENTERPRISE_AGENT_HUB_GITHUB_URL } from "../state/ui/aboutInfo.ts";
import { downloadAuthenticatedFile, p1Client } from "../services/p1Client.ts";
import { defaultProjectSkillsPath, defaultToolConfigPath, defaultToolSkillsPath, previewCentralStorePath } from "../utils/platformPaths.ts";
import { passwordPolicyHint, validatePasswordPolicy } from "../utils/passwordPolicy.ts";
import {
  flattenDepartments,
  formatDate,
  localize,
  publishVisibilityLabel,
  reviewActionLabel,
  riskLabel,
  scopeLabel,
  settingsLanguageLabel,
  skillInitials,
  statusLabel,
  statusTone,
  submissionTypeLabel,
  themeLabel,
  roleLabel,
  workflowStateLabel
} from "./desktopShared.tsx";
import { shouldCloseFromBackdropPointerDown } from "./modalInteraction.ts";
import { InitialBadge, PackagePreviewPanel, SectionEmpty, SelectField, TagPill, renderMarkdownPreview } from "./pageCommon.tsx";

function OverlaySectionHeader({
  title,
  eyebrow,
  description
}: {
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <div className="section-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function OverlayPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function ModalFrame({
  title,
  eyebrow,
  children,
  onClose,
  narrow = false,
  full = false,
  panelClassName = "",
  headerContent,
  headActions
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
  narrow?: boolean;
  full?: boolean;
  panelClassName?: string;
  headerContent?: React.ReactNode;
  headActions?: React.ReactNode;
}) {
  const baseClassName = full ? "overlay-panel full" : narrow ? "overlay-panel narrow" : "overlay-panel";
  const className = [baseClassName, panelClassName].filter(Boolean).join(" ");
  return (
    <div
      className="overlay-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (shouldCloseFromBackdropPointerDown(event)) {
          onClose();
        }
      }}
    >
      <section className={className} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          {headerContent ?? (
            <div>
              <div className="eyebrow">{eyebrow}</div>
              <h2>{title}</h2>
            </div>
          )}
          <div className="overlay-head-actions">
            {headActions}
            <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="overlay-body">{children}</div>
      </section>
    </div>
  );
}

export function progressStepsForOperation(operation: OperationProgress["operation"]): string[] {
  if (operation === "install" || operation === "update") {
    return ["获取下载凭证", "下载包", "校验大小和文件数", "校验 SHA-256", "写入 Central Store", "完成"];
  }
  if (operation === "request") {
    return ["发起请求", "等待服务响应", "处理结果"];
  }
  if (operation === "import") {
    return ["校验来源", "写入 Central Store", "认领原路径", "完成"];
  }
  if (operation === "scan") {
    return ["启动扫描", "读取工具和项目目录", "完成"];
  }
  return ["准备目标", "执行本地命令", "写入结果", "完成"];
}

export function progressTitle(progress: OperationProgress): string {
  if (progress.operation === "scan") return "扫描本地目标";
  return progress.operation === "request" ? "请求失败" : `${progress.operation} · ${progress.skillID}`;
}

export function progressEyebrow(operation: OperationProgress["operation"]): string {
  if (operation === "scan") return "本地扫描";
  return operation === "request" ? "服务连接" : "本地写入流程";
}

function defaultLoginForm(apiBaseURL: string) {
  const savedPreferences = p1Client.storedLoginPreferences();
  return {
    serverURL: savedPreferences.serverURL || apiBaseURL,
    phoneNumber: savedPreferences.phoneNumber || (import.meta.env.DEV ? import.meta.env.VITE_P1_DEV_LOGIN_PHONE_NUMBER ?? "" : ""),
    password: savedPreferences.password || (import.meta.env.DEV ? import.meta.env.VITE_P1_DEV_LOGIN_PASSWORD ?? "" : ""),
    rememberPassword: savedPreferences.rememberPassword,
    autoLogin: savedPreferences.autoLogin
  };
}

function normalizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

function validatePhoneNumber(value: string): string | null {
  if (!value) return "请输入手机号。";
  if (!/^\d+$/.test(value)) return "手机号只能输入数字。";
  if (value.length !== 11) return "手机号需为 11 位数字。";
  if (!value.startsWith("1")) return "手机号需以 1 开头。";
  return null;
}

function LoginModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const [form, setForm] = useState(() => defaultLoginForm(workspace.apiBaseURL));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordChallenge, setPasswordChallenge] = useState<{ passwordChangeToken: string; expiresAt: string; username: string; phoneNumber: string } | null>(null);
  const [initialPasswordForm, setInitialPasswordForm] = useState({ nextPassword: "", confirmPassword: "" });
  const [initialPasswordError, setInitialPasswordError] = useState<string | null>(null);
  const visibleError = formError ?? workspace.authError;
  const initialPasswordValidation = initialPasswordForm.nextPassword.trim() ? validatePasswordPolicy(initialPasswordForm.nextPassword) : null;
  const initialPasswordReused = initialPasswordForm.nextPassword.trim() === "EAgentHub123!";
  const initialPasswordMismatch =
    initialPasswordForm.confirmPassword.length > 0 && initialPasswordForm.nextPassword !== initialPasswordForm.confirmPassword;
  const canSubmitInitialPassword = Boolean(
    passwordChallenge &&
    initialPasswordForm.nextPassword.trim() &&
    initialPasswordForm.confirmPassword.trim() &&
    !initialPasswordValidation &&
    !initialPasswordReused &&
    !initialPasswordMismatch
  );

  useEffect(() => {
    if (!workspace.loginModalOpen) return;
    setForm(defaultLoginForm(workspace.apiBaseURL));
    setSubmitting(false);
    setFormError(null);
    setPasswordChallenge(null);
    setInitialPasswordForm({ nextPassword: "", confirmPassword: "" });
    setInitialPasswordError(null);
  }, [workspace.apiBaseURL, workspace.loginModalOpen]);

  if (!workspace.loginModalOpen) return null;

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.name === "phoneNumber" ? normalizePhoneInput(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [event.target.name]: nextValue }));
    if (event.target.name === "phoneNumber" || event.target.name === "password") {
      setFormError(null);
    }
  }

  function updateLoginPreference(event: ChangeEvent<HTMLInputElement>) {
    const { checked, name } = event.target;
    setForm((current) => {
      if (name === "autoLogin") {
        return { ...current, autoLogin: checked, rememberPassword: checked ? true : current.rememberPassword };
      }
      return { ...current, rememberPassword: checked, autoLogin: checked ? current.autoLogin : false };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const phoneError = validatePhoneNumber(form.phoneNumber);
    if (phoneError) {
      setFormError(phoneError);
      return;
    }
    if (!form.password.trim()) {
      setFormError("请输入密码。");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await workspace.login(form);
      if (result.status === "password_change_required") {
        setPasswordChallenge({
          passwordChangeToken: result.passwordChangeToken,
          expiresAt: result.expiresAt,
          username: result.user.username,
          phoneNumber: result.user.phoneNumber
        });
        setInitialPasswordForm({ nextPassword: "", confirmPassword: "" });
        setInitialPasswordError(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInitialPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordChallenge || !canSubmitInitialPassword || submitting) return;
    if (initialPasswordReused) {
      setInitialPasswordError("新密码不能与初始密码相同。");
      return;
    }
    setInitialPasswordError(null);
    setSubmitting(true);
    try {
      const result = await workspace.completeInitialPasswordChange({
        passwordChangeToken: passwordChallenge.passwordChangeToken,
        nextPassword: initialPasswordForm.nextPassword.trim(),
        phoneNumber: form.phoneNumber,
        serverURL: form.serverURL,
        rememberPassword: form.rememberPassword,
        autoLogin: form.autoLogin
      });
      if (!result.ok) {
        setInitialPasswordError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (passwordChallenge) {
    const initialPasswordVisibleError =
      initialPasswordError ??
      workspace.authError ??
      (initialPasswordMismatch
        ? "两次输入的新密码不一致。"
        : initialPasswordReused
          ? "新密码不能与初始密码相同。"
          : initialPasswordValidation);
    return (
      <ModalFrame title="首次登录修改密码" eyebrow="账号安全" onClose={() => workspace.setLoginModalOpen(false)} narrow>
        <div data-testid="initial-password-change">
          <div className="overlay-intro">
            <div className="detail-symbol-card overlay-symbol-card">
              <span className="overlay-symbol-mark icon-tone-pine">EA</span>
            </div>
            <div>
              <p className="overlay-intro-title">初始密码仅用于首次验证</p>
              <p className="overlay-intro-copy">{passwordChallenge.username}（{passwordChallenge.phoneNumber}）需要设置新密码后才能进入工作台。</p>
            </div>
          </div>
          <form className="form-stack" onSubmit={submitInitialPasswordChange} noValidate>
            <label className="field">
              <span>新密码</span>
              <input
                data-testid="initial-password-next"
                type="password"
                value={initialPasswordForm.nextPassword}
                autoComplete="new-password"
                onChange={(event) => {
                  setInitialPasswordForm((current) => ({ ...current, nextPassword: event.target.value }));
                  setInitialPasswordError(null);
                }}
              />
            </label>
            <label className="field">
              <span>确认新密码</span>
              <input
                data-testid="initial-password-confirm"
                type="password"
                value={initialPasswordForm.confirmPassword}
                autoComplete="new-password"
                onChange={(event) => {
                  setInitialPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }));
                  setInitialPasswordError(null);
                }}
              />
            </label>
            <small className={initialPasswordVisibleError ? "field-hint warning" : "field-hint"}>
              {initialPasswordVisibleError ?? passwordPolicyHint}
            </small>
            <div className="inline-actions wrap">
              <button className="btn btn-primary" type="submit" disabled={!canSubmitInitialPassword || submitting}>
                <LogIn size={14} />
                {submitting ? "正在保存..." : "保存并登录"}
              </button>
              <button className="btn" type="button" onClick={() => workspace.setLoginModalOpen(false)} disabled={submitting}>
                取消
              </button>
            </div>
          </form>
        </div>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame title="手机号登录企业服务" eyebrow="身份连接" onClose={() => workspace.setLoginModalOpen(false)} narrow>
      <div data-testid="login-modal">
      <div className="overlay-intro">
        <div className="detail-symbol-card overlay-symbol-card">
          <span className="overlay-symbol-mark icon-tone-pine">EA</span>
        </div>
        <div>
          <p className="overlay-intro-title">登录后同步市场、通知和权限</p>
          <p className="overlay-intro-copy">本地 Skill、工具和项目配置会继续保留，成功登录后会回到当前上下文继续操作。</p>
        </div>
      </div>
      <div className="pill-row">
        <TagPill tone="success">社区同步</TagPill>
        <TagPill tone="info">通知恢复</TagPill>
        <TagPill tone="neutral">本地配置保留</TagPill>
      </div>
      <div className="stack-list">
        <form className="form-stack" onSubmit={submit} noValidate>
          <label className="field">
            <span>服务地址</span>
            <input
              data-testid="login-server-url"
              name="serverURL"
              value={form.serverURL}
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="http://server.example.com"
              onChange={updateField}
            />
          </label>
          <label className="field">
            <span>手机号</span>
            <input
              data-testid="login-phone-number"
              name="phoneNumber"
              value={form.phoneNumber}
              inputMode="tel"
              autoComplete="tel"
              autoCapitalize="none"
              maxLength={11}
              pattern="1[0-9]{10}"
              spellCheck={false}
              placeholder="11 位手机号"
              onChange={updateField}
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              data-testid="login-password"
              name="password"
              type="password"
              value={form.password}
              autoComplete="current-password"
              placeholder="••••••••"
              onChange={updateField}
            />
          </label>
          <div className="stack-list compact">
            <label className="toggle-row compact">
              <span>记住密码</span>
              <input
                data-testid="login-remember-password"
                name="rememberPassword"
                type="checkbox"
                checked={form.rememberPassword}
                onChange={updateLoginPreference}
              />
            </label>
            <label className="toggle-row compact">
              <span>自动登录</span>
              <input
                data-testid="login-auto-login"
                name="autoLogin"
                type="checkbox"
                checked={form.autoLogin}
                onChange={updateLoginPreference}
              />
            </label>
          </div>
          {visibleError ? (
            <div className="callout warning">
              {formError ? <AlertTriangle size={16} /> : <WifiOff size={16} />}
              <span>
                <strong>{visibleError}</strong>
              </span>
            </div>
          ) : null}
          <div className="inline-actions wrap">
            <button className="btn btn-primary" type="submit" data-testid="login-submit" disabled={submitting}>
              <LogIn size={14} />
              {submitting ? "正在连接..." : "登录"}
            </button>
            <button className="btn" type="button" onClick={() => workspace.setLoginModalOpen(false)} disabled={submitting}>
              取消
            </button>
          </div>
        </form>
      </div>
      </div>
    </ModalFrame>
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
      <div className="inline-actions wrap">
        <button className={modal.tone === "danger" ? "btn btn-danger" : "btn btn-primary"} type="button" onClick={() => void modal.onConfirm?.()}>
          {modal.confirmLabel}
        </button>
        <button className="btn" type="button" onClick={ui.closeModal}>
          取消
        </button>
      </div>
    </ModalFrame>
  );
}

function ProgressModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const progress = workspace.progress;
  if (!progress || !ui.preferences.showInstallResults) return null;
  const steps = progressStepsForOperation(progress.operation);
  const currentIndex = Math.max(0, steps.findIndex((step) => progress.stage.includes(step)));
  const toneIcon = progress.result === "success" ? <CheckCircle2 size={18} /> : progress.result === "failed" ? <AlertTriangle size={18} /> : <Sparkles size={18} />;

  return (
    <ModalFrame title={progressTitle(progress)} eyebrow={progressEyebrow(progress.operation)} onClose={ui.closeModal} narrow>
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
        <button className="btn btn-primary" type="button" onClick={workspace.clearProgress}>
          知道了
        </button>
      ) : null}
    </ModalFrame>
  );
}

function TargetsModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const modal = ui.modal;
  if (modal.type !== "targets") return null;
  const skill = workspace.skills.find((item) => item.skillID === modal.skillID) ?? workspace.installedSkills.find((item) => item.skillID === modal.skillID);
  if (!skill) return null;
  const submitLabel = targetDraftSubmitLabel(ui.targetDrafts);

  return (
    <ModalFrame title={`${skill.displayName} v${skill.localVersion ?? skill.version}`} eyebrow="目标选择" onClose={ui.closeModal}>
      {skill.isScopeRestricted ? <div className="callout warning"><AlertTriangle size={16} /> 权限已收缩：可继续使用当前版本，但不可新增启用位置。</div> : null}
      <div className="target-grid">
        {ui.targetDrafts.map((draft) => (
          <label key={draft.key} className={draft.disabled ? "target-tile disabled" : "target-tile"}>
            <input type="checkbox" checked={draft.selected} disabled={draft.disabled} onChange={() => ui.toggleTargetDraft(draft.key)} />
            <span className="target-tile-copy">
              <span className="target-tile-head">
                <strong>{draft.targetName}</strong>
                <TagPill tone={draft.disabled ? "warning" : "success"}>{draft.availability.label}</TagPill>
              </span>
              <small className="target-path-text">{draft.targetPath || "未配置路径"}</small>
              <small>{draft.statusLabel}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="inline-actions wrap">
        <button className="btn btn-primary" type="button" onClick={() => void ui.applyTargetDrafts(skill)} disabled={skill.isScopeRestricted}>
          {submitLabel}
        </button>
        <button className="btn" type="button" onClick={() => ui.openToolEditor()}>
          <Plus size={14} />
          添加工具
        </button>
        <button className="btn" type="button" onClick={() => ui.openProjectEditor()}>
          <FolderPlus size={14} />
          添加项目
        </button>
      </div>
    </ModalFrame>
  );
}

function LocalImportModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const modal = ui.modal;
  const skill = modal.type === "local_import" ? workspace.discoveredLocalSkills.find((item) => item.skillID === modal.skillID) ?? null : null;
  const [finalSkillID, setFinalSkillID] = useState("");
  const [replaceArmed, setReplaceArmed] = useState(false);

  useEffect(() => {
    if (modal.type !== "local_import") return;
    const nextSkill = workspace.discoveredLocalSkills.find((item) => item.skillID === modal.skillID) ?? null;
    setFinalSkillID(nextSkill?.suggestedSkillID ?? nextSkill?.skillID ?? "");
    setReplaceArmed(false);
  }, [modal, workspace.discoveredLocalSkills]);

  if (modal.type !== "local_import" || !skill) return null;

  const hasConflict = skill.hasCentralStoreConflict || skill.hasScanConflict;
  const idValid = /^[a-z0-9][a-z0-9_-]*$/.test(finalSkillID);
  const sourceLines = skill.targets.map((target) => `${target.targetName} · ${target.targetPath}`);

  async function importWith(strategy: "rename" | "replace", skillID: string) {
    ui.closeModal();
    await workspace.importLocalSkill(skill!, skillID, strategy);
    workspace.selectSkill(skillID);
  }

  return (
    <ModalFrame title={`纳入管理：${skill.displayName}`} eyebrow="本地托管" onClose={ui.closeModal}>
      <div className={hasConflict ? "callout warning" : "callout info"}>
        {hasConflict ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
        {hasConflict ? "检测到同名或多来源冲突，推荐重命名后导入。" : "会复制到本机 Central Store，并认领当前来源路径为已启用目标。"}
      </div>
      <div className="definition-grid split">
        <div><dt>扫描 ID</dt><dd>{skill.skillID}</dd></div>
        <div><dt>本地版本</dt><dd>{skill.version}</dd></div>
        <div><dt>来源数</dt><dd>{skill.targets.length}</dd></div>
        <div><dt>同步策略</dt><dd>仅本机，不上传服务器</dd></div>
      </div>
      <label className="field">
        <span>导入后的 skillID</span>
        <input value={finalSkillID} onChange={(event) => setFinalSkillID(event.target.value.trim())} />
      </label>
      {!idValid ? <div className="callout warning"><AlertTriangle size={16} /> skillID 只能使用小写字母、数字、连字符或下划线，并且不能以符号开头。</div> : null}
      <div className="detail-block">
        <h3>将认领的来源路径</h3>
        <div className="stack-list compact">
          {sourceLines.map((line) => <small key={line}>{line}</small>)}
        </div>
      </div>
      {replaceArmed ? (
        <div className="callout warning">
          <AlertTriangle size={16} />
          确认替换会覆盖 Central Store 中同名本地副本。已有启用目标不会上传服务器，但后续卸载会按托管目标清理。
        </div>
      ) : null}
      <div className="inline-actions wrap">
        <button className="btn btn-primary" type="button" disabled={!idValid} onClick={() => void importWith("rename", finalSkillID)}>
          {hasConflict ? "重命名导入" : "纳入管理"}
        </button>
        {hasConflict ? (
          <>
            <button className="btn" type="button" onClick={ui.closeModal}>
              保留现有
            </button>
            <button
              className={replaceArmed ? "btn btn-danger" : "btn"}
              type="button"
              onClick={() => {
                if (!replaceArmed) {
                  setFinalSkillID(skill.skillID);
                  setReplaceArmed(true);
                  return;
                }
                void importWith("replace", skill.skillID);
              }}
            >
              {replaceArmed ? "确认替换本地" : "用扫描副本替换"}
            </button>
          </>
        ) : null}
      </div>
    </ModalFrame>
  );
}

function ToolEditorModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
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
  const currentTool = ui.toolDraft.toolID ? workspace.tools.find((tool) => tool.toolID === ui.toolDraft.toolID) ?? null : null;
  const draftToolID = ui.toolDraft.toolID ?? "custom_directory";
  const configPlaceholder = customDirectory ? "例如 ~/.codex/config.json" : defaultToolConfigPath(draftToolID);
  const skillsPlaceholder = customDirectory ? "例如 ~/.codex/skills" : defaultToolSkillsPath(draftToolID);

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
        <div className="inline-actions wrap">
          <button className="btn btn-primary" type="submit">{editing ? "保存工具配置" : "保存自定义目录"}</button>
          {currentTool && editing ? (
            <button
              className="btn btn-danger"
              type="button"
              disabled={currentTool.enabledSkillCount > 0 || (currentTool.toolID === "custom_directory" && !currentTool.configuredPath && !currentTool.skillsPath.trim())}
              onClick={() => ui.confirmDeleteToolConfig(currentTool.toolID)}
            >
              {currentTool.toolID === "custom_directory" ? "清空配置" : "恢复默认"}
            </button>
          ) : null}
          <button className="btn" type="button" onClick={ui.closeModal}>取消</button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ProjectEditorModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  if (ui.modal.type !== "project_editor") return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ui.submitProjectDraft();
  }

  const editing = Boolean(ui.projectDraft.projectID);
  const currentProject = ui.projectDraft.projectID ? workspace.projects.find((project) => project.projectID === ui.projectDraft.projectID) ?? null : null;
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
        <button className="btn btn-small" type="button" onClick={() => void ui.pickProjectDirectoryForDraft()}>
          <FolderPlus size={14} />
          选择文件夹
        </button>
        <label className="field">
          <span>skills 安装路径</span>
          <input value={ui.projectDraft.skillsPath} onChange={(event) => ui.setProjectDraft((current) => ({ ...current, skillsPath: event.target.value }))} placeholder={skillsPlaceholder} />
        </label>
        <label className="toggle-row">
          <span>启用项目级配置</span>
          <input type="checkbox" checked={ui.projectDraft.enabled} onChange={(event) => ui.setProjectDraft((current) => ({ ...current, enabled: event.target.checked }))} />
        </label>
        <div className="inline-actions wrap">
          <button className="btn btn-primary" type="submit">{editing ? "保存项目" : "添加项目"}</button>
          {currentProject ? (
            <button
              className="btn btn-danger"
              type="button"
              disabled={currentProject.enabledSkillCount > 0}
              onClick={() => ui.confirmDeleteProjectConfig(currentProject.projectID)}
            >
              删除项目
            </button>
          ) : null}
          <button className="btn" type="button" onClick={ui.closeModal}>取消</button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ConnectionStatusModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    nextPassword: "",
    confirmPassword: ""
  });
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ tone: "success" | "warning"; message: string } | null>(null);

  useEffect(() => {
    if (ui.modal.type !== "connection_status") {
      setPasswordForm({
        currentPassword: "",
        nextPassword: "",
        confirmPassword: ""
      });
      setSubmittingPassword(false);
      setPasswordFeedback(null);
    }
  }, [ui.modal.type]);

  if (ui.modal.type !== "connection_status") return null;
  const status = workspace.bootstrap.connection.status;
  const roleText = roleLabel(workspace.currentUser, ui.language);
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
  const statusToneClass = status === "connected" ? "success" : status === "connecting" ? "info" : "warning";
  const adminLevelLabel = workspace.currentUser.adminLevel ? `L${workspace.currentUser.adminLevel}` : "-";
  const serviceTime = workspace.bootstrap.connection.serverTime ? formatDate(workspace.bootstrap.connection.serverTime, ui.language) : "-";
  const nextPasswordError = passwordForm.nextPassword.trim() ? validatePasswordPolicy(passwordForm.nextPassword) : null;
  const passwordMismatch =
    passwordForm.confirmPassword.length > 0 && passwordForm.nextPassword !== passwordForm.confirmPassword;
  const canSubmitPassword = Boolean(
    workspace.loggedIn &&
    passwordForm.currentPassword.trim() &&
    passwordForm.nextPassword.trim() &&
    passwordForm.confirmPassword.trim() &&
    !nextPasswordError &&
    !passwordMismatch
  );

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitPassword || submittingPassword) return;
    setSubmittingPassword(true);
    setPasswordFeedback(null);
    const result = await workspace.changeOwnPassword({
      currentPassword: passwordForm.currentPassword,
      nextPassword: passwordForm.nextPassword.trim()
    });
    setSubmittingPassword(false);
    if (!result.ok) {
      setPasswordFeedback({
        tone: "warning",
        message: result.error
      });
      return;
    }
    setPasswordForm({
      currentPassword: "",
      nextPassword: "",
      confirmPassword: ""
    });
    setPasswordFeedback({
      tone: "success",
      message: "密码已更新，当前登录保持有效，其他会话已失效。"
    });
  }

  return (
    <ModalFrame title="我的信息" eyebrow="账号概览" onClose={ui.closeModal} narrow>
      <div className="account-profile-panel">
        <InitialBadge label={workspace.currentUser.username} large className="account-profile-avatar" />
        <div className="account-profile-copy">
          <div className="eyebrow">当前身份</div>
          <h3>{workspace.currentUser.username}</h3>
          <p>{roleText}</p>
          <div className="pill-row">
            <TagPill tone={statusToneClass}>{statusText}</TagPill>
            <TagPill tone="neutral">{workspace.currentUser.departmentName}</TagPill>
          </div>
        </div>
      </div>
      <div className="account-info-grid">
        <div className="account-info-item"><span>用户名称</span><strong>{workspace.currentUser.username}</strong></div>
        <div className="account-info-item"><span>手机号</span><strong>{workspace.currentUser.phoneNumber || "-"}</strong></div>
        <div className="account-info-item"><span>所属部门</span><strong>{workspace.currentUser.departmentName}</strong></div>
        <div className="account-info-item"><span>权限角色</span><strong>{roleText}</strong></div>
        <div className="account-info-item"><span>管理级别</span><strong>{adminLevelLabel}</strong></div>
      </div>
      <div className="account-service-panel">
        <div className="account-service-head">
          <span>
            {status === "connected" ? <CheckCircle2 size={16} /> : <WifiOff size={16} />}
            服务状态
          </span>
          <TagPill tone={statusToneClass}>{statusText}</TagPill>
        </div>
        <div className="definition-grid compact">
          <div><dt>API 版本</dt><dd>{workspace.bootstrap.connection.apiVersion || "-"}</dd></div>
          <div><dt>服务端时间</dt><dd>{serviceTime}</dd></div>
          <div><dt>最近错误</dt><dd>{workspace.bootstrap.connection.lastError ?? "暂无最近错误"}</dd></div>
          <div><dt>界面语言</dt><dd>{workspace.currentUser.locale}</dd></div>
        </div>
      </div>
      {workspace.loggedIn ? (
        <div className="detail-block inspector-subsection">
          <h3>修改密码</h3>
          <form className="form-stack compact" onSubmit={submitPasswordChange}>
            <label className="field"><span>当前密码</span><input value={passwordForm.currentPassword} type="password" autoComplete="current-password" onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
            <label className="field"><span>新密码</span><input value={passwordForm.nextPassword} type="password" autoComplete="new-password" onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))} /></label>
            <label className="field"><span>确认新密码</span><input value={passwordForm.confirmPassword} type="password" autoComplete="new-password" onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
            <small className={passwordFeedback?.tone === "warning" || passwordMismatch || nextPasswordError ? "field-hint warning" : passwordFeedback?.tone === "success" ? "field-hint success" : "field-hint"}>
              {passwordFeedback?.message ?? (passwordMismatch ? "两次输入的新密码不一致。" : nextPasswordError ?? passwordPolicyHint)}
            </small>
            <button className="btn btn-primary" type="submit" disabled={!canSubmitPassword || submittingPassword}>
              {submittingPassword ? "正在保存..." : "保存新密码"}
            </button>
          </form>
        </div>
      ) : null}
      <div className="inline-actions wrap">
        {workspace.loggedIn ? (
          <button className="btn btn-primary" type="button" onClick={() => void workspace.refreshBootstrap()}>
            <RefreshCw size={14} />
            刷新信息
          </button>
        ) : (
          <button className="btn btn-primary" type="button" onClick={() => { ui.closeModal(); workspace.requireAuth(null); }}>
            登录同步
          </button>
        )}
        <button className="btn" type="button" onClick={ui.closeModal}>关闭</button>
      </div>
    </ModalFrame>
  );
}

function AppUpdateModal({ ui }: { ui: DesktopUIState }) {
  if (ui.modal.type !== "app_update") return null;

  return (
    <ModalFrame title="软件更新" eyebrow="桌面客户端" onClose={ui.closeModal} narrow>
      <div className={ui.appUpdate.blocking ? "callout danger" : "callout info"}>
        <Download size={16} />
        <span>
          <strong>{ui.appUpdate.blocking ? "当前版本需要先升级" : `发现新版本 ${ui.appUpdate.latestVersion}`}</strong>
          <small>{ui.appUpdate.summary}</small>
        </span>
      </div>
      <div className="definition-grid">
        <div><dt>当前版本</dt><dd>{ui.appUpdate.currentVersion}</dd></div>
        <div><dt>最新版本</dt><dd>{ui.appUpdate.latestVersion}</dd></div>
        <div><dt>发布 ID</dt><dd>{ui.appUpdate.releaseID ?? "待服务端提供"}</dd></div>
        <div><dt>发布时间</dt><dd>{ui.appUpdate.publishedAt ? formatDate(ui.appUpdate.publishedAt, ui.language) : "待服务端提供"}</dd></div>
      </div>
      <div className="stack-list compact">
        {ui.appUpdate.highlights.map((highlight) => (
          <small key={highlight}>{highlight}</small>
        ))}
      </div>
      {ui.appUpdate.lastError ? (
        <div className="callout warning">
          <AlertTriangle size={16} />
          <span>
            <strong>最近一次检查失败</strong>
            <small>{ui.appUpdate.lastError}</small>
          </span>
        </div>
      ) : null}
      <div className="inline-actions wrap">
        <button className="btn btn-primary" type="button" onClick={() => void ui.viewAppUpdate()} disabled={ui.appUpdate.checking}>
          {ui.appUpdate.actionLabel}
        </button>
        <button className="btn" type="button" onClick={() => void ui.recheckAppUpdate()} disabled={ui.appUpdate.checking}>
          <RefreshCw size={14} />
          重新检查
        </button>
        {ui.appUpdate.blocking ? (
          <button className="btn" type="button" onClick={ui.closeModal}>关闭</button>
        ) : (
          <button className="btn" type="button" onClick={() => void ui.dismissOptionalAppUpdate().then(ui.closeModal)}>稍后提醒</button>
        )}
      </div>
    </ModalFrame>
  );
}

type SettingsPanelID = "general" | "agent" | "local" | "sync" | "about";

const defaultAgentBaseURLs: Record<PreferenceState["agentProvider"], string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  custom: ""
};

function agentProviderLabel(provider: PreferenceState["agentProvider"]) {
  return {
    openai: "OpenAI",
    anthropic: "Anthropic",
    custom: "自定义"
  }[provider];
}

function SettingsModal({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const [activePanel, setActivePanel] = useState<SettingsPanelID>("general");
  if (ui.modal.type !== "settings") return null;

  const themeOptions = [
    { value: "classic", description: localize(ui.language, "冷白背景，保持企业工作台的标准对比。", "Cool white background with standard enterprise workspace contrast.") },
    { value: "dark", description: localize(ui.language, "深色全局界面，适合低光环境和长时间工作。", "A global dark interface for low-light and long-session work.") }
  ] as const;
  const knownAgentBaseURLs = Object.values(defaultAgentBaseURLs).filter(Boolean);
  const hasAgentKey = ui.preferences.agentApiKey.trim().length > 0;
  const settingsPanels = buildSettingsPanels({
    language: ui.language,
    theme: ui.preferences.theme,
    hasAgentKey,
    connectionStatus: workspace.bootstrap.connection.status,
    appUpdate: ui.appUpdate
  });
  const activePanelMeta = settingsPanels.find((panel) => panel.id === activePanel) ?? settingsPanels[0];
  const agentBaseURL = ui.preferences.agentBaseURL || defaultAgentBaseURLs[ui.preferences.agentProvider];
  const updateStatus = ui.appUpdate.blocking
    ? `${ui.appUpdate.reasonBadge ?? "需要升级"} · v${ui.appUpdate.latestVersion}`
    : ui.appUpdate.available
      ? `可更新到 ${ui.appUpdate.latestVersion}`
      : "已是最新版本";
  const connectedServerAddress = connectedServiceURL({
    connectionStatus: workspace.bootstrap.connection.status,
    apiBaseURL: workspace.apiBaseURL
  });

  return (
    <ModalFrame title={localize(ui.language, "设置", "Settings")} eyebrow={localize(ui.language, "基础偏好", "Preferences")} onClose={ui.closeModal} panelClassName="settings-modal-panel">
      <div className="settings-shell">
        <nav className="settings-sidebar" aria-label="设置列表">
          {settingsPanels.map((panel) => (
            <button
              key={panel.id}
              className={activePanel === panel.id ? "settings-nav-item active" : "settings-nav-item"}
              type="button"
              onClick={() => setActivePanel(panel.id)}
            >
              <span>
                <strong>{panel.title}</strong>
                <small>{panel.description}</small>
              </span>
              <em>{panel.status}</em>
            </button>
          ))}
        </nav>
        <section className="settings-detail" aria-label={activePanelMeta.title}>
          <div className="settings-detail-head">
            <div>
              <div className="eyebrow">{activePanelMeta.description}</div>
              <h3>{activePanelMeta.title}</h3>
            </div>
            <span className="pill tone-neutral">{activePanelMeta.status}</span>
          </div>

          <div className="settings-detail-scroll">
          {activePanel === "general" ? (
            <div className="settings-panel-stack">
              <SelectField
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
              <div>
                <span className="settings-inline-label">{localize(ui.language, "界面主题", "Theme")}</span>
                <div className="settings-choice-grid compact">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      className={ui.preferences.theme === option.value ? "settings-choice active" : "settings-choice"}
                      type="button"
                      onClick={() => ui.setPreferences((current) => ({ ...current, theme: option.value }))}
                    >
                      <strong>{themeLabel(option.value, ui.language)}</strong>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activePanel === "agent" ? (
            <div className="settings-panel-stack">
              <div className="callout info">
                <Sparkles size={16} />
                <span>
                  <strong>先准备 Agent 调用所需凭据。</strong>
                  <small>当前只保存本机配置，后续接入真实 Agent 执行链路时会迁移到更安全的密钥存储。</small>
                </span>
              </div>
              <SelectField
                label="模型服务"
                value={ui.preferences.agentProvider}
                onChange={(value) =>
                  ui.setPreferences((current) => {
                    const nextProvider = value as PreferenceState["agentProvider"];
                    const shouldUseDefaultBase = !current.agentBaseURL || knownAgentBaseURLs.includes(current.agentBaseURL);
                    return {
                      ...current,
                      agentProvider: nextProvider,
                      agentBaseURL: shouldUseDefaultBase ? defaultAgentBaseURLs[nextProvider] : current.agentBaseURL
                    };
                  })
                }
                options={[
                  { value: "openai", label: "OpenAI" },
                  { value: "anthropic", label: "Anthropic" },
                  { value: "custom", label: "自定义兼容服务" }
                ]}
              />
              <label className="field">
                <span>API Key</span>
                <input
                  type="password"
                  value={ui.preferences.agentApiKey}
                  placeholder="sk-..."
                  autoComplete="off"
                  onChange={(event) => ui.setPreferences((current) => ({ ...current, agentApiKey: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Base URL</span>
                <input
                  type="url"
                  value={agentBaseURL}
                  placeholder="https://api.example.com/v1"
                  onChange={(event) => ui.setPreferences((current) => ({ ...current, agentBaseURL: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>默认模型</span>
                <input
                  type="text"
                  value={ui.preferences.agentDefaultModel}
                  placeholder="gpt-5.4"
                  onChange={(event) => ui.setPreferences((current) => ({ ...current, agentDefaultModel: event.target.value }))}
                />
              </label>
              <div className="settings-meta-row">
                <span>{agentProviderLabel(ui.preferences.agentProvider)}</span>
                <small>{hasAgentKey ? "API Key 已保存，可用于后续 Agent 接入。" : "尚未填写 API Key。"}</small>
              </div>
              <div className="inline-actions wrap">
                <button className="btn" type="button" onClick={() => ui.setPreferences((current) => ({ ...current, agentApiKey: "" }))} disabled={!hasAgentKey}>
                  清除 Key
                </button>
              </div>
            </div>
          ) : null}

          {activePanel === "local" ? (
            <div className="settings-panel-stack">
              <div className="settings-meta-row">
                <span>Central Store</span>
                <p className="settings-path">{workspace.localCentralStorePath || previewCentralStorePath()}</p>
              </div>
              <div className="settings-meta-row">
                <span>企业服务地址</span>
                <p className="settings-path">{workspace.apiBaseURL}</p>
              </div>
              <div className="settings-meta-row">
                <span>连接状态</span>
                <small>{workspace.bootstrap.connection.status === "connected" ? `已连接 · API ${workspace.bootstrap.connection.apiVersion}` : workspace.bootstrap.connection.lastError ?? "离线，本地能力仍可使用。"}</small>
              </div>
              <small>工具路径、项目路径和启用范围继续在“本地”页维护，设置里只保留环境概览。</small>
              <div className="inline-actions wrap">
                <button className="btn" type="button" onClick={() => void workspace.refreshBootstrap()}>
                  <RefreshCw size={14} />
                  刷新连接状态
                </button>
              </div>
            </div>
          ) : null}

          {activePanel === "sync" ? (
            <div className="settings-panel-stack">
              <label className="toggle-row compact">
                <span>{localize(ui.language, "显示安装/更新结果", "Show Install and Update Results")}</span>
                <input type="checkbox" checked={ui.preferences.showInstallResults} onChange={(event) => ui.setPreferences((current) => ({ ...current, showInstallResults: event.target.checked }))} />
              </label>
              <label className="toggle-row compact">
                <span>{localize(ui.language, "同步本地事件到通知", "Sync Local Events into Notifications")}</span>
                <input type="checkbox" checked={ui.preferences.syncLocalEvents} onChange={(event) => ui.setPreferences((current) => ({ ...current, syncLocalEvents: event.target.checked }))} />
              </label>
              <div className="settings-meta-row">
                <span>客户端更新</span>
                <small>{updateStatus}</small>
              </div>
              {ui.appUpdate.reasonBadge ? (
                <div className="settings-meta-row">
                  <span>限制原因</span>
                  <small>{ui.appUpdate.reasonBadge}</small>
                </div>
              ) : null}
              {ui.appUpdate.available ? (
                <div className={ui.appUpdate.blocking ? "callout danger" : "callout info"}>
                  <Download size={16} />
                  <span>
                    <strong>{ui.appUpdate.blocking ? "当前版本需要先升级" : `发现新版本 ${ui.appUpdate.latestVersion}`}</strong>
                    <small>{ui.appUpdate.releaseID ? `发布 ${ui.appUpdate.releaseID} · ${ui.appUpdate.summary}` : ui.appUpdate.summary}</small>
                  </span>
                </div>
              ) : null}
              {ui.appUpdate.lastError ? (
                <div className="callout warning">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>最近一次检查失败</strong>
                    <small>{ui.appUpdate.lastError}</small>
                  </span>
                </div>
              ) : null}
              <div className="inline-actions wrap">
                <button className="btn btn-primary" type="button" onClick={ui.openAppUpdateModal} disabled={!ui.appUpdate.available}>
                  查看更新
                </button>
                <button className="btn" type="button" onClick={() => void ui.recheckAppUpdate()} disabled={ui.appUpdate.checking}>
                  <RefreshCw size={14} />
                  重新检查
                </button>
                <button className="btn" type="button" onClick={() => void workspace.refreshBootstrap()}>
                  <RefreshCw size={14} />
                  刷新启动上下文
                </button>
              </div>
            </div>
          ) : null}

          {activePanel === "about" ? (
            <div className="settings-panel-stack">
              <section className="settings-about-hero">
                <div>
                  <div className="eyebrow">Enterprise Agent Hub</div>
                  <h4>Desktop Skills Workspace</h4>
                  <p>统一承载本地 Skill、社区浏览、管理能力与桌面更新的企业桌面工作台。</p>
                </div>
                <span className="pill tone-info">v{ui.appUpdate.currentVersion}</span>
              </section>
              <section className="settings-about-hero">
                <div>
                  <div className="eyebrow">问题反馈</div>
                  <h4>聊天工具联系 Zhanghaibin</h4>
                  <p>遇到问题或有改进建议时，请通过聊天工具反馈。</p>
                </div>
              </section>
              <div className="settings-about-grid">
                <article className="settings-about-card">
                  <span>软件名称</span>
                  <strong>Enterprise Agent Hub</strong>
                  <small>Desktop Skills Workspace</small>
                </article>
                <article className="settings-about-card">
                  <span>当前版本</span>
                  <strong>v{ui.appUpdate.currentVersion}</strong>
                  <small>
                    {ui.appUpdate.available
                      ? `${ui.appUpdate.releaseID ? `发布 ${ui.appUpdate.releaseID} · ` : ""}可更新到 v${ui.appUpdate.latestVersion}`
                      : "当前已是最新版本"}
                  </small>
                </article>
                <article className="settings-about-card">
                  <span>运行模式</span>
                  <strong>{workspace.loggedIn ? "企业服务连接" : "本地工作台"}</strong>
                  <small>{workspace.loggedIn ? "已支持身份同步、通知与管理权限。" : "未登录时仍可使用本地设置与离线能力。"}</small>
                </article>
                {connectedServerAddress ? (
                  <article className="settings-about-card">
                    <span>服务地址</span>
                    <strong className="settings-path-strong">{connectedServerAddress}</strong>
                    <small>当前正式连接到该企业服务地址。</small>
                  </article>
                ) : null}
              </div>
              <div className="settings-link-row">
                <div>
                  <span>GitHub</span>
                  <strong className="settings-path-strong">{ENTERPRISE_AGENT_HUB_GITHUB_URL}</strong>
                  <small>项目源码与协作入口</small>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    void openExternalURL(ENTERPRISE_AGENT_HUB_GITHUB_URL).catch((error) => {
                      console.error("open github url failed", error);
                    });
                  }}
                >
                  打开仓库
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ) : null}
          </div>
        </section>
      </div>
    </ModalFrame>
  );
}

function managementSkillStatusLabel(status: string) {
  return {
    published: "已上架",
    delisted: "已下架",
    archived: "已归档"
  }[status] ?? status;
}

function riskToneClass(risk: string | null | undefined): "success" | "warning" | "danger" | "info" | "neutral" {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "low") return "success";
  return "neutral";
}

function fallbackRiskLabel(risk: string, language: DesktopUIState["language"]) {
  return language === "en-US"
    ? { low: "Low", medium: "Medium", high: "High", unknown: "Unknown" }[risk] ?? risk
    : { low: "低", medium: "中", high: "高", unknown: "未知" }[risk] ?? risk;
}

function fallbackSkillDetail(input: {
  adminSkill?: AdminSkill;
  publisherSkill?: PublisherSkillSummary;
  selectedSubmission?: P1WorkspaceState["publisherData"]["selectedPublisherSubmission"];
  language: DesktopUIState["language"];
}) {
  if (input.adminSkill) {
    const skill = input.adminSkill;
    return {
      displayName: skill.displayName,
      skillID: skill.skillID,
      description: skill.description,
      statusLabel: managementSkillStatusLabel(skill.status),
      statusTone: skill.status === "published" ? "success" as const : skill.status === "delisted" ? "warning" as const : "neutral" as const,
      category: skill.category ?? "未分类",
      risk: skill.currentVersionRiskLevel,
      version: skill.version,
      owner: skill.publisherName,
      department: skill.departmentName,
      visibility: publishVisibilityLabel(skill.visibilityLevel, input.language),
      updatedAt: skill.updatedAt,
      metrics: [`Star ${skill.starCount}`, `下载 ${skill.downloadCount}`],
      summary: skill.currentVersionReviewSummary ?? "当前版本暂无审核摘要。",
      sourceLabel: "该详情来自管理 Skill 列表。"
    };
  }

  if (input.publisherSkill) {
    const skill = input.publisherSkill;
    const submission = input.selectedSubmission?.skillID === skill.skillID ? input.selectedSubmission : null;
    const stateLabel = skill.latestWorkflowState
      ? workflowStateLabel(skill.latestWorkflowState, input.language)
      : skill.currentStatus
        ? managementSkillStatusLabel(skill.currentStatus)
        : "暂无提交";
    const visibility = skill.currentVisibilityLevel ?? skill.latestRequestedVisibilityLevel ?? submission?.visibilityLevel;
    const scope = skill.currentScopeType ?? skill.latestRequestedScopeType ?? submission?.scopeType;
    return {
      displayName: skill.displayName,
      skillID: skill.skillID,
      description: submission?.description ?? skill.latestReviewSummary ?? "该 Skill 当前保留作者工作台摘要，可从社区-我的查看提交包与审核结果。",
      statusLabel: stateLabel,
      statusTone: skill.latestWorkflowState === "published" || skill.currentStatus === "published" ? "success" as const : "info" as const,
      category: submissionTypeLabel(skill.latestSubmissionType ?? submission?.submissionType ?? "publish", input.language),
      risk: null,
      version: skill.currentVersion ?? skill.latestRequestedVersion ?? submission?.version ?? "未发布",
      owner: "当前账号",
      department: "",
      visibility: visibility ? publishVisibilityLabel(visibility, input.language) : "未设置",
      updatedAt: skill.updatedAt,
      metrics: [scope ? scopeLabel(scope, input.language) : "未设置", skill.submittedAt ? formatDate(skill.submittedAt, input.language) : "暂无提交"],
      summary: skill.latestReviewSummary ?? submission?.reviewSummary ?? "当前发布记录可继续查看详情、发起新版本或调整权限。",
      sourceLabel: "该详情来自社区作者工作台。"
    };
  }

  return null;
}

function skillDetailHead({
  displayName,
  eyebrow,
  meta,
  description,
  tags
}: {
  displayName: string;
  eyebrow: string;
  meta: string;
  description: string;
  tags: React.ReactNode;
}) {
  return (
    <div className="skill-detail-head-main">
      <InitialBadge label={displayName} large />
      <div className="skill-detail-head-copy">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{displayName}</h2>
        <p>{description}</p>
        <small>{meta}</small>
        <div className="pill-row">{tags}</div>
      </div>
    </div>
  );
}

function skillDetailActions({
  skill,
  workspace,
  ui
}: {
  skill: SkillSummary;
  workspace: P1WorkspaceState;
  ui: DesktopUIState;
}) {
  return (
    <div className="skill-detail-action-bar">
      {skill.installState === "not_installed" ? (
        <button className="btn btn-primary" type="button" onClick={() => ui.openInstallConfirm(skill, "install")}>安装</button>
      ) : null}
      {skill.installState === "update_available" ? (
        <button className="btn btn-primary" type="button" onClick={() => ui.openInstallConfirm(skill, "update")}>更新</button>
      ) : null}
      {skill.localVersion ? (
        <button className="btn" type="button" onClick={() => ui.openTargetsModal(skill)}>启用范围</button>
      ) : null}
      <button className="btn" type="button" onClick={() => void workspace.toggleStar(skill.skillID)}>
        {skill.starred ? "取消收藏" : "收藏"}
      </button>
    </div>
  );
}

function skillVersionHistory(skill: SkillSummary): NonNullable<SkillSummary["versions"]> {
  const versions = [...(skill.versions ?? [])];
  if (!versions.some((version) => version.version === skill.version)) {
    versions.push({
      version: skill.version,
      publishedAt: skill.currentVersionUpdatedAt,
      changelog: skill.reviewSummary ?? undefined,
      riskLevel: skill.riskLevel
    });
  }
  return versions.sort((left, right) => {
    const rightTime = Date.parse(right.publishedAt);
    const leftTime = Date.parse(left.publishedAt);
    if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return right.version.localeCompare(left.version, undefined, { numeric: true, sensitivity: "base" });
  });
}

function SkillDetailOverlay({ workspace, ui, overlay }: { workspace: P1WorkspaceState; ui: DesktopUIState; overlay: OverlayState }) {
  if (overlay.kind !== "skill_detail") return null;
  const skill =
    workspace.skills.find((item) => item.skillID === overlay.skillID) ??
    workspace.installedSkills.find((item) => item.skillID === overlay.skillID) ??
    (workspace.selectedSkill?.skillID === overlay.skillID ? workspace.selectedSkill : null);
  const fallback = skill ? null : fallbackSkillDetail({
    adminSkill: workspace.adminData.adminSkills.find((item) => item.skillID === overlay.skillID),
    publisherSkill: workspace.publisherData.publisherSkills.find((item) => item.skillID === overlay.skillID),
    selectedSubmission: workspace.publisherData.selectedPublisherSubmission,
    language: ui.language
  });
  if (!skill && !fallback) return null;

  if (!skill && fallback) {
    return (
      <ModalFrame
        title={fallback.displayName}
        eyebrow="Skill 详情"
        onClose={ui.closeOverlay}
        full
        panelClassName="skill-detail-modal"
        headerContent={skillDetailHead({
          displayName: fallback.displayName,
          eyebrow: "Skill 详情",
          description: fallback.description,
          meta: `${fallback.skillID} · ${fallback.owner}${fallback.department ? ` · ${fallback.department}` : ""}`,
          tags: (
            <>
              <TagPill tone={fallback.statusTone}>{fallback.statusLabel}</TagPill>
              {fallback.risk ? <TagPill tone={riskToneClass(fallback.risk)}>{fallbackRiskLabel(fallback.risk, ui.language)}</TagPill> : null}
              <TagPill tone="neutral">{fallback.category}</TagPill>
            </>
          )
        })}
      >
        <div className="skill-detail-page">
          <section className="skill-detail-section">
            <div className="definition-grid split">
              <div><dt>版本</dt><dd>{fallback.version}</dd></div>
              <div><dt>公开级别</dt><dd>{fallback.visibility}</dd></div>
              <div><dt>指标</dt><dd>{fallback.metrics.join(" · ")}</dd></div>
              <div><dt>最近更新</dt><dd>{formatDate(fallback.updatedAt, ui.language)}</dd></div>
            </div>
          </section>
          <section className="skill-detail-section">
            <div className="detail-column-head">
              <h3>当前摘要</h3>
            </div>
            <p>{fallback.summary}</p>
            <small>{fallback.sourceLabel}</small>
          </section>
        </div>
      </ModalFrame>
    );
  }
  if (!skill) return null;

  const versions = skillVersionHistory(skill);
  const readme = skill.readme?.trim();
  const reviewText = skill.reviewSummary ?? "当前版本已准备就绪。";
  const riskText = skill.riskDescription ?? "暂无额外风险说明。";

  return (
    <ModalFrame
      title={skill.displayName}
      eyebrow="Skill 详情"
      onClose={ui.closeOverlay}
      full
      panelClassName="skill-detail-modal"
      headerContent={skillDetailHead({
        displayName: skill.displayName,
        eyebrow: "Skill 详情",
        description: skill.description,
        meta: `${skill.skillID} · ${skill.authorName ?? "未知作者"} · ${skill.authorDepartment ?? "未标注部门"}`,
        tags: (
          <>
            <TagPill tone={statusTone(skill)}>{statusLabel(skill, ui.language)}</TagPill>
            <TagPill tone={riskToneClass(skill.riskLevel)}>{riskLabel(skill, ui.language)}</TagPill>
            <TagPill tone="neutral">{skill.category}</TagPill>
          </>
        )
      })}
      headActions={skillDetailActions({ skill, workspace, ui })}
    >
      <div className="skill-detail-page">
        <section className="skill-detail-section">
          <div className="definition-grid split skill-detail-meta-grid">
            <div><dt>当前版本</dt><dd>v{skill.version}</dd></div>
            <div><dt>本地版本</dt><dd>{skill.localVersion ? `v${skill.localVersion}` : "未安装"}</dd></div>
            <div><dt>Star</dt><dd>{skill.starCount}</dd></div>
            <div><dt>下载量</dt><dd>{skill.downloadCount}</dd></div>
            <div><dt>最近更新</dt><dd>{formatDate(skill.currentVersionUpdatedAt, ui.language)}</dd></div>
            <div><dt>公开级别</dt><dd>{publishVisibilityLabel(skill.visibilityLevel, ui.language)}</dd></div>
          </div>
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>兼容与状态</h3>
          </div>
          <div className="skill-detail-tag-group">
            <div className="pill-row">
              {skill.compatibleTools.map((tool) => <TagPill key={tool} tone="info">{tool}</TagPill>)}
              {skill.compatibleSystems.map((system) => <TagPill key={system} tone="neutral">{system}</TagPill>)}
            </div>
            {skill.tags.length > 0 ? (
              <div className="pill-row">
                {skill.tags.map((tag) => <TagPill key={tag} tone="neutral">{tag}</TagPill>)}
              </div>
            ) : null}
          </div>
          <div className="skill-detail-note-grid">
            <div>
              <strong>审核摘要</strong>
              <p>{reviewText}</p>
            </div>
            <div>
              <strong>风险说明</strong>
              <p>{riskText}</p>
            </div>
          </div>
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>已启用位置</h3>
          </div>
          {skill.enabledTargets.length === 0 ? <p className="muted-copy">当前还没有启用位置。</p> : null}
          <div className="stack-list compact">
            {skill.enabledTargets.map((target) => (
              <div className="micro-row" key={`${target.targetType}:${target.targetID}`}>
                <strong>{target.targetName}</strong>
                <small>{target.targetPath}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>版本历史</h3>
          </div>
          <div className="version-history-list">
            {versions.map((version) => {
              const isCurrent = version.version === skill.version;
              const risk = version.riskLevel ?? "unknown";
              return (
                <article className="version-history-row" key={`${version.version}:${version.publishedAt}`}>
                  <div className="version-history-row-head">
                    <div>
                      <strong>v{version.version}</strong>
                      <small>{formatDate(version.publishedAt, ui.language)}</small>
                    </div>
                    <div className="pill-row">
                      {isCurrent ? <TagPill tone="success">当前版本</TagPill> : null}
                      <TagPill tone={riskToneClass(risk)}>{fallbackRiskLabel(risk, ui.language)}</TagPill>
                    </div>
                  </div>
                  <p>{version.changelog ?? (isCurrent ? reviewText : "暂无变更说明。")}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="skill-detail-section skill-readme-section">
          <div className="detail-column-head">
            <h3>README.md</h3>
          </div>
          {readme ? (
            <article className="markdown-preview skill-readme-body" dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(readme) }} />
          ) : (
            <SectionEmpty title="暂无 README.md" body="发布包中没有可展示的 README.md。" />
          )}
        </section>
      </div>
    </ModalFrame>
  );
}

function reviewStatusTone(review: Pick<ReviewDetail, "reviewStatus">): "success" | "warning" | "danger" | "info" | "neutral" {
  if (review.reviewStatus === "reviewed") return "success";
  if (review.reviewStatus === "in_review") return "warning";
  return "info";
}

function reviewRiskText(risk: string, language: DesktopUIState["language"]) {
  const label = fallbackRiskLabel(risk, language);
  return language === "en-US" ? `${label} Risk` : `${label}风险`;
}

function reviewHistoryActionLabel(action: string, language: DesktopUIState["language"]) {
  const zhCN: Record<string, string> = {
    submit: "提交",
    submitted: "提交",
    claim: "开始审核",
    pass_precheck: "通过初审",
    approve: "同意",
    return_for_changes: "退回修改",
    reject: "拒绝",
    withdraw: "撤回"
  };
  const enUS: Record<string, string> = {
    submit: "Submitted",
    submitted: "Submitted",
    claim: "Claimed",
    pass_precheck: "Passed Precheck",
    approve: "Approved",
    return_for_changes: "Returned",
    reject: "Rejected",
    withdraw: "Withdrawn"
  };
  return (language === "en-US" ? enUS : zhCN)[action] ?? workflowStateLabel(action, language);
}

function reviewChangeSections(review: ReviewDetail, language: DesktopUIState["language"]) {
  if (review.reviewType === "permission_change") {
    const currentScope = review.currentScopeType ? scopeLabel(review.currentScopeType, language) : "未设置";
    const requestedScope = review.requestedScopeType ? scopeLabel(review.requestedScopeType, language) : currentScope;
    const currentVisibility = review.currentVisibilityLevel ? publishVisibilityLabel(review.currentVisibilityLevel, language) : "未设置";
    const requestedVisibility = review.requestedVisibilityLevel ? publishVisibilityLabel(review.requestedVisibilityLevel, language) : currentVisibility;
    return [
      { label: "授权范围", value: `${currentScope} -> ${requestedScope}` },
      { label: "公开级别", value: `${currentVisibility} -> ${requestedVisibility}` },
      { label: "指定部门", value: review.requestedDepartmentIDs.length > 0 ? `${review.requestedDepartmentIDs.length} 个部门` : "未指定" }
    ];
  }

  if (review.reviewType === "update") {
    return [
      { label: "版本", value: `${review.currentVersion ?? "未发布"} -> ${review.requestedVersion ?? "未填写"}` },
      { label: "公开级别", value: review.requestedVisibilityLevel ? publishVisibilityLabel(review.requestedVisibilityLevel, language) : "沿用当前设置" },
      { label: "变更说明", value: review.summary || review.reviewSummary || "暂无变更摘要" }
    ];
  }

  return [
    { label: "目标版本", value: review.requestedVersion ?? review.currentVersion ?? "未填写" },
    { label: "授权范围", value: review.requestedScopeType ? scopeLabel(review.requestedScopeType, language) : "未设置" },
    { label: "公开级别", value: review.requestedVisibilityLevel ? publishVisibilityLabel(review.requestedVisibilityLevel, language) : "未设置" }
  ];
}

function reviewActionButtonClass(action: ReviewAction) {
  return action === "approve" || action === "pass_precheck" || action === "claim" ? "btn btn-primary btn-small" : "btn btn-small";
}

const blockingPrecheckIDs = new Set(["skill-md", "semver", "version-order", "size", "file-count", "visibility", "scope"]);

function isBlockingPrecheckWarning(item: ReviewDetail["precheckResults"][number]) {
  return item.status === "warn" && blockingPrecheckIDs.has(item.id);
}

function ReviewDetailOverlay({ workspace, ui, overlay }: { workspace: P1WorkspaceState; ui: DesktopUIState; overlay: OverlayState }) {
  if (overlay.kind !== "review_detail") return null;
  return <ReviewDetailOverlayContent workspace={workspace} ui={ui} reviewID={overlay.reviewID} />;
}

function ReviewDetailOverlayContent({ workspace, ui, reviewID }: { workspace: P1WorkspaceState; ui: DesktopUIState; reviewID: string }) {
  const selectedReview = workspace.adminData.selectedReview?.reviewID === reviewID ? workspace.adminData.selectedReview : null;
  const listItem = workspace.adminData.reviews.find((review) => review.reviewID === reviewID) ?? null;
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    if (workspace.adminData.selectedReviewID !== reviewID) {
      workspace.adminData.setSelectedReviewID(reviewID);
    }
  }, [reviewID, workspace.adminData]);

  useEffect(() => {
    setReviewComment("");
  }, [reviewID]);

  const loadReviewFileContent = useCallback(
    async (relativePath: string) => workspace.adminData.getReviewFileContent(reviewID, relativePath),
    [reviewID, workspace.adminData]
  );

  const runReviewAction = useCallback((action: ReviewAction) => {
    if (!selectedReview) return;
    switch (action) {
      case "claim":
        void workspace.adminData.claimReview(selectedReview.reviewID);
        break;
      case "pass_precheck":
        void workspace.adminData.passPrecheck(selectedReview.reviewID, reviewComment);
        break;
      case "approve":
        void workspace.adminData.approveReview(selectedReview.reviewID, reviewComment);
        break;
      case "return_for_changes":
        void workspace.adminData.returnReview(selectedReview.reviewID, reviewComment);
        break;
      case "reject":
        void workspace.adminData.rejectReview(selectedReview.reviewID, reviewComment);
        break;
      case "withdraw":
        break;
    }
  }, [reviewComment, selectedReview, workspace.adminData]);

  if (!selectedReview) {
    const title = listItem?.skillDisplayName ?? "审核详情";
    return (
      <ModalFrame
        title={title}
        eyebrow="审核详情"
        onClose={ui.closeOverlay}
        full
        panelClassName="skill-detail-modal review-detail-modal"
      >
        <SectionEmpty
          title={listItem ? "正在加载审核详情" : "未找到审核单"}
          body={listItem ? `${listItem.submitterName} · ${submissionTypeLabel(listItem.reviewType, ui.language)} · ${workflowStateLabel(listItem.workflowState, ui.language)}` : "请返回审核工作台重新选择审核单。"}
        />
      </ModalFrame>
    );
  }

  const reviewActions = selectedReview.availableActions.filter((action) => action !== "withdraw");
  const changeItems = reviewChangeSections(selectedReview, ui.language);
  const warningPrechecks = selectedReview.precheckResults.filter((item) => item.status === "warn");
  const blockingPrechecks = selectedReview.precheckResults.filter(isBlockingPrecheckWarning);
  const reviewSummary = selectedReview.reviewSummary ?? selectedReview.summary ?? "暂无审核摘要。";

  return (
    <ModalFrame
      title={selectedReview.skillDisplayName}
      eyebrow="审核详情"
      onClose={ui.closeOverlay}
      full
      panelClassName="skill-detail-modal review-detail-modal"
      headerContent={skillDetailHead({
        displayName: selectedReview.skillDisplayName,
        eyebrow: "审核详情",
        description: selectedReview.description,
        meta: `${selectedReview.skillID} · ${selectedReview.submitterName} · ${selectedReview.submitterDepartmentName}`,
        tags: (
          <>
            <TagPill tone={reviewStatusTone(selectedReview)}>{workflowStateLabel(selectedReview.workflowState, ui.language)}</TagPill>
            <TagPill tone={riskToneClass(selectedReview.riskLevel)}>{reviewRiskText(selectedReview.riskLevel, ui.language)}</TagPill>
            <TagPill tone="neutral">{submissionTypeLabel(selectedReview.reviewType, ui.language)}</TagPill>
          </>
        )
      })}
    >
      <div className="skill-detail-page review-detail-page">
        <section className="skill-detail-section">
          <div className="definition-grid split skill-detail-meta-grid">
            <div><dt>提交人</dt><dd>{selectedReview.submitterName}</dd></div>
            <div><dt>提交部门</dt><dd>{selectedReview.submitterDepartmentName}</dd></div>
            <div><dt>当前审核人</dt><dd>{selectedReview.currentReviewerName ?? "未锁定"}</dd></div>
            <div><dt>提交时间</dt><dd>{formatDate(selectedReview.submittedAt, ui.language)}</dd></div>
            <div><dt>更新时间</dt><dd>{formatDate(selectedReview.updatedAt, ui.language)}</dd></div>
            <div><dt>锁单状态</dt><dd>{selectedReview.lockState === "locked" ? "已锁定" : "未锁定"}</dd></div>
          </div>
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>本次变更</h3>
          </div>
          <div className="definition-grid split">
            {changeItems.map((item) => (
              <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
            ))}
            <div><dt>分类</dt><dd>{selectedReview.category}</dd></div>
            <div><dt>标签</dt><dd>{selectedReview.tags.length > 0 ? selectedReview.tags.join("、") : "-"}</dd></div>
            <div><dt>包信息</dt><dd>{selectedReview.packageSize ? `${Math.max(1, Math.round(selectedReview.packageSize / 1024))} KB` : "-"} · {selectedReview.packageFileCount ?? selectedReview.packageFiles.length} 个文件</dd></div>
          </div>
          <div className="skill-detail-note-grid">
            <div>
              <strong>审核摘要</strong>
              <p>{reviewSummary}</p>
            </div>
            <div>
              <strong>处理提示</strong>
              <p>{warningPrechecks.length > 0 ? `当前有 ${warningPrechecks.length} 个预检查警告，确认阻塞项处理方式后再给出结论。` : "当前未发现预检查警告，仍需结合包内容完成最终判断。"}</p>
            </div>
          </div>
        </section>

        <section className="skill-detail-section review-action-section">
          <div className="detail-column-head">
            <h3>审核动作</h3>
          </div>
          <label className="field">
            <span>审核意见</span>
            <textarea
              rows={4}
              data-testid="review-comment"
              value={reviewComment}
              placeholder="补充审核意见、退回原因或通过说明"
              onChange={(event) => setReviewComment(event.target.value)}
            />
          </label>
          {blockingPrechecks.length > 0 ? (
            <div className="callout warning">
              <AlertTriangle size={16} />
              <span>
                <strong>存在阻塞型预检查警告</strong>
                <small>如需通过初审或同意发布，必须填写审核意见，系统会将该意见记录为风险覆盖理由。</small>
              </span>
            </div>
          ) : null}
          <div className="inline-actions wrap">
            {reviewActions.length === 0 ? <span className="muted-copy">当前状态没有可执行审核动作。</span> : null}
            {reviewActions.map((action) => (
              <button
                key={action}
                className={reviewActionButtonClass(action)}
                type="button"
                data-testid={`review-action-${action}`}
                onClick={() => runReviewAction(action)}
              >
                {reviewActionLabel(action, ui.language)}
              </button>
            ))}
          </div>
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>系统预检查</h3>
          </div>
          {selectedReview.precheckResults.length === 0 ? <SectionEmpty title="系统初审尚未返回结果" body="等待服务端返回结构、版本、包大小和文件数等检查结果。" /> : null}
          {selectedReview.precheckResults.length > 0 ? (
            <div className="stack-list compact">
              {selectedReview.precheckResults.map((item) => (
                <div className="micro-row review-precheck-row" key={item.id}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.message}</small>
                  </span>
                  <TagPill tone={item.status === "warn" ? "warning" : "success"}>{item.status === "warn" ? "警告" : "通过"}</TagPill>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>包内容预览</h3>
          </div>
          <PackagePreviewPanel
            files={selectedReview.packageFiles}
            packageURL={selectedReview.packageURL}
            downloadName={`${selectedReview.skillID}.zip`}
            loadContent={loadReviewFileContent}
            ui={ui}
          />
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>Skill 信息</h3>
          </div>
          <div className="definition-grid split">
            <div><dt>skillID</dt><dd>{selectedReview.skillID}</dd></div>
            <div><dt>当前版本</dt><dd>{selectedReview.currentVersion ?? "未发布"}</dd></div>
            <div><dt>目标版本</dt><dd>{selectedReview.requestedVersion ?? "-"}</dd></div>
            <div><dt>当前公开级别</dt><dd>{selectedReview.currentVisibilityLevel ? publishVisibilityLabel(selectedReview.currentVisibilityLevel, ui.language) : "未设置"}</dd></div>
            <div><dt>申请公开级别</dt><dd>{selectedReview.requestedVisibilityLevel ? publishVisibilityLabel(selectedReview.requestedVisibilityLevel, ui.language) : "未设置"}</dd></div>
            <div><dt>风险等级</dt><dd>{reviewRiskText(selectedReview.riskLevel, ui.language)}</dd></div>
          </div>
          <p>{selectedReview.description}</p>
        </section>

        <section className="skill-detail-section">
          <div className="detail-column-head">
            <h3>审核历史</h3>
          </div>
          {selectedReview.history.length === 0 ? <SectionEmpty title="暂无审核历史" body="领取、退回、拒绝、同意等动作会记录在这里。" /> : null}
          {selectedReview.history.length > 0 ? (
            <div className="version-history-list review-history-list">
              {selectedReview.history.map((item) => (
                <article className="version-history-row review-history-row" key={item.historyID}>
                  <div className="version-history-row-head">
                    <div>
                      <strong>{reviewHistoryActionLabel(item.action, ui.language)}</strong>
                      <small>{item.actorName} · {formatDate(item.createdAt, ui.language)}</small>
                    </div>
                  </div>
                  <p>{item.comment ?? "无补充说明。"}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </ModalFrame>
  );
}

function splitCSV(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleStringItem(items: string[], item: string, maxItems?: number): string[] {
  if (items.includes(item)) {
    return items.filter((current) => current !== item);
  }
  if (maxItems && items.length >= maxItems) {
    return items;
  }
  return [...items, item];
}

function bumpPatchVersion(version: string): string {
  const [major, minor, patch] = version.split(".").map((item) => Number.parseInt(item, 10));
  if (![major, minor, patch].every(Number.isFinite)) {
    return "1.0.0";
  }
  return `${major}.${minor}.${patch + 1}`;
}

function DraftWorkspace({
  workspace,
  ui,
  selectedPublisherSkill,
  composerTitle,
  draft,
  setDraft,
  uploadEntries,
  setUploadEntries,
  tagInput,
  setTagInput,
  toolInput,
  setToolInput,
  systemInput,
  setSystemInput,
  wizardStep,
  setWizardStep,
  onResetDraft,
  onSubmitDraft
}: {
  workspace: P1WorkspaceState;
  ui: DesktopUIState;
  selectedPublisherSkill: PublisherSkillSummary | null;
  composerTitle: string;
  draft: PublishDraft;
  setDraft: Dispatch<SetStateAction<PublishDraft>>;
  uploadEntries: Array<{ file: File; relativePath: string }>;
  setUploadEntries: Dispatch<SetStateAction<Array<{ file: File; relativePath: string }>>>;
  tagInput: string;
  setTagInput: Dispatch<SetStateAction<string>>;
  toolInput: string;
  setToolInput: Dispatch<SetStateAction<string>>;
  systemInput: string;
  setSystemInput: Dispatch<SetStateAction<string>>;
  wizardStep: 1 | 2 | 3;
  setWizardStep: Dispatch<SetStateAction<1 | 2 | 3>>;
  onResetDraft: (submissionType?: PublishDraft["submissionType"], source?: PublisherSkillSummary) => void;
  onSubmitDraft: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const folderInputProps = { webkitdirectory: "" } as { [key: string]: string };
  const publishPrecheck = buildPublishPrecheck(draft);
  const canSubmitPermissionChange =
    draft.skillID.trim().length > 0 &&
    draft.displayName.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    (draft.scope !== "selected_departments" || draft.selectedDepartmentIDs.length > 0);
  const canSubmitDraft = draft.submissionType === "permission_change" ? canSubmitPermissionChange : publishPrecheck.canSubmit;

  function handleZipUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadEntries([{ file, relativePath: file.name }]);
    setDraft((current) => ({
      ...current,
      uploadMode: "zip",
      packageName: file.name,
      files: [
        {
          name: file.name,
          relativePath: file.name,
          size: file.size,
          mimeType: file.type || "application/zip"
        }
      ]
    }));
  }

  function handleFolderUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const entries = files.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return { file, relativePath };
    });
    setUploadEntries(entries);
    setDraft((current) => ({
      ...current,
      uploadMode: "folder",
      packageName: entries[0]?.relativePath.split("/")[0] ?? "skill-folder",
      files: entries.map((entry) => ({
        name: entry.relativePath,
        relativePath: entry.relativePath,
        size: entry.file.size,
        mimeType: entry.file.type || "application/octet-stream"
      }))
    }));
  }

  return (
    <section className="overlay-stack">
      <div className="publisher-step-row">
        {[1, 2, 3].map((step) => (
          <button key={step} className={wizardStep === step ? "btn btn-primary btn-small" : "btn btn-small"} type="button" onClick={() => setWizardStep(step as 1 | 2 | 3)}>
            {step === 1 ? "1. 基础信息" : step === 2 ? "2. 包上传与校验" : "3. 最终确认"}
          </button>
        ))}
      </div>
      <form className="form-stack" onSubmit={onSubmitDraft}>
        <OverlaySectionHeader title={composerTitle} eyebrow="发布工作台" description="发布、更新、权限变更都统一在这里起草和提交流程。" />
        {wizardStep === 1 ? (
          <>
            <SelectField label="提交类型" value={draft.submissionType} options={["publish", "update", "permission_change"]} onChange={(value) => onResetDraft(value as PublishDraft["submissionType"], selectedPublisherSkill ?? undefined)} />
            <label className="field"><span>skillID</span><input value={draft.skillID} onChange={(event) => setDraft((current) => ({ ...current, skillID: event.target.value }))} disabled={draft.submissionType !== "publish"} /></label>
            <label className="field"><span>显示名称</span><input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></label>
            <label className="field"><span>描述</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className="field"><span>版本号</span><input value={draft.version} onChange={(event) => setDraft((current) => ({ ...current, version: event.target.value }))} disabled={draft.submissionType === "permission_change"} /></label>
            <label className="field"><span>变更说明</span><textarea rows={3} value={draft.changelog} onChange={(event) => setDraft((current) => ({ ...current, changelog: event.target.value }))} disabled={draft.submissionType === "permission_change"} /></label>
            <SelectField label="授权范围" value={draft.scope} options={["current_department", "department_tree", "selected_departments", "all_employees"]} onChange={(value) => setDraft((current) => ({ ...current, scope: value as PublishDraft["scope"] }))} />
            {draft.scope === "selected_departments" ? (
              <label className="field">
                <span>指定部门（多选）</span>
                <select
                  multiple
                  value={draft.selectedDepartmentIDs}
                  onChange={(event) => {
                    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                    setDraft((current) => ({ ...current, selectedDepartmentIDs: values }));
                  }}
                >
                  {flattenDepartments(workspace.adminData.departments).map((department) => (
                    <option key={department.departmentID} value={department.departmentID}>{department.path}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <SelectField label="公开级别" value={draft.visibility} options={["private", "summary_visible", "detail_visible", "public_installable"]} onChange={(value) => setDraft((current) => ({ ...current, visibility: value as PublishDraft["visibility"] }))} />
            <label className="field">
              <span>分类</span>
              <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                <option value="">请选择分类</option>
                {SKILL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>标签</span>
              <div className="tag-row compact">
                {SKILL_TAGS.map((tag) => {
                  const active = draft.tags.includes(tag);
                  const disabled = !active && draft.tags.length >= 5;
                  return (
                    <button
                      key={tag}
                      className={active ? "tag-filter active" : "tag-filter"}
                      type="button"
                      disabled={disabled}
                      aria-pressed={active}
                      onClick={() => {
                        setDraft((current) => {
                          const tags = toggleStringItem(current.tags, tag, 5);
                          setTagInput(tags.join(", "));
                          return { ...current, tags };
                        });
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="field"><span>适用工具（逗号分隔）</span><input value={toolInput} onChange={(event) => { const value = event.target.value; setToolInput(value); setDraft((current) => ({ ...current, compatibleTools: splitCSV(value) })); }} /></label>
            <label className="field"><span>适用系统（逗号分隔）</span><input value={systemInput} onChange={(event) => { const value = event.target.value; setSystemInput(value); setDraft((current) => ({ ...current, compatibleSystems: splitCSV(value) })); }} /></label>
            <div className="inline-actions wrap">
              <button className="btn btn-primary" type="button" onClick={() => setWizardStep(2)} disabled={draft.skillID.trim().length === 0}>下一步：组装校验</button>
              <button className="btn" type="button" onClick={() => onResetDraft(draft.submissionType, selectedPublisherSkill ?? undefined)}>重置</button>
            </div>
          </>
        ) : null}

        {wizardStep === 2 ? (
          <>
            {draft.submissionType !== "permission_change" ? (
              <>
                <div className="inline-actions wrap">
                  <label className="btn">
                    上传 ZIP
                    <input type="file" accept=".zip,application/zip" onChange={handleZipUpload} style={{ display: "none" }} />
                  </label>
                  <label className="btn">
                    上传文件夹
                    <input type="file" multiple {...folderInputProps} onChange={handleFolderUpload} style={{ display: "none" }} />
                  </label>
                </div>
                <div className="detail-block">
                  <h3>包含的文件清单 ({draft.files.length})</h3>
                  {draft.files.length === 0 ? <p>选择 ZIP 或文件夹后预校验内容。</p> : null}
                  <div className="stack-list compact limited-height">
                    {draft.files.slice(0, 15).map((file) => (
                      <div className="micro-row" key={file.relativePath}>
                        <strong>{file.relativePath}</strong>
                        <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="detail-block">
                  <h3>预检查结果</h3>
                  <div className="stack-list compact">
                    {publishPrecheck.items.map((item) => (
                      <div className="micro-row" key={item.id}>
                        <strong>{item.label}</strong>
                        <small>{item.status === "pass" ? "通过" : item.status === "warn" ? "需关注" : "待判定"} · {item.message}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="callout warning">
                <AlertTriangle size={16} />
                <span>
                  <strong>权限变更不需要重新上传包</strong>
                  <small>审核通过前会继续沿用最新历史版本，仅变更可见范围与权限配置。</small>
                </span>
              </div>
            )}
            <div className="inline-actions wrap">
              <button className="btn" type="button" onClick={() => setWizardStep(1)}>上一步</button>
              <button className="btn btn-primary" type="button" onClick={() => setWizardStep(3)} disabled={draft.submissionType !== "permission_change" && !publishPrecheck.canSubmit}>下一步：最终确认</button>
            </div>
          </>
        ) : null}

        {wizardStep === 3 ? (
          <>
            <div className="detail-block">
              <h3>最终确认</h3>
              <div className="definition-grid split">
                <div><dt>类型</dt><dd>{submissionTypeLabel(draft.submissionType, ui.language)}</dd></div>
                <div><dt>范围</dt><dd>{scopeLabel(draft.scope, ui.language)}</dd></div>
                <div><dt>公开级别</dt><dd>{publishVisibilityLabel(draft.visibility, ui.language)}</dd></div>
                <div><dt>版本</dt><dd>{draft.version}</dd></div>
              </div>
            </div>
            {!canSubmitDraft ? (
              <div className="callout warning">
                <AlertTriangle size={16} />
                <span>
                  <strong>校验尚未全部通过</strong>
                  <small>请返回前一步补齐必填信息或包文件。</small>
                </span>
              </div>
            ) : null}
            <div className="inline-actions wrap">
              <button className="btn" type="button" onClick={() => setWizardStep(2)}>上一步</button>
              <button className="btn btn-primary" type="submit" disabled={!canSubmitDraft}>提交到发布中心</button>
            </div>
          </>
        ) : null}
      </form>
    </section>
  );
}

function PublisherOverlay({ workspace, ui, overlay }: { workspace: P1WorkspaceState; ui: DesktopUIState; overlay: OverlayState }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<PublishDraft>({
    submissionType: "publish",
    uploadMode: "none",
    packageName: "",
    skillID: "",
    displayName: "",
    description: "",
    version: "1.0.0",
    scope: "current_department",
    selectedDepartmentIDs: [],
    visibility: "private",
    changelog: "",
    category: "",
    tags: [],
    compatibleTools: [],
    compatibleSystems: ["windows"],
    files: []
  });
  const [uploadEntries, setUploadEntries] = useState<Array<{ file: File; relativePath: string }>>([]);
  const [tagInput, setTagInput] = useState("");
  const [toolInput, setToolInput] = useState("");
  const [systemInput, setSystemInput] = useState("windows");

  useEffect(() => {
    if (overlay.kind === "publisher") {
      setComposerOpen(overlay.pane === "compose");
    }
  }, [overlay]);

  if (overlay.kind !== "publisher") return null;

  const selectedPublisherSkill =
    workspace.publisherData.publisherSkills.find((skill) => skill.latestSubmissionID === workspace.publisherData.selectedPublisherSubmissionID) ??
    workspace.publisherData.publisherSkills[0] ??
    null;
  const selectedSubmission = workspace.publisherData.selectedPublisherSubmission;

  function applyDraftLists(nextDraft: PublishDraft) {
    setDraft(nextDraft);
    setTagInput(nextDraft.tags.join(", "));
    setToolInput(nextDraft.compatibleTools.join(", "));
    setSystemInput(nextDraft.compatibleSystems.join(", "));
  }

  function resetDraft(submissionType: PublishDraft["submissionType"] = "publish", source?: PublisherSkillSummary) {
    const sourceSubmission =
      source?.latestSubmissionID && workspace.publisherData.selectedPublisherSubmission?.submissionID === source.latestSubmissionID
        ? workspace.publisherData.selectedPublisherSubmission
        : null;
    applyDraftLists({
      submissionType,
      uploadMode: "none",
      packageName: "",
      skillID: source?.skillID ?? "",
      displayName: source?.displayName ?? "",
      description: sourceSubmission?.description ?? "",
      version:
        submissionType === "update"
          ? bumpPatchVersion(source?.currentVersion ?? sourceSubmission?.currentVersion ?? "1.0.0")
          : source?.currentVersion ?? sourceSubmission?.currentVersion ?? "1.0.0",
      scope: source?.currentScopeType ?? "current_department",
      selectedDepartmentIDs: sourceSubmission?.selectedDepartmentIDs ?? [],
      visibility: source?.currentVisibilityLevel ?? "private",
      changelog: "",
      category: sourceSubmission?.category ?? source?.category ?? "",
      tags: [...(sourceSubmission?.tags ?? source?.tags ?? [])],
      compatibleTools: [],
      compatibleSystems: ["windows"],
      files: []
    });
    setUploadEntries([]);
    setWizardStep(1);
    setComposerOpen(true);
    ui.setPublisherPane("compose");
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("submissionType", draft.submissionType);
    formData.set("skillID", draft.skillID);
    formData.set("displayName", draft.displayName);
    formData.set("description", draft.description);
    formData.set("version", draft.version);
    formData.set("scopeType", draft.scope);
    formData.set("selectedDepartmentIDs", JSON.stringify(draft.selectedDepartmentIDs));
    formData.set("visibilityLevel", draft.visibility);
    formData.set("changelog", draft.changelog);
    formData.set("category", draft.category);
    formData.set("tags", JSON.stringify(draft.tags));
    formData.set("compatibleTools", JSON.stringify(splitCSV(toolInput)));
    formData.set("compatibleSystems", JSON.stringify(splitCSV(systemInput)));
    for (const entry of uploadEntries) {
      formData.append("files", entry.file, entry.relativePath);
    }
    void workspace.publisherData.submitPublisherSubmission(formData);
    setComposerOpen(false);
    ui.setPublisherPane("mine");
  }

  const composerTitle =
    draft.submissionType === "publish"
      ? "新建发布"
      : draft.submissionType === "update"
        ? "发布新版本"
        : "提交权限变更";

  const loadSubmissionFileContent = async (relativePath: string) => {
    if (!selectedSubmission) {
      throw new Error("未选择提交记录");
    }
    return workspace.publisherData.getSubmissionFileContent(selectedSubmission.submissionID, relativePath);
  };

  return (
    <ModalFrame title="发布中心" eyebrow="Publisher" onClose={ui.closeOverlay} full>
      {!workspace.loggedIn ? (
        <div className="overlay-stack">
          <p>发布、更新、权限变更和提交流程都统一收敛在这里。</p>
          <button className="btn btn-primary" type="button" onClick={() => workspace.requireAuth("publisher")}>
            登录后继续
          </button>
        </div>
      ) : (
        <div className="publisher-overlay">
          <aside className="publisher-side">
            <button className={composerOpen ? "sidebar-switch active" : "sidebar-switch"} type="button" onClick={() => { setComposerOpen(true); ui.setPublisherPane("compose"); }}>
              <span>发布</span>
            </button>
            <button className={!composerOpen ? "sidebar-switch active" : "sidebar-switch"} type="button" onClick={() => { setComposerOpen(false); ui.setPublisherPane("mine"); }}>
              <span>我的</span>
              <small>{workspace.publisherData.publisherSkills.length}</small>
            </button>
          </aside>
          <div className="publisher-main">
            {composerOpen ? (
              <DraftWorkspace
                workspace={workspace}
                ui={ui}
                selectedPublisherSkill={selectedPublisherSkill}
                composerTitle={composerTitle}
                draft={draft}
                setDraft={setDraft}
                uploadEntries={uploadEntries}
                setUploadEntries={setUploadEntries}
                tagInput={tagInput}
                setTagInput={setTagInput}
                toolInput={toolInput}
                setToolInput={setToolInput}
                systemInput={systemInput}
                setSystemInput={setSystemInput}
                wizardStep={wizardStep}
                setWizardStep={setWizardStep}
                onResetDraft={resetDraft}
                onSubmitDraft={submitDraft}
              />
            ) : (
              <div className="publisher-detail-layout">
                <section className="stage-panel list-panel">
                  <div className="inline-actions wrap">
                    <button className="btn btn-primary" type="button" onClick={() => resetDraft("publish")}>
                      <Upload size={14} />
                      新建发布
                    </button>
                  </div>
                  {workspace.publisherData.publisherSkills.length === 0 ? <SectionEmpty title="还没有发布记录" body="点击新建发布，或上传 ZIP / 文件夹开始第一次提交流程。" /> : null}
                  <div className="stack-list">
                    {workspace.publisherData.publisherSkills.map((skill) => (
                      <article className="publisher-item" key={skill.skillID}>
                        <div className="publisher-item-head">
                          <div>
                            <strong>{skill.displayName}</strong>
                            <small>{skill.skillID} · 当前版本 {skill.currentVersion ?? "未发布"}</small>
                          </div>
                          <div className="pill-row">
                            {skill.currentStatus ? <TagPill tone="info">{skill.currentStatus}</TagPill> : null}
                            {skill.latestWorkflowState ? (
                              <TagPill tone={skill.latestWorkflowState === "published" ? "success" : skill.latestWorkflowState === "manual_precheck" ? "warning" : "info"}>
                                {workflowStateLabel(skill.latestWorkflowState, ui.language)}
                              </TagPill>
                            ) : null}
                          </div>
                        </div>
                        <small>最近提交：{skill.submittedAt ? formatDate(skill.submittedAt, ui.language) : "暂无提交"} · 更新于 {formatDate(skill.updatedAt, ui.language)}</small>
                        {skill.latestReviewSummary ? <p>{skill.latestReviewSummary}</p> : null}
                        <div className="inline-actions wrap">
                          {skill.latestSubmissionID ? (
                            <button className="btn btn-small" type="button" onClick={() => workspace.publisherData.setSelectedPublisherSubmissionID(skill.latestSubmissionID ?? null)}>
                              查看详情
                            </button>
                          ) : null}
                          <button className="btn btn-small" type="button" onClick={() => resetDraft("update", skill)}>发布新版本</button>
                          <button className="btn btn-small" type="button" onClick={() => resetDraft("permission_change", skill)}>修改权限</button>
                          {skill.canWithdraw && skill.latestSubmissionID ? (
                            <button className="btn btn-small" type="button" onClick={() => void workspace.publisherData.withdrawPublisherSubmission(skill.latestSubmissionID ?? "")}>撤回</button>
                          ) : null}
                          {skill.availableStatusActions.includes("delist") ? (
                            <button className="btn btn-small" type="button" onClick={() => void workspace.publisherData.delistPublisherSkill(skill.skillID)}>下架</button>
                          ) : null}
                          {skill.availableStatusActions.includes("relist") ? (
                            <button className="btn btn-small" type="button" onClick={() => void workspace.publisherData.relistPublisherSkill(skill.skillID)}>上架</button>
                          ) : null}
                          {skill.availableStatusActions.includes("archive") ? (
                            <button className="btn btn-danger btn-small" type="button" onClick={() => void workspace.publisherData.archivePublisherSkill(skill.skillID)}>
                              <Archive size={14} />
                              归档
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="stage-panel detail-panel wide">
                  {!selectedSubmission ? (
                    <SectionEmpty title="选择一条提交查看详情" />
                  ) : (
                    <>
                      <div className="detail-hero compact">
                        <InitialBadge label={selectedSubmission.displayName} large />
                        <div>
                          <div className="pill-row">
                            <TagPill tone="info">{submissionTypeLabel(selectedSubmission.submissionType, ui.language)}</TagPill>
                            <TagPill tone={selectedSubmission.workflowState === "published" ? "success" : selectedSubmission.workflowState === "manual_precheck" ? "warning" : "info"}>
                              {workflowStateLabel(selectedSubmission.workflowState, ui.language)}
                            </TagPill>
                          </div>
                          <h3>{selectedSubmission.displayName}</h3>
                          <p>{selectedSubmission.description}</p>
                        </div>
                      </div>
                      <div className="definition-grid split">
                        <div><dt>版本</dt><dd>{selectedSubmission.version}</dd></div>
                        <div><dt>公开级别</dt><dd>{publishVisibilityLabel(selectedSubmission.visibilityLevel, ui.language)}</dd></div>
                        <div><dt>授权范围</dt><dd>{scopeLabel(selectedSubmission.scopeType, ui.language)}</dd></div>
                        <div><dt>提交时间</dt><dd>{formatDate(selectedSubmission.submittedAt, ui.language)}</dd></div>
                      </div>
                      {selectedSubmission.packageURL ? (
                        <div className="inline-actions wrap">
                          <button className="btn btn-small" type="button" onClick={() => void downloadAuthenticatedFile(selectedSubmission.packageURL ?? "", `${selectedSubmission.skillID ?? "submission"}.zip`)}>
                            <Download size={14} />
                            下载包
                          </button>
                          {selectedSubmission.canWithdraw ? (
                            <button className="btn btn-small" type="button" onClick={() => void workspace.publisherData.withdrawPublisherSubmission(selectedSubmission.submissionID ?? "")}>
                              撤回提交
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <PackagePreviewPanel
                        files={selectedSubmission.packageFiles}
                        packageURL={selectedSubmission.packageURL}
                        downloadName={`${selectedSubmission.skillID}.zip`}
                        loadContent={loadSubmissionFileContent}
                        ui={ui}
                      />
                      <div className="detail-block">
                        <h3>预检查结果</h3>
                        {selectedSubmission.precheckResults.length === 0 ? (
                          <p>等待系统初审。</p>
                        ) : (
                          <div className="stack-list compact">
                            {selectedSubmission.precheckResults.map((item) => (
                              <div className="micro-row" key={item.id}>
                                <strong>{item.label}</strong>
                                <small>{item.message}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalFrame>
  );
}

export function FlashToast({ flash, onClear }: { flash: FlashMessage | null; onClear: () => void }) {
  useEffect(() => {
    if (!flash) return;
    const handle = window.setTimeout(onClear, 3200);
    return () => window.clearTimeout(handle);
  }, [flash, onClear]);

  if (!flash) return null;

  return (
    <OverlayPortal>
      <div className={`flash-toast ${flash.tone}`} role="status" aria-live="polite">
        <strong>{flash.title}</strong>
        <p>{flash.body}</p>
      </div>
    </OverlayPortal>
  );
}

export function DesktopOverlays({ workspace, ui }: { workspace: P1WorkspaceState; ui: DesktopUIState }) {
  return (
    <OverlayPortal>
      <>
        <LoginModal workspace={workspace} ui={ui} />
        <ConfirmModal ui={ui} />
        <ProgressModal workspace={workspace} ui={ui} />
        <TargetsModal workspace={workspace} ui={ui} />
        <LocalImportModal workspace={workspace} ui={ui} />
        <ToolEditorModal workspace={workspace} ui={ui} />
        <ProjectEditorModal workspace={workspace} ui={ui} />
        <ConnectionStatusModal workspace={workspace} ui={ui} />
        <AppUpdateModal ui={ui} />
        <SettingsModal workspace={workspace} ui={ui} />
        <SkillDetailOverlay workspace={workspace} ui={ui} overlay={ui.overlay} />
        <ReviewDetailOverlay workspace={workspace} ui={ui} overlay={ui.overlay} />
      </>
    </OverlayPortal>
  );
}
