import type {
  AdminSkill,
  AdminUser,
  BootstrapContext,
  DepartmentNode,
  LocalEvent,
  LocalNotification,
  ProjectConfig,
  ReviewDetail,
  ReviewItem,
  SkillSummary,
  ToolConfig
} from "../domain/p1";

const baseNavigation: BootstrapContext["navigation"] = ["home", "market", "my_installed", "publisher", "tools", "projects", "notifications", "settings"];

export const guestBootstrap: BootstrapContext = {
  user: {
    userID: "guest",
    displayName: "本地模式",
    role: "guest",
    departmentID: "local",
    departmentName: "离线工作台",
    locale: "zh-CN"
  },
  connection: {
    status: "offline",
    serverTime: "",
    apiVersion: "p1.0",
    lastError: "登录后同步市场、通知和管理员能力。"
  },
  features: {
    p1Desktop: true,
    publishSkill: false,
    reviewWorkbench: false,
    adminManage: false,
    mcpManage: false,
    pluginManage: false
  },
  counts: {
    installedCount: 0,
    enabledCount: 0,
    updateAvailableCount: 0,
    unreadNotificationCount: 0
  },
  navigation: baseNavigation,
  menuPermissions: []
};

export const seedSkills: SkillSummary[] = [
  {
    skillID: "context-router",
    displayName: "上下文路由助手",
    description: "根据任务类型自动推荐 Codex、Claude、Cursor 的上下文入口，减少重复说明。",
    version: "1.4.0",
    localVersion: "1.2.0",
    latestVersion: "1.4.0",
    status: "published",
    visibilityLevel: "public_installable",
    detailAccess: "full",
    canInstall: true,
    canUpdate: true,
    installState: "update_available",
    authorName: "林澄",
    authorDepartment: "平台工程部",
    currentVersionUpdatedAt: "2026-04-09T08:00:00Z",
    publishedAt: "2026-03-12T08:00:00Z",
    compatibleTools: ["codex", "claude", "cursor"],
    compatibleSystems: ["windows"],
    tags: ["上下文", "路由", "效率"],
    category: "开发效率",
    riskLevel: "low",
    starCount: 148,
    downloadCount: 982,
    starred: true,
    readme: "适用于多工具协作场景。启用后会把任务入口和上下文说明转换到目标工具的 Skill 目录。",
    reviewSummary: "已通过安全复核，未发现风险脚本。",
    isScopeRestricted: false,
    hasLocalHashDrift: true,
    enabledTargets: [
      {
        targetType: "tool",
        targetID: "codex",
        targetName: "Codex",
        targetPath: "%USERPROFILE%\\.codex\\skills\\context-router",
        requestedMode: "symlink",
        resolvedMode: "symlink",
        fallbackReason: null,
        enabledAt: "2026-04-10T08:32:00Z"
      },
      {
        targetType: "project",
        targetID: "enterprise-agent-hub",
        targetName: "Enterprise Agent Hub",
        targetPath: "D:\\workspace\\EnterpriseAgentHub\\.codex\\skills\\context-router",
        requestedMode: "symlink",
        resolvedMode: "copy",
        fallbackReason: "symlink_permission_denied",
        enabledAt: "2026-04-10T08:40:00Z"
      }
    ],
    lastEnabledAt: "2026-04-10T08:40:00Z"
  },
  {
    skillID: "security-review-kit",
    displayName: "安全审查套件",
    description: "为权限、包校验、路径写入和接口调用提供安全审查清单。",
    version: "2.0.1",
    localVersion: null,
    latestVersion: "2.0.1",
    status: "published",
    visibilityLevel: "public_installable",
    detailAccess: "full",
    canInstall: true,
    canUpdate: false,
    installState: "not_installed",
    authorName: "陈苇",
    authorDepartment: "安全与合规部",
    currentVersionUpdatedAt: "2026-04-08T08:00:00Z",
    publishedAt: "2026-02-20T08:00:00Z",
    compatibleTools: ["codex", "claude", "windsurf"],
    compatibleSystems: ["windows"],
    tags: ["安全", "审查", "清单"],
    category: "治理",
    riskLevel: "medium",
    starCount: 201,
    downloadCount: 1312,
    starred: false,
    readme: "按认证、授权、文件写入、日志四段进行核对。",
    reviewSummary: "风险等级中等，涉及本地路径检查，无自动执行脚本。",
    isScopeRestricted: false,
    hasLocalHashDrift: false,
    enabledTargets: [],
    lastEnabledAt: null
  },
  {
    skillID: "readme-polisher",
    displayName: "README 改写助手",
    description: "统一整理 README 的结构、示例、限制说明和验收清单。",
    version: "1.3.2",
    localVersion: "1.3.2",
    latestVersion: "1.3.2",
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "full",
    canInstall: true,
    canUpdate: false,
    installState: "installed",
    authorName: "周瑾",
    authorDepartment: "研发效能部",
    currentVersionUpdatedAt: "2026-04-01T08:00:00Z",
    publishedAt: "2026-01-14T08:00:00Z",
    compatibleTools: ["codex", "cursor", "opencode"],
    compatibleSystems: ["windows"],
    tags: ["文档", "README", "写作"],
    category: "文档",
    riskLevel: "low",
    starCount: 94,
    downloadCount: 711,
    starred: false,
    readme: "适合发布前文档清理。启用后可在工具内调用统一的 README 写作指令。",
    reviewSummary: "低风险，仅包含文档模板与说明。",
    isScopeRestricted: false,
    hasLocalHashDrift: false,
    enabledTargets: [],
    lastEnabledAt: "2026-04-04T02:20:00Z"
  },
  {
    skillID: "e2e-test-writer",
    displayName: "端到端测试编排",
    description: "根据页面流程生成端到端测试步骤，覆盖成功、失败、离线和权限状态。",
    version: "0.9.7",
    localVersion: "0.9.7",
    latestVersion: "0.9.7",
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "full",
    canInstall: true,
    canUpdate: false,
    installState: "enabled",
    authorName: "许未",
    authorDepartment: "质量平台部",
    currentVersionUpdatedAt: "2026-03-29T08:00:00Z",
    publishedAt: "2026-02-03T08:00:00Z",
    compatibleTools: ["codex", "claude"],
    compatibleSystems: ["windows"],
    tags: ["测试", "E2E", "验收"],
    category: "测试",
    riskLevel: "unknown",
    starCount: 77,
    downloadCount: 533,
    starred: true,
    readme: "围绕产品验收标准生成测试脚本草案，重点覆盖异常和回归路径。",
    reviewSummary: "未知风险，依赖说明不完整；当前版本不会自动解析或安装依赖。",
    isScopeRestricted: false,
    hasLocalHashDrift: false,
    enabledTargets: [
      {
        targetType: "tool",
        targetID: "claude",
        targetName: "Claude",
        targetPath: "%USERPROFILE%\\.claude\\skills\\e2e-test-writer",
        requestedMode: "symlink",
        resolvedMode: "symlink",
        fallbackReason: null,
        enabledAt: "2026-04-08T01:12:00Z"
      }
    ],
    lastEnabledAt: "2026-04-08T01:12:00Z"
  },
  {
    skillID: "adapter-bridge",
    displayName: "Adapter 转换桥",
    description: "覆盖 Codex、Claude、Cursor、Windsurf、opencode 的转换规则。",
    version: "1.0.0",
    localVersion: null,
    latestVersion: "1.0.0",
    status: "published",
    visibilityLevel: "summary_visible",
    detailAccess: "summary",
    canInstall: false,
    canUpdate: false,
    cannotInstallReason: "该 Skill 暂未向你开放详情，不能安装。",
    installState: "blocked",
    authorName: "韩屿",
    authorDepartment: "工具平台部",
    currentVersionUpdatedAt: "2026-04-05T08:00:00Z",
    publishedAt: "2026-03-30T08:00:00Z",
    compatibleTools: ["codex", "claude", "cursor", "windsurf", "opencode"],
    compatibleSystems: ["windows"],
    tags: ["Adapter", "转换", "工具"],
    category: "工具集成",
    riskLevel: "high",
    starCount: 63,
    downloadCount: 241,
    starred: false,
    readme: "",
    reviewSummary: "",
    isScopeRestricted: false,
    hasLocalHashDrift: false,
    enabledTargets: [],
    lastEnabledAt: null
  },
  {
    skillID: "legacy-cli-helper",
    displayName: "旧版 CLI 迁移助手",
    description: "保留旧版命令迁移提示。权限已收缩，存量用户只能继续使用当前本地版本。",
    version: "1.8.0",
    localVersion: "1.6.0",
    latestVersion: "1.8.0",
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "full",
    canInstall: false,
    canUpdate: false,
    cannotInstallReason: "权限已收缩，禁止新增安装或更新。",
    installState: "installed",
    authorName: "赵行",
    authorDepartment: "基础设施部",
    currentVersionUpdatedAt: "2026-04-06T08:00:00Z",
    publishedAt: "2025-12-18T08:00:00Z",
    compatibleTools: ["codex", "opencode"],
    compatibleSystems: ["windows"],
    tags: ["CLI", "迁移", "存量"],
    category: "工具集成",
    riskLevel: "medium",
    starCount: 36,
    downloadCount: 418,
    starred: false,
    readme: "用于旧版 CLI 迁移期间的提示保留。当前不允许新增安装或更新。",
    reviewSummary: "权限已收缩，存量用户可继续使用当前版本。",
    isScopeRestricted: true,
    hasLocalHashDrift: false,
    enabledTargets: [],
    lastEnabledAt: "2026-03-28T06:06:00Z"
  }
];

