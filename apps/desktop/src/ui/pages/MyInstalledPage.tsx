import { AlertTriangle, Search, ShieldAlert } from "lucide-react";
import { categoryIcon, formatDate, statusLabel } from "../desktopShared.tsx";
import { PageProps, SectionEmpty, TagPill } from "./pageCommon.tsx";
import { useInstalledSkillsView } from "../../state/ui/useInstalledSkillsView.ts";

export function MyInstalledPage({ workspace, ui }: PageProps) {
  const {
    installedQuery,
    installedFilter,
    filteredInstalledSkills,
    installedFilterCounts,
    installedSkillIssuesByID,
    setInstalledQuery,
    setInstalledFilter,
  } = useInstalledSkillsView(workspace, {
    installedFilter: ui.installedFilter,
    setInstalledFilter: ui.setInstalledFilter,
  });

  const abnormalInstalledSkills = workspace.installedSkills.filter((skill) => (installedSkillIssuesByID[skill.skillID] ?? []).length > 0);

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">本地资产</div>
          <h1>已安装</h1>
          <p>聚焦本地副本、启用状态、更新、权限收缩与异常摘要。目录扫描和物理空间诊断已迁到目标管理。</p>
        </div>
        <div className="inline-actions wrap">
          <button className="btn" onClick={() => ui.navigate("market")}>去市场看看</button>
          <button className="btn btn-primary" onClick={() => ui.navigate("target_management")}>查看目标管理</button>
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
              ["issues", "异常"],
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
          <TagPill tone={installedFilterCounts.updates > 0 ? "warning" : "info"}>{installedFilterCounts.updates} 个待更新</TagPill>
          <TagPill tone={installedFilterCounts.scope_restricted > 0 ? "warning" : "info"}>{installedFilterCounts.scope_restricted} 个权限收缩</TagPill>
          <TagPill tone={abnormalInstalledSkills.length > 0 ? "danger" : "success"}>{abnormalInstalledSkills.length} 个异常摘要</TagPill>
        </div>

        {workspace.installedSkills.length === 0 ? <SectionEmpty title="你还没有安装 Skill" body="进入市场安装后会出现在这里。" /> : null}
        {workspace.installedSkills.length > 0 && filteredInstalledSkills.length === 0 ? <SectionEmpty title="没有符合当前筛选的 Skill" body="清空搜索词或切换筛选后再试一次。" /> : null}

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

                  {skill.isScopeRestricted ? (
                    <div className="inline-alert warning">
                      <ShieldAlert size={16} />
                      <span>
                        <strong>权限已收缩</strong>
                        <small>可继续使用当前版本，但不可更新或新增启用位置。</small>
                      </span>
                    </div>
                  ) : null}
                  {issues.length > 0 ? (
                    <div className="inline-alert warning">
                      <AlertTriangle size={16} />
                      <span>
                        <strong>本地异常摘要</strong>
                        <small>{issues.join("；")}</small>
                      </span>
                    </div>
                  ) : null}

                  <div className="inline-actions wrap" style={{ marginTop: 12 }}>
                    <button className="btn" onClick={() => ui.openSkillDetail(skill.skillID, "my_installed")}>查看详情</button>
                    {skill.installState === "update_available" && skill.canUpdate ? <button className="btn btn-primary" onClick={() => ui.openInstallConfirm(skill, "update")}>更新</button> : null}
                    {skill.isScopeRestricted ? <button className="btn btn-small" disabled>更新已受限</button> : null}
                    <button className="btn" onClick={() => ui.openTargetsModal(skill)} disabled={skill.isScopeRestricted}>启用范围</button>
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
                  ) : (
                    <div className="inline-actions wrap" style={{ marginTop: 12 }}>
                      <button className="btn btn-small" onClick={() => ui.navigate("target_management")}>去目标管理查看可用目标</button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
