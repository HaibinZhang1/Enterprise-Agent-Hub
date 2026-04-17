import { useMemo, useState } from "react";
import { AlertTriangle, CircleGauge, FolderPlus, Link2, Plus, RefreshCw } from "lucide-react";
import { adapterStatusLabel, detectionMethodLabel, formatDate, localize, transformStrategyLabel } from "../desktopShared.tsx";
import { PageProps, SectionEmpty, TagPill } from "./pageCommon.tsx";

type TargetManagementTab = "tools" | "projects" | "diagnostics";

function EnabledSkillList({
  workspace,
  ui,
  targetID,
  targetType,
}: Pick<PageProps, "workspace" | "ui"> & { targetID: string; targetType: "tool" | "project" }) {
  const skills = workspace.installedSkills.filter((skill) =>
    skill.enabledTargets.some((target) => target.targetType === targetType && target.targetID === targetID)
  );

  if (skills.length === 0) {
    return <SectionEmpty title="暂无已启用 Skill" body="安装并启用到这个目标后，会在这里显示最终落地结果。" />;
  }

  return (
    <div className="target-skill-list">
      {skills.map((skill) => (
        <div className="target-skill-row" key={`${targetType}:${targetID}:${skill.skillID}`}>
          <div>
            <strong>{skill.displayName}</strong>
            <small>{skill.skillID} · 本地 {skill.localVersion}</small>
          </div>
          <div className="inline-actions wrap">
            <button className="btn btn-small" onClick={() => ui.openSkillDetail(skill.skillID, "target_management")}>查看详情</button>
            <button className="btn btn-small" onClick={() => ui.openTargetsModal(skill)}>调整范围</button>
            <button className="btn btn-small" onClick={() => void workspace.disableSkill(skill.skillID, targetID, targetType)}>停用</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolsTab({ workspace, ui, setActiveTab }: PageProps & { setActiveTab: (tab: TargetManagementTab) => void }) {
  return (
    <section className="panel tool-list">
      {workspace.tools.map((tool) => {
        const scanSummary = workspace.scanTargets.find((summary) => summary.targetType === "tool" && summary.targetID === tool.toolID) ?? null;
        const abnormalCount = scanSummary ? scanSummary.counts.unmanaged + scanSummary.counts.conflict + scanSummary.counts.orphan : 0;

        return (
          <article className="tool-list-row" key={tool.toolID}>
            <div className="tool-list-main">
              <div className="inline-heading">
                <div className="tool-list-title">
                  <div className="tool-mark"><CircleGauge size={18} /></div>
                  <div>
                    <h3>{tool.name}</h3>
                    <small>{transformStrategyLabel(tool.transformStrategy, ui.language)}</small>
                  </div>
                </div>
                <div className="pill-row">
                  <TagPill tone={tool.adapterStatus === "detected" ? "success" : tool.adapterStatus === "manual" ? "info" : "warning"}>{adapterStatusLabel(tool.adapterStatus, ui.language)}</TagPill>
                  <TagPill tone="info">{detectionMethodLabel(tool.detectionMethod, ui.language)}</TagPill>
                  {abnormalCount > 0 ? <TagPill tone="warning">{localize(ui.language, `异常 ${abnormalCount}`, `${abnormalCount} issues`)}</TagPill> : null}
                </div>
              </div>
              <div className="tool-list-meta">
                <small>{localize(ui.language, "配置路径", "Config")}: {tool.configPath || localize(ui.language, "未配置", "Not set")}</small>
                <small>{localize(ui.language, "自动检测路径", "Detected")}: {tool.detectedPath ?? localize(ui.language, "未命中", "Not found")}</small>
                <small>{localize(ui.language, "手动覆盖路径", "Manual Override")}: {tool.configuredPath ?? localize(ui.language, "未覆盖", "None")}</small>
                <small>{localize(ui.language, "Skills 路径", "Skills Path")}: {tool.skillsPath || localize(ui.language, "未配置", "Not set")}</small>
                <small>{localize(ui.language, "已启用 Skill", "Enabled Skills")}: {tool.enabledSkillCount} · {tool.enabled ? localize(ui.language, "配置已启用", "Enabled") : localize(ui.language, "配置已停用", "Disabled")} · {localize(ui.language, "最近扫描", "Last Scan")}: {formatDate(tool.lastScannedAt ?? null, ui.language)}</small>
              </div>
              {tool.adapterStatus === "missing" || tool.adapterStatus === "invalid" ? (
                <div className="callout warning">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>{tool.adapterStatus === "missing" ? localize(ui.language, "工具未检测到", "Tool Not Found") : localize(ui.language, "工具路径不可用", "Invalid Tool Path")}</strong>
                    <small>{localize(ui.language, "请修改当前项路径后重新检测。", "Update the path and scan again.")}</small>
                  </span>
                </div>
              ) : null}
              <div className="detail-block">
                <h3>{localize(ui.language, "当前已启用 Skill", "Enabled Skills on This Tool")}</h3>
                <EnabledSkillList workspace={workspace} ui={ui} targetID={tool.toolID} targetType="tool" />
              </div>
            </div>
            <div className="tool-list-actions">
              <button className="btn" onClick={() => ui.openToolEditor(tool)}>{localize(ui.language, "修改路径", "Edit Paths")}</button>
              <button className="btn btn-small" onClick={() => { setActiveTab("diagnostics"); void workspace.scanLocalTargets(); }}>{localize(ui.language, "查看诊断", "Diagnostics")}</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ProjectsTab({ workspace, ui }: PageProps) {
  return (
    <div className="card-grid">
      {workspace.projects.map((project) => {
        const scanSummary = workspace.scanTargets.find((summary) => summary.targetType === "project" && summary.targetID === project.projectID) ?? null;
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
            {scanSummary ? <small>扫描结果：托管 {scanSummary.counts.managed} / 异常 {scanSummary.counts.unmanaged + scanSummary.counts.conflict + scanSummary.counts.orphan} · 最近扫描 {formatDate(scanSummary.scannedAt)}</small> : null}
            <div className="detail-block">
              <h3>当前已生效 Skill</h3>
              <EnabledSkillList workspace={workspace} ui={ui} targetID={project.projectID} targetType="project" />
            </div>
            <div className="inline-actions wrap">
              <button className="btn" onClick={() => ui.openProjectEditor(project)}>修改路径</button>
              {project.enabled ? <TagPill tone="info">项目级优先</TagPill> : <TagPill tone="warning">当前停用</TagPill>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DiagnosticsTab({ workspace, ui, setActiveTab }: PageProps & { setActiveTab: (tab: TargetManagementTab) => void }) {
  const abnormalTargets = workspace.scanTargets.filter((summary) => summary.lastError || summary.counts.unmanaged + summary.counts.conflict + summary.counts.orphan > 0);

  return (
    <div className="page-grid two-up">
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">扫描摘要</div>
            <h2>目标诊断</h2>
          </div>
          <button className="btn btn-small" onClick={() => void workspace.scanLocalTargets()}>
            <RefreshCw size={15} />
            重新扫描
          </button>
        </div>
        {abnormalTargets.length === 0 ? <SectionEmpty title="当前没有异常目标" body="工具与项目的扫描异常会集中显示在这里。" /> : null}
        <div className="stack-list">
          {abnormalTargets.map((summary) => (
            <article className="panel discovered-skill-card" key={summary.id}>
              <div className="inline-heading">
                <div>
                  <strong>{summary.targetName}</strong>
                  <p>{summary.targetPath}</p>
                </div>
                <TagPill tone="warning">{summary.targetType === "tool" ? "工具" : "项目"}</TagPill>
              </div>
              <div className="discovered-meta-line">
                <span>托管 {summary.counts.managed}</span>
                <span>unmanaged {summary.counts.unmanaged}</span>
                <span>conflict {summary.counts.conflict}</span>
                <span>orphan {summary.counts.orphan}</span>
              </div>
              {summary.lastError ? <div className="callout warning"><AlertTriangle size={16} /> {summary.lastError}</div> : null}
              <div className="stack-list compact">
                {summary.findings.filter((finding) => finding.kind !== "managed").slice(0, 4).map((finding) => (
                  <div className="discovered-target-row" key={finding.id}>
                    <div className="inline-heading">
                      <strong>{finding.relativePath}</strong>
                      <TagPill tone="warning">{finding.kind}</TagPill>
                    </div>
                    <small className="target-path-line" title={finding.targetPath}>{finding.targetPath}</small>
                    <small>{finding.message}</small>
                  </div>
                ))}
              </div>
              <div className="inline-actions wrap">
                <button className="btn btn-small" onClick={() => setActiveTab(summary.targetType === "tool" ? "tools" : "projects")}>
                  前往对应{summary.targetType === "tool" ? "工具" : "项目"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">扫描发现</div>
            <h2>未托管 / 冲突资产</h2>
          </div>
        </div>
        {workspace.discoveredLocalSkills.length === 0 ? <SectionEmpty title="没有发现游离副本" body="本地目录里的 unmanaged / orphan / conflict 结果会显示在这里。" /> : null}
        <div className="stack-list">
          {workspace.discoveredLocalSkills.map((skill) => (
            <article className="panel discovered-skill-card" key={skill.skillID}>
              <div className="inline-heading">
                <div className="discovered-skill-summary">
                  <strong>{skill.displayName}</strong>
                  <p>{skill.skillID}</p>
                </div>
                <div className="pill-row">
                  <TagPill tone="warning">{skill.sourceLabel}</TagPill>
                  {skill.matchedMarketSkill ? <TagPill tone="info">市场已存在</TagPill> : null}
                </div>
              </div>
              <div className="discovered-target-list">
                {skill.targets.slice(0, 4).map((target, idx) => (
                  <div className="discovered-target-row" key={`${skill.skillID}:${target.targetType}:${target.targetID}:${idx}`}>
                    <div className="inline-heading">
                      <strong>{target.targetName}</strong>
                      <TagPill tone={target.findingKind === "unmanaged" ? "info" : "warning"}>{target.findingKind}</TagPill>
                    </div>
                    <small className="target-path-line" title={target.targetPath}>{target.targetPath}</small>
                    <small>{target.message}</small>
                  </div>
                ))}
              </div>
              <div className="inline-actions wrap">
                {skill.matchedMarketSkill ? <button className="btn btn-small" onClick={() => ui.openSkillDetail(skill.skillID, "target_management")}>查看市场详情</button> : null}
                <button className="btn btn-small" onClick={() => setActiveTab(skill.targets.some((target) => target.targetType === "project") ? "projects" : "tools")}>前往对应目标</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TargetManagementPage({ workspace, ui }: PageProps) {
  const [activeTab, setActiveTab] = useState<TargetManagementTab>("tools");
  const abnormalTargetCount = useMemo(
    () => workspace.scanTargets.filter((summary) => summary.lastError || summary.counts.unmanaged + summary.counts.conflict + summary.counts.orphan > 0).length,
    [workspace.scanTargets]
  );

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">目标视角</div>
          <h1>目标管理</h1>
          <p>统一管理工具、项目和诊断，聚焦 Skill 最终落到哪里，以及当前哪些目标已经生效。</p>
        </div>
        <div className="inline-actions wrap">
          <button className="btn" onClick={() => void workspace.scanLocalTargets()}><RefreshCw size={15} />刷新检测</button>
          <button className="btn" onClick={() => ui.openToolEditor()}><Plus size={15} />添加工具</button>
          <button className="btn btn-primary" onClick={() => ui.openProjectEditor()}><FolderPlus size={15} />添加项目</button>
        </div>
      </section>

      <div className="pill-row">
        <TagPill tone="info">{workspace.tools.length} 个工具</TagPill>
        <TagPill tone="info">{workspace.projects.length} 个项目</TagPill>
        <TagPill tone={abnormalTargetCount > 0 ? "warning" : "success"}>{abnormalTargetCount} 个异常目标</TagPill>
        <TagPill tone={workspace.discoveredLocalSkills.length > 0 ? "warning" : "info"}>{workspace.discoveredLocalSkills.length} 个扫描发现</TagPill>
      </div>

      <div className="inline-actions wrap">
        <button className={activeTab === "tools" ? "btn btn-primary" : "btn"} onClick={() => setActiveTab("tools")}>工具</button>
        <button className={activeTab === "projects" ? "btn btn-primary" : "btn"} onClick={() => setActiveTab("projects")}>项目</button>
        <button className={activeTab === "diagnostics" ? "btn btn-primary" : "btn"} onClick={() => setActiveTab("diagnostics")}>诊断</button>
      </div>

      {activeTab === "tools" ? <ToolsTab workspace={workspace} ui={ui} setActiveTab={setActiveTab} /> : null}
      {activeTab === "projects" ? <ProjectsTab workspace={workspace} ui={ui} /> : null}
      {activeTab === "diagnostics" ? <DiagnosticsTab workspace={workspace} ui={ui} setActiveTab={setActiveTab} /> : null}
    </div>
  );
}