export const seedTools: ToolConfig[] = [
  { toolID: "codex", name: "Codex", displayName: "Codex", configPath: "%USERPROFILE%\\.codex\\config.toml", detectedPath: "%USERPROFILE%\\.codex\\skills", configuredPath: null, skillsPath: "%USERPROFILE%\\.codex\\skills", enabled: true, status: "detected", adapterStatus: "detected", detectionMethod: "default_path", transform: "codex_skill", transformStrategy: "codex_skill", enabledSkillCount: 1, lastScannedAt: "2026-04-11T02:00:00Z" },
  { toolID: "claude", name: "Claude", displayName: "Claude", configPath: "%USERPROFILE%\\.claude\\settings.json", detectedPath: "%USERPROFILE%\\.claude\\skills", configuredPath: null, skillsPath: "%USERPROFILE%\\.claude\\skills", enabled: true, status: "detected", adapterStatus: "detected", detectionMethod: "registry", transform: "claude_skill", transformStrategy: "claude_skill", enabledSkillCount: 1, lastScannedAt: "2026-04-11T02:00:00Z" },
  { toolID: "cursor", name: "Cursor", displayName: "Cursor", configPath: "%USERPROFILE%\\.cursor\\settings.json", detectedPath: "%USERPROFILE%\\.cursor\\rules", configuredPath: "D:\\Cursor\\rules", skillsPath: "D:\\Cursor\\rules", enabled: true, status: "manual", adapterStatus: "manual", detectionMethod: "manual", transform: "cursor_rule", transformStrategy: "cursor_rule", enabledSkillCount: 0, lastScannedAt: "2026-04-11T02:00:00Z" },
  { toolID: "windsurf", name: "Windsurf", displayName: "Windsurf", configPath: "%USERPROFILE%\\.windsurf\\settings.json", detectedPath: null, configuredPath: null, skillsPath: "%USERPROFILE%\\.windsurf\\skills", enabled: false, status: "missing", adapterStatus: "missing", detectionMethod: "default_path", transform: "windsurf_rule", transformStrategy: "windsurf_rule", enabledSkillCount: 0, lastScannedAt: null },
  { toolID: "opencode", name: "opencode", displayName: "opencode", configPath: "%USERPROFILE%\\.opencode\\config.json", detectedPath: null, configuredPath: "D:\\OpenCode\\skills", skillsPath: "D:\\OpenCode\\skills", enabled: true, status: "invalid", adapterStatus: "invalid", detectionMethod: "manual", transform: "opencode_skill", transformStrategy: "opencode_skill", enabledSkillCount: 0, lastScannedAt: "2026-04-11T02:00:00Z" },
  { toolID: "custom_directory", name: "自定义目录", displayName: "自定义目录", configPath: "手动维护", detectedPath: null, configuredPath: "D:\\ai-skills\\shared", skillsPath: "D:\\ai-skills\\shared", enabled: true, status: "manual", adapterStatus: "manual", detectionMethod: "manual", transform: "generic_directory", transformStrategy: "generic_directory", enabledSkillCount: 0, lastScannedAt: "2026-04-11T02:00:00Z" }
];

