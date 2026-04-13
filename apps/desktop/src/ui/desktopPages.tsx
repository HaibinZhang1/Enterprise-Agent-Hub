import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ChevronRight,
  CircleGauge,
  Download,
  FolderPlus,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  UserPlus
} from "lucide-react";
import type { MarketFilters, PreferenceState, SkillSummary } from "../domain/p1";
import type { DesktopUIState } from "../state/useDesktopUIState";
import type { P1WorkspaceState } from "../state/useP1Workspace";
import {
  IMAGE_POOL,
  flattenDepartments,
  formatDate,
  imageForSkill,
  riskLabel,
  statusLabel,
  themeLabel
} from "./desktopShared";

interface PageProps {
  workspace: P1WorkspaceState;
  ui: DesktopUIState;
}

function AuthGateCard({ title, body, onLogin }: { title: string; body: string; onLogin: () => void }) {
  return (
    <section className="auth-gate">
      <div className="eyebrow">需要登录</div>
      <h1>{title}</h1>
      <p>{body}</p>
      <div className="inline-actions">
        <button className="btn btn-primary" onClick={onLogin}>登录同步</button>
      </div>
    </section>
  );
}

function SectionEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function TagPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function HomeMetricCards({ workspace }: { workspace: P1WorkspaceState }) {
  const metrics = [
    ["本机已安装", workspace.bootstrap.counts.installedCount],
    ["已启用目标", workspace.bootstrap.counts.enabledCount],
    ["待更新", workspace.bootstrap.counts.updateAvailableCount],
    ["未读通知", workspace.bootstrap.counts.unreadNotificationCount]
  ] as const;

  return (
    <section className="metric-grid">
      {metrics.map(([label, value]) => (
        <article className="metric-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function HomeRecommendation({ skill, ui }: { skill: SkillSummary; ui: DesktopUIState }) {
  return (
    <button className="recommendation-row" onClick={() => ui.openSkillDetail(skill.skillID, "home")}>
      <img src={imageForSkill(skill)} alt={skill.displayName} />
      <span>
        <strong>{skill.displayName}</strong>
        <small>{skill.authorDepartment} · 风险{riskLabel(skill)}</small>
      </span>
      <TagPill tone="info">{statusLabel(skill)}</TagPill>
    </button>
  );
}

function HomeSignalCard({ skill, workspace, ui }: { skill: SkillSummary; workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const action = !skill.localVersion ? "install" : skill.installState === "update_available" ? "update" : "detail";
  return (
    <article className="signal-card">
      <img src={imageForSkill(skill)} alt={skill.displayName} />
      <div>
        <div className="inline-heading">
          <strong>{skill.displayName}</strong>
          <TagPill tone={skill.installState === "update_available" ? "warning" : "success"}>{statusLabel(skill)}</TagPill>
        </div>
        <p>{skill.description}</p>
        <div className="inline-actions">
          {action === "install" ? (
            <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "install")}>安装</button>
          ) : null}
          {action === "update" ? (
            <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "update")}>更新</button>
          ) : null}
          {action === "detail" ? (
            <button className="btn" onClick={() => ui.openSkillDetail(skill.skillID, "home")}>查看详情</button>
          ) : null}
          {skill.localVersion ? (
            <button className="btn" onClick={() => workspace.openPage("my_installed")}>已安装</button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function HomePage({ workspace, ui }: PageProps) {
  const localSignals = [...workspace.installedSkills]
    .sort((left, right) => right.currentVersionUpdatedAt.localeCompare(left.currentVersionUpdatedAt))
    .slice(0, 3);
  const recommended = (workspace.loggedIn ? workspace.skills : workspace.installedSkills).slice(0, 3);
  const notices = workspace.notifications.filter((notice) => notice.unread).slice(0, 3);
  const heroImage = imageForSkill(recommended[0] ?? localSignals[0] ?? workspace.skills[0] ?? workspace.installedSkills[0] ?? {
    skillID: "dashboard",
    displayName: "工作台",
    description: "",
    version: "0.0.0",
    localVersion: null,
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "summary",
    canInstall: false,
    canUpdate: false,
    installState: "not_installed",
    currentVersionUpdatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    compatibleTools: [],
    compatibleSystems: [],
    tags: [],
    category: "dashboard",
    riskLevel: "unknown",
    starCount: 0,
    downloadCount: 0,
    starred: false,
    isScopeRestricted: false,
    hasLocalHashDrift: false,
    enabledTargets: [],
    lastEnabledAt: null
  });

  return (
    <div className="page-stack">
      <section className="hero-surface">
        <img src={heroImage || IMAGE_POOL.dashboard} alt="workspace" />
        <div className="hero-overlay">
          <div className="eyebrow">本地工作台</div>
          <h1>{workspace.loggedIn ? "本机 Skill 状态正常" : "先从本地模式开始"}</h1>
          <p>
            {workspace.loggedIn
              ? workspace.bootstrap.connection.lastError ?? "市场、通知、管理员权限和本地安装状态已经同步。"
              : "当前先展示本机已安装 Skill、工具和项目配置。需要市场、通知或管理员能力时再登录。"}
          </p>
          <div className="inline-actions">
            <button className="btn btn-primary" onClick={() => workspace.loggedIn ? ui.navigate("market") : workspace.requireAuth("market")}>进入市场</button>
            <button className="btn" onClick={() => ui.navigate("my_installed")}>查看我的 Skill</button>
            <button className="btn" onClick={() => ui.navigate("tools")}>工具管理</button>
          </div>
        </div>
      </section>

      <HomeMetricCards workspace={workspace} />

      {!workspace.loggedIn ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">登录后可用</div>
              <h2>真实远端能力</h2>
            </div>
            <TagPill tone="info">游客优先</TagPill>
          </div>
          <div className="pill-row">
            <TagPill>市场搜索</TagPill>
            <TagPill>远端通知</TagPill>
            <TagPill>审核 / 管理</TagPill>
          </div>
          <p>点击市场、通知或管理员入口时，会自动弹出真实登录框。</p>
        </section>
      ) : null}

      <section className="page-grid two-up">
        <article className="panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">本机动态</div>
              <h2>最近变化</h2>
            </div>
          </div>
          {localSignals.length === 0 ? <SectionEmpty title="暂无动态" body="安装或启用 Skill 后，会在这里看到本机状态。" /> : null}
          <div className="stack-list">
            {localSignals.map((skill) => <HomeSignalCard key={skill.skillID} skill={skill} workspace={workspace} ui={ui} />)}
          </div>
        </article>
        <article className="panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">通知摘要</div>
              <h2>{workspace.loggedIn ? "应用内消息" : "本机提醒"}</h2>
            </div>
            <button className="btn btn-small" onClick={() => ui.navigate("notifications")}>查看全部</button>
          </div>
          {notices.length === 0 ? <SectionEmpty title="暂无通知" body="新的安装、路径异常和连接状态会出现在这里。" /> : null}
          <div className="stack-list compact">
            {notices.map((notice) => (
              <button className="notice-row" key={notice.notificationID} onClick={() => ui.navigate(notice.targetPage)}>
                <span>
                  <strong>{notice.title}</strong>
                  <small>{notice.summary}</small>
                </span>
                <small>{formatDate(notice.occurredAt)}</small>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">推荐与热门</div>
            <h2>{workspace.loggedIn ? "市场推荐" : "本机已安装"}</h2>
          </div>
          <button className="btn btn-small" onClick={() => ui.navigate("market")}>进入市场</button>
        </div>
        {recommended.length === 0 ? <SectionEmpty title="暂无推荐内容" body="登录后会根据真实市场数据更新推荐。" /> : null}
        <div className="stack-list">
          {recommended.map((skill) => <HomeRecommendation key={skill.skillID} skill={skill} ui={ui} />)}
        </div>
      </section>
    </div>
  );
}

function MarketToolbar({ workspace }: PageProps) {
  const offline = workspace.bootstrap.connection.status === "offline" || workspace.bootstrap.connection.status === "failed";
  return (
    <section className="toolbar-shell">
      <form className="search-shell" onSubmit={(event) => event.preventDefault()}>
        <Search size={16} />
        <input
          aria-label="搜索市场 Skill"
          value={workspace.filters.query}
          placeholder="搜索 Skill 名称、描述、标签、作者、部门或 skillID"
          onChange={(event) => workspace.setFilters((current) => ({ ...current, query: event.target.value }))}
          disabled={offline}
        />
      </form>
      <div className="toolbar-grid">
        <SelectField label="部门" value={workspace.filters.department} options={["all", ...workspace.departments]} onChange={(value) => workspace.setFilters((current) => ({ ...current, department: value }))} disabled={offline} />
        <SelectField label="工具" value={workspace.filters.compatibleTool} options={["all", ...workspace.compatibleTools]} onChange={(value) => workspace.setFilters((current) => ({ ...current, compatibleTool: value }))} disabled={offline} />
        <SelectField label="安装" value={workspace.filters.installed} options={["all", "installed", "not_installed"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, installed: value as MarketFilters["installed"] }))} disabled={offline} />
        <SelectField label="启用" value={workspace.filters.enabled} options={["all", "enabled", "not_enabled"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, enabled: value as MarketFilters["enabled"] }))} disabled={offline} />
        <SelectField label="权限" value={workspace.filters.accessScope} options={["include_public", "authorized_only"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, accessScope: value as MarketFilters["accessScope"] }))} disabled={offline} />
        <SelectField label="风险" value={workspace.filters.riskLevel} options={["all", "low", "medium", "high", "unknown"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, riskLevel: value as MarketFilters["riskLevel"] }))} disabled={offline} />
        <SelectField label="排序" value={workspace.filters.sort} options={["composite", "latest_published", "recently_updated", "download_count", "star_count", "relevance"]} onChange={(value) => workspace.setFilters((current) => ({ ...current, sort: value as MarketFilters["sort"] }))} disabled={false} />
      </div>
    </section>
  );
}

