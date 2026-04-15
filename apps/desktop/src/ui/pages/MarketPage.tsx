import { Download, RefreshCw, Search, ShieldAlert, Star, AlertTriangle } from "lucide-react";
import type { MarketFilters, SkillSummary } from "../../domain/p1.ts";
import { downloadAuthenticatedFile } from "../../services/p1Client.ts";
import { categoryIcon, formatDate, localize, riskLabel, statusLabel } from "../desktopShared.tsx";
import { AuthGateCard, PageProps, SectionEmpty, SelectField, TagPill } from "./pageCommon.tsx";

function formatMetricCount(value: number, language: "zh-CN" | "en-US") {
  return new Intl.NumberFormat(language, {
    notation: value >= 1000 ? "compact" : "standard",
    compactDisplay: "short",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function MarketToolbar({ workspace, ui }: PageProps) {
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
        <SelectField
          label={localize(ui.language, "部门", "Department")}
          value={workspace.filters.department}
          options={[
            { value: "all", label: localize(ui.language, "全部", "All") },
            ...workspace.departments.map((department) => ({ value: department, label: department }))
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, department: value }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "工具", "Tool")}
          value={workspace.filters.compatibleTool}
          options={[
            { value: "all", label: localize(ui.language, "全部", "All") },
            ...workspace.compatibleTools.map((tool) => ({ value: tool, label: tool }))
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, compatibleTool: value }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "安装", "Install")}
          value={workspace.filters.installed}
          options={[
            { value: "all", label: localize(ui.language, "全部", "All") },
            { value: "installed", label: localize(ui.language, "已安装", "Installed") },
            { value: "not_installed", label: localize(ui.language, "未安装", "Not Installed") }
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, installed: value as MarketFilters["installed"] }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "启用", "Enabled")}
          value={workspace.filters.enabled}
          options={[
            { value: "all", label: localize(ui.language, "全部", "All") },
            { value: "enabled", label: localize(ui.language, "已启用", "Enabled") },
            { value: "not_enabled", label: localize(ui.language, "未启用", "Not Enabled") }
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, enabled: value as MarketFilters["enabled"] }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "权限", "Access")}
          value={workspace.filters.accessScope}
          options={[
            { value: "include_public", label: localize(ui.language, "全部可见", "All Visible") },
            { value: "authorized_only", label: localize(ui.language, "仅授权", "Authorized Only") }
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, accessScope: value as MarketFilters["accessScope"] }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "分类", "Category")}
          value={workspace.filters.category}
          options={[
            { value: "all", label: localize(ui.language, "全部", "All") },
            ...workspace.categories.map((category) => ({ value: category, label: category }))
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, category: value }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "风险", "Risk")}
          value={workspace.filters.riskLevel}
          options={[
            { value: "all", label: localize(ui.language, "全部", "All") },
            { value: "low", label: localize(ui.language, "低", "Low") },
            { value: "medium", label: localize(ui.language, "中", "Medium") },
            { value: "high", label: localize(ui.language, "高", "High") },
            { value: "unknown", label: localize(ui.language, "未知", "Unknown") }
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, riskLevel: value as MarketFilters["riskLevel"] }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "发布时间", "Published")}
          value={workspace.filters.publishedWithin}
          options={[
            { value: "all", label: localize(ui.language, "全部时间", "Any Time") },
            { value: "7d", label: localize(ui.language, "最近 7 天", "Last 7 Days") },
            { value: "30d", label: localize(ui.language, "最近 30 天", "Last 30 Days") },
            { value: "90d", label: localize(ui.language, "最近 90 天", "Last 90 Days") }
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, publishedWithin: value as MarketFilters["publishedWithin"] }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "更新时间", "Updated")}
          value={workspace.filters.updatedWithin}
          options={[
            { value: "all", label: localize(ui.language, "全部时间", "Any Time") },
            { value: "7d", label: localize(ui.language, "最近 7 天", "Last 7 Days") },
            { value: "30d", label: localize(ui.language, "最近 30 天", "Last 30 Days") },
            { value: "90d", label: localize(ui.language, "最近 90 天", "Last 90 Days") }
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, updatedWithin: value as MarketFilters["updatedWithin"] }))}
          disabled={offline}
        />
        <SelectField
          label={localize(ui.language, "排序", "Sort")}
          value={workspace.filters.sort}
          options={[
            { value: "composite", label: localize(ui.language, "综合排序", "Recommended") },
            { value: "latest_published", label: localize(ui.language, "最新发布", "Latest Published") },
            { value: "recently_updated", label: localize(ui.language, "最近更新", "Recently Updated") },
            { value: "download_count", label: localize(ui.language, "下载量", "Downloads") },
            { value: "star_count", label: localize(ui.language, "收藏数", "Stars") },
            { value: "relevance", label: localize(ui.language, "相关度", "Relevance") }
          ]}
          onChange={(value) => workspace.setFilters((current) => ({ ...current, sort: value as MarketFilters["sort"] }))}
          disabled={false}
        />
      </div>
    </section>
  );
}

function SkillCard({ skill, workspace, ui }: PageProps & { skill: SkillSummary }) {
  return (
    <article className="skill-card no-art" key={skill.skillID} data-testid="market-skill-card" data-skill-id={skill.skillID}>
      <button className="skill-row-main" onClick={() => ui.openSkillDetail(skill.skillID, "market")}>
        <div className="signal-mark">{categoryIcon(skill)}</div>
        <div className="skill-row-copy">
          <h3>{skill.displayName}</h3>
          <p className="skill-row-description">{skill.description}</p>
        </div>
      </button>
      <div className="skill-row-metrics">
        <button
          className="skill-metric skill-metric-button"
          onClick={() => void workspace.toggleStar(skill.skillID)}
          aria-label={skill.starred ? `取消收藏 ${skill.displayName}` : `收藏 ${skill.displayName}`}
        >
          <Star size={15} fill={skill.starred ? "currentColor" : "none"} />
          <span>{formatMetricCount(skill.starCount, ui.language)}</span>
        </button>
        <div className="skill-metric">
          <Download size={15} />
          <span>{formatMetricCount(skill.downloadCount, ui.language)}</span>
        </div>
        <div className="skill-metric skill-metric-status">
          <TagPill tone={skill.installState === "update_available" ? "warning" : skill.installState === "blocked" ? "danger" : "success"}>
            {statusLabel(skill, ui.language)}
          </TagPill>
        </div>
        <div className="skill-metric skill-metric-version">
          <span>v{skill.version}</span>
        </div>
      </div>
    </article>
  );
}

export function SkillDetailPanel({ skill, workspace, ui, standalone }: PageProps & { skill: SkillSummary; standalone?: boolean }) {
  const offline = workspace.bootstrap.connection.status === "offline" || workspace.bootstrap.connection.status === "failed";
  return (
    <aside className={standalone ? "detail-shell page-detail" : "detail-shell"}>
      <div className="detail-head">
        <div className="detail-head-copy">
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

export function MarketPage({ workspace, ui }: PageProps) {
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
      <section className="panel skill-grid-panel">
        {disconnected ? <SectionEmpty title={statusTitle} body={statusBody} /> : null}
        {!disconnected && workspace.marketSkills.length === 0 ? <SectionEmpty title="没有找到匹配的 Skill" body="清空筛选后再试一次。" /> : null}
        <div className="skill-grid">
          {!disconnected ? workspace.marketSkills.map((skill) => <SkillCard key={skill.skillID} skill={skill} workspace={workspace} ui={ui} />) : null}
        </div>
      </section>
    </div>
  );
}
