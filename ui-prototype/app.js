const app = document.getElementById("app");
const toastRegion = document.getElementById("toast-region");

const IMAGE_POOL = {
  login:
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
  context:
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80",
  review:
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
  docs:
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80",
  test:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
  bridge:
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  cli:
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=900&q=80",
};

const initialSkills = [
  {
    skillID: "context-router",
    displayName: "上下文路由助手",
    description: "根据任务类型自动推荐 Codex、Claude、Cursor 的上下文入口，减少重复说明。",
    version: "1.4.0",
    localVersion: "1.2.0",
    installState: "update_available",
    detailAccess: "full",
    canInstall: true,
    canUpdate: true,
    isScopeRestricted: false,
    authorName: "林澄",
    authorDepartment: "平台工程部",
    tags: ["上下文", "路由", "效率"],
    category: "开发效率",
    riskLevel: "low",
    starCount: 148,
    downloadCount: 982,
    compatibleTools: ["Codex", "Claude", "Cursor"],
    compatibleSystems: ["Windows"],
    currentVersionUpdatedAt: "2026-04-09",
    publishedAt: "2026-03-12",
    packageHash: "sha256:19e3d6a3",
    packageSize: 842000,
    packageFileCount: 18,
    image: IMAGE_POOL.context,
    starred: true,
    hasLocalHashDrift: true,
    reviewSummary: "已通过安全复核，未发现风险脚本。",
    readme:
      "适用于多工具协作场景。启用后会把任务入口和上下文说明复制到目标工具的 Skill 目录。",
    enabledTargets: [
      {
        type: "tool",
        id: "codex",
        name: "Codex",
        path: "%USERPROFILE%\\.codex\\skills\\context-router",
        status: "enabled",
      },
      {
        type: "project",
        id: "enterprise-agent-hub",
        name: "Enterprise Agent Hub",
        path: "D:\\workspace\\EnterpriseAgentHub\\.codex\\skills\\context-router",
        status: "enabled",
      },
    ],
    lastEnabledAt: "2026-04-10 16:32",
  },
  {
    skillID: "security-review-kit",
    displayName: "安全审查套件",
    description: "为权限、包校验、路径写入和接口调用提供安全审查清单。",
    version: "2.0.1",
    localVersion: null,
    installState: "not_installed",
    detailAccess: "full",
    canInstall: true,
    canUpdate: false,
    isScopeRestricted: false,
    authorName: "陈苇",
    authorDepartment: "安全与合规部",
    tags: ["安全", "审查", "清单"],
    category: "治理",
    riskLevel: "medium",
    starCount: 201,
    downloadCount: 1312,
    compatibleTools: ["Codex", "Claude", "Windsurf"],
    compatibleSystems: ["Windows"],
    currentVersionUpdatedAt: "2026-04-08",
    publishedAt: "2026-02-20",
    packageHash: "sha256:64cbe1a9",
    packageSize: 1293000,
    packageFileCount: 35,
    image: IMAGE_POOL.review,
    starred: false,
    hasLocalHashDrift: false,
    reviewSummary: "风险等级中等，涉及本地路径检查，无自动执行脚本。",
    readme: "打开安全审查清单后，按认证、授权、文件写入、日志四段进行核对。",
    enabledTargets: [],
    lastEnabledAt: null,
  },
  {
    skillID: "readme-polisher",
    displayName: "README 改写助手",
    description: "统一整理 README 的结构、示例、限制说明和验收清单。",
    version: "1.3.2",
    localVersion: "1.3.2",
    installState: "installed",
    detailAccess: "full",
    canInstall: true,
    canUpdate: false,
    isScopeRestricted: false,
    authorName: "周瑾",
    authorDepartment: "研发效能部",
    tags: ["文档", "README", "写作"],
    category: "文档",
    riskLevel: "low",
    starCount: 94,
    downloadCount: 711,
    compatibleTools: ["Codex", "Cursor", "opencode"],
    compatibleSystems: ["Windows"],
    currentVersionUpdatedAt: "2026-04-01",
    publishedAt: "2026-01-14",
    packageHash: "sha256:7b3fb0a4",
    packageSize: 412000,
    packageFileCount: 12,
    image: IMAGE_POOL.docs,
    starred: false,
    hasLocalHashDrift: false,
    reviewSummary: "低风险，仅包含文档模板与说明。",
    readme: "适合发布前文档清理。启用后可在工具内调用统一的 README 写作指令。",
    enabledTargets: [],
    lastEnabledAt: "2026-04-04 10:20",
  },
  {
    skillID: "e2e-test-writer",
    displayName: "端到端测试编排",
    description: "根据页面流程生成端到端测试步骤，覆盖成功、失败、离线和权限状态。",
    version: "0.9.7",
    localVersion: "0.9.7",
    installState: "enabled",
    detailAccess: "full",
    canInstall: true,
    canUpdate: false,
    isScopeRestricted: false,
    authorName: "许未",
    authorDepartment: "质量平台部",
    tags: ["测试", "E2E", "验收"],
    category: "测试",
    riskLevel: "unknown",
    starCount: 77,
    downloadCount: 533,
    compatibleTools: ["Codex", "Claude"],
    compatibleSystems: ["Windows"],
    currentVersionUpdatedAt: "2026-03-29",
    publishedAt: "2026-02-03",
    packageHash: "sha256:bf83291c",
    packageSize: 965000,
    packageFileCount: 24,
    image: IMAGE_POOL.test,
    starred: true,
    hasLocalHashDrift: false,
    reviewSummary: "未知风险，依赖说明不完整；当前版本不会自动解析或安装依赖。",
    readme: "围绕产品验收标准生成测试脚本草案，重点覆盖异常和回归路径。",
    enabledTargets: [
      {
        type: "tool",
        id: "claude",
        name: "Claude",
        path: "%USERPROFILE%\\.claude\\skills\\e2e-test-writer",
        status: "enabled",
      },
    ],
    lastEnabledAt: "2026-04-08 09:12",
  },
  {
    skillID: "adapter-bridge",
    displayName: "Adapter 转换桥",
    description: "覆盖 Codex、Claude、Cursor、Windsurf、opencode 的转换规则。",
    version: "1.0.0",
    localVersion: null,
    installState: "blocked",
    detailAccess: "summary",
    canInstall: false,
    canUpdate: false,
    cannotInstallReason: "该 Skill 暂未向你开放详情，不能安装。",
    isScopeRestricted: false,
    authorName: "韩屿",
    authorDepartment: "工具平台部",
    tags: ["Adapter", "转换", "工具"],
    category: "工具集成",
    riskLevel: "high",
    starCount: 63,
    downloadCount: 241,
    compatibleTools: ["Codex", "Claude", "Cursor", "Windsurf", "opencode"],
    compatibleSystems: ["Windows"],
    currentVersionUpdatedAt: "2026-04-05",
    publishedAt: "2026-03-30",
    packageHash: null,
    packageSize: 0,
    packageFileCount: 0,
    image: IMAGE_POOL.bridge,
    starred: false,
    hasLocalHashDrift: false,
    reviewSummary: "",
    readme: "",
    enabledTargets: [],
    lastEnabledAt: null,
  },
  {
    skillID: "legacy-cli-helper",
    displayName: "旧版 CLI 迁移助手",
    description: "保留旧版命令迁移提示。权限已收缩，存量用户只能继续使用当前本地版本。",
    version: "1.8.0",
    localVersion: "1.6.0",
    installState: "installed",
    detailAccess: "full",
    canInstall: false,
    canUpdate: false,
    cannotInstallReason: "权限已收缩，禁止新增安装或更新。",
    isScopeRestricted: true,
    authorName: "赵行",
    authorDepartment: "基础设施部",
    tags: ["CLI", "迁移", "存量"],
    category: "工具集成",
    riskLevel: "medium",
    starCount: 36,
    downloadCount: 418,
    compatibleTools: ["Codex", "opencode"],
    compatibleSystems: ["Windows"],
    currentVersionUpdatedAt: "2026-04-06",
    publishedAt: "2025-12-18",
    packageHash: "sha256:442bfaa1",
    packageSize: 533000,
    packageFileCount: 16,
    image: IMAGE_POOL.cli,
    starred: false,
    hasLocalHashDrift: false,
    reviewSummary: "权限已收缩，存量用户可继续使用当前版本。",
    readme: "用于旧版 CLI 迁移期间的提示保留。当前不允许新增安装或更新。",
    enabledTargets: [],
    lastEnabledAt: "2026-03-28 14:06",
  },
];

const initialTools = [
  {
    id: "codex",
    name: "Codex",
    configPath: "%USERPROFILE%\\.codex\\config.toml",
    skillsPath: "%USERPROFILE%\\.codex\\skills",
    enabled: true,
    status: "detected",
    transform: "codex_skill",
  },
  {
    id: "claude",
    name: "Claude",
    configPath: "%USERPROFILE%\\.claude\\settings.json",
    skillsPath: "%USERPROFILE%\\.claude\\skills",
    enabled: true,
    status: "detected",
    transform: "claude_skill",
  },
  {
    id: "cursor",
    name: "Cursor",
    configPath: "%USERPROFILE%\\.cursor\\settings.json",
    skillsPath: "%USERPROFILE%\\.cursor\\rules",
    enabled: true,
    status: "manual",
    transform: "cursor_rule",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    configPath: "未检测到",
    skillsPath: "%USERPROFILE%\\.windsurf\\skills",
    enabled: false,
    status: "missing",
    transform: "windsurf_rule",
  },
  {
    id: "opencode",
    name: "opencode",
    configPath: "%USERPROFILE%\\.opencode\\config.json",
    skillsPath: "%USERPROFILE%\\.opencode\\skills",
    enabled: true,
    status: "invalid",
    transform: "opencode_skill",
  },
  {
    id: "custom_directory",
    name: "自定义目录",
    configPath: "手动维护",
    skillsPath: "D:\\ai-skills\\shared",
    enabled: true,
    status: "manual",
    transform: "generic_directory",
  },
];

const initialProjects = [
  {
    id: "enterprise-agent-hub",
    name: "Enterprise Agent Hub",
    projectPath: "D:\\workspace\\EnterpriseAgentHub",
    skillsPath: "D:\\workspace\\EnterpriseAgentHub\\.codex\\skills",
    enabled: true,
  },
  {
    id: "desktop-client",
    name: "Desktop Client",
    projectPath: "D:\\workspace\\DesktopClient",
    skillsPath: "D:\\workspace\\DesktopClient\\.claude\\skills",
    enabled: true,
  },
];

const initialNotifications = [
  {
    id: "n-001",
    type: "skill_update_available",
    title: "上下文路由助手有新版本",
    summary: "市场版本 1.4.0 高于本地版本 1.2.0，更新前会提示覆盖本地修改。",
    relatedSkillID: "context-router",
    targetPage: "my",
    time: "2026-04-11 09:20",
    unread: true,
  },
  {
    id: "n-002",
    type: "skill_scope_restricted",
    title: "旧版 CLI 迁移助手权限已收缩",
    summary: "可继续使用当前版本，但不可更新或新增启用位置。",
    relatedSkillID: "legacy-cli-helper",
    targetPage: "my",
    time: "2026-04-10 18:02",
    unread: true,
  },
  {
    id: "n-003",
    type: "target_path_invalid",
    title: "opencode 路径不可用",
    summary: "请在工具页修复 skills 安装路径后再启用到 opencode。",
    relatedSkillID: null,
    targetPage: "tools",
    time: "2026-04-10 11:41",
    unread: false,
  },
];