function SkillCard({ skill, workspace, ui }: { skill: SkillSummary; workspace: P1WorkspaceState; ui: DesktopUIState }) {
  const offline = workspace.bootstrap.connection.status === "offline" || workspace.bootstrap.connection.status === "failed";
  return (
    <article className="skill-card" key={skill.skillID}>
      <img src={imageForSkill(skill)} alt={skill.displayName} />
      <div className="skill-card-body">
        <div className="inline-heading">
          <TagPill tone={skill.installState === "update_available" ? "warning" : skill.installState === "blocked" ? "danger" : "success"}>{statusLabel(skill)}</TagPill>
          <button className="icon-button" onClick={() => void workspace.toggleStar(skill.skillID)} aria-label={skill.starred ? `取消收藏 ${skill.displayName}` : `收藏 ${skill.displayName}`}>
            <Star size={15} fill={skill.starred ? "currentColor" : "none"} />
            <span>{skill.starCount}</span>
          </button>
        </div>
        <h3>{skill.displayName}</h3>
        <code>{skill.skillID}</code>
        <p>{skill.description}</p>
        <div className="pill-row">
          {skill.tags.slice(0, 3).map((tag) => <TagPill key={tag}>{tag}</TagPill>)}
        </div>
        <small>{skill.authorName} / {skill.authorDepartment}</small>
        <small>v{skill.version} · 风险{riskLabel(skill)} · 更新于 {formatDate(skill.currentVersionUpdatedAt)}</small>
        <div className="inline-actions wrap">
          <button className="btn" onClick={() => ui.openSkillDetail(skill.skillID, "market")}>进入详情</button>
          {!skill.localVersion && skill.canInstall && skill.detailAccess === "full" ? (
            <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "install")} disabled={offline}>安装</button>
          ) : null}
          {skill.installState === "update_available" && skill.canUpdate ? (
            <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "update")} disabled={offline}>更新</button>
          ) : null}
          {skill.localVersion ? (
            <button className="btn" onClick={() => ui.openTargetsModal(skill)} disabled={skill.isScopeRestricted}>
              <Link2 size={15} />
              配置目标
            </button>
          ) : null}
          {!skill.canInstall && !skill.localVersion ? <TagPill tone="warning">{skill.cannotInstallReason ?? "不可安装"}</TagPill> : null}
        </div>
      </div>
    </article>
  );
}