export const seedProjects: ProjectConfig[] = [
  { projectID: "enterprise-agent-hub", name: "Enterprise Agent Hub", displayName: "Enterprise Agent Hub", projectPath: "D:\\workspace\\EnterpriseAgentHub", skillsPath: "D:\\workspace\\EnterpriseAgentHub\\.codex\\skills", enabled: true, enabledSkillCount: 1, createdAt: "2026-04-09T10:00:00Z", updatedAt: "2026-04-11T02:00:00Z" },
  { projectID: "desktop-client", name: "Desktop Client", displayName: "Desktop Client", projectPath: "D:\\workspace\\DesktopClient", skillsPath: "D:\\workspace\\DesktopClient\\.claude\\skills", enabled: true, enabledSkillCount: 0, createdAt: "2026-04-09T11:00:00Z", updatedAt: "2026-04-11T02:00:00Z" }
];

export const seedNotifications: LocalNotification[] = [
  { notificationID: "n-001", type: "skill_update_available", title: "上下文路由助手有新版本", summary: "市场版本 1.4.0 高于本地版本 1.2.0，更新前会提示覆盖本地修改。", relatedSkillID: "context-router", targetPage: "my_installed", occurredAt: "2026-04-11T01:20:00Z", unread: true, source: "server" },
  { notificationID: "n-002", type: "skill_scope_restricted", title: "旧版 CLI 迁移助手权限已收缩", summary: "可继续使用当前版本，但不可更新或新增启用位置。", relatedSkillID: "legacy-cli-helper", targetPage: "my_installed", occurredAt: "2026-04-10T10:02:00Z", unread: true, source: "server" },
  { notificationID: "n-003", type: "target_path_invalid", title: "opencode 路径不可用", summary: "请在工具页修复 skills 安装路径后再启用到 opencode。", relatedSkillID: null, targetPage: "tools", occurredAt: "2026-04-10T03:41:00Z", unread: false, source: "local" }
];