const initialReviewItems = [
  {
    id: "rv-001",
    skillID: "prompt-guardrails",
    name: "提示词护栏模板",
    submitter: "王棠",
    department: "前端组",
    version: "1.0.0",
    type: "首次发布",
    risk: "medium",
    precheck: "待人工复核",
    status: "pending",
    lockedBy: "",
    submittedAt: "2026-04-11 10:42",
  },
  {
    id: "rv-002",
    skillID: "incident-writer",
    name: "故障复盘写作助手",
    submitter: "赵行",
    department: "基础设施部",
    version: "1.2.0",
    type: "更新发布",
    risk: "low",
    precheck: "初审通过",
    status: "reviewing",
    lockedBy: "张三",
    submittedAt: "2026-04-11 09:12",
  },
  {
    id: "rv-003",
    skillID: "adapter-bridge",
    name: "Adapter 转换桥",
    submitter: "韩屿",
    department: "工具平台部",
    version: "1.0.0",
    type: "权限变更",
    risk: "high",
    precheck: "初审通过",
    status: "reviewed",
    lockedBy: "李楠",
    submittedAt: "2026-04-10 15:33",
  },
];

const managedUsers = [
  ["yang.liu", "前端组", "普通用户", "正常", 4, "2026-04-10 18:20"],
  ["chen.wei", "安全与合规部", "三级管理员", "正常", 9, "2026-04-11 08:48"],
  ["han.yu", "工具平台部", "四级管理员", "冻结", 6, "2026-03-29 11:05"],
];

const managedSkillRows = [
  ["上下文路由助手", "林澄", "平台工程部", "1.4.0", "已发布", 148, 982, "上架"],
  ["Adapter 转换桥", "韩屿", "工具平台部", "1.0.0", "待管理员审核", 63, 241, "未上架"],
  ["旧版 CLI 迁移助手", "赵行", "基础设施部", "1.8.0", "已下架", 36, 418, "下架"],
];

const state = {
  loggedIn: false,
  page: "home",
  connection: "connected",
  search: "",
  marketQuery: "",
  marketFilters: {
    department: "all",
    tool: "all",
    installed: "all",
    enabled: "all",
    access: "authorized_only",
    category: "all",
    risk: "all",
  },
  marketSort: "composite",
  myFilter: "all",
  mySearch: "",
  notificationFilter: "all",
  reviewTab: "pending",
  manageTab: "departments",
  homeExpanded: null,
  detailSkillID: null,
  modal: null,
  userMenuOpen: false,
  connectionOpen: false,
  skills: structuredClone(initialSkills),
  tools: structuredClone(initialTools),
  projects: structuredClone(initialProjects),
  notifications: structuredClone(initialNotifications),
  reviewItems: structuredClone(initialReviewItems),
  settings: {
    language: "auto",
    autoDetectLanguage: true,
    centralStorePath: "%USERPROFILE%\\.ai-skills\\skills",
    showInstallResults: true,
    syncLocalEvents: true,
    theme: "classic",
  },
};

let progressTimer = null;
let toastCounter = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatFileSize(bytes) {
  if (!bytes) return "无包信息";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getSkill(skillID) {
  return state.skills.find((skill) => skill.skillID === skillID);
}

function isOffline() {
  return state.connection === "offline" || state.connection === "failed";
}

function isInstalled(skill) {
  return Boolean(skill.localVersion);
}

function isEnabled(skill) {
  return skill.enabledTargets.some((target) => target.status === "enabled");
}

function hasUpdate(skill) {
  return Boolean(skill.localVersion && skill.version !== skill.localVersion);
}

function getCounts() {
  const installedSkills = state.skills.filter(isInstalled);
  return {
    installed: installedSkills.length,
    enabled: installedSkills.filter(isEnabled).length,
    updates: installedSkills.filter((skill) => hasUpdate(skill) && skill.canUpdate).length,
    unread: state.notifications.filter((notice) => notice.unread).length,
  };
}

function connectionMeta(status = state.connection) {
  const map = {
    connected: {
      label: "已连接",
      className: "pill-success",
      description: "服务端连接正常。市场搜索、安装、更新和通知同步可用。",
    },
    connecting: {
      label: "正在连接",
      className: "pill-warning",
      description: "正在重试服务连接，请稍候。",
    },
    offline: {
      label: "离线模式",
      className: "pill-warning",
      description: "市场搜索、安装和更新暂不可用；本地已安装 Skill 可继续启用或停用。",
    },
    failed: {
      label: "连接失败",
      className: "pill-danger",
      description: "请检查网络或服务地址。本地使用能力仍保留。",
    },
  };
  return map[status] || map.connected;
}

function riskMeta(risk) {
  const map = {
    low: ["低风险", "pill-success"],
    medium: ["中风险", "pill-warning"],
    high: ["高风险", "pill-danger"],
    unknown: ["未知风险", "pill-info"],
  };
  return map[risk] || map.unknown;
}

function statusMeta(skill) {
  if (skill.isScopeRestricted) return ["权限已收缩", "pill-warning"];
  if (!skill.canInstall && !isInstalled(skill)) return ["不可安装", "pill-danger"];
  if (hasUpdate(skill) && skill.canUpdate) return ["有更新", "pill-warning"];
  if (isEnabled(skill)) return ["已启用", "pill-success"];
  if (isInstalled(skill)) return ["已安装", "pill-info"];
  return ["未安装", ""];
}

function render() {
  document.body.dataset.theme = state.settings.theme;
  app.innerHTML = state.loggedIn ? renderShell() : renderLogin();
  renderToasts();
}

function renderLogin() {
  return `
    <main class="login-shell">
      <section class="login-panel" aria-label="登录">
        <div class="brand-mark">EA</div>
        <p class="eyebrow">Desktop 使用闭环</p>
        <h1>企业内部 Agent Skills 管理市场</h1>
        <p class="muted">登录后可查看连接状态、浏览市场、安装或更新 Skill，并把本地副本启用到工具或项目目录。</p>
        <form class="login-form" data-form="login">
          <label class="field">
            <span>服务地址</span>
            <input name="server" value="https://skills.internal.example" autocomplete="url" />
          </label>
          <label class="field">
            <span>用户名</span>
            <input name="username" value="zhang.san" autocomplete="username" />
          </label>
          <label class="field">
            <span>密码</span>
            <input name="password" value="demo-password" type="password" autocomplete="current-password" />
          </label>
          <button class="btn btn-primary btn-block" type="submit">进入桌面客户端</button>
          <p class="muted">演示账号由管理员开通。发布、审核与管理将在后续版本开放。</p>
        </form>
      </section>
      <section class="login-visual" aria-label="产品场景图">
        <img src="${IMAGE_POOL.login}" alt="团队工作区" />
        <div class="visual-caption">
          <p class="eyebrow">Windows-first 内网交付</p>
          <h2>本机 Central Store 是唯一真源</h2>
          <p class="muted">启用时通过 copy 分发到 Codex、Claude、Cursor、Windsurf、opencode 或自定义目录，每次本地写入都有结果反馈。</p>
        </div>
      </section>
    </main>
  `;
}

function renderShell() {
  return `
    <div class="app-shell">
      ${renderSidebar()}
      ${renderTopbar()}
      <main class="content" id="main-content">
        ${renderPage()}
      </main>
      ${renderModal()}
    </div>
  `;
}

function renderSidebar() {
  const navGroups = [
    {
      label: "导航",
      items: [
        ["home", "H", "首页"],
        ["market", "M", "市场"],
        ["my", "S", "我的 Skill"],
        ["tools", "T", "工具"],
        ["projects", "P", "项目"],
      ],
    },
    {
      label: "管理",
      items: [
        ["publish", "P2", "发布 Skill"],
        ["review", "R", "审核工作台"],
        ["manage", "A", "管理中心"],
      ],
    },
    {
      label: "扩展",
      items: [["ecosystem", "P3", "生态路线图"]],
    },
  ];
  return `
    <aside class="sidebar">
      <button class="sidebar-brand btn-ghost" data-action="set-page" data-page="home">
        <span class="brand-mark">EA</span>
        <span>
          <span class="sidebar-title">Agent Skills</span>
          <span class="sidebar-subtitle">Desktop</span>
        </span>
      </button>
      <nav class="nav-list" aria-label="主导航">
        ${navGroups
          .map(
            (group) => `
              <section class="nav-section">
                <div class="nav-section-head">
                  <div class="nav-section-label"><span>${group.label}</span></div>
                </div>
                ${group.items
                  .map(
                    ([page, mark, label]) => `
                      <button class="nav-item ${state.page === page ? "active" : ""}" data-action="set-page" data-page="${page}">
                        <span class="nav-main"><span class="nav-dot">${mark}</span>${label}</span>
                      </button>
                    `
                  )
                  .join("")}
              </section>
            `
          )
          .join("")}
      </nav>
      <div class="sidebar-foot">
        <button class="btn settings-nav ${state.page === "settings" ? "btn-primary" : ""}" data-action="set-page" data-page="settings">
          <span class="nav-dot">G</span>
          设置
        </button>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const meta = connectionMeta();
  const counts = getCounts();
  return `
    <header class="topbar">
      <form class="topbar-search" data-form="global-search">
        <label class="screen-reader-only" for="global-search">全局搜索 Skill</label>
        <input id="global-search" class="search-input" name="q" value="${escapeHtml(
          state.search
        )}" placeholder="搜索 Skill 名称、描述、标签、作者、部门或 skillID" ${
    isOffline() ? "disabled" : ""
  } />
        <button class="btn" type="submit" ${isOffline() ? "disabled" : ""}>搜索</button>
      </form>
      <div class="popover-wrap">
        <button class="pill ${meta.className}" data-action="toggle-connection">${meta.label}</button>
        ${
          state.connectionOpen
            ? `<div class="popover">
                <h3>连接状态</h3>
                <p class="muted">${meta.description}</p>
                <div class="inline-list">
                  <button class="btn btn-small" data-action="retry-connection">重试连接</button>
                  <button class="btn btn-small" data-action="set-connection" data-status="offline">切换离线</button>
                  <button class="btn btn-small" data-action="set-connection" data-status="failed">模拟失败</button>
                </div>
              </div>`
            : ""
        }
      </div>
      <button class="btn" data-action="set-page" data-page="notifications">通知 ${counts.unread ? `(${counts.unread})` : ""}</button>
      <div class="popover-wrap">
        <button class="user-button" data-action="toggle-user-menu">
          <span class="avatar">张</span>
          <span>张三</span>
        </button>
        ${
          state.userMenuOpen
            ? `<div class="popover">
                <h3>张三</h3>
                <p class="muted">普通用户，前端组</p>
                <p class="muted">管理员治理能力将在后续版本开放。</p>
                <button class="btn btn-danger" data-action="logout">退出登录</button>
              </div>`
            : ""
        }
      </div>
    </header>
  `;
}

function renderPage() {
  const pages = {
    home: renderHome,
    market: renderMarket,
    detail: renderSkillDetailPage,
    my: renderMySkills,
    tools: renderTools,
    projects: renderProjects,
    notifications: renderNotifications,
    settings: renderSettings,
    publish: renderPublish,
    review: renderReview,
    manage: renderManage,
    ecosystem: renderEcosystem,
  };
  return (pages[state.page] || renderHome)();
}

function renderHome() {
  const counts = getCounts();
  const recommended = [...state.skills].sort((a, b) => b.starCount - a.starCount).slice(0, 6);
  const signals = getHomeSkillSignals();
  const notices = state.notifications.filter((notice) => notice.unread).slice(0, 3);
  const connection = connectionMeta();
  const focus = getHomeFocus(counts);
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">首页</p>
        <h1 class="page-title">${state.connection === "connected" ? "本机 Skill 状态正常" : "本机 Skill 可继续使用"}</h1>
        <p class="muted">${connection.description}</p>
      </div>
      <div class="inline-list">
        <span class="pill ${connection.className}">${connection.label}</span>
        ${state.connection === "connected" ? "" : `<button class="btn" data-action="retry-connection">重试连接</button>`}
      </div>
    </section>
    ${isOffline() ? renderOfflineBanner() : ""}
    <section class="home-layout">
      <div class="home-main">
        <section class="home-focus-grid">
          <article class="home-status-panel">
            <div>
              <p class="eyebrow">安装摘要</p>
              <h2>我的 Skill</h2>
            </div>
            <div class="home-status-metrics">
              <article class="stat-card">
                <span class="muted">已安装</span>
                <strong>${counts.installed}</strong>
                <button class="btn btn-small" data-action="set-page" data-page="my">查看列表</button>
              </article>
              <article class="stat-card">
                <span class="muted">已启用</span>
                <strong>${counts.enabled}</strong>
                <button class="btn btn-small" data-action="set-page" data-page="tools">查看工具</button>
              </article>
              <article class="stat-card">
                <span class="muted">可更新</span>
                <strong>${counts.updates}</strong>
                <button class="btn btn-small" data-action="set-page" data-page="my" data-filter="updates">处理更新</button>
              </article>
            </div>
          </article>
          <article class="home-next-action">
            <p class="eyebrow">当前动作</p>
            <h2>${escapeHtml(focus.title)}</h2>
            <p class="muted">${escapeHtml(focus.body)}</p>
            <button class="btn btn-primary" data-action="${focus.action}" data-page="${focus.page || ""}" data-filter="${focus.filter || ""}" data-skill-id="${focus.skillID || ""}">${escapeHtml(focus.label)}</button>
          </article>
        </section>
        <section>
          <div class="section-head">
            <h2>Skill 动态</h2>
            <button class="btn btn-small" data-action="set-page" data-page="my">查看我的 Skill</button>
          </div>
          <div class="home-compact-grid">
            ${signals.length ? signals.map(renderHomeSignalTile).join("") : renderEmpty("暂无动态", "安装或启用 Skill 后会在这里看到本机状态。")}
          </div>
        </section>
        <section>
          <div class="section-head">
            <h2>通知摘要</h2>
            <button class="btn btn-small" data-action="set-page" data-page="notifications">查看通知</button>
          </div>
          <div class="home-notice-list">
            ${notices.length ? notices.map(renderHomeNoticeRow).join("") : renderEmpty("暂无通知", "新的安装、更新、路径异常或连接状态会出现在这里。")}
          </div>
        </section>
      </div>
      <aside class="home-recommendations" aria-labelledby="home-recommendations-title">
        <div class="section-head">
          <div>
            <p class="eyebrow">推荐</p>
            <h2 id="home-recommendations-title">热门推荐</h2>
          </div>
          <button class="btn btn-small" data-action="set-page" data-page="market">市场</button>
        </div>
        <div class="home-recommendation-list">
          ${recommended.map(renderHomeRecommendationItem).join("")}
        </div>
      </aside>
    </section>
  `;
}

