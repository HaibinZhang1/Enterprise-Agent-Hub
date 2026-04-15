import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Archive, Download, ShieldAlert } from "lucide-react";
import type { PublishDraft, PublisherSkillSummary } from "../../domain/p1.ts";
import { buildPublishPrecheck } from "../../state/ui/publishPrecheck.ts";
import { downloadAuthenticatedFile } from "../../services/p1Client.ts";
import { flattenDepartments, formatDate, submissionTypeLabel, workflowStateLabel } from "../desktopShared.tsx";
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

export function PublisherWorkbenchPage({ workspace, ui }: PageProps) {
  const folderInputProps = { webkitdirectory: "" } as { [key: string]: string };
  const [workbenchTab, setWorkbenchTab] = useState<"published" | "publish">("published");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
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

  if (!workspace.loggedIn) {
    return (
      <div className="page-stack">
        <section className="page-head">
          <div>
            <div className="eyebrow">发布管控</div>
            <h1>我发布的</h1>
            <p>发布、更新、权限变更和撤回都在登录后开放。</p>
          </div>
        </section>
        <AuthGateCard title="登录后管理我发布的 Skill" body="浏览器端会通过真实 API 上传 ZIP 或文件夹，并进入系统初审与管理员审核。" onLogin={() => workspace.requireAuth("publisher")} />
      </div>
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
    setWizardStep(1);
    setWorkbenchTab("publish");
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
    setWorkbenchTab("published");
  }

  const selectedSubmission = workspace.publisherData.selectedPublisherSubmission;
  const loadSubmissionFileContent = async (relativePath: string) => {
    if (!selectedSubmission) {
      throw new Error("未选择提交记录");
    }
    return workspace.publisherData.getSubmissionFileContent(selectedSubmission.submissionID, relativePath);
  };

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">作者视角</div>
          <h1>{workbenchTab === "published" ? "我发布的" : "发布与更新工作台"}</h1>
          <p>{workbenchTab === "published" ? "展示最新治理状态、预检查和审核历史。" : "支持 ZIP 与文件夹双上传，提交后进入系统初审与管理员审核。"}</p>
        </div>
        <div className="inline-actions wrap">
          <button className={workbenchTab === "published" ? "btn btn-primary" : "btn"} onClick={() => setWorkbenchTab("published")}>已发布列表</button>
          <button className={workbenchTab === "publish" ? "btn btn-primary" : "btn"} onClick={() => setWorkbenchTab("publish")}>开始发布</button>
        </div>
      </section>

      {workbenchTab === "published" ? (
        <div className="page-grid two-up">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>发布履历</h2>
              </div>
              <button className="btn btn-primary btn-small" onClick={() => resetDraft("publish")}>发布 Skill</button>
            </div>
            {workspace.publisherData.publisherSkills.length === 0 ? <SectionEmpty title="还没有发布记录" body="上传 ZIP 或文件夹后会在这里看到治理状态。" /> : null}
            <div className="stack-list">
              {workspace.publisherData.publisherSkills.map((skill) => (
                <article className="panel" key={skill.skillID} data-testid="publisher-skill-row">
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
                      <button className="btn btn-small" onClick={() => workspace.publisherData.setSelectedPublisherSubmissionID(skill.latestSubmissionID ?? null)}>查看详情</button>
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
                          >下架</button>
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
                          >上架</button>
                        ) : null}
                        {skill.availableStatusActions.includes("archive") ? (
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => ui.openConfirm({
                              title: `归档 ${skill.displayName}`,
                              body: "归档后该 Skill 不可再次上架，请确认不再作为活跃维护。",
                              confirmLabel: "确认归档",
                              tone: "danger",
                              detailLines: [`当前状态：${skill.currentStatus ?? "未知"}`],
                              onConfirm: async () => {
                                ui.closeModal();
                                await workspace.publisherData.archivePublisherSkill(skill.skillID);
                              }
                            })}
                          ><Archive size={14} />归档</button>
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
              <SectionEmpty title="选择一条提交查看详情" body="这里会显示预检查结果、下载包、历史时间线和动作。" />
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
                    ><Download size={14} /> 下载包</button>
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
                  <h3>审核过程</h3>
                  <div className="history-list">
                    {selectedSubmission.history.map((history) => (
                      <div className="history-row" key={history.historyID}>
                        <strong>{history.action}</strong>
                        <span>{history.actorName}</span>
                        <small>{history.comment ?? "无补充"} · {formatDate(history.createdAt)}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {workbenchTab === "publish" ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>{draft.submissionType === "publish" ? "发布新 Skill" : draft.submissionType === "update" ? "发布新版本" : "提交权限变更"}</h2>
              <p>预检过程将在本地纯端侧校验静态项。若权限变更不需要重新上传文件。</p>
            </div>
            <TagPill tone="info">{submissionTypeLabel(draft.submissionType)}</TagPill>
          </div>
          <div className="pill-row" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
            <button type="button" className={wizardStep === 1 ? "btn btn-primary btn-small" : "btn btn-small"} onClick={() => setWizardStep(1)}>1. 基础信息设定</button>
            <button type="button" className={wizardStep === 2 ? "btn btn-primary btn-small" : "btn btn-small"} onClick={() => setWizardStep(2)} disabled={wizardStep < 2 && draft.skillID.trim().length === 0}>2. 包上传与校验</button>
            <button type="button" className={wizardStep === 3 ? "btn btn-primary btn-small" : "btn btn-small"} onClick={() => setWizardStep(3)} disabled={wizardStep < 3 && (!publishPrecheck.canSubmit && draft.submissionType !== "permission_change")}>3. 确认与签发</button>
          </div>

          <form className="form-stack" onSubmit={submitDraft}>
            {wizardStep === 1 && (
              <>
                <SelectField label="提交类型" value={draft.submissionType} options={["publish", "update", "permission_change"]} onChange={(value) => resetDraft(value as PublishDraft["submissionType"], selectedPublisherSkill ?? undefined)} />
                <label className="field"><span>skillID</span><input value={draft.skillID} onChange={(event) => setDraft((current) => ({ ...current, skillID: event.target.value }))} disabled={draft.submissionType !== "publish"} /></label>
                <label className="field"><span>显示名称</span><input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} /></label>
                <label className="field"><span>描述</span><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} /></label>
                <label className="field"><span>版本号</span><input value={draft.version} onChange={(event) => setDraft((current) => ({ ...current, version: event.target.value }))} disabled={draft.submissionType === "permission_change"} /></label>
                <label className="field"><span>变更说明</span><textarea value={draft.changelog} onChange={(event) => setDraft((current) => ({ ...current, changelog: event.target.value }))} rows={3} disabled={draft.submissionType === "permission_change"} /></label>
                <SelectField label="授权范围" value={draft.scope} options={["current_department", "department_tree", "selected_departments", "all_employees"]} onChange={(value) => setDraft((current) => ({ ...current, scope: value as PublishDraft["scope"] }))} />
                {draft.scope === "selected_departments" ? (
                  <label className="field">
                    <span>指定部门 (多选)</span>
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
                <label className="field"><span>分类</span><input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></label>
                <label className="field"><span>标签（逗号分隔）</span><input value={tagInput} onChange={(event) => { const value = event.target.value; setTagInput(value); setDraft((current) => ({ ...current, tags: splitCSV(value) })); }} /></label>
                <label className="field"><span>适用工具（逗号分隔）</span><input value={toolInput} onChange={(event) => { const value = event.target.value; setToolInput(value); setDraft((current) => ({ ...current, compatibleTools: splitCSV(value) })); }} /></label>
                <label className="field"><span>适用系统（逗号分隔）</span><input value={systemInput} onChange={(event) => { const value = event.target.value; setSystemInput(value); setDraft((current) => ({ ...current, compatibleSystems: splitCSV(value) })); }} /></label>
                
                <div className="inline-actions wrap" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <button className="btn btn-primary" type="button" onClick={() => setWizardStep(2)} disabled={draft.skillID.trim().length === 0}>下一步：组装校验</button>
                  <button className="btn" type="button" onClick={() => resetDraft(draft.submissionType, selectedPublisherSkill ?? undefined)}>重置</button>
                </div>
              </>
            )}

            {wizardStep === 2 && (
              <>
                {draft.submissionType !== "permission_change" ? (
                  <div className="publish-upload-panel">
                    <div className="inline-actions wrap" style={{ marginBottom: 12 }}>
                      <label className="btn">
                        上传 ZIP
                        <input type="file" accept=".zip,application/zip" onChange={handleZipUpload} style={{ display: "none" }} />
                      </label>
                      <label className="btn">
                        上传文件夹
                        <input type="file" multiple {...folderInputProps} onChange={handleFolderUpload} style={{ display: "none" }} />
                      </label>
                    </div>
                    <div className="detail-block">
                      <h3>包含的文件清单 ({draft.files.length})</h3>
                      {draft.files.length === 0 ? <p>选择 ZIP 或文件夹后预校验内容。</p> : null}
                      <div className="stack-list compact" style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--border-subtle)", padding: 8 }}>
                        {draft.files.slice(0, 15).map((file) => (
                          <div className="history-row" key={file.relativePath}>
                            <strong>{file.relativePath}</strong>
                            <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
                          </div>
                        ))}
                        {draft.files.length > 15 ? <small>还有 {draft.files.length - 15} 个文件...</small> : null}
                      </div>
                    </div>
                    <div className="detail-block">
                      <h3>前置校验报告</h3>
                      <div className="stack-list compact">
                        {publishPrecheck.items.map((item) => (
                          <div className="history-row" key={item.id} style={{ color: item.status === "warn" ? "var(--amber-strong)" : "" }}>
                            <strong>{item.label}</strong>
                            <span>{item.status === "pass" ? "✔ 通过" : item.status === "warn" ? "⚠ 需关注" : "待判定"}</span>
                            <small>{item.message}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="callout warning">
                    <ShieldAlert size={16} />
                    <span>
                      <strong>权限变更不需要重新上传包</strong>
                      <br />审核通过前会继续拉取最新历史版本使用您的新权限等级。
                    </span>
                  </div>
                )}

                <div className="inline-actions wrap" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <button className="btn" type="button" onClick={() => setWizardStep(1)}>上一步</button>
                  <button className="btn btn-primary" type="button" onClick={() => setWizardStep(3)} disabled={draft.submissionType !== "permission_change" && !publishPrecheck.canSubmit}>下一步：最终确认</button>
                </div>
              </>
            )}

            {wizardStep === 3 && (
              <>
                <div className="detail-block">
                  <h3>最终确认</h3>
                  <p>您即将提交此草稿，提审后不可再修改包体和底层配置，直至发布新版本。</p>
                </div>
                {!canSubmitDraft ? (
                  <div className="callout warning">
                    <ShieldAlert size={16} />
                    <span>
                      <strong>校验尚未全部通过</strong>
                      <br />某些必填项尚未完成。请返回步骤1或步骤2补充所需信息。
                    </span>
                  </div>
                ) : null}
                <div className="inline-actions wrap" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <button className="btn" type="button" onClick={() => setWizardStep(2)}>上一步</button>
                  <button className="btn btn-primary" type="submit" disabled={!canSubmitDraft}>签署并起草案</button>
                </div>
              </>
            )}
          </form>
        </section>
      ) : null}
    </div>
  );
}
