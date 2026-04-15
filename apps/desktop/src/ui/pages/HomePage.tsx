import { localize, categoryIcon, formatDate, riskLabel, statusLabel } from "../desktopShared.tsx";
import { PageProps, SectionEmpty, TagPill } from "./pageCommon.tsx";

function formatMetricCount(value: number, language: "zh-CN" | "en-US") {
  return new Intl.NumberFormat(language, {
    notation: value >= 1000 ? "compact" : "standard",
    compactDisplay: "short",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function HomeMetricCards({ workspace, ui }: PageProps) {
  const metrics = [
    [localize(ui.language, "本机已安装", "Installed"), workspace.bootstrap.counts.installedCount],
    [localize(ui.language, "已启用目标", "Enabled Targets"), workspace.bootstrap.counts.enabledCount],
    [localize(ui.language, "待更新", "Updates"), workspace.bootstrap.counts.updateAvailableCount],
    [localize(ui.language, "未读通知", "Unread"), workspace.bootstrap.counts.unreadNotificationCount]
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

function HomeRecommendation({ skill, ui }: Pick<PageProps, "ui"> & { skill: PageProps["workspace"]["installedSkills"][number] }) {
  return (
    <button className="recommendation-row no-art" onClick={() => ui.openSkillDetail(skill.skillID, "home")}>
      <div className="signal-mark">{categoryIcon(skill)}</div>
      <span>
        <strong>{skill.displayName}</strong>
        <small>{skill.authorDepartment} · {localize(ui.language, "风险", "Risk")} {riskLabel(skill, ui.language)}</small>
      </span>
      <TagPill tone="info">{statusLabel(skill, ui.language)}</TagPill>
    </button>
  );
}

function HomeSignalCard({ skill, workspace, ui }: PageProps & { skill: PageProps["workspace"]["installedSkills"][number] }) {
  const action = !skill.localVersion ? "install" : skill.installState === "update_available" ? "update" : "detail";
  return (
    <article className="signal-card no-art">
      <div className="signal-mark">{categoryIcon(skill)}</div>
      <div>
        <div className="inline-heading">
          <strong>{skill.displayName}</strong>
          <TagPill tone={skill.installState === "update_available" ? "warning" : "success"}>{statusLabel(skill, ui.language)}</TagPill>
        </div>
        <p>{skill.description}</p>
        <div className="inline-actions">
          {action === "install" ? (
            <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "install")}>{localize(ui.language, "安装", "Install")}</button>
          ) : null}
          {action === "update" ? (
            <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "update")}>{localize(ui.language, "更新", "Update")}</button>
          ) : null}
          {action === "detail" ? (
            <button className="btn" onClick={() => ui.openSkillDetail(skill.skillID, "home")}>{localize(ui.language, "查看详情", "View")}</button>
          ) : null}
          {skill.localVersion ? (
            <button className="btn" onClick={() => workspace.openPage("my_installed")}>{localize(ui.language, "已安装", "Installed")}</button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function HomePage({ workspace, ui }: PageProps) {
  const localSignals = [...workspace.installedSkills]
    .sort((left, right) => right.currentVersionUpdatedAt.localeCompare(left.currentVersionUpdatedAt))
    .slice(0, 3);
  const recommended = (workspace.loggedIn ? workspace.skills : workspace.installedSkills).slice(0, 3);
  const notices = workspace.notifications.filter((notice) => notice.unread).slice(0, 3);

  return (
    <div className="page-stack">
      <section className="home-hero panel">
        <div>
          <div className="eyebrow">{localize(ui.language, "本地工作台", "Local Workspace")}</div>
          <h1>{workspace.loggedIn ? localize(ui.language, "本机 Skill 与服务状态", "Local Skills and Service Status") : localize(ui.language, "先用本地模式开始", "Start in Local Mode")}</h1>
          <p>
            {workspace.loggedIn
              ? workspace.bootstrap.connection.lastError ?? localize(ui.language, "查看本地 Skill、工具和项目；需要在线能力时再同步服务端数据。", "Review local skills, tools, and projects. Sync server data only when needed.")
              : localize(ui.language, "先查看本地 Skill、工具和项目；需要市场、通知或管理员能力时再登录。", "Use local skills, tools, and projects first. Sign in when you need market, notifications, or admin features.")}
          </p>
        </div>
        <div className="inline-actions wrap">
          <button className="btn btn-primary" onClick={() => workspace.loggedIn ? ui.navigate("market") : workspace.requireAuth("market")}>{localize(ui.language, "进入市场", "Open Market")}</button>
          <button className="btn" onClick={() => ui.navigate("my_installed")}>{localize(ui.language, "查看我的 Skill", "My Skills")}</button>
          <button className="btn" onClick={() => ui.navigate("tools")}>{localize(ui.language, "工具管理", "Manage Tools")}</button>
        </div>
      </section>

      <HomeMetricCards workspace={workspace} ui={ui} />

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
                <small>{formatDate(notice.occurredAt, ui.language)}</small>
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