function getHomeFocus(counts) {
  const update = state.skills.find((skill) => hasUpdate(skill) && skill.canUpdate);
  const restricted = state.skills.find((skill) => skill.isScopeRestricted && isInstalled(skill));
  const invalidTool = state.tools.find((tool) => tool.status === "invalid" || tool.status === "missing");
  if (isOffline()) {
    return {
      title: "恢复服务连接",
      body: "市场搜索、安装和更新暂不可用，已安装 Skill 仍可本地启用或停用。",
      label: "重试连接",
      action: "retry-connection",
    };
  }
  if (update) {
    return {
      title: `${update.displayName} 可更新`,
      body: `本地版本 v${update.localVersion}，市场版本 v${update.version}。`,
      label: "处理更新",
      action: "set-page",
      page: "my",
      filter: "updates",
    };
  }
  if (restricted) {
    return {
      title: "有 Skill 权限已收缩",
      body: `${restricted.displayName} 可继续使用当前版本，但不可更新或新增启用位置。`,
      label: "查看详情",
      action: "open-detail",
      skillID: restricted.skillID,
    };
  }
  if (invalidTool) {
    return {
      title: "修复工具路径",
      body: `${invalidTool.name} 的路径需要手动确认后再启用 Skill。`,
      label: "查看工具",
      action: "set-page",
      page: "tools",
    };
  }
  if (!counts.installed) {
    return {
      title: "先安装一个 Skill",
      body: "从市场选择适合当前工具或项目的 Skill。",
      label: "进入市场",
      action: "set-page",
      page: "market",
    };
  }
  if (!counts.enabled) {
    return {
      title: "把 Skill 启用到工具或项目",
      body: "已安装的 Skill 需要写入目标目录后才会在工具中生效。",
      label: "配置启用范围",
      action: "set-page",
      page: "my",
    };
  }
  return {
    title: "继续管理本机 Skill",
    body: "安装、启用和通知状态都已就绪。",
    label: "查看我的 Skill",
    action: "set-page",
    page: "my",
  };
}

function getHomeSkillSignals() {
  const important = state.skills.filter(
    (skill) => (hasUpdate(skill) && skill.canUpdate) || skill.isScopeRestricted || isEnabled(skill)
  );
  return important.slice(0, 4);
}

function renderHomeSignalTile(skill) {
  const [statusLabel, statusClass] = statusMeta(skill);
  return `
    <button class="home-skill-compact" data-action="open-detail" data-skill-id="${skill.skillID}">
      <strong>${escapeHtml(skill.displayName)}</strong>
      <span class="skill-id">${escapeHtml(skill.skillID)}</span>
      <span class="meta-line">${escapeHtml(skill.authorDepartment)} · ${escapeHtml(skill.category)}</span>
      <span class="pill ${statusClass}">${statusLabel}</span>
    </button>
  `;
}

