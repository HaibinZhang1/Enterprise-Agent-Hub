import type {
  ProjectDraft,
  PublishDraft,
  ReviewDecisionDraft,
  TargetDraft,
  ToolDraft
} from "../domain/p1.ts";
import { PendingBackendError, PendingLocalCommandError } from "../domain/p1.ts";

export interface PrototypeActionClient {
  submitPublishDraft(draft: PublishDraft): Promise<never>;
  claimReview(reviewID: string): Promise<never>;
  submitReviewDecision(draft: ReviewDecisionDraft): Promise<never>;
  createToolDraft(draft: ToolDraft): Promise<never>;
  createProjectDraft(draft: ProjectDraft): Promise<never>;
  applyTargetDrafts(skillID: string, drafts: TargetDraft[]): Promise<never>;
}

export const prototypeActionClient: PrototypeActionClient = {
  async submitPublishDraft(draft) {
    throw new PendingBackendError(
      "publish.submit",
      `“${draft.displayName || draft.skillID || "发布 Skill"}” 提交流程的后端接口待接入。`
    );
  },

  async claimReview(reviewID) {
    throw new PendingBackendError(
      "review.claim",
      `审核单 ${reviewID} 的锁单接口待接入，当前只保留真实工作台交互。`
    );
  },

  async submitReviewDecision(draft) {
    throw new PendingBackendError(
      "review.decision",
      `审核动作“${draft.decision}”的后端接口待接入，当前不会伪造审核结果。`
    );
  },

  async createToolDraft(draft) {
    throw new PendingLocalCommandError(
      "tool.create",
      `工具“${draft.name || "自定义工具"}”的本地写入命令待接入，当前只保留真实表单和校验。`
    );
  },

  async createProjectDraft(draft) {
    throw new PendingLocalCommandError(
      "project.create",
      `项目“${draft.name || "新增项目"}”的本地写入命令待接入，当前只保留真实表单和校验。`
    );
  },

  async applyTargetDrafts(skillID, drafts) {
    const labels = drafts.map((draft) => draft.targetName).join("、");
    throw new PendingLocalCommandError(
      "targets.apply",
      `Skill ${skillID} 到目标 ${labels || "所选路径"} 的完整配置命令待接入，当前只保留真实选择流程。`
    );
  }
};
