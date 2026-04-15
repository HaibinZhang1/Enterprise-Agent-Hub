import { AlertTriangle, CircleGauge, Plus, RefreshCw } from "lucide-react";
import { adapterStatusLabel, detectionMethodLabel, formatDate, localize, transformStrategyLabel } from "../desktopShared.tsx";
import { PageProps, TagPill } from "./pageCommon.tsx";

export function ToolsPage({ workspace, ui }: PageProps) {
  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">{localize(ui.language, "工具管理", "Tools")}</div>
          <h1>{localize(ui.language, "本机 AI 工具", "Local AI Tools")}</h1>
          <p>{localize(ui.language, "工具状态、注册表/默认路径检测、手动覆盖和目录扫描都来自真实 Tauri 本地状态。", "Tool status, path detection, manual overrides, and scans all come from local Tauri state.")}</p>
        </div>
        <div className="inline-actions">
          <button className="btn" onClick={() => void workspace.refreshTools()}><RefreshCw size={15} />{localize(ui.language, "刷新检测", "Refresh")}</button>
          <button className="btn btn-primary" onClick={() => ui.openToolEditor()}><Plus size={15} />{localize(ui.language, "添加自定义工具", "Add Custom Tool")}</button>
        </div>
      </section>

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
                {scanSummary && abnormalCount > 0 ? (
                  <div className="callout warning">
                    <AlertTriangle size={16} />
                    <span>
                      <strong>{localize(ui.language, "扫描摘要", "Scan Summary")}</strong>
                      <small>{scanSummary.findings.filter((finding) => finding.kind !== "managed").slice(0, 2).map((finding) => finding.message).join("；")}</small>
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="tool-list-actions">
                <button className="btn" onClick={() => ui.openToolEditor(tool)}>{localize(ui.language, "修改路径", "Edit Paths")}</button>
                <button className="btn btn-small" onClick={() => void workspace.scanLocalTargets()}>{localize(ui.language, "重新扫描", "Rescan")}</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