function renderHomeRecommendationItem(skill) {
  const expanded = state.homeExpanded?.section === "recommended" && state.homeExpanded?.skillID === skill.skillID;
  const [riskLabel, riskClass] = riskMeta(skill.riskLevel);
  const [statusLabel, statusClass] = statusMeta(skill);
  return `
    <article class="home-recommendation-item ${expanded ? "expanded" : ""}">
      <button class="home-recommendation-trigger" data-action="toggle-home-recommendation" data-skill-id="${skill.skillID}">
        <span class="home-recommendation-main">
          <strong>${escapeHtml(skill.displayName)}</strong>
          <span class="skill-id">${escapeHtml(skill.skillID)}</span>
        </span>
        <span class="meta-line">
          <span>${escapeHtml(skill.authorDepartment)}</span>
          <span>${skill.starCount} Star</span>
        </span>
        <span class="inline-list">
          <span class="pill ${statusClass}">${statusLabel}</span>
          <span class="pill ${riskClass}">${riskLabel}</span>
        </span>
      </button>
      ${
        expanded
          ? `<div class="home-recommendation-summary">
              <div class="market-summary-head">
                <div>
                  <strong>${escapeHtml(skill.displayName)}</strong>
                  <span class="skill-id">${escapeHtml(skill.skillID)}</span>
                </div>
                ${renderStarButton(skill)}
              </div>
              <p class="muted">${escapeHtml(skill.description)}</p>
              <div class="meta-line">
                <span>${escapeHtml(skill.authorName)} / ${escapeHtml(skill.authorDepartment)}</span>
                <span>v${escapeHtml(skill.version)}</span>
                <span>${skill.downloadCount} 下载</span>
              </div>
              <div class="inline-list">
                <span class="pill">${escapeHtml(skill.category)}</span>
                <span class="pill ${riskClass}">${riskLabel}</span>
                ${skill.compatibleTools.map((tool) => `<span class="pill">${escapeHtml(tool)}</span>`).join("")}
              </div>
              <div class="card-actions summary-actions">
                ${renderPrimarySkillAction(skill)}
                <button class="btn btn-small" data-action="open-detail" data-skill-id="${skill.skillID}">${
                  skill.detailAccess === "summary" ? "受限详情" : "详情"
                }</button>
              </div>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderSkillDetailPage() {
  const skill = getSkill(state.detailSkillID);
  if (!skill) {
    return `
      <section class="page-head">
        <div>
          <p class="eyebrow">Skill 详情</p>
          <h1 class="page-title">没有找到这个 Skill</h1>
          <p class="muted">返回市场后可以重新选择。</p>
        </div>
        <button class="btn btn-primary" data-action="set-page" data-page="market">返回市场</button>
      </section>
    `;
  }
  const [riskLabel, riskClass] = riskMeta(skill.riskLevel);
  const [statusLabel, statusClass] = statusMeta(skill);
  if (skill.detailAccess === "summary") {
    return `
      <section class="page-head">
        <div>
          <p class="eyebrow">受限详情</p>
          <h1 class="page-title">${escapeHtml(skill.displayName)}</h1>
          <p class="muted">该 Skill 暂未向你开放详情。</p>
        </div>
        <button class="btn" data-action="set-page" data-page="market">返回市场</button>
      </section>
      <section class="skill-detail-page narrow-detail">
        <dl class="definition-list">
          <dt>发布人</dt><dd>${escapeHtml(skill.authorName)}</dd>
          <dt>部门</dt><dd>${escapeHtml(skill.authorDepartment)}</dd>
          <dt>Star</dt><dd>${skill.starCount}</dd>
          <dt>下载</dt><dd>${skill.downloadCount}</dd>
          <dt>分类</dt><dd>${escapeHtml(skill.category)}</dd>
        </dl>
        <div class="banner">申请访问与申请使用将在后续版本开放。</div>
      </section>
    `;
  }
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">Skill 详情</p>
        <h1 class="page-title">${escapeHtml(skill.displayName)}</h1>
        <p class="muted">${escapeHtml(skill.description)}</p>
      </div>
      <div class="inline-list">
        <button class="btn" data-action="set-page" data-page="market">返回市场</button>
        ${renderStarButton(skill)}
      </div>
    </section>
    <section class="skill-detail-page">
      <section class="skill-detail-section">
        <div class="section-head">
          <h2>基础信息</h2>
          <span class="pill ${statusClass}">${statusLabel}</span>
        </div>
        <div class="detail-info-grid">
          <dl class="definition-list">
            <dt>skillID</dt><dd>${escapeHtml(skill.skillID)}</dd>
            <dt>作者</dt><dd>${escapeHtml(skill.authorName)} / ${escapeHtml(skill.authorDepartment)}</dd>
            <dt>当前版本</dt><dd>v${escapeHtml(skill.version)}</dd>
            <dt>本地版本</dt><dd>${skill.localVersion ? `v${escapeHtml(skill.localVersion)}` : "未安装"}</dd>
            <dt>更新时间</dt><dd>${escapeHtml(skill.currentVersionUpdatedAt)}</dd>
            <dt>包大小</dt><dd>${formatFileSize(skill.packageSize)}</dd>
            <dt>文件数</dt><dd>${skill.packageFileCount || "无"}</dd>
            <dt>适用工具</dt><dd>${skill.compatibleTools.map(escapeHtml).join("、")}</dd>
            <dt>适用系统</dt><dd>${skill.compatibleSystems.map(escapeHtml).join("、")}</dd>
          </dl>
          <div class="detail-action-panel">
            ${renderPrimarySkillAction(skill)}
            ${
              isInstalled(skill)
                ? `<button class="btn btn-small" data-action="open-targets" data-skill-id="${skill.skillID}" ${
                    skill.isScopeRestricted ? "disabled" : ""
                  }>启用到工具或项目</button>
                   <button class="btn btn-danger btn-small" data-action="uninstall-skill" data-skill-id="${skill.skillID}">卸载</button>`
                : ""
            }
          </div>
        </div>
      </section>
      <section class="skill-detail-section">
        <h2>审核与安全信息</h2>
        <p class="muted">${escapeHtml(skill.reviewSummary)}</p>
        <div class="inline-list">
          <span class="pill ${riskClass}">${riskLabel}</span>
          <span class="pill ${statusClass}">${statusLabel}</span>
          <span class="pill">Hash ${escapeHtml(skill.packageHash || "无")}</span>
        </div>
      </section>
      <section class="skill-detail-section">
        <h2>README / 使用说明</h2>
        <p class="muted">${escapeHtml(skill.readme)}</p>
      </section>
    </section>
  `;
}

function renderHomeNoticeRow(notice) {
  return `
    <button class="home-notice-row" data-action="set-page" data-page="notifications">
      <span>
        <strong>${escapeHtml(notice.title)}</strong>
        <span class="muted">${escapeHtml(notice.summary)}</span>
      </span>
      <span class="pill">${escapeHtml(notice.time)}</span>
    </button>
  `;
}

function renderMarket() {
  const skills = getMarketSkills();
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">市场</p>
        <h1 class="page-title">发现、搜索、筛选和安装 Skill</h1>
        <p class="muted">输入名称、描述、标签、作者、部门或 skillID 找到合适的 Skill。离线时只能查看缓存内容。</p>
      </div>
      <button class="btn" data-action="clear-filters">清空筛选</button>
    </section>
    ${isOffline() ? renderOfflineBanner() : ""}
    <section class="market-toolbar">
      <form class="topbar-search" data-form="market-search">
        <label class="screen-reader-only" for="market-query">市场搜索</label>
        <input id="market-query" class="search-input" name="q" value="${escapeHtml(
          state.marketQuery
        )}" placeholder="搜索市场" ${isOffline() ? "disabled" : ""} />
        <button class="btn" type="submit" ${isOffline() ? "disabled" : ""}>搜索</button>
      </form>
      <div class="filter-grid">
        ${renderSelect("department", "部门", ["all", ...uniqueValues("authorDepartment")], state.marketFilters.department)}
        ${renderSelect("access", "权限", ["authorized_only", "include_public"], state.marketFilters.access)}
        ${renderSelect("category", "分类", ["all", ...uniqueValues("category")], state.marketFilters.category)}
        ${renderSelect("sort", "排序", ["composite", "latest_published", "recently_updated", "download_count", "star_count", "relevance"], state.marketSort, true)}
      </div>
      <span class="pill">${skills.length} 个结果</span>
    </section>
    <section class="skill-layout">
      <div class="skill-grid">
        ${skills.length ? skills.map(renderSkillCard).join("") : renderEmpty("没有找到匹配的 Skill", "清空筛选后再试一次。")}
      </div>
      <aside>
        <div class="section-head">
          <h2>简单榜单</h2>
        </div>
        <div class="rank-list">
          ${[...state.skills]
            .sort((a, b) => b.downloadCount - a.downloadCount)
            .slice(0, 5)
            .map(
              (skill, index) => `
                <button class="rank-row" data-action="open-detail" data-skill-id="${skill.skillID}">
                  <span class="rank-num">${index + 1}</span>
                  <span><strong>${escapeHtml(skill.displayName)}</strong><br><span class="muted">${skill.downloadCount} 下载</span></span>
                  <span class="pill">${skill.authorDepartment}</span>
                </button>
              `
            )
            .join("")}
        </div>
      </aside>
    </section>
  `;
}

function renderMySkills() {
  const installed = state.skills.filter(isInstalled).filter((skill) => {
    const q = state.mySearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [skill.displayName, skill.skillID, skill.description, skill.authorDepartment]
        .join(" ")
        .toLowerCase()
        .includes(q);
    if (!matchesSearch) return false;
    if (state.myFilter === "enabled") return isEnabled(skill);
    if (state.myFilter === "updates") return hasUpdate(skill) && skill.canUpdate;
    if (state.myFilter === "scope") return skill.isScopeRestricted;
    if (state.myFilter === "error") return skill.installState === "partially_failed";
    return true;
  });
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">我的 Skill</p>
        <h1 class="page-title">已安装</h1>
        <p class="muted">已安装的 Skill 会在这里保留本地版本、启用位置和权限状态。发布能力将在后续版本开放。</p>
      </div>
      <button class="btn btn-primary" data-action="set-page" data-page="market">去市场看看</button>
    </section>
    <section class="market-toolbar">
      <input class="search-input" data-action="my-search" value="${escapeHtml(state.mySearch)}" placeholder="搜索已安装 Skill" />
      <div class="inline-list">
        ${[
          ["all", "全部"],
          ["enabled", "已启用"],
          ["updates", "有更新"],
          ["scope", "权限已收缩"],
          ["error", "异常"],
        ]
          .map(
            ([key, label]) =>
              `<button class="btn btn-small ${
                state.myFilter === key ? "btn-primary" : ""
              }" data-action="set-my-filter" data-filter="${key}">${label}</button>`
          )
          .join("")}
      </div>
      <span class="pill">${installed.length} 个本地副本</span>
    </section>
    ${
      installed.length
        ? `<table class="data-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>版本</th>
                <th>启用位置</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${installed.map(renderInstalledRow).join("")}
            </tbody>
          </table>`
        : renderEmpty("你还没有安装 Skill", "进入市场安装后会出现在这里。")
    }
  `;
}

function renderTools() {
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">工具</p>
        <h1 class="page-title">本机 AI 工具管理</h1>
        <p class="muted">内置 Codex、Claude、Cursor、Windsurf、opencode 和自定义目录。启用固定使用 copy，不提供 symlink。</p>
      </div>
      <div class="inline-list">
        <button class="btn" data-action="refresh-tools">刷新检测工具</button>
        <button class="btn btn-primary" data-action="open-add-tool">添加自定义工具</button>
      </div>
    </section>
    <div class="list-stack">
      ${state.tools.map(renderToolRow).join("")}
    </div>
  `;
}

function renderProjects() {
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">项目</p>
        <h1 class="page-title">项目级 Skill 启用</h1>
        <p class="muted">项目级优先于工具级。若同一 Skill 在项目和工具中冲突，以项目路径最终落地版本为准。</p>
      </div>
      <button class="btn btn-primary" data-action="open-add-project">添加项目</button>
    </section>
    <div class="banner">
      <span>项目路径与工具路径同时存在时，项目路径优先。启用动作会覆盖目标目录中的同名副本并提示结果。</span>
    </div>
    <div class="list-stack">
      ${state.projects.length ? state.projects.map(renderProjectRow).join("") : renderEmpty("项目为空", "手动添加项目后可配置项目级 skills 目录。")}
    </div>
  `;
}

function renderNotifications() {
  const notices = state.notifications.filter((notice) =>
    state.notificationFilter === "unread" ? notice.unread : true
  );
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">通知</p>
        <h1 class="page-title">应用内消息中心</h1>
        <p class="muted">安装、更新、路径异常和连接状态会在这里沉淀。企业 IM、系统托盘和通知清理策略将在后续版本开放。</p>
      </div>
      <div class="inline-list">
        <button class="btn btn-small ${state.notificationFilter === "all" ? "btn-primary" : ""}" data-action="set-notice-filter" data-filter="all">全部</button>
        <button class="btn btn-small ${state.notificationFilter === "unread" ? "btn-primary" : ""}" data-action="set-notice-filter" data-filter="unread">未读</button>
        <button class="btn" data-action="confirm-mark-all-read">全部已读</button>
      </div>
    </section>
    <div class="list-stack">
      ${notices.length ? notices.map(renderNoticeRow).join("") : renderEmpty("暂无通知", "新的安装、更新、路径异常或连接状态会出现在这里。")}
    </div>
  `;
}

function renderSettings() {
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">设置</p>
        <h1 class="page-title">基础偏好</h1>
        <p class="muted">管理语言、Central Store 路径和本地同步偏好。审核偏好、通知渠道、MCP 与插件配置将在后续版本开放。</p>
      </div>
    </section>
    <section class="settings-grid">
      <div class="settings-row">
        <label class="field">
          <span>语言设置</span>
          <select data-action="setting-language">
            <option value="auto" ${state.settings.language === "auto" ? "selected" : ""}>自动</option>
            <option value="zh-CN" ${state.settings.language === "zh-CN" ? "selected" : ""}>简体中文</option>
            <option value="en-US" ${state.settings.language === "en-US" ? "selected" : ""}>English</option>
          </select>
        </label>
        <label class="switch-row">
          <span>默认语言自动识别</span>
          <input type="checkbox" data-action="toggle-setting" data-key="autoDetectLanguage" ${
            state.settings.autoDetectLanguage ? "checked" : ""
          } />
        </label>
      </div>
      <div class="settings-row">
        <label class="field">
          <span>主题风格</span>
          <select data-action="setting-theme">
            <option value="classic" ${state.settings.theme === "classic" ? "selected" : ""}>经典白</option>
            <option value="fresh" ${state.settings.theme === "fresh" ? "selected" : ""}>清爽绿</option>
            <option value="contrast" ${state.settings.theme === "contrast" ? "selected" : ""}>高对比</option>
          </select>
        </label>
        <p class="muted">主题只影响本地界面偏好，不改变 Skill 安装、启用或服务端治理状态。</p>
      </div>
      <div class="settings-row">
        <label class="field">
          <span>Central Store 路径</span>
          <input value="${escapeHtml(state.settings.centralStorePath)}" readonly />
        </label>
        <p class="muted">Central Store 是本机唯一真源。工具和项目目录只是 copy 分发目标。</p>
      </div>
      <div class="settings-row">
        <label class="switch-row">
          <span>安装、更新、卸载后显示结果通知</span>
          <input type="checkbox" data-action="toggle-setting" data-key="showInstallResults" ${
            state.settings.showInstallResults ? "checked" : ""
          } />
        </label>
        <label class="switch-row">
          <span>恢复网络后同步本地启用/停用事件</span>
          <input type="checkbox" data-action="toggle-setting" data-key="syncLocalEvents" ${
            state.settings.syncLocalEvents ? "checked" : ""
          } />
        </label>
      </div>
    </section>
  `;
}

function renderPublish() {
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">P2 发布与版本更新</p>
        <h1 class="page-title">发布 Skill</h1>
        <p class="muted">上传文件夹或 zip 后，系统解析 SKILL.md、校验包结构、补齐 manifest 字段，再进入系统初审和管理员审核。</p>
      </div>
      <span class="pill pill-info">旧版本在新版本审核期间保持可用</span>
    </section>
    <section class="dashboard-grid">
      <form class="settings-row login-form" data-form="publish-skill">
        <h2>发布表单</h2>
        <label class="field"><span>上传 Skill 包</span><input name="packageName" value="prompt-guardrails.zip" /></label>
        <label class="field"><span>skillID</span><input name="skillID" value="prompt-guardrails" /></label>
        <label class="field"><span>显示名称</span><input name="displayName" value="提示词护栏模板" /></label>
        <label class="field"><span>版本号</span><input name="version" value="1.0.0" /></label>
        <label class="field"><span>授权范围</span><select name="scope"><option>本部门</option><option>本部门及下级部门</option><option>指定多个部门</option><option>全员可用</option></select></label>
        <label class="field"><span>公开级别</span><select name="visibility"><option>默认不公开</option><option>摘要公开</option><option>详情公开</option><option>全员可安装</option></select></label>
        <label class="field"><span>变更说明</span><textarea name="changelog">首次发布，包含护栏说明、示例和限制条件。</textarea></label>
        <button class="btn btn-primary" type="submit">提交审核</button>
      </form>
      <div class="list-stack">
        <article class="settings-row">
          <h2>上传预检查</h2>
          <div class="inline-list">
            <span class="pill pill-success">存在 SKILL.md</span>
            <span class="pill pill-success">SemVer 合法</span>
            <span class="pill pill-success">包小于 5MB</span>
            <span class="pill pill-success">文件数小于 100</span>
            <span class="pill pill-warning">脚本风险待人工复核</span>
          </div>
          <p class="muted">manifest.json 由系统根据表单自动生成。依赖项只展示，不自动解析或安装。</p>
        </article>
        <article class="settings-row">
          <h2>生命周期</h2>
          <div class="lifecycle">
            ${["上传成功", "系统初审中", "待人工复核", "待管理员审核", "已发布"]
              .map((label, index) => `<div class="lifecycle-step"><strong>${index + 1}. ${label}</strong><p class="muted">${publishStepCopy(label)}</p></div>`)
              .join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function publishStepCopy(label) {
  return {
    上传成功: "文件已接收，发布者仍可撤回。",
    系统初审中: "结构、元数据和风险字段进入自动校验。",
    待人工复核: "异常不直接拒绝，由审核员复核。",
    待管理员审核: "审核链路按当前组织关系实时计算。",
    已发布: "进入市场；新版本审核期间旧版本继续可用。",
  }[label];
}

function renderReview() {
  const tabs = [
    ["pending", "待审核"],
    ["reviewing", "审核中"],
    ["reviewed", "已审核"],
  ];
  const rows = state.reviewItems.filter((item) => item.status === state.reviewTab);
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">P2 审核工作台</p>
        <h1 class="page-title">发布审核</h1>
        <p class="muted">待审单据对合格审核员可见，首个点击开始审核的人获得锁定；锁单 5 分钟超时后自动释放。</p>
      </div>
      <span class="pill pill-warning">${state.reviewItems.filter((item) => item.status === "pending").length} 个待处理</span>
    </section>
    <section class="section">
      <div class="inline-list">
        ${tabs
          .map(
            ([key, label]) =>
              `<button class="btn btn-small ${state.reviewTab === key ? "btn-primary" : ""}" data-action="set-review-tab" data-tab="${key}">${label}</button>`
          )
          .join("")}
      </div>
    </section>
    <table class="data-table">
      <thead>
        <tr>
          <th>单据</th>
          <th>提交人</th>
          <th>风险与初审</th>
          <th>锁定状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.map(renderReviewRow).join("") : `<tr><td colspan="5">${renderEmpty("当前没有单据", "切换其他页签查看历史。")}</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderReviewRow(item) {
  const [riskLabel, riskClass] = riskMeta(item.risk);
  return `
    <tr>
      <td>
        <strong>${escapeHtml(item.name)}</strong>
        <div class="skill-id">${escapeHtml(item.skillID)} · v${escapeHtml(item.version)} · ${escapeHtml(item.type)}</div>
        <div class="muted">提交时间：${escapeHtml(item.submittedAt)}</div>
      </td>
      <td>${escapeHtml(item.submitter)}<br><span class="muted">${escapeHtml(item.department)}</span></td>
      <td>
        <span class="pill ${riskClass}">${riskLabel}</span>
        <span class="pill">${escapeHtml(item.precheck)}</span>
      </td>
      <td>${item.lockedBy ? `<span class="pill pill-info">已被 ${escapeHtml(item.lockedBy)} 锁定</span>` : `<span class="pill">未锁定</span>`}</td>
      <td>
        <div class="row-actions">
          ${
            item.status === "pending"
              ? `<button class="btn btn-primary btn-small" data-action="start-review" data-review-id="${item.id}">开始审核</button>`
              : ""
          }
          ${
            item.status === "reviewing"
              ? `<button class="btn btn-primary btn-small" data-action="review-decision" data-review-id="${item.id}" data-decision="同意">同意</button>
                 <button class="btn btn-small" data-action="review-decision" data-review-id="${item.id}" data-decision="退回修改">退回</button>
                 <button class="btn btn-danger btn-small" data-action="review-decision" data-review-id="${item.id}" data-decision="拒绝">拒绝</button>`
              : ""
          }
          <button class="btn btn-small" data-action="open-review-detail" data-review-id="${item.id}">审核历史</button>
        </div>
      </td>
    </tr>
  `;
}

function renderManage() {
  const tabs = [
    ["departments", "部门管理"],
    ["users", "用户管理"],
    ["skills", "Skill 管理"],
  ];
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">P2 管理治理</p>
        <h1 class="page-title">管理中心</h1>
        <p class="muted">管理员管理本部门及所有后代部门；跨部门紧急下架仅一级管理员可操作。</p>
      </div>
      <span class="pill pill-info">自建账号体系</span>
    </section>
    <section class="section">
      <div class="inline-list">
        ${tabs
          .map(
            ([key, label]) =>
              `<button class="btn btn-small ${state.manageTab === key ? "btn-primary" : ""}" data-action="set-manage-tab" data-tab="${key}">${label}</button>`
          )
          .join("")}
      </div>
    </section>
    ${state.manageTab === "departments" ? renderDepartmentManage() : ""}
    ${state.manageTab === "users" ? renderUserManage() : ""}
    ${state.manageTab === "skills" ? renderSkillManage() : ""}
  `;
}

function renderDepartmentManage() {
  return `
    <section class="dashboard-grid">
      <div class="settings-row">
        <h2>部门树</h2>
        <div class="list-stack">
          ${["集团 / 技术部", "技术部 / 前端组", "技术部 / 后端组", "后端组 / Go 小组"]
            .map((dept) => `<button class="rank-row"><span class="rank-num">D</span><span><strong>${dept}</strong><br><span class="muted">可展开、收起、查看详情</span></span><span class="pill">后代部门</span></button>`)
            .join("")}
        </div>
      </div>
      <div class="settings-row">
        <h2>详情面板</h2>
        <dl class="definition-list">
          <dt>部门</dt><dd>前端组</dd>
          <dt>用户数</dt><dd>42</dd>
          <dt>Skill 数</dt><dd>16</dd>
          <dt>管理员</dt><dd>陈苇、韩屿</dd>
          <dt>规则</dt><dd>不可操作本部门自身及上级部门；每个部门必须至少有一个管理员。</dd>
        </dl>
        <div class="modal-actions">
          <button class="btn btn-primary">新增下级部门</button>
          <button class="btn">修改部门</button>
          <button class="btn btn-danger">删除下级部门</button>
        </div>
      </div>
    </section>
  `;
}

function renderUserManage() {
  return `
    <table class="data-table">
      <thead><tr><th>用户</th><th>部门</th><th>角色</th><th>状态</th><th>数据</th><th>操作</th></tr></thead>
      <tbody>
        ${managedUsers
          .map(
            ([name, department, role, status, published, lastLogin]) => `
              <tr>
                <td><strong>${name}</strong><br><span class="muted">最近登录：${lastLogin}</span></td>
                <td>${department}</td>
                <td>${role}</td>
                <td><span class="pill ${status === "正常" ? "pill-success" : "pill-warning"}">${status}</span></td>
                <td>${published} 个已发布 Skill</td>
                <td><div class="row-actions"><button class="btn btn-small">设置角色</button><button class="btn btn-small">${status === "正常" ? "冻结" : "解冻"}</button><button class="btn btn-danger btn-small">删除</button></div></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSkillManage() {
  return `
    <table class="data-table">
      <thead><tr><th>Skill</th><th>发布者</th><th>状态</th><th>热度</th><th>操作</th></tr></thead>
      <tbody>
        ${managedSkillRows
          .map(
            ([name, author, department, version, status, stars, downloads, shelf]) => `
              <tr>
                <td><strong>${name}</strong><br><span class="muted">v${version} · ${department}</span></td>
                <td>${author}</td>
                <td><span class="pill">${status}</span><br><span class="muted">${shelf}</span></td>
                <td><span class="star-icon">⭐️</span> ${stars}<br><span class="muted">${downloads} 下载</span></td>
                <td><div class="row-actions"><button class="btn btn-small">查看详情</button><button class="btn btn-small">下架/上架</button><button class="btn btn-danger btn-small">归档</button></div></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderEcosystem() {
  const items = [
    ["审计日志", "统一记录谁在什么时间做了什么，覆盖发布、审核、安装、管理和权限变更。"],
    ["数据看板", "全站 Skill 统计、部门发布情况、审核通过率、拒绝率和平均审核时长。"],
    ["批量目标管理", "跨工具和项目批量绑定、启用、停用与升级，适合团队级治理。"],
    ["依赖解析", "识别依赖、冲突和自动安装候选；P1/P2 只展示依赖信息。"],
    ["MCP 与插件", "管理 MCP、开源 AI 工具插件和组织内扩展资源。"],
    ["Agent / RAG 检索", "用智能 Agent 搜索和 RAG 检索增强 Skill 发现。"],
  ];
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">P3 生态与规模化</p>
        <h1 class="page-title">生态路线图</h1>
        <p class="muted">当发布审核和管理治理稳定后，继续扩展审计、看板、批量管理、多维护者、依赖解析、MCP、插件和 Agent/RAG 检索。</p>
      </div>
      <span class="pill pill-info">规模化能力</span>
    </section>
    <section class="roadmap-grid">
      ${items
        .map(
          ([title, body]) => `
            <article class="roadmap-item">
              <h3>${title}</h3>
              <p class="muted">${body}</p>
              <span class="pill pill-info">P3</span>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderSelect(name, label, options, selected, isSort = false) {
  return `
    <label class="field">
      <span>${label}</span>
      <select class="filter-select" data-action="${isSort ? "market-sort" : "market-filter"}" data-filter="${name}" ${
    isOffline() && !isSort ? "disabled" : ""
  }>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${labelForOption(option)}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

function labelForOption(option) {
  const map = {
    all: "全部",
    installed: "已安装",
    not_installed: "未安装",
    enabled: "已启用",
    not_enabled: "未启用",
    authorized_only: "仅有权限查看",
    include_public: "包含公开摘要",
    low: "低风险",
    medium: "中风险",
    high: "高风险",
    unknown: "未知风险",
    composite: "综合排序",
    latest_published: "最新发布",
    recently_updated: "最近更新",
    download_count: "下载量",
    star_count: "⭐️ 数",
    relevance: "搜索相关度",
  };
  return map[option] || option;
}

function uniqueValues(key) {
  return [...new Set(state.skills.map((skill) => skill[key]).filter(Boolean))];
}

function getMarketSkills() {
  const q = state.marketQuery.trim().toLowerCase();
  let results = state.skills.filter((skill) => {
    const text = [
      skill.displayName,
      skill.skillID,
      skill.description,
      skill.authorName,
      skill.authorDepartment,
      skill.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    if (q && !text.includes(q)) return false;
    if (state.marketFilters.department !== "all" && skill.authorDepartment !== state.marketFilters.department) return false;
    if (state.marketFilters.tool !== "all" && !skill.compatibleTools.includes(state.marketFilters.tool)) return false;
    if (state.marketFilters.installed === "installed" && !isInstalled(skill)) return false;
    if (state.marketFilters.installed === "not_installed" && isInstalled(skill)) return false;
    if (state.marketFilters.enabled === "enabled" && !isEnabled(skill)) return false;
    if (state.marketFilters.enabled === "not_enabled" && isEnabled(skill)) return false;
    if (state.marketFilters.access === "authorized_only" && skill.detailAccess !== "full") return false;
    if (state.marketFilters.category !== "all" && skill.category !== state.marketFilters.category) return false;
    if (state.marketFilters.risk !== "all" && skill.riskLevel !== state.marketFilters.risk) return false;
    return true;
  });
  const sorters = {
    latest_published: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
    recently_updated: (a, b) => b.currentVersionUpdatedAt.localeCompare(a.currentVersionUpdatedAt),
    download_count: (a, b) => b.downloadCount - a.downloadCount,
    star_count: (a, b) => b.starCount - a.starCount,
    relevance: (a, b) => Number(b.displayName.toLowerCase().includes(q)) - Number(a.displayName.toLowerCase().includes(q)),
    composite: (a, b) => b.starCount + b.downloadCount * 0.05 - (a.starCount + a.downloadCount * 0.05),
  };
  results.sort(sorters[state.marketSort] || sorters.composite);
  return results;
}

function renderSkillCard(skill) {
  const [statusLabel, statusClass] = statusMeta(skill);
  const [riskLabel, riskClass] = riskMeta(skill.riskLevel);
  return `
    <article class="skill-card">
      <div class="skill-card-body">
        <div class="skill-card-title">
          <div>
            <h3>${escapeHtml(skill.displayName)}</h3>
            <div class="skill-id">${escapeHtml(skill.skillID)}</div>
          </div>
          <div class="inline-list">
            ${renderStarButton(skill)}
            <span class="pill ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <p class="muted">${escapeHtml(skill.description)}</p>
        <div class="meta-line">
          <span>${escapeHtml(skill.authorName)} / ${escapeHtml(skill.authorDepartment)}</span>
          <span>v${escapeHtml(skill.version)}</span>
          <span><span class="star-icon">⭐️</span> ${skill.starCount}</span>
          <span>${skill.downloadCount} 下载</span>
        </div>
        <div class="inline-list">
          <span class="pill">${escapeHtml(skill.category)}</span>
          <span class="pill ${riskClass}">${riskLabel}</span>
          ${skill.compatibleTools.map((tool) => `<span class="pill">${tool}</span>`).join("")}
        </div>
        <div class="card-actions">
          ${renderPrimarySkillAction(skill)}
          <button class="btn btn-small" data-action="open-detail" data-skill-id="${skill.skillID}">${
    skill.detailAccess === "summary" ? "受限详情" : "详情"
  }</button>
        </div>
      </div>
    </article>
  `;
}

function renderStarButton(skill) {
  return `
    <button class="star-button ${skill.starred ? "active" : ""}" data-action="toggle-star" data-skill-id="${
    skill.skillID
  }" aria-label="${skill.starred ? "取消收藏" : "收藏"} ${escapeHtml(skill.displayName)}">
      <span class="star-icon" aria-hidden="true">⭐️</span>
      <span>${skill.starCount}</span>
    </button>
  `;
}

function renderPrimarySkillAction(skill) {
  if (isOffline() && (!isInstalled(skill) || hasUpdate(skill))) {
    return `<button class="btn btn-small" disabled>离线不可用</button>`;
  }
  if (skill.isScopeRestricted) {
    return `<button class="btn btn-small" disabled>继续使用当前版本</button>`;
  }
  if (!skill.canInstall && !isInstalled(skill)) {
    return `<button class="btn btn-small" disabled>不可安装</button>`;
  }
  if (hasUpdate(skill) && skill.canUpdate) {
    return `<button class="btn btn-primary btn-small" data-action="update-skill" data-skill-id="${skill.skillID}">更新</button>`;
  }
  if (isEnabled(skill)) {
    return `<button class="btn btn-small" data-action="open-targets" data-skill-id="${skill.skillID}">查看启用位置</button>`;
  }
  if (isInstalled(skill)) {
    return `<button class="btn btn-primary btn-small" data-action="open-targets" data-skill-id="${skill.skillID}">启用</button>`;
  }
  return `<button class="btn btn-primary btn-small" data-action="install-skill" data-skill-id="${skill.skillID}">安装</button>`;
}

function renderInstalledRow(skill) {
  const targets = skill.enabledTargets.filter((target) => target.status === "enabled");
  const [statusLabel, statusClass] = statusMeta(skill);
  return `
    <tr>
      <td>
        <strong>${escapeHtml(skill.displayName)}</strong>
        <div class="skill-id">${escapeHtml(skill.skillID)}</div>
        ${skill.isScopeRestricted ? `<div class="pill pill-warning">可继续使用当前版本，但不可更新或新增启用位置</div>` : ""}
      </td>
      <td>
        本地 v${escapeHtml(skill.localVersion)}<br>
        <span class="muted">市场 v${escapeHtml(skill.version)}</span>
      </td>
      <td>
        ${
          targets.length
            ? targets.map((target) => `<span class="pill">${escapeHtml(target.name)}</span>`).join(" ")
            : `<span class="muted">未启用</span>`
        }
        <div class="muted">最近启用：${escapeHtml(skill.lastEnabledAt || "无")}</div>
      </td>
      <td><span class="pill ${statusClass}">${statusLabel}</span></td>
      <td>
        <div class="row-actions">
          ${renderPrimarySkillAction(skill)}
          <button class="btn btn-small" data-action="open-detail" data-skill-id="${skill.skillID}">详情</button>
          <button class="btn btn-small" data-action="open-targets" data-skill-id="${skill.skillID}" ${
    skill.isScopeRestricted ? "disabled" : ""
  }>编辑启用范围</button>
          <button class="btn btn-danger btn-small" data-action="uninstall-skill" data-skill-id="${skill.skillID}">卸载</button>
        </div>
      </td>
    </tr>
  `;
}

function renderToolRow(tool) {
  const enabledCount = state.skills.filter((skill) =>
    skill.enabledTargets.some((target) => target.type === "tool" && target.id === tool.id && target.status === "enabled")
  ).length;
  return `
    <article class="tool-row">
      <div>
        <h3>${escapeHtml(tool.name)}</h3>
        <span class="pill ${adapterClass(tool.status)}">${adapterLabel(tool.status)}</span>
      </div>
      <div>
        <strong>配置路径</strong>
        <p class="muted">${escapeHtml(tool.configPath)}</p>
      </div>
      <div>
        <strong>skills 安装路径</strong>
        <p class="muted">${escapeHtml(tool.skillsPath)}</p>
        <p class="muted">转换策略：${escapeHtml(tool.transform)}，安装方式：copy</p>
      </div>
      <div class="row-actions">
        <span class="pill">${enabledCount} 个 Skill</span>
        <button class="btn btn-small" data-action="toggle-tool" data-tool-id="${tool.id}">${tool.enabled ? "关闭配置" : "启用配置"}</button>
        <button class="btn btn-small" data-action="repair-tool" data-tool-id="${tool.id}">${tool.status === "invalid" || tool.status === "missing" ? "手动设置路径" : "修改路径"}</button>
      </div>
    </article>
  `;
}

function renderProjectRow(project) {
  const enabledCount = state.skills.filter((skill) =>
    skill.enabledTargets.some(
      (target) => target.type === "project" && target.id === project.id && target.status === "enabled"
    )
  ).length;
  return `
    <article class="project-row">
      <div>
        <h3>${escapeHtml(project.name)}</h3>
        <span class="pill ${project.enabled ? "pill-success" : "pill-warning"}">${project.enabled ? "已启用" : "已停用"}</span>
      </div>
      <div>
        <strong>项目路径</strong>
        <p class="muted">${escapeHtml(project.projectPath)}</p>
      </div>
      <div>
        <strong>skills 安装路径</strong>
        <p class="muted">${escapeHtml(project.skillsPath)}</p>
      </div>
      <div class="row-actions">
        <span class="pill">${enabledCount} 个 Skill</span>
        <span class="pill pill-info">项目级优先</span>
        <button class="btn btn-small" data-action="toggle-project" data-project-id="${project.id}">${project.enabled ? "关闭" : "启用"}</button>
      </div>
    </article>
  `;
}

function renderNoticeRow(notice) {
  const skill = notice.relatedSkillID ? getSkill(notice.relatedSkillID) : null;
  return `
    <article class="notice-row ${notice.unread ? "unread" : ""}">
      <div>
        <div class="inline-list">
          ${notice.unread ? `<span class="pill pill-success">未读</span>` : `<span class="pill">已读</span>`}
          <span class="pill">${notice.type}</span>
          <span class="muted">${escapeHtml(notice.time)}</span>
        </div>
        <h3>${escapeHtml(notice.title)}</h3>
        <p class="muted">${escapeHtml(notice.summary)}</p>
      </div>
      <div class="row-actions">
        ${
          skill
            ? `<button class="btn btn-small" data-action="open-detail" data-skill-id="${skill.skillID}">查看关联 Skill</button>`
            : ""
        }
        <button class="btn btn-small" data-action="jump-notice" data-notice-id="${notice.id}">跳转</button>
        ${
          notice.unread
            ? `<button class="btn btn-small" data-action="mark-read" data-notice-id="${notice.id}">标记已读</button>`
            : ""
        }
      </div>
    </article>
  `;
}

function adapterLabel(status) {
  return {
    detected: "已检测到",
    manual: "手动配置",
    missing: "未检测到",
    invalid: "路径不可用",
    disabled: "已停用",
  }[status];
}

function adapterClass(status) {
  return {
    detected: "pill-success",
    manual: "pill-info",
    missing: "pill-warning",
    invalid: "pill-danger",
    disabled: "pill-warning",
  }[status];
}

function renderOfflineBanner() {
  return `
    <div class="banner">
      <span>离线模式下无法搜索市场、安装或更新 Skill；已安装 Skill 的启用和停用仍可在本地完成。</span>
      <button class="btn btn-small" data-action="retry-connection">重试连接</button>
    </div>
  `;
}

function renderEmpty(title, body) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      ${body ? `<p class="muted">${escapeHtml(body)}</p>` : ""}
    </div>
  `;
}

function renderModal() {
  if (!state.modal) return "";
  const modal = state.modal;
  if (modal.type === "confirm") return renderConfirmModal(modal);
  if (modal.type === "progress") return renderProgressModal(modal);
  if (modal.type === "targets") return renderTargetsModal(getSkill(modal.skillID));
  if (modal.type === "add-tool") return renderAddToolModal();
  if (modal.type === "add-project") return renderAddProjectModal();
  return "";
}

function renderConfirmModal(modal) {
  return `
    <div class="detail-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(modal.title)}">
      <section class="modal-panel narrow">
        <div class="modal-head">
          <div>
            <p class="eyebrow">二次确认</p>
            <h2>${escapeHtml(modal.title)}</h2>
          </div>
          <button class="btn btn-small" data-action="close-modal">关闭</button>
        </div>
        <div class="modal-body">
          <p class="muted">${escapeHtml(modal.body)}</p>
          ${modal.extraHtml || ""}
          <div class="modal-actions">
            <button class="btn btn-primary" data-action="${modal.confirmAction}" ${
    modal.skillID ? `data-skill-id="${modal.skillID}"` : ""
  }>${escapeHtml(modal.confirmText || "确认")}</button>
            <button class="btn" data-action="close-modal">取消</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderProgressModal(modal) {
  const steps = modal.steps;
  return `
    <div class="detail-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(modal.title)}">
      <section class="modal-panel narrow">
        <div class="modal-head">
          <div>
            <p class="eyebrow">本地写入流程</p>
            <h2>${escapeHtml(modal.title)}</h2>
          </div>
        </div>
        <div class="modal-body">
          <p class="muted">${escapeHtml(modal.description)}</p>
          <div class="progress-list">
            ${steps
              .map((step, index) => {
                const className = index < modal.index ? "done" : index === modal.index ? "active" : "";
                return `<div class="progress-step ${className}"><span class="step-dot">${index + 1}</span><span>${escapeHtml(
                  step
                )}</span></div>`;
              })
              .join("")}
          </div>
          <p class="muted">失败时不会写入 Central Store；Hash 校验失败会删除临时文件。</p>
        </div>
      </section>
    </div>
  `;
}

function renderTargetsModal(skill) {
  if (!skill) return "";
  const targets = [
    ...state.tools.map((tool) => ({
      type: "tool",
      id: tool.id,
      name: tool.name,
      path: tool.skillsPath,
      disabled: !tool.enabled || tool.status === "invalid" || tool.status === "missing",
      status: adapterLabel(tool.status),
    })),
    ...state.projects.map((project) => ({
      type: "project",
      id: project.id,
      name: project.name,
      path: project.skillsPath,
      disabled: !project.enabled,
      status: project.enabled ? "项目级优先" : "已停用",
    })),
  ];
  return `
    <div class="detail-modal" role="dialog" aria-modal="true" aria-label="目标选择">
      <section class="modal-panel">
        <div class="modal-head">
          <div>
            <p class="eyebrow">目标选择</p>
            <h2>${escapeHtml(skill.displayName)} v${escapeHtml(skill.localVersion || skill.version)}</h2>
          </div>
          <button class="btn btn-small" data-action="close-modal">关闭</button>
        </div>
        <div class="modal-body">
          ${skill.isScopeRestricted ? `<div class="banner">权限已收缩：可继续使用当前版本，但不可更新或新增启用位置。</div>` : ""}
          <div class="target-list">
            ${targets
              .map((target) => {
                const existing = skill.enabledTargets.some(
                  (item) => item.type === target.type && item.id === target.id && item.status === "enabled"
                );
                const disabled = target.disabled || (skill.isScopeRestricted && !existing);
                return `
                  <label class="target-item">
                    <input class="target-check" type="checkbox" data-type="${target.type}" data-id="${target.id}" ${
                  existing ? "checked" : ""
                } ${disabled ? "disabled" : ""} />
                    <span>
                      <strong>${escapeHtml(target.name)}</strong>
                      <br><span class="muted">${escapeHtml(target.path)}</span>
                    </span>
                    <span class="pill ${target.disabled ? "pill-danger" : "pill-info"}">${escapeHtml(target.status)}</span>
                  </label>
                `;
              })
              .join("")}
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" data-action="apply-targets" data-skill-id="${skill.skillID}" ${
    skill.isScopeRestricted ? "disabled" : ""
  }>启用所选目标</button>
            <button class="btn" data-action="open-add-tool">添加自定义工具</button>
            <button class="btn" data-action="open-add-project">添加项目</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAddToolModal() {
  return `
    <div class="detail-modal" role="dialog" aria-modal="true" aria-label="添加自定义工具">
      <section class="modal-panel narrow">
        <div class="modal-head">
          <div>
            <p class="eyebrow">自定义目录</p>
            <h2>添加自定义工具</h2>
          </div>
          <button class="btn btn-small" data-action="close-modal">关闭</button>
        </div>
        <form class="modal-body login-form" data-form="add-tool">
          <label class="field"><span>工具名称</span><input name="name" value="团队共享目录" required /></label>
          <label class="field"><span>skills 安装路径</span><input name="skillsPath" value="D:\\ai-skills\\team-shared" required /></label>
          <p class="muted">安装方式固定为 copy，路径需要存在或可创建并可写。</p>
          <div class="modal-actions">
            <button class="btn btn-primary" type="submit">添加</button>
            <button class="btn" type="button" data-action="close-modal">取消</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderAddProjectModal() {
  return `
    <div class="detail-modal" role="dialog" aria-modal="true" aria-label="添加项目">
      <section class="modal-panel narrow">
        <div class="modal-head">
          <div>
            <p class="eyebrow">项目配置</p>
            <h2>添加项目</h2>
          </div>
          <button class="btn btn-small" data-action="close-modal">关闭</button>
        </div>
        <form class="modal-body login-form" data-form="add-project">
          <label class="field"><span>项目名称</span><input name="name" value="Internal Skill Console" required /></label>
          <label class="field"><span>项目路径</span><input name="projectPath" value="D:\\workspace\\InternalSkillConsole" required /></label>
          <label class="field"><span>skills 安装路径</span><input name="skillsPath" value="D:\\workspace\\InternalSkillConsole\\.codex\\skills" required /></label>
          <p class="muted">若只选择项目路径，系统建议使用项目路径下的 .codex\\skills 或 Adapter 提供的相对路径。</p>
          <div class="modal-actions">
            <button class="btn btn-primary" type="submit">添加</button>
            <button class="btn" type="button" data-action="close-modal">取消</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function showToast(message) {
  const id = ++toastCounter;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.toastId = String(id);
  toast.textContent = message;
  toastRegion.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function renderToasts() {
  return undefined;
}

function setPage(page) {
  state.page = page;
  state.userMenuOpen = false;
  state.connectionOpen = false;
  state.modal = null;
  render();
}

function addNotification(type, title, summary, relatedSkillID, targetPage) {
  state.notifications.unshift({
    id: `n-${Date.now()}`,
    type,
    title,
    summary,
    relatedSkillID,
    targetPage,
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    unread: true,
  });
}

function startProgress(kind, skillID) {
  const skill = getSkill(skillID);
  if (!skill) return;
  const steps = ["获取下载凭证", "下载包", "校验包大小和文件数", "校验 Hash", "写入 Central Store", "完成"];
  state.modal = {
    type: "progress",
    kind,
    skillID,
    title: `${kind === "install" ? "安装" : "更新"} ${skill.displayName}`,
    description: "客户端会在 Hash 校验通过后写入 Central Store，并刷新本地状态。",
    steps,
    index: 0,
  };
  render();
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!state.modal || state.modal.type !== "progress") {
      clearInterval(progressTimer);
      return;
    }
    state.modal.index += 1;
    if (state.modal.index >= steps.length) {
      clearInterval(progressTimer);
      finishProgress(kind, skillID);
      return;
    }
    render();
  }, 520);
}

function finishProgress(kind, skillID) {
  const skill = getSkill(skillID);
  if (!skill) return;
  skill.localVersion = skill.version;
  skill.canUpdate = false;
  skill.hasLocalHashDrift = false;
  skill.installState = skill.enabledTargets.length ? "enabled" : "installed";
  skill.lastEnabledAt = skill.lastEnabledAt || "尚未启用";
  state.modal = null;
  addNotification(
    kind === "install" ? "install_result" : "update_result",
    `${skill.displayName}${kind === "install" ? "安装成功" : "更新成功"}`,
    "已写入 Central Store，目标工具和项目可继续使用 copy 启用。",
    skill.skillID,
    "my"
  );
  showToast(`${skill.displayName}${kind === "install" ? "安装成功" : "更新成功"}`);
  render();
}

function installSkill(skillID) {
  const skill = getSkill(skillID);
  if (!skill) return;
  if (isOffline()) {
    showToast("离线模式下无法安装 Skill");
    return;
  }
  if (!skill.canInstall) {
    showToast(skill.cannotInstallReason || "当前用户无权安装该 Skill");
    return;
  }
  startProgress("install", skillID);
}

function updateSkill(skillID) {
  const skill = getSkill(skillID);
  if (!skill) return;
  if (isOffline()) {
    showToast("离线模式下无法更新 Skill");
    return;
  }
  if (!skill.canUpdate || skill.isScopeRestricted) {
    showToast("当前版本不可更新");
    return;
  }
  if (skill.hasLocalHashDrift) {
    state.modal = {
      type: "confirm",
      title: "确认覆盖更新",
      body: "检测到本地文件 Hash 与上次安装 Hash 不一致。本次更新将直接覆盖本地内容。",
      confirmText: "确认覆盖并更新",
      confirmAction: "confirm-update",
      skillID,
    };
    render();
    return;
  }
  startProgress("update", skillID);
}

function uninstallSkill(skillID) {
  const skill = getSkill(skillID);
  if (!skill) return;
  const targets = skill.enabledTargets.filter((target) => target.status === "enabled");
  const extraHtml = targets.length
    ? `<div class="target-list">${targets
        .map(
          (target) =>
            `<div class="target-item"><span></span><span><strong>${escapeHtml(target.name)}</strong><br><span class="muted">${escapeHtml(
              target.path
            )}</span></span><span class="pill">${target.type === "tool" ? "工具" : "项目"}</span></div>`
        )
        .join("")}</div>`
    : `<p class="muted">当前没有启用位置。</p>`;
  state.modal = {
    type: "confirm",
    title: "确认卸载 Skill",
    body: "将从 Central Store 及所有启用位置移除。卸载后该 Skill 在本机不可继续使用。",
    confirmText: "确认卸载",
    confirmAction: "confirm-uninstall",
    skillID,
    extraHtml,
  };
  render();
}

function confirmUninstall(skillID) {
  const skill = getSkill(skillID);
  if (!skill) return;
  skill.localVersion = null;
  skill.installState = skill.canInstall ? "not_installed" : "blocked";
  skill.enabledTargets = [];
  skill.lastEnabledAt = null;
  state.modal = null;
  addNotification("uninstall_result", `${skill.displayName} 已卸载`, "已移除 Central Store 和目标目录副本。", skillID, "my");
  showToast(`${skill.displayName} 已卸载`);
  render();
}

function applyTargets(skillID) {
  const skill = getSkill(skillID);
  if (!skill) return;
  const selected = [...document.querySelectorAll(".target-check:checked")].map((input) => ({
    type: input.dataset.type,
    id: input.dataset.id,
  }));
  const allTargets = [
    ...state.tools.map((tool) => ({
      type: "tool",
      id: tool.id,
      name: tool.name,
      path: `${tool.skillsPath}\\${skill.skillID}`,
    })),
    ...state.projects.map((project) => ({
      type: "project",
      id: project.id,
      name: project.name,
      path: `${project.skillsPath}\\${skill.skillID}`,
    })),
  ];
  skill.enabledTargets = selected.map((target) => {
    const targetInfo = allTargets.find((item) => item.type === target.type && item.id === target.id);
    return {
      ...targetInfo,
      status: "enabled",
    };
  });
  skill.installState = skill.enabledTargets.length ? "enabled" : "installed";
  skill.lastEnabledAt = new Date().toLocaleString("zh-CN", { hour12: false });
  state.modal = null;
  addNotification("enable_result", `${skill.displayName} 启用范围已更新`, "已使用 copy 写入所选目标目录。", skill.skillID, "my");
  showToast("启用范围已更新");
  render();
}

function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  if (action === "set-page") {
    if (target.dataset.filter) state.myFilter = target.dataset.filter;
    setPage(target.dataset.page);
  }
  if (action === "toggle-connection") {
    state.connectionOpen = !state.connectionOpen;
    state.userMenuOpen = false;
    render();
  }
  if (action === "set-connection") {
    state.connection = target.dataset.status;
    state.connectionOpen = false;
    addNotification(
      state.connection === "failed" ? "connection_failed" : "connection_restored",
      connectionMeta().label,
      connectionMeta().description,
      null,
      "home"
    );
    render();
  }
  if (action === "retry-connection") {
    state.connection = "connecting";
    state.connectionOpen = false;
    render();
    setTimeout(() => {
      state.connection = "connected";
      addNotification("connection_restored", "连接已恢复", "已刷新市场数据、通知和可更新状态。", null, "home");
      showToast("连接已恢复");
      render();
    }, 900);
  }
  if (action === "toggle-user-menu") {
    state.userMenuOpen = !state.userMenuOpen;
    state.connectionOpen = false;
    render();
  }
  if (action === "logout") {
    state.loggedIn = false;
    state.userMenuOpen = false;
    state.connectionOpen = false;
    render();
  }
  if (action === "open-detail") {
    state.detailSkillID = target.dataset.skillId;
    state.page = "detail";
    state.modal = null;
    render();
  }
  if (action === "close-modal") {
    state.modal = null;
    clearInterval(progressTimer);
    render();
  }
  if (action === "install-skill") installSkill(target.dataset.skillId);
  if (action === "update-skill") updateSkill(target.dataset.skillId);
  if (action === "confirm-update") startProgress("update", target.dataset.skillId);
  if (action === "uninstall-skill") uninstallSkill(target.dataset.skillId);
  if (action === "confirm-uninstall") confirmUninstall(target.dataset.skillId);
  if (action === "open-targets") {
    const skill = getSkill(target.dataset.skillId);
    if (!skill || !isInstalled(skill)) {
      showToast("请先安装该 Skill");
      return;
    }
    state.modal = { type: "targets", skillID: target.dataset.skillId };
    render();
  }
  if (action === "apply-targets") applyTargets(target.dataset.skillId);
  if (action === "toggle-star") {
    const skill = getSkill(target.dataset.skillId);
    if (skill) {
      skill.starred = !skill.starred;
      skill.starCount += skill.starred ? 1 : -1;
      showToast(skill.starred ? "已收藏" : "已取消收藏");
      render();
    }
  }
  if (action === "clear-filters") {
    state.marketQuery = "";
    state.marketFilters = {
      department: "all",
      tool: "all",
      installed: "all",
      enabled: "all",
      access: "authorized_only",
      category: "all",
      risk: "all",
    };
    render();
  }
  if (action === "set-my-filter") {
    state.myFilter = target.dataset.filter;
    render();
  }
  if (action === "toggle-home-recommendation") {
    const skillID = target.dataset.skillId;
    const isSame =
      state.homeExpanded?.section === "recommended" && state.homeExpanded?.skillID === skillID;
    if (isSame) {
      state.homeExpanded = null;
    } else {
      state.homeExpanded = { section: "recommended", skillID };
    }
    render();
  }
  if (action === "set-review-tab") {
    state.reviewTab = target.dataset.tab;
    render();
  }
  if (action === "start-review") {
    const item = state.reviewItems.find((entry) => entry.id === target.dataset.reviewId);
    if (item) {
      item.status = "reviewing";
      item.lockedBy = "张三";
      state.reviewTab = "reviewing";
      showToast("已开始审核，锁单 5 分钟");
      render();
    }
  }
  if (action === "review-decision") {
    const item = state.reviewItems.find((entry) => entry.id === target.dataset.reviewId);
    if (item) {
      item.status = "reviewed";
      item.lockedBy = "张三";
      item.precheck = `审核${target.dataset.decision}`;
      state.reviewTab = "reviewed";
      addNotification("review_result", `${item.name} 审核${target.dataset.decision}`, "审核结果已写入历史时间线。", null, "review");
      showToast(`审核${target.dataset.decision}`);
      render();
    }
  }
  if (action === "open-review-detail") {
    const item = state.reviewItems.find((entry) => entry.id === target.dataset.reviewId);
    if (item) {
      state.modal = {
        type: "confirm",
        title: `${item.name} 审核历史`,
        body: "时间线包含上传成功、系统初审、人工复核、审核领取、审核意见和权限变更记录。拒绝与退回会要求选择原因模板并补充说明。",
        confirmText: "知道了",
        confirmAction: "close-modal",
      };
      render();
    }
  }
  if (action === "set-manage-tab") {
    state.manageTab = target.dataset.tab;
    render();
  }
  if (action === "refresh-tools") {
    state.tools = state.tools.map((tool) => ({
      ...tool,
      status: tool.status === "missing" ? "manual" : tool.status === "invalid" ? "manual" : tool.status,
      enabled: tool.status === "missing" || tool.status === "invalid" ? true : tool.enabled,
    }));
    addNotification("target_path_invalid", "工具检测已刷新", "缺失和不可用路径已切换为手动配置状态。", null, "tools");
    showToast("工具检测已刷新");
    render();
  }
  if (action === "toggle-tool") {
    const tool = state.tools.find((item) => item.id === target.dataset.toolId);
    if (tool) {
      tool.enabled = !tool.enabled;
      tool.status = tool.enabled ? "manual" : "disabled";
      render();
    }
  }
  if (action === "repair-tool") {
    const tool = state.tools.find((item) => item.id === target.dataset.toolId);
    if (tool) {
      tool.status = "manual";
      tool.enabled = true;
      tool.configPath = tool.configPath === "未检测到" ? "手动配置" : tool.configPath;
      showToast(`${tool.name} 已切换为手动配置`);
      render();
    }
  }
  if (action === "open-add-tool") {
    state.modal = { type: "add-tool" };
    render();
  }
  if (action === "open-add-project") {
    state.modal = { type: "add-project" };
    render();
  }
  if (action === "toggle-project") {
    const project = state.projects.find((item) => item.id === target.dataset.projectId);
    if (project) {
      project.enabled = !project.enabled;
      render();
    }
  }
  if (action === "set-notice-filter") {
    state.notificationFilter = target.dataset.filter;
    render();
  }
  if (action === "mark-read") {
    const notice = state.notifications.find((item) => item.id === target.dataset.noticeId);
    if (notice) notice.unread = false;
    render();
  }
  if (action === "confirm-mark-all-read") {
    state.modal = {
      type: "confirm",
      title: "全部标记为已读",
      body: "所有通知会被标记为已读。",
      confirmText: "全部已读",
      confirmAction: "mark-all-read",
    };
    render();
  }
  if (action === "mark-all-read") {
    state.notifications.forEach((notice) => {
      notice.unread = false;
    });
    state.modal = null;
    showToast("所有通知已标记为已读");
    render();
  }
  if (action === "jump-notice") {
    const notice = state.notifications.find((item) => item.id === target.dataset.noticeId);
    if (notice) {
      notice.unread = false;
      state.page = notice.targetPage;
      state.modal = null;
      render();
    }
  }
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  if (actionTarget.tagName === "SELECT" || actionTarget.matches("input[type='checkbox']")) return;
  event.preventDefault();
  handleAction(actionTarget);
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const formType = form.dataset.form;
  const data = new FormData(form);
  if (formType === "login") {
    state.loggedIn = true;
    state.page = "home";
    showToast("登录成功");
    render();
  }
  if (formType === "global-search") {
    if (isOffline()) return;
    state.search = String(data.get("q") || "");
    state.marketQuery = state.search;
    setPage("market");
  }
  if (formType === "market-search") {
    if (isOffline()) return;
    state.marketQuery = String(data.get("q") || "");
    render();
  }
  if (formType === "add-tool") {
    const name = String(data.get("name") || "").trim();
    const skillsPath = String(data.get("skillsPath") || "").trim();
    if (!name || !skillsPath) return;
    state.tools.push({
      id: `custom_${Date.now()}`,
      name,
      configPath: "手动维护",
      skillsPath,
      enabled: true,
      status: "manual",
      transform: "generic_directory",
    });
    state.modal = null;
    showToast("自定义工具已添加");
    render();
  }
  if (formType === "add-project") {
    const name = String(data.get("name") || "").trim();
    const projectPath = String(data.get("projectPath") || "").trim();
    const skillsPath = String(data.get("skillsPath") || "").trim();
    if (!name || !projectPath || !skillsPath) return;
    state.projects.push({
      id: `project_${Date.now()}`,
      name,
      projectPath,
      skillsPath,
      enabled: true,
    });
    state.modal = null;
    showToast("项目已添加");
    render();
  }
  if (formType === "publish-skill") {
    const skillID = String(data.get("skillID") || "").trim();
    const displayName = String(data.get("displayName") || "").trim();
    const version = String(data.get("version") || "").trim();
    if (!skillID || !displayName || !version) return;
    state.reviewItems.unshift({
      id: `rv-${Date.now()}`,
      skillID,
      name: displayName,
      submitter: "张三",
      department: "前端组",
      version,
      type: "首次发布",
      risk: "medium",
      precheck: "系统初审中",
      status: "pending",
      lockedBy: "",
      submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    });
    state.reviewTab = "pending";
    state.page = "review";
    addNotification("publish_submitted", `${displayName} 已提交审核`, "系统初审完成后会进入管理员审核队列。", null, "review");
    showToast("已提交审核");
    render();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (!action) return;
  if (action === "market-filter") {
    state.marketFilters[target.dataset.filter] = target.value;
    render();
  }
  if (action === "market-sort") {
    state.marketSort = target.value;
    render();
  }
  if (action === "setting-language") {
    state.settings.language = target.value;
    showToast("语言偏好已更新");
  }
  if (action === "setting-theme") {
    state.settings.theme = target.value;
    showToast("主题风格已更新");
    render();
  }
  if (action === "toggle-setting") {
    state.settings[target.dataset.key] = target.checked;
    showToast("设置已更新");
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.action === "my-search") {
    state.mySearch = target.value;
    render();
  }
});

render();
