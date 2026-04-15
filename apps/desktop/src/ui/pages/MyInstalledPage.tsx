import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, Archive, Download, Plus, RefreshCw, Search, ShieldAlert } from "lucide-react";
import type { PublishDraft, PublisherSkillSummary } from "../../domain/p1.ts";
import { buildPublishPrecheck } from "../../state/ui/publishPrecheck.ts";
import { downloadAuthenticatedFile } from "../../services/p1Client.ts";
import { categoryIcon, flattenDepartments, formatDate, statusLabel, submissionTypeLabel, workflowStateLabel } from "../desktopShared.tsx";
import { AuthGateCard, PackagePreviewPanel, PageProps, SectionEmpty, SelectField, TagPill } from "./pageCommon.tsx";

function splitCSV(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function bumpPatchVersion(version: string): string {
  const [major, minor, patch] = version.split(".").map((item) => Number.parseInt(item, 10));
  if (![major, minor, patch].every(Number.isFinite)) {
    return "1.0.0";
  }
  return `${major}.${minor}.${patch + 1}`;
}

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
  const folderInputProps = { webkitdirectory: "" } as { [key: string]: string };
  const [mySkillTab, setMySkillTab] = useState<"installed" | "published" | "publish">("installed");
  const [draft, setDraft] = useState<PublishDraft>({
    submissionType: "publish",
    uploadMode: "none",
    packageName: "",
    skillID: "",
    displayName: "",
    description: "",
    version: "1.0.0",
    scope: "current_department",
    selectedDepartmentIDs: [],
    visibility: "private",
    changelog: "",
    category: "uncategorized",
    tags: [],
    compatibleTools: [],
    compatibleSystems: ["windows"],
    files: []
  });
  const [uploadEntries, setUploadEntries] = useState<Array<{ file: File; relativePath: string }>>([]);
  const [tagInput, setTagInput] = useState("");
  const [toolInput, setToolInput] = useState("");
  const [systemInput, setSystemInput] = useState("windows");
  const [expandedDiscoveredSkillIDs, setExpandedDiscoveredSkillIDs] = useState<string[]>([]);

  const selectedPublisherSkill =
    workspace.publisherData.publisherSkills.find((skill) => skill.latestSubmissionID === workspace.publisherData.selectedPublisherSubmissionID) ??
    workspace.publisherData.publisherSkills[0] ??
    null;

  const publishPrecheck = buildPublishPrecheck(draft);
  const canSubmitPermissionChange =
    draft.skillID.trim().length > 0 &&
    draft.displayName.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    (draft.scope !== "selected_departments" || draft.selectedDepartmentIDs.length > 0);
  const canSubmitDraft = draft.submissionType === "permission_change" ? canSubmitPermissionChange : publishPrecheck.canSubmit;

  useEffect(() => {
    if (!workspace.loggedIn) {
      setMySkillTab("installed");
    }
  }, [workspace.loggedIn]);

  function toggleDiscoveredDetails(skillID: string) {
    setExpandedDiscoveredSkillIDs((current) =>
      current.includes(skillID) ? current.filter((item) => item !== skillID) : [...current, skillID]
    );
  }

  function applyDraftLists(nextDraft: PublishDraft) {
    setDraft(nextDraft);
    setTagInput(nextDraft.tags.join(", "));
    setToolInput(nextDraft.compatibleTools.join(", "));
    setSystemInput(nextDraft.compatibleSystems.join(", "));
  }

  function resetDraft(submissionType: PublishDraft["submissionType"] = "publish", source?: PublisherSkillSummary) {
    const sourceSubmission =
      source?.latestSubmissionID && workspace.publisherData.selectedPublisherSubmission?.submissionID === source.latestSubmissionID
        ? workspace.publisherData.selectedPublisherSubmission
        : null;
    applyDraftLists({
      submissionType,
      uploadMode: "none",
      packageName: "",
      skillID: source?.skillID ?? "",
      displayName: source?.displayName ?? "",
      description: sourceSubmission?.description ?? "",
      version:
        submissionType === "update"
          ? bumpPatchVersion(source?.currentVersion ?? sourceSubmission?.currentVersion ?? "1.0.0")
          : source?.currentVersion ?? sourceSubmission?.currentVersion ?? "1.0.0",
      scope: source?.currentScopeType ?? "current_department",
      selectedDepartmentIDs: sourceSubmission?.selectedDepartmentIDs ?? [],
      visibility: source?.currentVisibilityLevel ?? "private",
      changelog: "",
      category: "uncategorized",
      tags: [],
      compatibleTools: [],
      compatibleSystems: ["windows"],
      files: []
    });
    setUploadEntries([]);
    setMySkillTab("publish");
  }

  function handleZipUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadEntries([{ file, relativePath: file.name }]);
    setDraft((current) => ({
      ...current,
      uploadMode: "zip",
      packageName: file.name,
      files: [
        {
          name: file.name,
          relativePath: file.name,
          size: file.size,
          mimeType: file.type || "application/zip"
        }
      ]
    }));
  }

  function handleFolderUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const entries = files.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return { file, relativePath };
    });
    setUploadEntries(entries);
    setDraft((current) => ({
      ...current,
      uploadMode: "folder",
      packageName: entries[0]?.relativePath.split("/")[0] ?? "skill-folder",
      files: entries.map((entry) => ({
        name: entry.relativePath,
        relativePath: entry.relativePath,
        size: entry.file.size,
        mimeType: entry.file.type || "application/octet-stream"
      }))
    }));
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitDraft) return;
    const formData = new FormData();
    formData.set("submissionType", draft.submissionType);
    formData.set("skillID", draft.skillID);
    formData.set("displayName", draft.displayName);
    formData.set("description", draft.description);
    formData.set("version", draft.version);
    formData.set("scopeType", draft.scope);
    formData.set("selectedDepartmentIDs", JSON.stringify(draft.selectedDepartmentIDs));
    formData.set("visibilityLevel", draft.visibility);
    formData.set("changelog", draft.changelog);
    formData.set("category", draft.category);
    formData.set("tags", JSON.stringify(splitCSV(tagInput)));
    formData.set("compatibleTools", JSON.stringify(splitCSV(toolInput)));
    formData.set("compatibleSystems", JSON.stringify(splitCSV(systemInput)));
    for (const entry of uploadEntries) {
      formData.append("files", entry.file, entry.relativePath);
    }
    void workspace.publisherData.submitPublisherSubmission(formData);
    setMySkillTab("published");
  }

  function renderInstalledContent() {
    const query = ui.installedQuery.trim().toLocaleLowerCase();
    const visibleDiscoveredSkills =
      ui.installedFilter === "all" || ui.installedFilter === "issues"
        ? workspace.discoveredLocalSkills.filter((skill) =>
            query.length === 0 ||
            skill.displayName.toLocaleLowerCase().includes(query) ||
            skill.skillID.toLocaleLowerCase().includes(query) ||
            skill.targets.some((target) => target.targetName.toLocaleLowerCase().includes(query) || target.relativePath.toLocaleLowerCase().includes(query))
          )
        : [];

    return (
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
          {workspace.discoveredLocalSkills.length > 0 ? <TagPill tone="warning">{workspace.discoveredLocalSkills.length} 个目录扫描发现</TagPill> : null}
          {ui.installedFilterCounts.updates > 0 ? <TagPill tone="warning">{ui.installedFilterCounts.updates} 个待更新</TagPill> : null}
          {ui.installedFilterCounts.issues > 0 ? <TagPill tone="danger">{ui.installedFilterCounts.issues} 个异常</TagPill> : null}
        </div>
        {workspace.installedSkills.length === 0 && workspace.discoveredLocalSkills.length === 0 ? <SectionEmpty title="你还没有安装 Skill" body="进入市场安装后会出现在这里。" /> : null}
        {workspace.installedSkills.length > 0 && ui.filteredInstalledSkills.length === 0 && visibleDiscoveredSkills.length === 0 ? <SectionEmpty title="没有符合当前筛选的 Skill" body="清空搜索词或切换筛选后再试一次。" /> : null}
        <div className="stack-list">
          {ui.filteredInstalledSkills.map((skill) => {
            const enabledTools = skill.enabledTargets.filter((target) => target.targetType === "tool").length;
            const enabledProjects = skill.enabledTargets.filter((target) => target.targetType === "project").length;
            const issues = ui.installedSkillIssuesByID[skill.skillID] ?? [];
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
          <div className="stack-list">
            <div className="section-heading">
              <div>
                <div className="eyebrow">目录扫描发现</div>
                <h2>工具或项目目录里的外部 Skill</h2>
                <p>先看摘要；具体路径和处理提示按需展开，避免列表被诊断信息撑满。</p>
              </div>
              <button className="btn btn-small" onClick={() => void workspace.scanLocalTargets()}>
                <RefreshCw size={15} />
                重新扫描
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
                      {skill.matchedMarketSkill ? <TagPill tone="info">市场已存在同名 Skill</TagPill> : null}
                    </div>
                  </div>
                  <p>{discoveredPreview(skill)}</p>
                  <div className="discovered-meta-line">
                    <span>{discoveredLocationSummary(skill)}</span>
                  </div>
                  <div className="inline-actions wrap">
                    {skill.matchedMarketSkill ? (
                      <button className="btn btn-primary" onClick={() => ui.openSkillDetail(skill.skillID, "my_installed")}>查看市场详情</button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => ui.navigate(skill.targets.some((target) => target.targetType === "project") ? "projects" : "tools")}>
                        {discoveryManageLabel(skill)}
                      </button>
                    )}
                    <button className="btn" onClick={() => toggleDiscoveredDetails(skill.skillID)}>
                      {expanded ? "收起位置" : `查看 ${skill.targets.length} 个位置`}
                    </button>
                  </div>
                  {expanded ? (
                    <div className="discovered-target-list">
                      {skill.targets.map((target) => (
                        <div className="discovered-target-row" key={`${skill.skillID}:${target.targetType}:${target.targetID}:${target.relativePath}`}>
                          <div className="inline-heading">
                            <strong>{target.targetName}</strong>
                            <TagPill tone={target.findingKind === "unmanaged" ? "info" : "warning"}>
                              {target.findingKind === "conflict" ? "内容不一致" : target.findingKind === "orphan" ? "登记缺失" : "未托管"}
                            </TagPill>
                          </div>
                          <small className="target-path-line" title={target.targetPath}>{target.targetPath}</small>
                          <small>{target.message}</small>
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
    );
  }

  function renderPublishedContent() {
    if (!workspace.loggedIn) {
      return <AuthGateCard title="登录后管理我发布的 Skill" body="发布、更新、权限变更和撤回都在登录后开放。" onLogin={() => workspace.requireAuth("my_installed")} />;
    }

    const selectedSubmission = workspace.publisherData.selectedPublisherSubmission;
    const loadSubmissionFileContent = async (relativePath: string) => {
      if (!selectedSubmission) {
        throw new Error("未选择提交记录");
      }
      return workspace.publisherData.getSubmissionFileContent(selectedSubmission.submissionID, relativePath);
    };

    return (
      <div className="page-grid two-up">
        <section className="panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">作者视角</div>
              <h2>我发布的</h2>
            </div>
            <button className="btn btn-primary btn-small" onClick={() => resetDraft("publish")}>发布 Skill</button>
          </div>
          {workspace.publisherData.publisherSkills.length === 0 ? <SectionEmpty title="还没有发布记录" body="上传 ZIP 或文件夹后会在这里看到治理状态。" /> : null}
          <div className="stack-list">
            {workspace.publisherData.publisherSkills.map((skill) => (
              <article className="panel" key={skill.skillID} data-testid="publisher-skill-row" data-skill-id={skill.skillID}>
                <div className="inline-heading">
                  <div>
                    <strong>{skill.displayName}</strong>
                    <small>{skill.skillID} · 当前版本 {skill.currentVersion ?? "未发布"}</small>
                  </div>
                  <div className="pill-row">
                    {skill.currentStatus ? <TagPill tone="info">{skill.currentStatus}</TagPill> : null}
                    {skill.latestWorkflowState ? (
                      <TagPill tone={skill.latestWorkflowState === "published" ? "success" : skill.latestWorkflowState === "manual_precheck" ? "warning" : "info"}>
                        {workflowStateLabel(skill.latestWorkflowState)}
                      </TagPill>
                    ) : null}
                  </div>
                </div>
                <small>最近提交：{skill.submittedAt ? formatDate(skill.submittedAt) : "暂无提交"} · 更新于 {formatDate(skill.updatedAt)}</small>
                {skill.latestReviewSummary ? <p>{skill.latestReviewSummary}</p> : null}
                <div className="inline-actions wrap">
                  {skill.latestSubmissionID ? (
                    <button className="btn btn-small" onClick={() => workspace.publisherData.setSelectedPublisherSubmissionID(skill.latestSubmissionID ?? null)}>
                      查看详情
                    </button>
                  ) : null}
                  {skill.canWithdraw && skill.latestSubmissionID ? (
                    <button className="btn btn-small" onClick={() => void workspace.publisherData.withdrawPublisherSubmission(skill.latestSubmissionID ?? "")}>撤回</button>
                  ) : null}
                  {skill.publishedSkillExists ? (
                    <>
                      {skill.availableStatusActions.includes("delist") ? (
                        <button
                          className="btn btn-small"
                          onClick={() => ui.openConfirm({
                            title: `下架 ${skill.displayName}`,
                            body: "下架后市场不再提供安装；已安装用户继续保留当前本地副本。",
                            confirmLabel: "确认下架",
                            tone: "danger",
                            detailLines: [`当前状态：${skill.currentStatus ?? "未知"}`],
                            onConfirm: async () => {
                              ui.closeModal();
                              await workspace.publisherData.delistPublisherSkill(skill.skillID);
                            }
                          })}
                        >
                          下架
                        </button>
                      ) : null}
                      {skill.availableStatusActions.includes("relist") ? (
                        <button
                          className="btn btn-small"
                          onClick={() => ui.openConfirm({
                            title: `上架 ${skill.displayName}`,
                            body: "上架后恢复市场可见与安装资格，仍以当前权限配置为准。",
                            confirmLabel: "确认上架",
                            tone: "primary",
                            detailLines: [`当前状态：${skill.currentStatus ?? "未知"}`],
                            onConfirm: async () => {
                              ui.closeModal();
                              await workspace.publisherData.relistPublisherSkill(skill.skillID);
                            }
                          })}
                        >
                          上架
                        </button>
                      ) : null}
                      {skill.availableStatusActions.includes("archive") ? (
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => ui.openConfirm({
                            title: `归档 ${skill.displayName}`,
                            body: "归档后该 Skill 不可再次上架，请确认当前版本已经不再作为活跃 Skill 维护。",
                            confirmLabel: "确认归档",
                            tone: "danger",
                            detailLines: [`当前状态：${skill.currentStatus ?? "未知"}`],
                            onConfirm: async () => {
                              ui.closeModal();
                              await workspace.publisherData.archivePublisherSkill(skill.skillID);
                            }
                          })}
                        >
                          <Archive size={14} />归档
                        </button>
                      ) : null}
                      <button className="btn btn-small" onClick={() => resetDraft("update", skill)}>发布新版本</button>
                      <button className="btn btn-small" onClick={() => resetDraft("permission_change", skill)}>修改权限</button>
                    </>
                  ) : (
                    <button className="btn btn-small" onClick={() => resetDraft("publish", skill)}>重新提交</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" data-testid="publisher-submission-detail">
          {!selectedSubmission ? (
            <SectionEmpty title="选择一条提交查看详情" body="这里会显示预检查结果、下载包、历史时间线和当前可执行动作。" />
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">提交详情</div>
                  <h2>{selectedSubmission.displayName}</h2>
                </div>
                <TagPill tone="info">{submissionTypeLabel(selectedSubmission.submissionType)}</TagPill>
              </div>
              <p>{selectedSubmission.description}</p>
              <div className="definition-grid split">
                <div><dt>状态</dt><dd>{workflowStateLabel(selectedSubmission.workflowState)}</dd></div>
                <div><dt>版本</dt><dd>{selectedSubmission.version}</dd></div>
                <div><dt>公开级别</dt><dd>{selectedSubmission.visibilityLevel}</dd></div>
                <div><dt>授权范围</dt><dd>{selectedSubmission.scopeType}</dd></div>
              </div>
              {selectedSubmission.packageURL ? (
                <div className="inline-actions wrap">
                  <button
                    className="btn btn-small"
                    onClick={() => void downloadAuthenticatedFile(
                      selectedSubmission.packageURL ?? "",
                      `${selectedSubmission.skillID ?? "submission"}.zip`
                    )}
                  >
                    <Download size={14} /> 下载提交包
                  </button>
                  {selectedSubmission.canWithdraw ? (
                    <button className="btn btn-small" onClick={() => void workspace.publisherData.withdrawPublisherSubmission(selectedSubmission.submissionID ?? "")}>撤回提交</button>
                  ) : null}
                </div>
              ) : null}
              <PackagePreviewPanel
                files={selectedSubmission.packageFiles}
                packageURL={selectedSubmission.packageURL}
                downloadName={`${selectedSubmission.skillID}.zip`}
                loadContent={loadSubmissionFileContent}
              />
              <div className="detail-block">
                <h3>预检查结果</h3>
                {selectedSubmission.precheckResults.length === 0 ? (
                  <p>等待系统初审。</p>
                ) : (
                  <div className="stack-list compact">
                    {selectedSubmission.precheckResults.map((item) => (
                      <div className="history-row" key={item.id}>
                        <strong>{item.label}</strong>
                        <span>{item.status === "pass" ? "通过" : "待人工复核"}</span>
                        <small>{item.message}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="detail-block">
                <h3>历史时间线</h3>
                <div className="history-list">
                  {selectedSubmission.history.map((history) => (
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

  function renderPublishContent() {
    if (!workspace.loggedIn) {
      return <AuthGateCard title="登录后发布 Skill" body="浏览器端会通过真实 API 上传 ZIP 或文件夹，并进入系统初审与管理员审核。" onLogin={() => workspace.requireAuth("my_installed")} />;
    }

    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">发布入口</div>
            <h2>{draft.submissionType === "publish" ? "发布 Skill" : draft.submissionType === "update" ? "发布新版本" : "提交权限变更"}</h2>
          </div>
          <TagPill tone="info">{submissionTypeLabel(draft.submissionType)}</TagPill>
        </div>
        <form className="form-stack" data-testid="publish-form" onSubmit={submitDraft}>
          <SelectField label="提交类型" value={draft.submissionType} options={["publish", "update", "permission_change"]} onChange={(value) => resetDraft(value as PublishDraft["submissionType"], selectedPublisherSkill ?? undefined)} />
          <label className="field"><span>skillID</span><input value={draft.skillID} data-testid="publish-skill-id" onChange={(event) => setDraft((current) => ({ ...current, skillID: event.target.value }))} disabled={draft.submissionType !== "publish"} /></label>
          <label className="field"><span>显示名称</span><input value={draft.displayName} data-testid="publish-display-name" onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></label>
          <label className="field"><span>描述</span><textarea value={draft.description} data-testid="publish-description" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} /></label>
          <label className="field"><span>版本号</span><input value={draft.version} data-testid="publish-version" onChange={(event) => setDraft((current) => ({ ...current, version: event.target.value }))} disabled={draft.submissionType === "permission_change"} /></label>
          <label className="field"><span>变更说明</span><textarea value={draft.changelog} data-testid="publish-changelog" onChange={(event) => setDraft((current) => ({ ...current, changelog: event.target.value }))} rows={3} disabled={draft.submissionType === "permission_change"} /></label>
          <SelectField label="授权范围" value={draft.scope} options={["current_department", "department_tree", "selected_departments", "all_employees"]} onChange={(value) => setDraft((current) => ({ ...current, scope: value as PublishDraft["scope"] }))} />
          {draft.scope === "selected_departments" ? (
            <label className="field">
              <span>指定部门</span>
              <select
                multiple
                value={draft.selectedDepartmentIDs}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setDraft((current) => ({ ...current, selectedDepartmentIDs: values }));
                }}
              >
                {flattenDepartments(workspace.adminData.departments).map((department) => (
                  <option key={department.departmentID} value={department.departmentID}>{department.path}</option>
                ))}
              </select>
            </label>
          ) : null}
          <SelectField label="公开级别" value={draft.visibility} options={["private", "summary_visible", "detail_visible", "public_installable"]} onChange={(value) => setDraft((current) => ({ ...current, visibility: value as PublishDraft["visibility"] }))} />
          <label className="field"><span>分类</span><input value={draft.category} data-testid="publish-category" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></label>
          <label className="field"><span>标签（逗号分隔）</span><input value={tagInput} data-testid="publish-tags" onChange={(event) => { const value = event.target.value; setTagInput(value); setDraft((current) => ({ ...current, tags: splitCSV(value) })); }} /></label>
          <label className="field"><span>适用工具（逗号分隔）</span><input value={toolInput} data-testid="publish-tools" onChange={(event) => { const value = event.target.value; setToolInput(value); setDraft((current) => ({ ...current, compatibleTools: splitCSV(value) })); }} /></label>
          <label className="field"><span>适用系统（逗号分隔）</span><input value={systemInput} data-testid="publish-systems" onChange={(event) => { const value = event.target.value; setSystemInput(value); setDraft((current) => ({ ...current, compatibleSystems: splitCSV(value) })); }} /></label>
          {draft.submissionType !== "permission_change" ? (
            <>
              <label className="field">
                <span>上传 ZIP</span>
                <input type="file" accept=".zip,application/zip" data-testid="publish-zip-input" onChange={handleZipUpload} />
              </label>
              <label className="field">
                <span>上传文件夹</span>
                <input type="file" multiple data-testid="publish-folder-input" {...folderInputProps} onChange={handleFolderUpload} />
              </label>
              <div className="detail-block">
                <h3>当前上传内容</h3>
                {draft.files.length === 0 ? <p>选择 ZIP 或文件夹后，系统会先显示前端预检查结果。</p> : null}
                <div className="stack-list compact">
                  {draft.files.slice(0, 8).map((file) => (
                    <div className="history-row" key={file.relativePath}>
                      <strong>{file.relativePath}</strong>
                      <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
                    </div>
                  ))}
                  {draft.files.length > 8 ? <small>还有 {draft.files.length - 8} 个文件未展开。</small> : null}
                </div>
              </div>
              <div className="detail-block">
                <h3>提交前预检</h3>
                <div className="stack-list compact">
                  {publishPrecheck.items.map((item) => (
                    <div className="history-row" key={item.id}>
                      <strong>{item.label}</strong>
                      <span>{item.status === "pass" ? "通过" : item.status === "warn" ? "需关注" : "待校验"}</span>
                      <small>{item.message}</small>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="callout warning">
              <ShieldAlert size={16} />
              <span>
                <strong>权限变更不需要重新上传包</strong>
                <small>审核通过前继续沿用当前已发布版本，审核通过后才切换新的可见范围与授权范围。</small>
              </span>
            </div>
          )}
          <div className="inline-actions wrap">
            <button className="btn btn-primary" type="submit" data-testid="publish-submit" disabled={!canSubmitDraft}>提交发布</button>
            <button className="btn" type="button" onClick={() => resetDraft(draft.submissionType, selectedPublisherSkill ?? undefined)}>重置</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">我的 Skill</div>
          <h1>{mySkillTab === "installed" ? "已安装" : mySkillTab === "published" ? "我发布的" : "发布 Skill"}</h1>
          <p>{mySkillTab === "installed" ? "按文档展示本机副本、启用范围、更新状态、权限收缩和异常提示。" : mySkillTab === "published" ? "作者侧展示最新治理状态、预检查和审核历史。" : "支持 ZIP 与文件夹双上传，提交后进入系统初审与管理员审核。"}</p>
        </div>
        <div className="inline-actions wrap">
          <button className={mySkillTab === "installed" ? "btn btn-primary" : "btn"} data-testid="my-skills-installed-tab" onClick={() => setMySkillTab("installed")}>已安装</button>
          <button className={mySkillTab === "published" ? "btn btn-primary" : "btn"} data-testid="my-skills-published-tab" onClick={() => setMySkillTab("published")} disabled={!workspace.loggedIn}>我发布的</button>
          <button className={mySkillTab === "publish" ? "btn btn-primary" : "btn"} data-testid="my-skills-publish-tab" onClick={() => setMySkillTab("publish")} disabled={!workspace.loggedIn}>发布 Skill</button>
          <button className="btn" onClick={() => ui.navigate("market")}>去市场看看</button>
        </div>
      </section>

      {mySkillTab === "installed" ? renderInstalledContent() : null}
      {mySkillTab === "published" ? renderPublishedContent() : null}
      {mySkillTab === "publish" ? renderPublishContent() : null}
    </div>
  );
}