export const seedOfflineEvents: LocalEvent[] = [];

export const seedDepartments: DepartmentNode[] = [
  {
    departmentID: "dept_company",
    parentDepartmentID: null,
    name: "集团",
    path: "/集团",
    level: 0,
    status: "active",
    userCount: 7,
    skillCount: 3,
    children: [
      {
        departmentID: "dept_engineering",
        parentDepartmentID: "dept_company",
        name: "技术部",
        path: "/集团/技术部",
        level: 1,
        status: "active",
        userCount: 4,
        skillCount: 1,
        children: [
          {
            departmentID: "dept_frontend",
            parentDepartmentID: "dept_engineering",
            name: "前端组",
            path: "/集团/技术部/前端组",
            level: 2,
            status: "active",
            userCount: 3,
            skillCount: 1,
            children: []
          },
          {
            departmentID: "dept_backend",
            parentDepartmentID: "dept_engineering",
            name: "后端组",
            path: "/集团/技术部/后端组",
            level: 2,
            status: "active",
            userCount: 1,
            skillCount: 0,
            children: []
          }
        ]
      },
      {
        departmentID: "dept_design",
        parentDepartmentID: "dept_company",
        name: "设计平台组",
        path: "/集团/设计平台组",
        level: 1,
        status: "active",
        userCount: 1,
        skillCount: 1,
        children: []
      },
      {
        departmentID: "dept_ops",
        parentDepartmentID: "dept_company",
        name: "运维组",
        path: "/集团/运维组",
        level: 1,
        status: "active",
        userCount: 1,
        skillCount: 1,
        children: []
      }
    ]
  }
];

export const seedAdminUsers: AdminUser[] = [
  {
    userID: "u_admin_l1",
    username: "superadmin",
    displayName: "系统管理员",
    departmentID: "dept_company",
    departmentName: "集团",
    role: "admin",
    adminLevel: 1,
    status: "active",
    publishedSkillCount: 0,
    starCount: 4
  },
  {
    userID: "u_admin_l2_eng",
    username: "engadmin",
    displayName: "技术部管理员",
    departmentID: "dept_engineering",
    departmentName: "技术部",
    role: "admin",
    adminLevel: 2,
    status: "active",
    publishedSkillCount: 0,
    starCount: 1
  },
  {
    userID: "u_001",
    username: "demo",
    displayName: "张三",
    departmentID: "dept_frontend",
    departmentName: "前端组",
    role: "normal_user",
    adminLevel: null,
    status: "active",
    publishedSkillCount: 0,
    starCount: 2
  }
];

