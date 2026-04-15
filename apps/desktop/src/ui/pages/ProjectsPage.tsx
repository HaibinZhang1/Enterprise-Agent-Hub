import { FolderPlus, Link2, RefreshCw } from "lucide-react";
import { formatDate } from "../desktopShared.tsx";
import { PageProps, SectionEmpty, TagPill } from "./pageCommon.tsx";

export function ProjectsPage({ workspace, ui }: PageProps) {
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
