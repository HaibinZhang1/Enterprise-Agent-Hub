import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, LogIn, LogOut, RefreshCw, Search, WifiOff } from "lucide-react";
import { useP1Workspace } from "../state/useP1Workspace";
import { useDesktopUIState } from "../state/useDesktopUIState";
import { DesktopModals, FlashToast } from "./desktopModals";
import { ActivePageContent } from "./desktopPages";
import { IMAGE_POOL, pageMeta, roleLabel, shellBrand } from "./desktopShared";

function defaultLoginForm(apiBaseURL: string) {
  return {
    serverURL: apiBaseURL,
    username: import.meta.env.DEV ? import.meta.env.VITE_P1_DEV_LOGIN_USERNAME ?? "" : "",
    password: import.meta.env.DEV ? import.meta.env.VITE_P1_DEV_LOGIN_PASSWORD ?? "" : ""
  };
}

function LoginModal({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
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
      <section className="login-modal-panel" role="dialog" aria-modal="true" aria-label="登录同步企业服务" onClick={(event) => event.stopPropagation()}>
        <div className="login-card-shell">
          <div className="login-panel">
            <div className="brand-mark">{shellBrand.icon}</div>
            <div className="eyebrow">连接企业服务</div>
            <h1>登录后解锁市场、通知和管理员能力</h1>
            <p>本机已安装 Skill、工具和项目配置会继续保留。登录仅同步真实远端能力，不会覆盖本地副本。</p>
            <form className="form-stack" onSubmit={submit}>
              <label className="field">
                <span>服务地址</span>
                <input name="serverURL" value={form.serverURL} onChange={updateField} />
              </label>
              <label className="field">
                <span>用户名</span>
                <input name="username" value={form.username} onChange={updateField} />
              </label>
              <label className="field">
                <span>密码</span>
                <input name="password" type="password" value={form.password} onChange={updateField} />
              </label>
              {workspace.authError ? <div className="callout warning"><WifiOff size={16} /> {workspace.authError}</div> : null}
              <div className="inline-actions wrap">
                <button className="btn btn-primary" type="submit"><LogIn size={15} />登录并同步</button>
                <button className="btn" type="button" onClick={() => workspace.setLoginModalOpen(false)}>稍后再说</button>
              </div>
            </form>
          </div>
          <div className="login-visual">
            <img src={IMAGE_POOL.login} alt="团队工作区" />
            <div className="visual-caption">
              <strong>Windows-first Desktop</strong>
              <p>真实前端入口为 `apps/desktop`；这里的登录、市场、通知和管理员权限都直接连接 live 服务端。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DesktopApp() {
  const workspace = useP1Workspace();
  const ui = useDesktopUIState(workspace);

  const connection = workspace.bootstrap.connection.status;
  const connectionLabel =
    workspace.authState === "guest"
      ? "本地模式"
      : connection === "connected"
        ? "已连接"
        : connection === "connecting"
          ? "正在连接"
          : connection === "offline"
            ? "离线模式"
            : "连接失败";

  function globalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ui.navigate("market");
  }

  return (
    <div className="desktop-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark compact">{shellBrand.icon}</div>
          <div>
            <strong>{shellBrand.title}</strong>
            <span>{shellBrand.subtitle}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {ui.navigation.map((page) => (
            <button key={page} className={ui.activePage === page ? "nav-item active" : "nav-item"} onClick={() => ui.navigate(page)}>
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
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <form className="search-shell top-search" onSubmit={globalSearch}>
            <Search size={16} />
            <input
              aria-label="全局搜索 Skill"
              value={workspace.filters.query}
              name="global-search"
              placeholder={workspace.loggedIn ? "搜索 Skill 名称、标签、作者或 skillID" : "登录后搜索企业 Skill"}
              onChange={(event) => workspace.setFilters((current) => ({ ...current, query: event.target.value }))}
            />
          </form>

          <button className={`status-chip ${connection}`} type="button" onClick={ui.openConnectionStatus} aria-label="查看连接状态详情">
            {connection === "connected" ? <CheckCircle2 size={16} /> : <WifiOff size={16} />}
            {connectionLabel}
          </button>

          <button className="btn btn-small" onClick={() => void workspace.refreshBootstrap()}>
            <RefreshCw size={15} />
            刷新
          </button>

          <div className="account-chip">
            <div>
              <strong>{workspace.currentUser.displayName}</strong>
              <small>{roleLabel(workspace.currentUser)}</small>
            </div>
            {workspace.loggedIn ? (
              <button className="btn btn-small" onClick={() => void workspace.logout()}>
                <LogOut size={15} />
                退出
              </button>
            ) : (
              <button className="btn btn-primary btn-small" onClick={() => workspace.requireAuth(null)}>
                <LogIn size={15} />
                登录
              </button>
            )}
          </div>
        </header>

        <main className="page-shell">
          <ActivePageContent workspace={workspace} ui={ui} />
        </main>
      </div>

      <LoginModal workspace={workspace} />
      <DesktopModals workspace={workspace} ui={ui} />
      <FlashToast ui={ui} />
    </div>
  );
}
