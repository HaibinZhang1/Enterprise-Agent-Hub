import { useState } from "react";
import { AlertTriangle, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { categoryIcon, formatDate, statusLabel } from "../desktopShared.tsx";
import { PageProps, SectionEmpty, TagPill } from "./pageCommon.tsx";

import { useInstalledSkillsView } from "../../state/ui/useInstalledSkillsView.ts";

function discoveredLocationSummary(skill: PageProps["workspace"]["discoveredLocalSkills"][number]) {
  const toolCount = skill.targets.filter((target) => target.targetType === "tool").length;
  const projectCount = skill.targets.filter((target) => target.targetType === "project").length;
  const issueCount = skill.targets.filter((target) => target.findingKind !== "unmanaged").length;
  const parts = [`${skill.targets.length} 个位置`];

  if (toolCount > 0) parts.push(`${toolCount} 个工具`);
  if (projectCount > 0) parts.push(`${projectCount} 个项目`);
  parts.push(issueCount > 0 ? `${issueCount} 个需处理` : "待确认");

  return parts.join(" · ");
}

function discoveredPreview(skill: PageProps["workspace"]["discoveredLocalSkills"][number]) {
  if (skill.targets.some((target) => target.findingKind === "conflict")) {
    return "目录内容与登记不一致，建议先确认来源和覆盖策略。";
  }
  if (skill.targets.some((target) => target.findingKind === "orphan")) {
    return "目录有托管痕迹但登记缺失，建议尽快修复来源。";
  }
  if (skill.matchedMarketSkill) {
    return "市场已存在同名 Skill，可先看详情再决定是否纳入管理。";
  }
  return "本地目录里发现未托管副本，默认不会直接覆盖。";
}

function discoveryManageLabel(skill: PageProps["workspace"]["discoveredLocalSkills"][number]) {
  const hasTool = skill.targets.some((target) => target.targetType === "tool");
  const hasProject = skill.targets.some((target) => target.targetType === "project");
  if (hasTool && hasProject) return "前往位置管理";
  return hasProject ? "前往项目页" : "前往工具页";
}

export function MyInstalledPage({ workspace, ui }: PageProps) {
  const [expandedDiscoveredSkillIDs, setExpandedDiscoveredSkillIDs] = useState<string[]>([]);
  const {
    installedQuery,
    installedFilter,
    filteredInstalledSkills,
    installedFilterCounts,
    installedSkillIssuesByID,
    setInstalledQuery,
    setInstalledFilter
  } = useInstalledSkillsView(workspace);

  function toggleDiscoveredDetails(skillID: string) {
    setExpandedDiscoveredSkillIDs((current) =>
      current.includes(skillID) ? current.filter((item) => item !== skillID) : [...current, skillID]
    );
  }

  const query = installedQuery.trim().toLocaleLowerCase();
  const visibleDiscoveredSkills =
    installedFilter === "all" || installedFilter === "issues"
      ? workspace.discoveredLocalSkills.filter((skill) =>
          query.length === 0 ||
          skill.displayName.toLocaleLowerCase().includes(query) ||
          skill.skillID.toLocaleLowerCase().includes(query) ||
          skill.targets.some((target) => target.targetName.toLocaleLowerCase().includes(query) || target.relativePath.toLocaleLowerCase().includes(query))
        )
      : [];

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">本地资产</div>
          <h1>已安装的 Skill</h1>
          <p>本地工作台，查看从市场上拉取进来的副本状态，处理版本更新及目录变动异常。</p>
        </div>
        <div className="inline-actions wrap">
          <button className="btn" onClick={() => ui.navigate("market")}>去市场看看</button>
        </div>
      </section>

      <section className="panel">
        <div className="installed-filter-bar">
          <label className="search-shell installed-search">
            <Search size={16} />
            <input
              aria-label="搜索已安装 Skill"
              value={installedQuery}
              placeholder="搜索 Skill 名称、skillID 或异常提示"
              onChange={(event) => setInstalledQuery(event.target.value)}
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
                className={installedFilter === key ? "btn btn-primary btn-small" : "btn btn-small"}
                onClick={() => setInstalledFilter(key)}
              >
                {label}
                <span className="button-count">{installedFilterCounts[key]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-grid installed-toolbar">
          <TagPill tone="info">{workspace.installedSkills.length} 个本地副本</TagPill>
          {workspace.discoveredLocalSkills.length > 0 ? <TagPill tone="warning">{workspace.discoveredLocalSkills.length} 个目录扫描发现</TagPill> : null}
          {installedFilterCounts.updates > 0 ? <TagPill tone="warning">{installedFilterCounts.updates} 个待更新</TagPill> : null}
          {installedFilterCounts.issues > 0 ? <TagPill tone="danger">{installedFilterCounts.issues} 个异常</TagPill> : null}
        </div>
        
        {workspace.installedSkills.length === 0 && workspace.discoveredLocalSkills.length === 0 ? <SectionEmpty title="你还没有安装 Skill" body="进入市场安装后会出现在这里。" /> : null}
        {workspace.installedSkills.length > 0 && filteredInstalledSkills.length === 0 && visibleDiscoveredSkills.length === 0 ? <SectionEmpty title="没有符合当前筛选的 Skill" body="清空搜索词或切换筛选后再试一次。" /> : null}
        
        <div className="stack-list">
          {filteredInstalledSkills.map((skill) => {
            const enabledTools = skill.enabledTargets.filter((target) => target.targetType === "tool").length;
            const enabledProjects = skill.enabledTargets.filter((target) => target.targetType === "project").length;
            const issues = installedSkillIssuesByID[skill.skillID] ?? [];
            const visibleTargets = skill.enabledTargets.slice(0, 3);
            const hiddenTargetCount = Math.max(0, skill.enabledTargets.length - visibleTargets.length);

            return (
              <article className="installed-card no-art" key={skill.skillID}>
                <div className="signal-mark">{categoryIcon(skill)}</div>
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
                  
                  {skill.isScopeRestricted ? <div className="inline-alert warning"><ShieldAlert size={16} /> 可继续使用当前版本，但不可更新或新增启用位置。</div> : null}
                  {issues.length > 0 ? (
                    <div className="inline-alert warning">
                      <AlertTriangle size={16} />
                      <span>
                        <strong>异常状态</strong>
                        <small>{issues.join("；")}</small>
                      </span>
                    </div>
                  ) : null}
                  
                  <div className="inline-actions wrap" style={{ marginTop: 12 }}>
                    <button className="btn" onClick={() => ui.openSkillDetail(skill.skillID, "my_installed")}>查看详情</button>
                    {skill.installState === "update_available" && skill.canUpdate ? <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "update")}>更新</button> : null}
                    {skill.isScopeRestricted ? <button className="btn btn-small" disabled>更新已受限</button> : null}
                    <button className="btn" onClick={() => ui.openTargetsModal(skill)} disabled={skill.isScopeRestricted}>启/停范围配置</button>
                    <button className="btn btn-danger" onClick={() => ui.openUninstallConfirm(skill)}>卸载</button>
                  </div>
                  
                  {skill.enabledTargets.length > 0 ? (
                    <div className="pill-row" style={{ marginTop: 12 }}>
                      {visibleTargets.map((target) => (
                        <TagPill key={`${target.targetType}:${target.targetID}`} tone="info">
                          {target.targetName}
                        </TagPill>
                      ))}
                      {hiddenTargetCount > 0 ? <TagPill tone="neutral">+{hiddenTargetCount} 个位置</TagPill> : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        
        {visibleDiscoveredSkills.length > 0 ? (
          <div className="stack-list" style={{ marginTop: 24 }}>
            <div className="section-heading">
              <div>
                <div className="eyebrow">目录扫描雷达</div>
                <h2>物理空间扫描发现 ({visibleDiscoveredSkills.length})</h2>
                <p>主动识别被拖拽或手动散落在工具与项目对应 `skills` 目录下的外部数据包。</p>
              </div>
              <button className="btn btn-small" onClick={() => void workspace.scanLocalTargets()}>
                <RefreshCw size={15} />
                强制重扫
              </button>
            </div>
            {visibleDiscoveredSkills.map((skill) => {
              const expanded = expandedDiscoveredSkillIDs.includes(skill.skillID);

              return (
                <article className="panel discovered-skill-card" key={skill.skillID}>
                  <div className="inline-heading">
                    <div className="discovered-skill-summary">
                      <strong>{skill.displayName}</strong>
                      <p>{skill.skillID}</p>
                    </div>
                    <div className="pill-row">
                      <TagPill tone="warning">{skill.sourceLabel}</TagPill>
                      {skill.matchedMarketSkill ? <TagPill tone="info">市场已存在同名资产</TagPill> : null}
                    </div>
                  </div>
                  <p>{discoveredPreview(skill)}</p>
                  <div className="discovered-meta-line">
                    <span>{discoveredLocationSummary(skill)}</span>
                  </div>
                  <div className="inline-actions wrap" style={{ marginTop: 12 }}>
                    {skill.matchedMarketSkill ? (
                      <button className="btn btn-primary" onClick={() => ui.openSkillDetail(skill.skillID, "my_installed")}>查看市场详情与对齐</button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => ui.navigate(skill.targets.some((target) => target.targetType === "project") ? "projects" : "tools")}>
                        {discoveryManageLabel(skill)}
                      </button>
                    )}
                    <button className="btn" onClick={() => toggleDiscoveredDetails(skill.skillID)}>
                      {expanded ? "收起明细栈" : `展开 ${skill.targets.length} 处路径`}
                    </button>
                  </div>
                  {expanded ? (
                    <div className="discovered-target-list">
                      {skill.targets.map((target, idx) => (
                        <div className="discovered-target-row" key={`${skill.skillID}:${target.targetType}:${target.targetID}:${idx}`}>
                          <div className="inline-heading">
                            <strong>{target.targetName}</strong>
                            <TagPill tone={target.findingKind === "unmanaged" ? "info" : "warning"}>
                              {target.findingKind === "conflict" ? "哈希内容不一致" : target.findingKind === "orphan" ? "存托管痕迹但无登记" : "游离(未托管)"}
                            </TagPill>
                          </div>
                          <small className="target-path-line" title={target.targetPath}>{target.targetPath}</small>
                          <small style={{ color: "var(--amber)" }}>{target.message}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