function SkillDetailPanel({ skill, workspace, ui, standalone }: { skill: SkillSummary; workspace: P1WorkspaceState; ui: DesktopUIState; standalone?: boolean }) {
  const offline = workspace.bootstrap.connection.status === "offline" || workspace.bootstrap.connection.status === "failed";
  return (
    <aside className={standalone ? "detail-shell page-detail" : "detail-shell"}>
      <div className="detail-hero">
        <img src={imageForSkill(skill)} alt={skill.displayName} />
        <div className="detail-hero-copy">
          <div className="inline-heading">
            <TagPill tone={skill.detailAccess === "summary" ? "warning" : "info"}>{skill.detailAccess === "summary" ? "摘要详情" : "完整详情"}</TagPill>
            <button className="icon-button" onClick={() => void workspace.toggleStar(skill.skillID)} aria-label={skill.starred ? `取消收藏 ${skill.displayName}` : `收藏 ${skill.displayName}`}>
              <Star size={15} fill={skill.starred ? "currentColor" : "none"} />
              <span>{skill.starCount}</span>
            </button>
          </div>
          <h2>{skill.displayName}</h2>
          <p>{skill.description}</p>
          <small>{skill.skillID} · {skill.authorName} · {skill.authorDepartment}</small>
        </div>
      </div>
      <div className="detail-content">
        <section className="detail-block">
          <h3>基础信息</h3>
          <div className="definition-grid">
            <div><dt>版本</dt><dd>{skill.version}</dd></div>
            <div><dt>本地版本</dt><dd>{skill.localVersion ?? "未安装"}</dd></div>
            <div><dt>风险</dt><dd>{riskLabel(skill)}</dd></div>
            <div><dt>最近更新</dt><dd>{formatDate(skill.currentVersionUpdatedAt)}</dd></div>
          </div>
        </section>

        {skill.detailAccess === "summary" ? (
          <div className="callout warning"><ShieldAlert size={16} /> 该 Skill 暂未向你开放详情；不会展示 README、安全摘要或包信息。</div>
        ) : (
          <>
            <section className="detail-block">
              <h3>使用说明</h3>
              <p>{skill.readme ?? "README 将由服务端返回完整文本。"}</p>
            </section>
            <section className="detail-block">
              <h3>审核与安全信息</h3>
              <p>{skill.reviewSummary ?? "服务端暂未返回审核摘要。"}</p>
            </section>
          </>
        )}

        <section className="detail-block">
          <h3>兼容性</h3>
          <div className="pill-row">
            {skill.compatibleTools.map((tool) => <TagPill key={tool}>{tool}</TagPill>)}
            {skill.compatibleSystems.map((system) => <TagPill key={system}>{system}</TagPill>)}
          </div>
        </section>

        <section className="detail-block">
          <h3>操作区</h3>
          <div className="inline-actions wrap">
            {!skill.localVersion && skill.canInstall && skill.detailAccess === "full" ? (
              <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "install")} disabled={offline}>
                <Download size={15} />
                安装
              </button>
            ) : null}
            {skill.installState === "update_available" && skill.canUpdate ? (
              <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "update")} disabled={offline}>
                <RefreshCw size={15} />
                更新
              </button>
            ) : null}
            {skill.localVersion ? (
              <button className="btn" onClick={() => ui.openTargetsModal(skill)} disabled={skill.isScopeRestricted}>启用到目标</button>
            ) : null}
            {skill.localVersion ? (
              <button className="btn btn-danger" onClick={() => ui.openUninstallConfirm(skill)}>卸载</button>
            ) : null}
          </div>
        </section>

        <section className="detail-block">
          <h3>启用位置</h3>
          {skill.enabledTargets.length === 0 ? <SectionEmpty title="暂无启用位置" body="安装后可启用到工具或项目目标。" /> : null}
          <div className="stack-list compact">
            {skill.enabledTargets.map((target) => (
              <div className="target-row" key={`${target.targetType}:${target.targetID}`}>
                <span>
                  <strong>{target.targetName}</strong>
                  <small>{target.targetPath}</small>
                  <small>{target.requestedMode} → {target.resolvedMode}{target.fallbackReason ? ` · ${target.fallbackReason}` : ""}</small>
                </span>
                <button className="btn btn-small" onClick={() => void workspace.disableSkill(skill.skillID, target.targetID, target.targetType)}>停用</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function MarketPage({ workspace, ui }: PageProps) {
  if (!workspace.loggedIn) {
    return <AuthGateCard title="市场需要登录后同步" body="登录后可搜索企业 Skill、查看完整详情、安装更新并收取服务端通知。" onLogin={() => workspace.requireAuth("market")} />;
  }

  const connection = workspace.bootstrap.connection.status;
  const disconnected = connection === "offline" || connection === "failed" || connection === "connecting";
  const statusTitle =
    connection === "offline"
      ? "离线模式下无法搜索市场"
      : connection === "failed"
        ? "市场数据加载失败"
        : connection === "connecting"
          ? "正在恢复市场连接"
          : "";
  const statusBody =
    connection === "offline"
      ? "已安装 Skill 仍可在本地使用和启用/停用；恢复连接后再继续搜索、安装和更新。"
      : connection === "failed"
        ? workspace.bootstrap.connection.lastError ?? "请检查网络或服务地址，然后重试连接。"
        : connection === "connecting"
          ? "正在等待 live 服务端响应，当前不展示可能失真的市场结果。"
          : "";

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">Skill 市场</div>
          <h1>发现、搜索、筛选和安装 Skill</h1>
          <p>这里的市场数据来自真实服务端；摘要权限与可安装状态均以接口返回为准。</p>
        </div>
        <TagPill tone="info">{workspace.marketSkills.length} 个结果</TagPill>
      </section>
      {disconnected ? (
        <section className="panel">
          <div className="callout warning">
            <AlertTriangle size={16} />
            <span>
              <strong>{statusTitle}</strong>
              <small>{statusBody}</small>
            </span>
          </div>
          <div className="inline-actions wrap">
            <button className="btn btn-primary" onClick={() => void workspace.refreshBootstrap()}>重试连接</button>
            <button className="btn" onClick={ui.openConnectionStatus}>查看连接详情</button>
          </div>
        </section>
      ) : null}
      <MarketToolbar workspace={workspace} ui={ui} />
      <div className="market-layout">
        <section className="skill-grid-panel">
          {disconnected ? <SectionEmpty title={statusTitle} body={statusBody} /> : null}
          {!disconnected && workspace.marketSkills.length === 0 ? <SectionEmpty title="没有找到匹配的 Skill" body="清空筛选后再试一次。" /> : null}
          <div className="skill-grid">
            {!disconnected ? workspace.marketSkills.map((skill) => <SkillCard key={skill.skillID} skill={skill} workspace={workspace} ui={ui} />) : null}
          </div>
        </section>
        {!disconnected && ui.visibleSkillDetail ? <SkillDetailPanel skill={ui.visibleSkillDetail} workspace={workspace} ui={ui} /> : null}
      </div>
    </div>
  );
}

function MyInstalledPage({ workspace, ui }: PageProps) {
  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">我的 Skill</div>
          <h1>已安装</h1>
          <p>按文档展示本机副本、启用范围、更新状态、权限收缩和异常提示。</p>
        </div>
        <button className="btn btn-primary" onClick={() => ui.navigate("market")}>去市场看看</button>
      </section>

      <section className="panel">
        <div className="installed-filter-bar">
          <label className="search-shell installed-search">
            <Search size={16} />
            <input
              aria-label="搜索已安装 Skill"
              value={ui.installedQuery}
              placeholder="搜索 Skill 名称、skillID 或异常提示"
              onChange={(event) => ui.setInstalledQuery(event.target.value)}
            />
          </label>
          <div className="pill-row">
            {([
              ["all", "全部"],
              ["enabled", "已启用"],
              ["updates", "有更新"],
              ["scope_restricted", "权限已收缩"],
              ["issues", "异常"]
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={ui.installedFilter === key ? "btn btn-primary btn-small" : "btn btn-small"}
                onClick={() => ui.setInstalledFilter(key)}
              >
                {label}
                <span className="button-count">{ui.installedFilterCounts[key]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-grid installed-toolbar">
          <TagPill tone="info">{workspace.installedSkills.length} 个本地副本</TagPill>
          <TagPill tone="warning">{ui.installedFilterCounts.updates} 个待更新</TagPill>
          <TagPill tone="success">{ui.installedFilterCounts.enabled} 个已启用</TagPill>
          <TagPill tone={ui.installedFilterCounts.issues > 0 ? "danger" : "info"}>{ui.installedFilterCounts.issues} 个异常</TagPill>
        </div>
        {workspace.installedSkills.length === 0 ? <SectionEmpty title="你还没有安装 Skill" body="进入市场安装后会出现在这里。" /> : null}
        {workspace.installedSkills.length > 0 && ui.filteredInstalledSkills.length === 0 ? <SectionEmpty title="没有符合当前筛选的 Skill" body="清空搜索词或切换筛选后再试一次。" /> : null}
        <div className="stack-list">
          {ui.filteredInstalledSkills.map((skill) => {
            const enabledTools = skill.enabledTargets.filter((target) => target.targetType === "tool").length;
            const enabledProjects = skill.enabledTargets.filter((target) => target.targetType === "project").length;
            const issues = ui.installedSkillIssuesByID[skill.skillID] ?? [];

            return (
            <article className="installed-card" key={skill.skillID}>
              <img src={imageForSkill(skill)} alt={skill.displayName} />
              <div>
                <div className="inline-heading">
                  <strong>{skill.displayName}</strong>
                  <div className="pill-row">
                    <TagPill tone={skill.isScopeRestricted ? "warning" : skill.installState === "update_available" ? "warning" : "success"}>{statusLabel(skill)}</TagPill>
                    {issues.length > 0 ? <TagPill tone="danger">异常</TagPill> : null}
                  </div>
                </div>
                <p>{skill.skillID} · 本地 {skill.localVersion} · 市场 {skill.version}</p>
                <small>已启用工具：{enabledTools} · 已启用项目：{enabledProjects} · 最近启用：{formatDate(skill.lastEnabledAt)}</small>
                {skill.isScopeRestricted ? <div className="callout warning"><ShieldAlert size={16} /> 可继续使用当前版本，但不可更新或新增启用位置。</div> : null}
                {issues.length > 0 ? (
                  <div className="callout warning">
                    <AlertTriangle size={16} />
                    <span>
                      <strong>异常状态</strong>
                      <small>{issues.join("；")}</small>
                    </span>
                  </div>
                ) : null}
                <div className="inline-actions wrap">
                  <button className="btn" onClick={() => ui.openSkillDetail(skill.skillID, "my_installed")}>查看详情</button>
                  {skill.installState === "update_available" && skill.canUpdate ? <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "update")}>更新</button> : null}
                  {skill.isScopeRestricted ? <button className="btn btn-small" disabled>更新已受限</button> : null}
                  <button className="btn" onClick={() => ui.openTargetsModal(skill)} disabled={skill.isScopeRestricted}>编辑启用范围</button>
                  <button className="btn btn-danger" onClick={() => ui.openUninstallConfirm(skill)}>卸载</button>
                </div>
                {skill.enabledTargets.length > 0 ? (
                  <div className="pill-row">
                    {skill.enabledTargets.map((target) => (
                      <TagPill key={`${target.targetType}:${target.targetID}`} tone="info">
                        {target.targetName}
                      </TagPill>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ReviewPage({ workspace, ui }: PageProps) {
  if (!workspace.loggedIn || !workspace.visibleNavigation.includes("review")) {
    return <AuthGateCard title="审核仅对在线管理员开放" body="登录并保持连接后，可只读查看待审核、审核中和已审核单据。" onLogin={() => workspace.requireAuth("review")} />;
  }

  const riskCopy = { low: "低", medium: "中", high: "高", unknown: "未知" } as const;

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">审核工作台</div>
          <h1>发布审核</h1>
          <p>P1 仅保留列表、详情和历史，只读查看真实后端数据，不提供锁单和审核处理动作。</p>
        </div>
        <TagPill tone="info">最小只读</TagPill>
      </section>

      <div className="inline-actions wrap">
        {(["pending", "in_review", "reviewed"] as const).map((tab) => (
          <button key={tab} className={ui.reviewTab === tab ? "btn btn-primary" : "btn"} onClick={() => ui.setReviewTab(tab)}>
            {tab === "pending" ? "待审核" : tab === "in_review" ? "审核中" : "已审核"}
          </button>
        ))}
      </div>

      <div className="workspace-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>单据</th>
              <th>提交人</th>
              <th>风险与初审</th>
              <th>当前状态</th>
              <th>查看</th>
            </tr>
          </thead>
          <tbody>
            {ui.filteredReviews.map((review) => (
              <tr key={review.reviewID}>
                <td>
                  <strong>{review.skillDisplayName}</strong>
                  <div className="table-meta">{review.skillID} · {review.reviewType}</div>
                  <div className="table-meta">提交时间：{formatDate(review.submittedAt)}</div>
                </td>
                <td>{review.submitterName}<br /><span className="table-meta">{review.submitterDepartmentName}</span></td>
                <td><TagPill tone={review.riskLevel === "high" ? "danger" : review.riskLevel === "medium" ? "warning" : "success"}>{riskCopy[review.riskLevel]}</TagPill></td>
                <td>
                  <div className="stack-list compact">
                    <TagPill tone={review.reviewStatus === "reviewed" ? "success" : review.reviewStatus === "in_review" ? "warning" : "info"}>
                      {review.reviewStatus === "pending" ? "待审核" : review.reviewStatus === "in_review" ? "审核中" : "已审核"}
                    </TagPill>
                    <small>{review.lockState === "locked" ? `当前审核人：${review.currentReviewerName ?? "已锁定"}` : "当前未锁定"}</small>
                  </div>
                </td>
                <td>
                  <button className="btn btn-small" onClick={() => workspace.adminData.setSelectedReviewID(review.reviewID)}>查看详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel">
        {!workspace.adminData.selectedReview ? <SectionEmpty title="选择一条审核单查看详情" body="当前支持真实列表、详情和历史时间线。" /> : (
          <>
            <div className="section-heading">
              <div>
                <div className="eyebrow">审核详情</div>
                <h2>{workspace.adminData.selectedReview.skillDisplayName}</h2>
              </div>
              <TagPill tone="info">{workspace.adminData.selectedReview.reviewType}</TagPill>
            </div>
            <p>{workspace.adminData.selectedReview.description}</p>
            <div className="definition-grid split">
              <div><dt>提交人</dt><dd>{workspace.adminData.selectedReview.submitterName}</dd></div>
              <div><dt>部门</dt><dd>{workspace.adminData.selectedReview.submitterDepartmentName}</dd></div>
              <div><dt>状态</dt><dd>{workspace.adminData.selectedReview.reviewStatus}</dd></div>
              <div><dt>当前审核人</dt><dd>{workspace.adminData.selectedReview.currentReviewerName ?? "未锁定"}</dd></div>
            </div>
            {workspace.adminData.selectedReview.reviewSummary ? (
              <div className="detail-block">
                <h3>审核摘要</h3>
                <p>{workspace.adminData.selectedReview.reviewSummary}</p>
              </div>
            ) : null}
            <div className="detail-block">
              <h3>历史时间线</h3>
              <div className="history-list">
                {workspace.adminData.selectedReview.history.map((history) => (
                  <div className="history-row" key={history.historyID}>
                    <strong>{history.action}</strong>
                    <span>{history.actorName}</span>
                    <small>{history.comment ?? "无补充说明"} · {formatDate(history.createdAt)}</small>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DepartmentTree({
  nodes,
  selectedDepartmentID,
  onSelect
}: {
  nodes: P1WorkspaceState["adminData"]["departments"];
  selectedDepartmentID: string | null;
  onSelect: (departmentID: string) => void;
}) {
  return (
    <div className="tree-list">
      {nodes.map((node) => (
        <div className="tree-node" key={node.departmentID}>
          <button className={selectedDepartmentID === node.departmentID ? "tree-button selected" : "tree-button"} onClick={() => onSelect(node.departmentID)}>
            <ChevronRight size={14} />
            <span>{node.name}</span>
            <small>{node.userCount}</small>
          </button>
          {node.children.length > 0 ? <div className="tree-children"><DepartmentTree nodes={node.children} selectedDepartmentID={selectedDepartmentID} onSelect={onSelect} /></div> : null}
        </div>
      ))}
    </div>
  );
}

function ManagePage({ workspace }: PageProps) {
  const [createDepartmentName, setCreateDepartmentName] = useState("");
  const [renameDepartmentName, setRenameDepartmentName] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    displayName: "",
    departmentID: "",
    role: "normal_user" as "normal_user" | "admin",
    adminLevel: "4"
  });
  const [selectedUserID, setSelectedUserID] = useState<string | null>(null);

  const selectedDepartment = workspace.adminData.selectedDepartment;
  const selectedUser = workspace.adminData.adminUsers.find((user) => user.userID === selectedUserID) ?? workspace.adminData.adminUsers[0] ?? null;

  useEffect(() => {
    setSelectedUserID((current) => (workspace.adminData.adminUsers.some((user) => user.userID === current) ? current : workspace.adminData.adminUsers[0]?.userID ?? null));
  }, [workspace.adminData.adminUsers]);

  useEffect(() => {
    if (!selectedDepartment) return;
    setRenameDepartmentName(selectedDepartment.name);
    setNewUser((current) => ({ ...current, departmentID: current.departmentID || selectedDepartment.departmentID }));
  }, [selectedDepartment]);

  if (!workspace.loggedIn || !workspace.visibleNavigation.includes("manage")) {
    return <AuthGateCard title="管理仅对在线管理员开放" body="登录并与服务端保持连接后，可管理部门、用户和 Skill 状态。" onLogin={() => workspace.requireAuth("manage")} />;
  }

  function submitDepartmentCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDepartment || createDepartmentName.trim().length === 0) return;
    void workspace.adminData.createDepartment(selectedDepartment.departmentID, createDepartmentName.trim());
    setCreateDepartmentName("");
  }

  function submitDepartmentRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDepartment || renameDepartmentName.trim().length === 0) return;
    void workspace.adminData.updateDepartment(selectedDepartment.departmentID, renameDepartmentName.trim());
  }

  function submitCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newUser.departmentID || !newUser.username.trim() || !newUser.displayName.trim()) return;
    void workspace.adminData.createAdminUser({
      username: newUser.username.trim(),
      password: newUser.password,
      displayName: newUser.displayName.trim(),
      departmentID: newUser.departmentID,
      role: newUser.role,
      adminLevel: newUser.role === "admin" ? Number(newUser.adminLevel) : null
    });
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">管理中心</div>
          <h1>治理工作台</h1>
          <p>管理员管理本部门及后代部门；真实写操作继续走后端，未接入动作不伪造成功结果。</p>
        </div>
        <TagPill tone="info">自建账号体系</TagPill>
      </section>

      <div className="inline-actions wrap">
        {(["departments", "users", "skills"] as const).map((section) => (
          <button key={section} className={workspace.adminData.manageSection === section ? "btn btn-primary" : "btn"} onClick={() => workspace.adminData.setManageSection(section)}>
            {section === "departments" ? "部门管理" : section === "users" ? "用户管理" : "Skill 管理"}
          </button>
        ))}
      </div>

      {workspace.adminData.manageSection === "departments" ? (
        <div className="page-grid two-up">
          <section className="panel">
            <div className="section-heading"><h2>部门树</h2></div>
            <DepartmentTree nodes={workspace.adminData.departments} selectedDepartmentID={selectedDepartment?.departmentID ?? null} onSelect={workspace.adminData.setSelectedDepartmentID} />
          </section>
          <section className="panel">
            {!selectedDepartment ? <SectionEmpty title="选择部门查看详情" body="右侧会展示路径、人数、Skill 数和管理动作。" /> : (
              <>
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">详情面板</div>
                    <h2>{selectedDepartment.name}</h2>
                  </div>
                  <TagPill tone="info">L{selectedDepartment.level}</TagPill>
                </div>
                <div className="definition-grid split">
                  <div><dt>路径</dt><dd>{selectedDepartment.path}</dd></div>
                  <div><dt>用户数</dt><dd>{selectedDepartment.userCount}</dd></div>
                  <div><dt>Skill 数</dt><dd>{selectedDepartment.skillCount}</dd></div>
                  <div><dt>状态</dt><dd>{selectedDepartment.status}</dd></div>
                </div>
                <form className="inline-form" onSubmit={submitDepartmentCreate}>
                  <input value={createDepartmentName} onChange={(event) => setCreateDepartmentName(event.target.value)} placeholder="新增下级部门" />
                  <button className="btn btn-primary" type="submit"><Plus size={15} />新增</button>
                </form>
                {selectedDepartment.level > 0 ? (
                  <form className="inline-form" onSubmit={submitDepartmentRename}>
                    <input value={renameDepartmentName} onChange={(event) => setRenameDepartmentName(event.target.value)} />
                    <button className="btn" type="submit">保存</button>
                    <button className="btn btn-danger" type="button" onClick={() => void workspace.adminData.deleteDepartment(selectedDepartment.departmentID)}>删除</button>
                  </form>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}

      {workspace.adminData.manageSection === "users" ? (
        <div className="page-grid two-up">
          <section className="panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">账号开通</div>
                <h2>新增用户</h2>
              </div>
              <UserPlus size={18} />
            </div>
            <form className="form-stack" onSubmit={submitCreateUser}>
              <label className="field"><span>用户名</span><input value={newUser.username} onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))} /></label>
              <label className="field"><span>显示名</span><input value={newUser.displayName} onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))} /></label>
              <label className="field"><span>初始密码</span><input value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} /></label>
              <label className="field">
                <span>所属部门</span>
                <select value={newUser.departmentID} onChange={(event) => setNewUser((current) => ({ ...current, departmentID: event.target.value }))}>
                  {flattenDepartments(workspace.adminData.departments).map((department) => (
                    <option key={department.departmentID} value={department.departmentID}>{department.path}</option>
                  ))}
                </select>
              </label>
              <SelectField label="角色" value={newUser.role} options={["normal_user", "admin"]} onChange={(value) => setNewUser((current) => ({ ...current, role: value as "normal_user" | "admin" }))} />
              {newUser.role === "admin" ? <label className="field"><span>管理员等级</span><input value={newUser.adminLevel} onChange={(event) => setNewUser((current) => ({ ...current, adminLevel: event.target.value }))} /></label> : null}
              <button className="btn btn-primary" type="submit">创建用户</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading"><h2>用户列表</h2></div>
            <div className="stack-list">
              {workspace.adminData.adminUsers.map((user) => (
                <button key={user.userID} className={selectedUser?.userID === user.userID ? "admin-list-row selected" : "admin-list-row"} onClick={() => setSelectedUserID(user.userID)}>
                  <span>
                    <strong>{user.displayName}</strong>
                    <small>{user.departmentName} · {user.username}</small>
                  </span>
                  <TagPill tone={user.status === "active" ? "success" : "warning"}>{user.role === "admin" ? `管理员 L${user.adminLevel}` : "普通用户"}</TagPill>
                </button>
              ))}
            </div>
            {selectedUser ? (
              <div className="detail-block">
                <h3>用户操作</h3>
                <div className="inline-actions wrap">
                  <button className="btn" onClick={() => void workspace.adminData.updateAdminUser(selectedUser.userID, { role: "normal_user", adminLevel: null })}>设为普通用户</button>
                  <button className="btn" onClick={() => void workspace.adminData.updateAdminUser(selectedUser.userID, { role: "admin", adminLevel: selectedUser.adminLevel ?? 3 })}>设为管理员</button>
                  {selectedUser.status === "frozen" ? (
                    <button className="btn" onClick={() => void workspace.adminData.unfreezeAdminUser(selectedUser.userID)}>解冻</button>
                  ) : (
                    <button className="btn" onClick={() => void workspace.adminData.freezeAdminUser(selectedUser.userID)}>冻结</button>
                  )}
                  <button className="btn btn-danger" onClick={() => void workspace.adminData.deleteAdminUser(selectedUser.userID)}>删除</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {workspace.adminData.manageSection === "skills" ? (
        <section className="panel">
          <div className="section-heading"><h2>Skill 管理</h2></div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>发布者</th>
                <th>状态</th>
                <th>热度</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {workspace.adminData.adminSkills.map((skill) => (
                <tr key={skill.skillID}>
                  <td><strong>{skill.displayName}</strong><div className="table-meta">{skill.skillID} · v{skill.version}</div></td>
                  <td>{skill.publisherName}<br /><span className="table-meta">{skill.departmentName}</span></td>
                  <td><TagPill tone="info">{skill.status}</TagPill></td>
                  <td><span className="table-meta">Star {skill.starCount} · 下载 {skill.downloadCount}</span></td>
                  <td>
                    <div className="inline-actions wrap">
                      {skill.status !== "delisted" ? (
                        <button className="btn btn-small" onClick={() => void workspace.adminData.delistAdminSkill(skill.skillID)}>下架</button>
                      ) : (
                        <button className="btn btn-small" onClick={() => void workspace.adminData.relistAdminSkill(skill.skillID)}>上架</button>
                      )}
                      <button className="btn btn-danger btn-small" onClick={() => void workspace.adminData.archiveAdminSkill(skill.skillID)}><Archive size={14} />归档</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function ToolsPage({ workspace, ui }: PageProps) {
  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">工具管理</div>
          <h1>本机 AI 工具</h1>
          <p>工具状态、注册表/默认路径检测、手动覆盖和目录扫描都来自真实 Tauri 本地状态。</p>
        </div>
        <div className="inline-actions">
          <button className="btn" onClick={() => void workspace.refreshTools()}><RefreshCw size={15} />刷新检测</button>
          <button className="btn btn-primary" onClick={() => ui.openToolEditor()}><Plus size={15} />添加自定义工具</button>
        </div>
      </section>

      <div className="card-grid">
        {workspace.tools.map((tool) => {
          const scanSummary = workspace.scanTargets.find((summary) => summary.targetType === "tool" && summary.targetID === tool.toolID) ?? null;
          const abnormalCount = scanSummary ? scanSummary.counts.unmanaged + scanSummary.counts.conflict + scanSummary.counts.orphan : 0;
          return (
            <article className="panel tool-card" key={tool.toolID}>
              <div className="inline-heading">
                <div className="tool-mark"><CircleGauge size={18} /></div>
                <div>
                  <h3>{tool.name}</h3>
                  <small>{tool.transformStrategy}</small>
                </div>
              </div>
              <div className="pill-row">
                <TagPill tone={tool.adapterStatus === "detected" ? "success" : tool.adapterStatus === "manual" ? "info" : "warning"}>{tool.adapterStatus}</TagPill>
                <TagPill tone="info">{tool.detectionMethod}</TagPill>
                {abnormalCount > 0 ? <TagPill tone="warning">扫描异常 {abnormalCount}</TagPill> : null}
              </div>
              <p>配置路径：{tool.configPath || "未配置"}</p>
              <small>自动检测路径：{tool.detectedPath ?? "未命中"}</small>
              <small>手动覆盖路径：{tool.configuredPath ?? "未覆盖"}</small>
              <small>skills 路径：{tool.skillsPath}</small>
              <small>已启用 Skill：{tool.enabledSkillCount} · {tool.enabled ? "配置已启用" : "配置已停用"} · 最近扫描：{formatDate(tool.lastScannedAt ?? null)}</small>
              {tool.adapterStatus === "missing" || tool.adapterStatus === "invalid" ? (
                <div className="callout warning">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>{tool.adapterStatus === "missing" ? "工具未检测到" : "工具路径不可用"}</strong>
                    <small>请修改当前项路径后重新检测。</small>
                  </span>
                </div>
              ) : null}
              {scanSummary && abnormalCount > 0 ? (
                <div className="callout warning">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>扫描摘要</strong>
                    <small>{scanSummary.findings.filter((finding) => finding.kind !== "managed").slice(0, 2).map((finding) => finding.message).join("；")}</small>
                  </span>
                </div>
              ) : null}
              <div className="inline-actions wrap">
                <button className="btn" onClick={() => ui.openToolEditor(tool)}>修改路径</button>
                <button className="btn btn-small" onClick={() => void workspace.scanLocalTargets()}>重新扫描</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsPage({ workspace, ui }: PageProps) {
  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">项目级启用</div>
          <h1>项目</h1>
          <p>项目级路径优先于工具级路径；项目列表、最终启用结果和扫描摘要都来自本地 SQLite 真源。</p>
        </div>
        <div className="inline-actions">
          <button className="btn" onClick={() => void workspace.scanLocalTargets()}><RefreshCw size={15} />重新扫描</button>
          <button className="btn btn-primary" onClick={() => ui.openProjectEditor()}><FolderPlus size={15} />添加项目</button>
        </div>
      </section>

      {workspace.projects.length === 0 ? <SectionEmpty title="项目为空" body="添加项目后可配置项目级 skills 目录。" /> : null}
      <div className="card-grid">
        {workspace.projects.map((project) => {
          const scanSummary = workspace.scanTargets.find((summary) => summary.targetType === "project" && summary.targetID === project.projectID) ?? null;
          const effectiveSkills = workspace.installedSkills.filter((skill) =>
            skill.enabledTargets.some((target) => target.targetType === "project" && target.targetID === project.projectID)
          );
          return (
            <article className="panel project-card" key={project.projectID}>
              <div className="inline-heading">
                <div className="tool-mark"><Link2 size={18} /></div>
                <div>
                  <h3>{project.name}</h3>
                  <small>{project.enabled ? "已启用" : "已停用"}</small>
                </div>
              </div>
              <p>项目路径：{project.projectPath}</p>
              <small>skills 路径：{project.skillsPath}</small>
              <small>已启用 Skill：{project.enabledSkillCount} · 创建于 {formatDate(project.createdAt)} · 更新于 {formatDate(project.updatedAt)}</small>
              {scanSummary ? (
                <small>扫描结果：托管 {scanSummary.counts.managed} / 异常 {scanSummary.counts.unmanaged + scanSummary.counts.conflict + scanSummary.counts.orphan} · 最近扫描 {formatDate(scanSummary.scannedAt)}</small>
              ) : null}
              {effectiveSkills.length > 0 ? (
                <div className="pill-row">
                  {effectiveSkills.map((skill) => <TagPill key={skill.skillID} tone="info">{skill.displayName}</TagPill>)}
                </div>
              ) : (
                <SectionEmpty title="暂无最终生效 Skill" body="启用到当前项目后，会在这里显示最终落地结果。" />
              )}
              <div className="inline-actions wrap">
                <button className="btn" onClick={() => ui.openProjectEditor(project)}>修改路径</button>
                {project.enabled ? <TagPill tone="info">项目级优先</TagPill> : <TagPill tone="warning">当前停用</TagPill>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsPage({ workspace, ui }: PageProps) {
  if (!workspace.loggedIn) {
    return <AuthGateCard title="通知需要登录后同步" body="登录后可查看真实服务端通知、标记已读并同步离线事件。" onLogin={() => workspace.requireAuth("notifications")} />;
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">应用内消息中心</div>
          <h1>通知</h1>
          <p>服务端通知、本地事件同步结果和未读状态在这里统一汇总。</p>
        </div>
        <div className="inline-actions wrap">
          <button className={ui.notificationFilter === "all" ? "btn btn-primary" : "btn"} onClick={() => ui.setNotificationFilter("all")}>全部</button>
          <button className={ui.notificationFilter === "unread" ? "btn btn-primary" : "btn"} onClick={() => ui.setNotificationFilter("unread")}>未读</button>
          <button className="btn" onClick={() => void workspace.markNotificationsRead("all")}>全部已读</button>
          <button className="btn" onClick={() => void workspace.syncOfflineEvents()}>同步本地事件（{workspace.offlineEvents.length}）</button>
        </div>
      </section>

      {ui.filteredNotifications.length === 0 ? <SectionEmpty title="暂无通知" body="新的安装、更新、路径异常或连接状态会出现在这里。" /> : null}
      <div className="stack-list">
        {ui.filteredNotifications.map((notice) => (
          <button className={notice.unread ? "notice-row unread" : "notice-row"} key={notice.notificationID} onClick={() => { ui.navigate(notice.targetPage); void workspace.markNotificationsRead([notice.notificationID]); }}>
            <span>
              <strong>{notice.title}</strong>
              <small>{notice.summary}</small>
            </span>
            <small>{notice.source} · {formatDate(notice.occurredAt)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function PreferenceToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SettingsPage({ workspace, ui }: PageProps) {
  function updatePreference<K extends keyof PreferenceState>(key: K, value: PreferenceState[K]) {
    ui.setPreferences((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">基础偏好</div>
          <h1>设置</h1>
          <p>语言、主题和同步偏好都保存在本地，不依赖远端接口。</p>
        </div>
        <TagPill tone="info">{themeLabel(ui.preferences.theme)}</TagPill>
      </section>

      <div className="card-grid">
        <section className="panel">
          <h2>语言</h2>
          <SelectField label="显示语言" value={ui.preferences.language} options={["auto", "zh-CN", "en-US"]} onChange={(value) => updatePreference("language", value as PreferenceState["language"])} />
          <PreferenceToggle label="按系统地区自动识别" checked={ui.preferences.autoDetectLanguage} onChange={(value) => updatePreference("autoDetectLanguage", value)} />
        </section>
        <section className="panel">
          <h2>主题</h2>
          <SelectField label="主题" value={ui.preferences.theme} options={["classic", "fresh", "contrast"]} onChange={(value) => updatePreference("theme", value as PreferenceState["theme"])} />
          <div className="pill-row">
            <TagPill>经典白</TagPill>
            <TagPill>清爽绿</TagPill>
            <TagPill>高对比</TagPill>
          </div>
        </section>
        <section className="panel">
          <h2>Central Store</h2>
          <p>{workspace.bootstrap.user.locale === "zh-CN" ? "%APPDATA%\\EnterpriseAgentHub\\CentralStore" : "%APPDATA%\\EnterpriseAgentHub\\CentralStore"}</p>
          <small>前端只展示路径；真实文件写入仍通过 Tauri 命令完成。</small>
        </section>
        <section className="panel">
          <h2>同步偏好</h2>
          <PreferenceToggle label="显示安装/更新结果" checked={ui.preferences.showInstallResults} onChange={(value) => updatePreference("showInstallResults", value)} />
          <PreferenceToggle label="联网后同步本地事件" checked={ui.preferences.syncLocalEvents} onChange={(value) => updatePreference("syncLocalEvents", value)} />
          <div className="inline-actions">
            <button className="btn" onClick={() => void workspace.refreshBootstrap()}><RefreshCw size={15} />刷新启动上下文</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ActivePageContent({ workspace, ui }: PageProps) {
  switch (ui.activePage) {
    case "home":
      return <HomePage workspace={workspace} ui={ui} />;
    case "market":
      return <MarketPage workspace={workspace} ui={ui} />;
    case "detail":
      return ui.visibleSkillDetail ? <SkillDetailPanel skill={ui.visibleSkillDetail} workspace={workspace} ui={ui} standalone /> : <SectionEmpty title="没有找到这个 Skill" body="返回市场重新选择。" />;
    case "my_installed":
      return <MyInstalledPage workspace={workspace} ui={ui} />;
    case "review":
      return <ReviewPage workspace={workspace} ui={ui} />;
    case "manage":
      return <ManagePage workspace={workspace} ui={ui} />;
    case "tools":
      return <ToolsPage workspace={workspace} ui={ui} />;
    case "projects":
      return <ProjectsPage workspace={workspace} ui={ui} />;
    case "notifications":
      return <NotificationsPage workspace={workspace} ui={ui} />;
    case "settings":
      return <SettingsPage workspace={workspace} ui={ui} />;
  }
}
