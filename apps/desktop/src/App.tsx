import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  CheckCircle2,
  CloudOff,
  Download,
  FolderKanban,
  Home,
  Laptop,
  LogOut,
  PackageCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Star,
  Wrench
} from "lucide-react";
import type { MarketFilters, PageID, SkillSummary } from "./domain/p1";
import { useP1Workspace } from "./state/useP1Workspace";

const pageMeta: Record<PageID, { label: string; icon: ReactNode }> = {
  home: { label: "首页", icon: <Home size={18} /> },
  market: { label: "市场", icon: <Boxes size={18} /> },
  my_installed: { label: "我的 Skill", icon: <PackageCheck size={18} /> },
  tools: { label: "工具", icon: <Wrench size={18} /> },
  projects: { label: "项目", icon: <FolderKanban size={18} /> },
  notifications: { label: "通知", icon: <Bell size={18} /> },
  settings: { label: "设置", icon: <Settings size={18} /> }
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(skill: SkillSummary): string {
  if (skill.isScopeRestricted) return "权限收缩";
  switch (skill.installState) {
    case "not_installed":
      return "未安装";
    case "installed":
      return "已安装";
    case "enabled":
      return "已启用";
    case "update_available":
      return "有更新";
    case "blocked":
      return "不可安装";
  }
}

function riskLabel(skill: SkillSummary): string {
  return { low: "低", medium: "中", high: "高", unknown: "未知" }[skill.riskLevel];
}

function LoginView({ onLogin, authError }: { onLogin: (input: { username: string; password: string; serverURL: string }) => void; authError: string | null }) {
  const [form, setForm] = useState({ serverURL: "http://127.0.0.1:3000", username: "demo", password: "demo123" });

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin(form);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">EA</div>
        <p className="eyebrow">Enterprise Agent Hub</p>
        <h1>企业 Skill 使用闭环 Desktop</h1>
        <p className="muted">登录后进入 P1 工作台：市场浏览、安装、启用、通知和离线本地状态。</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            服务地址
            <input name="serverURL" value={form.serverURL} onChange={updateField} />
          </label>
          <label>
            用户名
            <input name="username" value={form.username} onChange={updateField} />
          </label>
          <label>
            密码
            <input name="password" type="password" value={form.password} onChange={updateField} />
          </label>
          {authError ? <div className="alert danger">{authError}</div> : null}
          <button className="primary" type="submit">登录</button>
        </form>
      </section>
      <section className="login-aside" aria-label="P1 能力摘要">
        <div>
          <p className="eyebrow">P1 Desktop</p>
          <h2>只保留使用入口</h2>
          <p>市场搜索、Central Store 安装、symlink 优先启用、copy 降级记录、离线启停同步。</p>
        </div>
      </section>
    </main>
  );
}

