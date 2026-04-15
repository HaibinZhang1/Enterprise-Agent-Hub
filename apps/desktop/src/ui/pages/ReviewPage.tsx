import { useState } from "react";
import { Download } from "lucide-react";
import { downloadAuthenticatedFile } from "../../services/p1Client.ts";
import { formatDate, reviewActionLabel, submissionTypeLabel, workflowStateLabel } from "../desktopShared.tsx";
import { AuthGateCard, PackagePreviewPanel, PageProps, SectionEmpty, TagPill } from "./pageCommon.tsx";

export function ReviewPage({ workspace, ui }: PageProps) {
  if (!workspace.loggedIn || !workspace.visibleNavigation.includes("review")) {
    return <AuthGateCard title="审核仅对在线管理员开放" body="登录并保持连接后，可领取单据、处理人工复核和完成审核决策。" onLogin={() => workspace.requireAuth("review")} />;
  }

  const riskCopy = { low: "低", medium: "中", high: "高", unknown: "未知" } as const;
  const [decisionComment, setDecisionComment] = useState("");
  const selectedReview = workspace.adminData.selectedReview;

  const loadReviewFileContent = async (relativePath: string) => {
    if (!selectedReview) {
      throw new Error("未选择审核单");
    }
    return workspace.adminData.getReviewFileContent(selectedReview.reviewID, relativePath);
  };

  function runReviewAction(action: "claim" | "pass_precheck" | "approve" | "return_for_changes" | "reject" | "withdraw", reviewID: string) {
    switch (action) {
      case "claim":
        void workspace.adminData.claimReview(reviewID);
        return;
      case "pass_precheck":
        void workspace.adminData.passPrecheck(reviewID, decisionComment);
        return;
      case "approve":
        void workspace.adminData.approveReview(reviewID, decisionComment);
        return;
      case "return_for_changes":
        void workspace.adminData.returnReview(reviewID, decisionComment);
        return;
      case "reject":
        void workspace.adminData.rejectReview(reviewID, decisionComment);
        return;
      case "withdraw":
        return;
    }
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">审核工作台</div>
          <h1>发布审核</h1>
          <p>审核单会先经过系统初审，异常进入人工复核，通过后再进入正式审核。锁单超时 5 分钟自动释放。</p>
        </div>
        <TagPill tone="info">真实写入链路</TagPill>
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
              <tr key={review.reviewID} data-testid="review-row" data-review-id={review.reviewID} data-skill-id={review.skillID}>
                <td>
                  <strong>{review.skillDisplayName}</strong>
                  <div className="table-meta">{review.skillID} · {submissionTypeLabel(review.reviewType)}</div>
                  <div className="table-meta">提交时间：{formatDate(review.submittedAt)}</div>
                </td>
                <td>{review.submitterName}<br /><span className="table-meta">{review.submitterDepartmentName}</span></td>
                <td><TagPill tone={review.riskLevel === "high" ? "danger" : review.riskLevel === "medium" ? "warning" : "success"}>{riskCopy[review.riskLevel]}</TagPill></td>
                <td>
                  <div className="stack-list compact">
                    <TagPill tone={review.reviewStatus === "reviewed" ? "success" : review.reviewStatus === "in_review" ? "warning" : "info"}>
                      {workflowStateLabel(review.workflowState)}
                    </TagPill>
                    <small>{review.lockState === "locked" ? `当前审核人：${review.currentReviewerName ?? "已锁定"}` : "当前未锁定"}</small>
                    {review.requestedVersion ? <small>目标版本：{review.requestedVersion}</small> : null}
                  </div>
                </td>
                <td>
                  <div className="inline-actions wrap">
                    <button className="btn btn-small" onClick={() => workspace.adminData.setSelectedReviewID(review.reviewID)}>查看详情</button>
                    {review.availableActions.includes("claim") ? (
                      <button className="btn btn-small btn-primary" onClick={() => runReviewAction("claim", review.reviewID)}>开始审核</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel" data-testid="review-detail-panel">
        {!selectedReview ? <SectionEmpty title="选择一条审核单查看详情" body="这里会显示预检查结果、提交包下载与可执行动作。" /> : (
          <>
            <div className="section-heading">
              <div>
                <div className="eyebrow">审核详情</div>
                <h2>{selectedReview.skillDisplayName}</h2>
              </div>
              <div className="pill-row">
                <TagPill tone="info">{submissionTypeLabel(selectedReview.reviewType)}</TagPill>
                <TagPill tone={selectedReview.workflowState === "published" ? "success" : selectedReview.workflowState === "manual_precheck" ? "warning" : "info"}>
                  {workflowStateLabel(selectedReview.workflowState)}
                </TagPill>
              </div>
            </div>
            <p>{selectedReview.description}</p>
            <div className="definition-grid split">
              <div><dt>提交人</dt><dd>{selectedReview.submitterName}</dd></div>
              <div><dt>部门</dt><dd>{selectedReview.submitterDepartmentName}</dd></div>
              <div><dt>状态</dt><dd>{workflowStateLabel(selectedReview.workflowState)}</dd></div>
              <div><dt>当前审核人</dt><dd>{selectedReview.currentReviewerName ?? "未锁定"}</dd></div>
            </div>
            <div className="definition-grid split">
              <div><dt>当前版本</dt><dd>{selectedReview.currentVersion ?? "-"}</dd></div>
              <div><dt>目标版本</dt><dd>{selectedReview.requestedVersion ?? "-"}</dd></div>
              <div><dt>当前公开级别</dt><dd>{selectedReview.currentVisibilityLevel ?? "-"}</dd></div>
              <div><dt>目标公开级别</dt><dd>{selectedReview.requestedVisibilityLevel ?? "-"}</dd></div>
            </div>
            {selectedReview.packageURL ? (
              <div className="inline-actions wrap">
                <button
                  className="btn btn-small"
                  onClick={() => void downloadAuthenticatedFile(
                    selectedReview.packageURL ?? "",
                    `${selectedReview.skillID ?? "review"}.zip`
                  )}
                >
                  <Download size={14} /> 下载提交包
                </button>
              </div>
            ) : null}
            <PackagePreviewPanel
              files={selectedReview.packageFiles}
              packageURL={selectedReview.packageURL}
              downloadName={`${selectedReview.skillID}.zip`}
              loadContent={loadReviewFileContent}
            />
            <div className="detail-block">
              <h3>预检查结果</h3>
              {selectedReview.precheckResults.length === 0 ? (
                <p>系统初审尚未返回结果。</p>
              ) : (
                <div className="stack-list compact">
                  {selectedReview.precheckResults.map((item) => (
                    <div className="history-row" key={item.id}>
                      <strong>{item.label}</strong>
                      <span>{item.status === "pass" ? "通过" : "待人工复核"}</span>
                      <small>{item.message}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedReview.reviewSummary ? (
              <div className="detail-block">
                <h3>审核摘要</h3>
                <p>{selectedReview.reviewSummary}</p>
              </div>
            ) : null}
            <div className="detail-block">
              <h3>审核动作</h3>
              <label className="field">
                <span>说明</span>
                <textarea value={decisionComment} data-testid="review-comment" onChange={(event) => setDecisionComment(event.target.value)} rows={3} placeholder="补充审核意见、退回原因或通过说明" />
              </label>
              <div className="inline-actions wrap">
                {selectedReview.availableActions.map((action) => (
                  <button
                    className={action === "approve" || action === "pass_precheck" ? "btn btn-primary btn-small" : "btn btn-small"}
                    key={action}
                    data-testid={`review-action-${action}`}
                    onClick={() => runReviewAction(action, selectedReview.reviewID ?? "")}
                  >
                    {reviewActionLabel(action)}
                  </button>
                ))}
              </div>
            </div>
            <div className="detail-block">
              <h3>历史时间线</h3>
              <div className="history-list">
                {selectedReview.history.map((history) => (
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