export const seedAdminSkills: AdminSkill[] = [
  {
    skillID: "codex-review-helper",
    displayName: "Codex Review Helper",
    publisherName: "李四",
    departmentID: "dept_frontend",
    departmentName: "前端组",
    version: "1.2.0",
    status: "published",
    visibilityLevel: "public_installable",
    starCount: 12,
    downloadCount: 33,
    updatedAt: "2026-04-11T02:30:00Z"
  },
  {
    skillID: "design-guideline-lite",
    displayName: "Design Guideline Lite",
    publisherName: "王五",
    departmentID: "dept_design",
    departmentName: "设计平台组",
    version: "0.9.0",
    status: "published",
    visibilityLevel: "summary_visible",
    starCount: 4,
    downloadCount: 8,
    updatedAt: "2026-04-10T09:30:00Z"
  }
];

export const seedReviews: ReviewItem[] = [
  {
    reviewID: "rv_001",
    skillID: "codex-review-helper",
    skillDisplayName: "Codex Review Helper",
    submitterName: "李四",
    submitterDepartmentName: "前端组",
    reviewType: "publish",
    reviewStatus: "pending",
    workflowState: "manual_precheck",
    riskLevel: "low",
    summary: "等待审核：代码审查辅助 Skill 首次发布。",
    lockState: "unlocked",
    availableActions: ["claim"],
    submittedAt: "2026-04-09T09:00:00Z",
    updatedAt: "2026-04-09T09:00:00Z"
  },
  {
    reviewID: "rv_002",
    skillID: "design-guideline-lite",
    skillDisplayName: "Design Guideline Lite",
    submitterName: "王五",
    submitterDepartmentName: "设计平台组",
    reviewType: "permission_change",
    reviewStatus: "in_review",
    workflowState: "pending_review",
    riskLevel: "unknown",
    summary: "正在复核：公开范围由摘要公开调整为详情公开。",
    lockState: "locked",
    lockOwnerID: "u_admin_l1",
    currentReviewerName: "系统管理员",
    availableActions: ["approve", "return_for_changes", "reject"],
    submittedAt: "2026-04-10T09:00:00Z",
    updatedAt: "2026-04-10T21:00:00Z"
  }
];

export const seedReviewDetail: ReviewDetail = {
  ...seedReviews[1],
  description: "涉及设计规范细则的详情可见范围调整，需确认部门授权策略。",
  currentVersion: "0.9.0",
  currentVisibilityLevel: "summary_visible",
  currentScopeType: "current_department",
  requestedDepartmentIDs: [],
  precheckResults: [
    { id: "scope", label: "授权范围有效", status: "pass", message: "本次仅调整公开级别，不改包内容。" },
    { id: "visibility", label: "公开级别有效", status: "warn", message: "公开级别扩大，需正式审核。" }
  ],
  packageRef: "pkg_design-guideline-lite_0_9_0",
  packageURL: "/skill-packages/pkg_design-guideline-lite_0_9_0/download?ticket=p1-dev-ticket",
  packageHash: "sha256:mock",
  packageSize: 1024,
  packageFileCount: 2,
  packageFiles: [
    { relativePath: "SKILL.md", fileType: "markdown", sizeBytes: 640, previewable: true },
    { relativePath: "assets/notes.txt", fileType: "text", sizeBytes: 128, previewable: true }
  ],
  reviewSummary: "当前由系统管理员查看授权范围变更影响。",
  history: [
    { historyID: "rvh_001", action: "submitted", actorName: "王五", comment: "提交权限变更申请。", createdAt: "2026-04-10T09:00:00Z" },
    { historyID: "rvh_002", action: "claimed", actorName: "系统管理员", comment: "系统管理员已领取复核。", createdAt: "2026-04-10T21:00:00Z" }
  ]
};
