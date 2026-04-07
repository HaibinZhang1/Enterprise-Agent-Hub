import { createPhase1LiveWebFlow } from '../live/phase-1-live-web-flow.js';
import { createPhase2LiveWebWorkflow } from '../live/phase-2-workflow.js';

// 单例模式实例化 slice，整个应用生命周期中只有一个实例
const phase1Flow = createPhase1LiveWebFlow();
const phase2Flow = createPhase2LiveWebWorkflow();

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// 初始化管理员用于测试
(async function bootstrapEnv() {
  const ticketRes = phase1Flow.bootstrapPage.issueTicket({ requestId: `sys-${Date.now()}` });
  if (ticketRes.state === 'ready') {
    await phase1Flow.bootstrapPage.bootstrapAdmin({
      requestId: `sys-boot-${Date.now()}`,
      bootstrapTicket: ticketRes.ticket,
      userId: 'u_admin_1',
      username: 'admin',
      displayName: 'System Admin',
    });
  }
})();

export const mockService = {
  // Auth
  async login(username, password) {
    await delay(300);
    const res = phase1Flow.loginPage.submit({
      requestId: `login-${Date.now()}`,
      username,
      password,
    });
    if (res.state === 'error') {
      throw new Error(res.reason || 'Login failed');
    }
    return res;
  },

  // Market
  async getMarketSkills(actor, query = '') {
    await delay(200);
    return phase2Flow.openMarketPage({ viewer: { userId: actor.userId, departmentIds: [] }, query });
  },

  // My Skill
  async getMySkills(actor) {
    await delay(200);
    return phase2Flow.openMySkillPage({ actor });
  },

  async publishSkill({ actor, packageId, skillId, reviewerId, visibility, manifest, files }) {
    await delay(500);
    return phase2Flow.publishFromMySkill({
      actor,
      packageId,
      skillId,
      reviewerId,
      visibility,
      manifest,
      files
    });
  },

  // Review
  async getReviewQueue(actor) {
    await delay(200);
    return phase2Flow.openReviewPage({ actor });
  },

  async claimReview(actor, ticketId) {
    await delay(200);
    return phase2Flow.claimReview({ actor, ticketId });
  },

  async approveReview(actor, ticketId, comment) {
    await delay(200);
    return phase2Flow.approveReview({ actor, ticketId, comment });
  },

  // Notifications
  async getNotifications(actor) {
    await delay(200);
    return phase2Flow.openNotificationsPage({ userId: actor.userId });
  },

  // User Management
  async getUsers(actor) {
    await delay(200);
    return phase1Flow.userManagementPage.load({ actor });
  },

  // Skill Management
  async getManageableSkills(actor) {
    await delay(200);
    return phase2Flow.openSkillManagementPage({ actor });
  }
};