function Shell({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  const connection = workspace.bootstrap.connection.status;
  const navItems = workspace.bootstrap.navigation;

  function globalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = String(data.get("global-search") ?? "");
    workspace.setFilters((current) => ({ ...current, query }));
    workspace.setActivePage("market");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark compact">EA</div>
          <div>
            <strong>Agent Hub</strong>
            <span>P1 Desktop</span>
          </div>
        </div>
        <nav>
          {navItems.map((page) => (
            <button key={page} className={workspace.activePage === page ? "nav-active" : ""} onClick={() => workspace.setActivePage(page)}>
              {pageMeta[page].icon}
              {pageMeta[page].label}
              {page === "notifications" && workspace.bootstrap.counts.unreadNotificationCount > 0 ? <b>{workspace.bootstrap.counts.unreadNotificationCount}</b> : null}
            </button>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <form className="global-search" onSubmit={globalSearch}>
            <Search size={16} />
            <input name="global-search" placeholder="搜索 Skill 名称、标签、作者或 skillID" />
          </form>
          <div className={`connection ${connection}`}>
            {connection === "connected" ? <CheckCircle2 size={16} /> : <CloudOff size={16} />}
            {connection === "connected" ? "已连接" : connection === "connecting" ? "正在连接" : connection === "offline" ? "离线模式" : "连接失败"}
          </div>
          <button className="ghost" onClick={() => workspace.setConnectionStatus(connection === "connected" ? "offline" : "connected")}>切换连接</button>
          <button className="ghost" onClick={workspace.logout}><LogOut size={16} /> 退出</button>
        </header>
        <main className="content">
          {workspace.activePage === "home" ? <HomePage workspace={workspace} /> : null}
          {workspace.activePage === "market" ? <MarketPage workspace={workspace} /> : null}
          {workspace.activePage === "my_installed" ? <MyInstalledPage workspace={workspace} /> : null}
          {workspace.activePage === "tools" ? <ToolsPage workspace={workspace} /> : null}
          {workspace.activePage === "projects" ? <ProjectsPage workspace={workspace} /> : null}
          {workspace.activePage === "notifications" ? <NotificationsPage workspace={workspace} /> : null}
          {workspace.activePage === "settings" ? <SettingsPage workspace={workspace} /> : null}
        </main>
      </div>
      {workspace.progress ? <OperationToast progress={workspace.progress} /> : null}
    </div>
  );
}

function HomePage({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  const recommended = workspace.skills.slice(0, 3);
  const recent = [...workspace.skills].sort((left, right) => right.currentVersionUpdatedAt.localeCompare(left.currentVersionUpdatedAt)).slice(0, 3);
  return (
    <section className="page-grid">
      <div className="hero card">
        <p className="eyebrow">服务状态</p>
        <h1>{workspace.bootstrap.connection.status === "connected" ? "连接正常，市场可用" : "本地使用能力保留"}</h1>
        <p>{workspace.bootstrap.connection.lastError ?? "恢复连接后会刷新市场、通知和可更新状态；不会自动覆盖本地 Skill。"}</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => workspace.setActivePage("market")}>进入市场</button>
          <button onClick={() => workspace.setActivePage("my_installed")}>查看我的 Skill</button>
          <button onClick={() => workspace.setActivePage("tools")}>工具管理</button>
        </div>
      </div>
      <MetricCards workspace={workspace} />
      <ListCard title="最近更新" skills={recent} onOpen={workspace.openSkill} />
      <ListCard title="热门推荐" skills={recommended} onOpen={workspace.openSkill} />
      <div className="card">
        <h2>通知摘要</h2>
        {workspace.notifications.slice(0, 3).map((notification) => (
          <button className="list-row" key={notification.notificationID} onClick={() => workspace.setActivePage(notification.targetPage)}>
            <span>{notification.title}</span>
            <small>{formatDate(notification.occurredAt)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function MetricCards({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  const metrics = [
    ["已安装", workspace.bootstrap.counts.installedCount],
    ["已启用", workspace.bootstrap.counts.enabledCount],
    ["可更新", workspace.bootstrap.counts.updateAvailableCount],
    ["未读通知", workspace.bootstrap.counts.unreadNotificationCount]
  ] as const;
  return (
    <div className="metrics">
      {metrics.map(([label, value]) => (
        <div className="metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function ListCard({ title, skills, onOpen }: { title: string; skills: SkillSummary[]; onOpen: (skillID: string) => void }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {skills.map((skill) => (
        <button key={skill.skillID} className="list-row" onClick={() => onOpen(skill.skillID)}>
          <span>{skill.displayName}</span>
          <small>{skill.version} · {skill.authorDepartment}</small>
        </button>
      ))}
    </div>
  );
}

function MarketPage({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  const connection = workspace.bootstrap.connection.status;
  const offline = connection === "offline" || connection === "failed";
  return (
    <section className="market-layout">
      <div className="card filters">
        <h2>市场筛选</h2>
        {offline ? <div className="alert warning">离线模式下无法搜索市场，安装和更新已禁用。</div> : null}
        <input value={workspace.filters.query} placeholder="搜索 Skill" onChange={(event) => workspace.setFilters((current) => ({ ...current, query: event.target.value }))} disabled={offline} />
        <SelectFilter label="部门" value={workspace.filters.department} options={["all", ...workspace.departments]} onChange={(value) => workspace.setFilters((current) => ({ ...current, department: value }))} />
        <SelectFilter label="工具" value={workspace.filters.compatibleTool} options={["all", ...workspace.compatibleTools]} onChange={(value) => workspace.setFilters((current) => ({ ...current, compatibleTool: value }))} />
        <SelectFilter label="安装" value={workspace.filters.installed} options={["all", "installed", "not_installed"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, installed: value as MarketFilters["installed"] }))} />
        <SelectFilter label="启用" value={workspace.filters.enabled} options={["all", "enabled", "not_enabled"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, enabled: value as MarketFilters["enabled"] }))} />
        <SelectFilter label="权限" value={workspace.filters.accessScope} options={["include_public", "authorized_only"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, accessScope: value as MarketFilters["accessScope"] }))} />
        <SelectFilter label="风险" value={workspace.filters.riskLevel} options={["all", "low", "medium", "high", "unknown"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, riskLevel: value as MarketFilters["riskLevel"] }))} />
        <SelectFilter label="排序" value={workspace.filters.sort} options={["composite", "latest_published", "recently_updated", "download_count", "star_count", "relevance"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, sort: value as MarketFilters["sort"] }))} />
      </div>
      <div className="market-results">
        <div className="section-heading">
          <h1>Skill 市场</h1>
          <span>{workspace.marketSkills.length} 个结果</span>
        </div>
        {workspace.marketSkills.length === 0 ? <div className="card empty">没有找到匹配的 Skill。</div> : null}
        <div className="skill-grid">
          {workspace.marketSkills.map((skill) => (
            <SkillCard key={skill.skillID} skill={skill} offline={offline} workspace={workspace} />
          ))}
        </div>
      </div>
      {workspace.selectedSkill ? <SkillDetail skill={workspace.selectedSkill} workspace={workspace} offline={offline} /> : null}
    </section>
  );
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SkillCard({ skill, offline, workspace }: { skill: SkillSummary; offline: boolean; workspace: ReturnType<typeof useP1Workspace> }) {
  return (
    <article className={`skill-card ${skill.installState}`} onClick={() => workspace.selectSkill(skill.skillID)}>
      <div className="card-topline">
        <span className="badge">{statusLabel(skill)}</span>
        <button className="star" onClick={(event) => { event.stopPropagation(); void workspace.toggleStar(skill.skillID); }}>
          <Star size={15} fill={skill.starred ? "currentColor" : "none"} /> {skill.starCount}
        </button>
      </div>
      <h3>{skill.displayName}</h3>
      <code>{skill.skillID}</code>
      <p>{skill.description}</p>
      <div className="tag-row">
        {skill.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <small>{skill.authorName} / {skill.authorDepartment} · v{skill.version} · 风险{riskLabel(skill)}</small>
      <SkillActions skill={skill} offline={offline} workspace={workspace} compact />
    </article>
  );
}

function SkillDetail({ skill, offline, workspace }: { skill: SkillSummary; offline: boolean; workspace: ReturnType<typeof useP1Workspace> }) {
  const isSummaryOnly = skill.detailAccess === "summary";
  return (
    <aside className="detail-panel card">
      <div className="card-topline">
        <span className="badge">{statusLabel(skill)}</span>
        <button className="star" onClick={() => void workspace.toggleStar(skill.skillID)}><Star size={15} fill={skill.starred ? "currentColor" : "none"} /> {skill.starCount}</button>
      </div>
      <h2>{skill.displayName}</h2>
      <p className="muted">{skill.skillID} · {skill.authorName} · {skill.authorDepartment}</p>
      {isSummaryOnly ? (
        <div className="alert warning"><ShieldAlert size={16} /> 该 Skill 暂未向你开放详情；不会展示 README、安全摘要或包信息。</div>
      ) : (
        <>
          <h3>使用说明</h3>
          <p>{skill.readme}</p>
          <h3>安全摘要</h3>
          <p>{skill.reviewSummary}</p>
          <h3>本机状态</h3>
          <p>本地版本：{skill.localVersion ?? "未安装"}；市场版本：{skill.version}；最近启用：{formatDate(skill.lastEnabledAt)}</p>
        </>
      )}
      <SkillActions skill={skill} offline={offline} workspace={workspace} />
      <h3>启用位置</h3>
      {skill.enabledTargets.length === 0 ? <p className="muted">暂无启用位置。</p> : null}
      {skill.enabledTargets.map((target) => (
        <div className="target-row" key={`${target.targetType}:${target.targetID}`}>
          <div>
            <strong>{target.targetName}</strong>
            <small>{target.targetPath}</small>
            <small>{target.requestedMode} → {target.resolvedMode}{target.fallbackReason ? ` · ${target.fallbackReason}` : ""}</small>
          </div>
          <button onClick={() => void workspace.disableSkill(skill.skillID, target.targetID)}>停用</button>
        </div>
      ))}
    </aside>
  );
}

function SkillActions({ skill, offline, workspace, compact = false }: { skill: SkillSummary; offline: boolean; workspace: ReturnType<typeof useP1Workspace>; compact?: boolean }) {
  function updateWithConfirm() {
    if (skill.hasLocalHashDrift && !window.confirm("本地内容已变更，本次更新将覆盖 Central Store 中的本地内容。继续？")) return;
    void workspace.installOrUpdate(skill.skillID, skill.localVersion ? "update" : "install");
  }

  function uninstallWithConfirm() {
    if (!window.confirm(`卸载会移除 Central Store 和 ${skill.enabledTargets.length} 个托管目标。继续？`)) return;
    void workspace.uninstallSkill(skill.skillID);
  }

  const canInstallOrUpdate = skill.canInstall && skill.detailAccess === "full" && !skill.isScopeRestricted;
  return (
    <div className={compact ? "actions compact" : "actions"}>
      {!skill.localVersion ? <button className="primary" disabled={offline || !canInstallOrUpdate} onClick={updateWithConfirm}><Download size={15} />安装</button> : null}
      {skill.localVersion && skill.installState === "update_available" ? <button className="primary" disabled={offline || !skill.canUpdate} onClick={updateWithConfirm}><RefreshCw size={15} />更新</button> : null}
      {skill.localVersion ? <button disabled={skill.isScopeRestricted} onClick={() => void workspace.enableSkill(skill.skillID, "tool", "codex")}>启用到 Codex</button> : null}
      {skill.localVersion ? <button disabled={skill.isScopeRestricted} onClick={() => void workspace.enableSkill(skill.skillID, "project", "enterprise-agent-hub")}>启用到项目</button> : null}
      {skill.localVersion ? <button className="danger-button" onClick={uninstallWithConfirm}>卸载</button> : null}
      {!canInstallOrUpdate && !skill.localVersion ? <span className="muted">{skill.cannotInstallReason ?? "不可安装"}</span> : null}
    </div>
  );
}

function MyInstalledPage({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  return (
    <section>
      <div className="section-heading"><h1>我的 Skill</h1><span>仅展示已安装</span></div>
      <div className="table-card card">
        {workspace.installedSkills.map((skill) => (
          <div className="installed-row" key={skill.skillID}>
            <div>
              <h3>{skill.displayName}</h3>
              <p>{skill.skillID} · 本地 {skill.localVersion} · 市场 {skill.version}</p>
              {skill.isScopeRestricted ? <div className="alert warning">可继续使用当前版本，但不可更新或新增启用位置。</div> : null}
            </div>
            <div><strong>{statusLabel(skill)}</strong><small>已启用目标：{skill.enabledTargets.length}</small></div>
            <SkillActions skill={skill} offline={workspace.bootstrap.connection.status !== "connected"} workspace={workspace} compact />
          </div>
        ))}
      </div>
    </section>
  );
}

function ToolsPage({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  return (
    <section>
      <div className="section-heading"><h1>工具</h1><button onClick={() => void workspace.refreshTools()}><RefreshCw size={16} />刷新检测</button></div>
      <div className="card-grid">
        {workspace.tools.map((tool) => (
          <article className="card" key={tool.toolID}>
            <div className="card-topline"><Laptop size={18} /><span className="badge">{tool.status}</span></div>
            <h2>{tool.name}</h2>
            <p>转换策略：{tool.transform}</p>
            <small>配置路径：{tool.configPath}</small>
            <small>skills 路径：{tool.skillsPath}</small>
            <strong>{tool.enabledSkillCount} 个已启用 Skill</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectsPage({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  return (
    <section>
      <div className="section-heading"><h1>项目</h1><button>添加项目</button></div>
      <div className="alert info">项目级路径与工具级路径冲突时，项目级优先。</div>
      <div className="card-grid">
        {workspace.projects.map((project) => (
          <article className="card" key={project.projectID}>
            <h2>{project.name}</h2>
            <small>项目路径：{project.projectPath}</small>
            <small>skills 路径：{project.skillsPath}</small>
            <strong>{project.enabledSkillCount} 个项目级启用</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationsPage({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  return (
    <section>
      <div className="section-heading">
        <h1>通知</h1>
        <div className="button-row"><button onClick={() => void workspace.markNotificationsRead("all")}>全部标记已读</button><button onClick={() => void workspace.syncOfflineEvents()}>同步本地事件（{workspace.offlineEvents.length}）</button></div>
      </div>
      <div className="card notification-list">
        {workspace.notifications.map((notification) => (
          <button key={notification.notificationID} className={notification.unread ? "notification unread" : "notification"} onClick={() => { workspace.setActivePage(notification.targetPage); void workspace.markNotificationsRead([notification.notificationID]); }}>
            <strong>{notification.title}</strong>
            <span>{notification.summary}</span>
            <small>{notification.source} · {formatDate(notification.occurredAt)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({ workspace }: { workspace: ReturnType<typeof useP1Workspace> }) {
  const centralStorePath = useMemo(() => "%APPDATA%\\EnterpriseAgentHub\\CentralStore", []);
  return (
    <section className="settings-page">
      <h1>设置</h1>
      <div className="card-grid">
        <div className="card"><h2>语言</h2><p>当前：{workspace.bootstrap.user.locale}</p></div>
        <div className="card"><h2>Central Store</h2><p>{centralStorePath}</p><small>前端只展示路径；本地文件写入必须由 Tauri 命令完成。</small></div>
        <div className="card"><h2>同步偏好</h2><p>联网后自动同步本地 enable/disable 结果。</p><button onClick={() => void workspace.refreshBootstrap()}>刷新启动上下文</button></div>
      </div>
    </section>
  );
}

function OperationToast({ progress }: { progress: NonNullable<ReturnType<typeof useP1Workspace>["progress"]> }) {
  return (
    <aside className={`operation-toast ${progress.result}`} role="status">
      <strong>{progress.operation} · {progress.stage}</strong>
      <span>{progress.message}</span>
    </aside>
  );
}

export function App() {
  const workspace = useP1Workspace();
  if (!workspace.loggedIn) {
    return <LoginView onLogin={(input) => void workspace.login(input)} authError={workspace.authError} />;
  }
  return <Shell workspace={workspace} />;
}
