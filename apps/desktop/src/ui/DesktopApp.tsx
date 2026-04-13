import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, LogIn, LogOut, RefreshCw, Search, WifiOff } from "lucide-react";
import { useP1Workspace } from "../state/useP1Workspace";
import { useDesktopUIState } from "../state/useDesktopUIState";
import { DesktopModals, FlashToast } from "./desktopModals";
import { ActivePageContent } from "./desktopPages";
import type { DisplayLanguage } from "./desktopShared";
import { localize, pageMetaFor, roleLabel, shellBrand } from "./desktopShared";

function defaultLoginForm(apiBaseURL: string) {
  return {
    serverURL: apiBaseURL,
    username: import.meta.env.DEV ? import.meta.env.VITE_P1_DEV_LOGIN_USERNAME ?? "" : "",
    password: import.meta.env.DEV ? import.meta.env.VITE_P1_DEV_LOGIN_PASSWORD ?? "" : ""
  };
}

function LoginModal({ workspace, language }: { workspace: ReturnType<typeof useP1Workspace>; language: DisplayLanguage }) {
  const [form, setForm] = useState(() => defaultLoginForm(workspace.apiBaseURL));

  useEffect(() => {
    if (!workspace.loginModalOpen) return;
    setForm((current) => ({
      ...current,
      serverURL: workspace.apiBaseURL
    }));
  }, [workspace.apiBaseURL, workspace.loginModalOpen]);

  if (!workspace.loginModalOpen) return null;

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void workspace.login(form);
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={() => workspace.setLoginModalOpen(false)}>
      <section className="login-modal-panel" role="dialog" aria-modal="true" aria-label="登录同步企业服务" data-testid="login-modal" onClick={(event) => event.stopPropagation()}>
        <div className="login-card-shell compact">
          <div className="login-panel compact">
            <div className="brand-mark">{shellBrand.icon}</div>
            <div className="eyebrow">{localize(language, "登录", "Sign In")}</div>
            <h1>{localize(language, "连接企业服务", "Connect to Enterprise Service")}</h1>
            <p>{localize(language, "登录后同步市场、通知和权限。本地 Skill、工具和项目配置会继续保留。", "Sign in to sync market, notifications, and permissions. Local skills, tools, and projects stay on this device.")}</p>
            <form className="form-stack" onSubmit={submit}>
              <label className="field">
                <span>{localize(language, "服务地址", "Server URL")}</span>
                <input name="serverURL" value={form.serverURL} onChange={updateField} data-testid="login-server-url" />
              </label>
              <label className="field">
                <span>{localize(language, "用户名", "Username")}</span>
                <input name="username" value={form.username} onChange={updateField} data-testid="login-username" />
              </label>
              <label className="field">
                <span>{localize(language, "密码", "Password")}</span>
                <input name="password" type="password" value={form.password} onChange={updateField} data-testid="login-password" />
              </label>
              {workspace.authError ? <div className="callout warning"><WifiOff size={16} /> {workspace.authError}</div> : null}
              <div className="inline-actions wrap">
                <button className="btn btn-primary" type="submit" data-testid="login-submit"><LogIn size={15} />{localize(language, "登录", "Sign In")}</button>
                <button className="btn" type="button" onClick={() => workspace.setLoginModalOpen(false)}>{localize(language, "取消", "Cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DesktopApp() {
  const workspace = useP1Workspace();
  const ui = useDesktopUIState(workspace);
  const pageMeta = pageMetaFor(ui.language);
  const shellNavigation = ui.navigation.filter((page) => page !== "settings");

  const connection = workspace.bootstrap.connection.status;
  const connectionLabel =
    workspace.authState === "guest"
      ? localize(ui.language, "本地模式", "Local Mode")
      : connection === "connected"
        ? localize(ui.language, "已连接", "Connected")
        : connection === "connecting"
          ? localize(ui.language, "正在连接", "Connecting")
          : connection === "offline"
            ? localize(ui.language, "离线模式", "Offline")
            : localize(ui.language, "连接失败", "Connection Failed");

  function globalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ui.navigate("market");
  }

  return (
    <div className="desktop-shell">
      <aside className="sidebar">
        <div className="sidebar-main">
          <div className="sidebar-brand">
            <div className="brand-mark compact">{shellBrand.icon}</div>
            <div>
              <strong>{shellBrand.title}</strong>
              <span>{shellBrand.subtitle}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {shellNavigation.map((page) => (
              <button key={page} className={ui.activePage === page ? "nav-item active" : "nav-item"} data-testid={`nav-${page}`} onClick={() => ui.navigate(page)}>
                <span className="nav-item-main">
                  {pageMeta[page].icon}
                  <span>{pageMeta[page].label}</span>
                </span>
                <span className="nav-item-side">
                  {pageMeta[page].mark ? <small>{pageMeta[page].mark}</small> : null}
                  {page === "notifications" && workspace.bootstrap.counts.unreadNotificationCount > 0 ? <b>{workspace.bootstrap.counts.unreadNotificationCount}</b> : null}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-divider" />
          <button className={ui.modal.type === "settings" ? "nav-item active" : "nav-item"} onClick={ui.openSettingsModal}>
            <span className="nav-item-main">
              {pageMeta.settings.icon}
              <span>{pageMeta.settings.label}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <form className="search-shell top-search" onSubmit={globalSearch}>
            <Search size={16} />
            <input
              aria-label={localize(ui.language, "全局搜索 Skill", "Global Skill Search")}
              value={workspace.filters.query}
              name="global-search"
              placeholder={workspace.loggedIn ? localize(ui.language, "搜索 Skill 名称、标签、作者或 skillID", "Search by skill name, tag, author, or skill ID") : localize(ui.language, "登录后搜索企业 Skill", "Sign in to search enterprise skills")}
              onChange={(event) => workspace.setFilters((current) => ({ ...current, query: event.target.value }))}
            />
          </form>

          <button className={`status-chip ${connection}`} type="button" onClick={ui.openConnectionStatus} aria-label={localize(ui.language, "查看连接状态详情", "View connection details")}>
            {connection === "connected" ? <CheckCircle2 size={16} /> : <WifiOff size={16} />}
            {connectionLabel}
          </button>

          <button className="btn btn-small" onClick={() => void workspace.refreshBootstrap()}>
            <RefreshCw size={15} />
            {localize(ui.language, "刷新", "Refresh")}
          </button>

          <div className="account-chip">
            <div>
              <strong>{workspace.currentUser.displayName}</strong>
              <small>{roleLabel(workspace.currentUser, ui.language)}</small>
            </div>
            {workspace.loggedIn ? (
              <button className="btn btn-small" onClick={() => void workspace.logout()}>
                <LogOut size={15} />
                {localize(ui.language, "退出", "Sign Out")}
              </button>
            ) : (
              <button className="btn btn-primary btn-small" data-testid="open-login" onClick={() => workspace.requireAuth(null)}>
                <LogIn size={15} />
                {localize(ui.language, "登录", "Sign In")}
              </button>
            )}
          </div>
        </header>

        <main className="page-shell">
          <ActivePageContent workspace={workspace} ui={ui} />
        </main>
      </div>

      <LoginModal workspace={workspace} language={ui.language} />
      <DesktopModals workspace={workspace} ui={ui} />
      <FlashToast ui={ui} />
    </div>
  );
}
