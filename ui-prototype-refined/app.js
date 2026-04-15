const app = document.getElementById("app");

const IMAGE_POOL = {
  home: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
  context: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  security: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=900&q=80",
  docs: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80",
  test: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
  bridge: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  legacy: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=900&q=80",
  a11y: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=900&q=80"
};

const skills = [
  {
    skillID: "context-router",
    displayName: "上下文路由助手",
    description: "把任务入口按工具自动落位，减少重复说明。",
    detail:
      "适合多工具协作场景。安装后优先保持当前使用习惯，只在需要时再补充目标位置和高级说明。",
    team: "平台工程部",
    category: "开发效率",
    tools: ["Codex", "Claude", "Cursor"],
    systems: ["Windows"],
    marketVersion: "1.4.0",
    localVersion: "1.2.0",
    status: "update",
    audience: "全员可安装",
    verified: "已验证",
    heat: "高热度",
    updatedAt: "2026/04/10 16:32",
    image: IMAGE_POOL.context,
    diagnostics: ["本地内容有改动，更新前建议先看变更摘要。"],
    placements: [
      "Codex · 已启用",
      "Enterprise Agent Hub 项目 · 已启用"
    ],
    advanced: {
      maintainer: "平台工程部",
      review: "已通过安全复核，无脚本执行项。",
      packageNote: "ZIP 校验与包体检查已通过。",
      skillID: "context-router"
    }
  },
  {
    skillID: "security-review-kit",
    displayName: "安全审查套件",
    description: "把权限、包校验和调用边界整理成一套可直接使用的检查步骤。",
    detail:
      "默认先给出最小检查集，复杂风险项和治理说明折叠到高级信息里，避免首屏把用户压成审核员。",
    team: "安全与合规部",
    category: "治理",
    tools: ["Codex", "Claude", "Windsurf"],
    systems: ["Windows"],
    marketVersion: "2.0.1",
    localVersion: null,
    status: "not_installed",
    audience: "全员可安装",
    verified: "需注意",
    heat: "推荐",
    updatedAt: "2026/04/08 16:00",
    image: IMAGE_POOL.security,
    diagnostics: [],
    placements: [],
    advanced: {
      maintainer: "安全与合规部",
      review: "中风险，无自动执行脚本。",
      packageNote: "包信息完整，可直接安装。",
      skillID: "security-review-kit"
    }
  },
  {
    skillID: "readme-polisher",
    displayName: "README 改写助手",
    description: "统一整理 README 的结构、示例和限制说明，让文档更容易交付。",
    detail:
      "更适合发布前的轻量清理，不把版本、审核和包细节推到阅读链路前面。",
    team: "研发效能部",
    category: "文档",
    tools: ["Codex", "Cursor", "OpenCode"],
    systems: ["Windows"],
    marketVersion: "1.3.2",
    localVersion: "1.3.2",
    status: "installed",
    audience: "详情公开",
    verified: "已验证",
    heat: "稳定",
    updatedAt: "2026/04/04 10:20",
    image: IMAGE_POOL.docs,
    diagnostics: [],
    placements: ["桌面客户端项目 · 已启用"],
    advanced: {
      maintainer: "研发效能部",
      review: "低风险，仅含文档模板与说明。",
      packageNote: "包体较小，适合快速分发。",
      skillID: "readme-polisher"
    }
  },
  {
    skillID: "e2e-test-writer",
    displayName: "端到端测试编排",
    description: "围绕成功、失败、离线和权限状态生成可执行的验收步骤。",
    detail:
      "把真正需要回归的路径收束成可读列表，减少客户在主界面里看到过多内部测试术语。",
    team: "质量平台部",
    category: "测试",
    tools: ["Codex", "Claude"],
    systems: ["Windows"],
    marketVersion: "0.9.7",
    localVersion: "0.9.7",
    status: "enabled",
    audience: "详情公开",
    verified: "待补充",
    heat: "常用",
    updatedAt: "2026/04/08 09:12",
    image: IMAGE_POOL.test,
    diagnostics: [],
    placements: ["Claude · 已启用"],
    advanced: {
      maintainer: "质量平台部",
      review: "依赖说明仍需补全。",
      packageNote: "当前版本不自动解析依赖。",
      skillID: "e2e-test-writer"
    }
  },
  {
    skillID: "legacy-cli-helper",
    displayName: "旧版 CLI 迁移助手",
    description: "保留存量命令提示，当前只允许已安装用户继续使用。",
    detail:
      "把权限收缩说明压成短状态，不在列表里展开大段治理文案，详细规则放在展开项里。",
    team: "基础设施部",
    category: "工具集成",
    tools: ["Codex", "OpenCode"],
    systems: ["Windows"],
    marketVersion: "1.8.0",
    localVersion: "1.6.0",
    status: "restricted",
    audience: "存量继续使用",
    verified: "已验证",
    heat: "存量",
    updatedAt: "2026/03/28 14:06",
    image: IMAGE_POOL.legacy,
    diagnostics: ["权限已收缩，当前版本可继续使用，但不可更新或新增位置。"],
    placements: [],
    advanced: {
      maintainer: "基础设施部",
      review: "当前仅保留存量用户访问。",
      packageNote: "新版本已冻结，不再提供更新入口。",
      skillID: "legacy-cli-helper"
    }
  },
  {
    skillID: "adapter-bridge",
    displayName: "Adapter 转换桥",
    description: "把多工具转换规则统一为一套可管理入口。",
    detail:
      "客户首屏只保留能否查看、能否安装和适用范围，技术元数据统一后置。",
    team: "工具平台部",
    category: "工具集成",
    tools: ["Codex", "Claude", "Cursor", "Windsurf", "OpenCode"],
    systems: ["Windows"],
    marketVersion: "1.0.0",
    localVersion: null,
    status: "blocked",
    audience: "仅可查看摘要",
    verified: "受限",
    heat: "受限",
    updatedAt: "2026/04/05 12:00",
    image: IMAGE_POOL.bridge,
    diagnostics: [],
    placements: [],
    advanced: {
      maintainer: "工具平台部",
      review: "当前只开放摘要信息。",
      packageNote: "详情权限未开放，不展示包元数据。",
      skillID: "adapter-bridge"
    }
  },
  {
    skillID: "frontend-a11y-guard",
    displayName: "前端可访问性守卫",
    description: "把页面可读性、对比度和焦点顺序检查收成一条轻量发布前流程。",
    detail:
      "更适合设计和前端一起使用，首屏只给出适用范围和主操作，具体检查项折叠展开。",
    team: "设计平台组",
    category: "设计协作",
    tools: ["Codex", "Cursor"],
    systems: ["Windows"],
    marketVersion: "1.1.0",
    localVersion: null,
    status: "not_installed",
    audience: "详情公开",
    verified: "已验证",
    heat: "新上架",
    updatedAt: "2026/04/11 09:40",
    image: IMAGE_POOL.a11y,
    diagnostics: [],
    placements: [],
    advanced: {
      maintainer: "设计平台组",
      review: "已完成人工复核，可直接试用。",
      packageNote: "适合与 README 改写助手搭配使用。",
      skillID: "frontend-a11y-guard"
    }
  }
];

const targetTools = [
  {
    id: "codex",
    name: "Codex",
    state: "可用",
    path: "默认目录已接入",
    enabledSkills: 1,
    issueCount: 1,
    note: "需要处理 1 条扫描差异"
  },
  {
    id: "claude",
    name: "Claude",
    state: "可用",
    path: "默认目录已接入",
    enabledSkills: 1,
    issueCount: 0,
    note: "当前无需处理"
  },
  {
    id: "cursor",
    name: "Cursor",
    state: "手动配置",
    path: "自定义规则目录",
    enabledSkills: 0,
    issueCount: 0,
    note: "仅在需要时再补充路径"
  },
  {
    id: "windsurf",
    name: "Windsurf",
    state: "未检测到",
    path: "等待手动补充",
    enabledSkills: 0,
    issueCount: 1,
    note: "缺少本地路径"
  }
];

const projects = [
  {
    id: "enterprise-agent-hub",
    name: "Enterprise Agent Hub",
    status: "已启用",
    enabledSkills: ["上下文路由助手"],
    path: "~/workspace/EnterpriseAgentHub/.codex/skills",
    note: "项目级配置优先"
  },
  {
    id: "desktop-client",
    name: "Desktop Client",
    status: "已启用",
    enabledSkills: [],
    path: "~/workspace/DesktopClient/.codex/skills",
    note: "当前没有已生效 Skill"
  }
];

const notifications = [
  {
    id: "n1",
    title: "上下文路由助手有新版本",
    body: "市场版本 1.4.0 高于本地 1.2.0，更新后仍保留现有启用位置。",
    time: "今天 09:20",
    group: "action"
  },
  {
    id: "n2",
    title: "旧版 CLI 迁移助手权限已收缩",
    body: "当前版本可继续使用，但后续不再提供更新。",
    time: "昨天 18:02",
    group: "action"
  },
  {
    id: "n3",
    title: "OpenCode 路径暂不可用",
    body: "建议在工具与项目里补充路径后再启用相关 Skill。",
    time: "昨天 11:41",
    group: "system"
  },
  {
    id: "n4",
    title: "本地事件已同步",
    body: "上次离线期间的启用变更已回写，不需要额外操作。",
    time: "昨天 09:35",
    group: "system"
  }
];

const publishedSkills = [
  {
    skillID: "prompt-lint-checklist",
    displayName: "Prompt Lint Checklist",
    status: "审核中",
    visibility: "详情公开",
    scope: "技术部",
    updatedAt: "2026/04/12 15:20",
    summary: "等待上级管理员确认发布范围。"
  },
  {
    skillID: "frontend-a11y-guard",
    displayName: "前端可访问性守卫",
    status: "已发布",
    visibility: "全员可安装",
    scope: "全员",
    updatedAt: "2026/04/11 09:40",
    summary: "当前版本稳定，无需立即操作。"
  }
];

const reviewQueue = [
  {
    reviewID: "r1",
    skillID: "design-guideline-lite",
    displayName: "Design Guideline Lite",
    submitter: "王五",
    department: "设计平台组",
    risk: "低",
    state: "待管理员复核",
    requestedVersion: "0.9.0",
    summary: "涉及可见范围变更，建议优先确认授权部门。",
    latestComment: "本次只调整公开级别，不改包内容。"
  },
  {
    reviewID: "r2",
    skillID: "prompt-lint-checklist",
    displayName: "Prompt Lint Checklist",
    submitter: "李四",
    department: "前端组",
    risk: "低",
    state: "审核中",
    requestedVersion: "1.0.0",
    summary: "新增发布项，预检已通过。",
    latestComment: "等待 L2 管理员确认上线范围。"
  }
];

const departments = [
  { name: "集团", level: "L0", users: 7, skills: 3 },
  { name: "技术部", level: "L1", users: 4, skills: 3 },
  { name: "前端组", level: "L2", users: 3, skills: 2 },
  { name: "后端组", level: "L2", users: 1, skills: 1 },
  { name: "设计平台组", level: "L1", users: 1, skills: 2 },
  { name: "运维组", level: "L1", users: 1, skills: 1 }
];

const users = [
  { name: "系统管理员", role: "管理员 L1", department: "集团", state: "active" },
  { name: "技术部管理员", role: "管理员 L2", department: "技术部", state: "active" },
  { name: "前端组管理员", role: "管理员 L3", department: "前端组", state: "active" },
  { name: "李四", role: "普通用户", department: "前端组", state: "active" }
];

const managedSkills = [
  {
    displayName: "Codex Review Helper",
    team: "前端组",
    status: "已发布",
    heat: "Star 12 · 下载 33"
  },
  {
    displayName: "Design Guideline Lite",
    team: "设计平台组",
    status: "摘要公开",
    heat: "Star 4 · 下载 8"
  },
  {
    displayName: "Legacy Department Runbook",
    team: "运维组",
    status: "已下架",
    heat: "Star 1 · 下载 2"
  }
];

const state = {
  mode: "customer",
  page: "home",
  libraryTab: "installed",
  adminTab: "reviews",
  notificationsTab: "action",
  marketAdvancedOpen: false,
  selectedSkillID: skills[0].skillID,
  targetSkillID: "context-router",
  marketFilters: {
    query: "",
    tool: "all",
    status: "all",
    department: "all",
    sort: "recommended",
    category: "all",
    risk: "all"
  }
};

function installedSkills() {
  return skills.filter((skill) => skill.localVersion !== null);
}

function actionableTasks() {
  const items = [];
  const updates = installedSkills().filter((skill) => skill.status === "update");
  const restricted = installedSkills().filter((skill) => skill.status === "restricted");
  const diagnostics = installedSkills()
    .filter((skill) => skill.diagnostics.length > 0)
    .flatMap((skill) =>
      skill.diagnostics.map((message) => ({
        title: skill.displayName,
        body: message
      }))
    );

  if (updates.length > 0) {
    items.push({
      level: "high",
      title: `${updates.length} 个 Skill 可以更新`,
      body: "把更新与覆盖风险放在同一条任务里处理，不再分散到多个页面。"
    });
  }
  if (restricted.length > 0) {
    items.push({
      level: "medium",
      title: `${restricted.length} 个存量 Skill 受权限收缩影响`,
      body: "保留继续使用入口，解释文本后置到详情，不在列表里堆满治理文案。"
    });
  }
  diagnostics.slice(0, 1).forEach((item) =>
    items.push({
      level: "medium",
      title: item.title,
      body: item.body
    })
  );
  items.push({
    level: "low",
    title: "工具与项目统一在一个入口管理",
    body: "把路径、启用和诊断集中收口，减少顶级导航负担。"
  });
  return items.slice(0, 4);
}

function counts() {
  const localSkills = installedSkills();
  return {
    installed: localSkills.length,
    enabled: localSkills.filter((skill) => skill.status === "enabled" || skill.placements.length > 0).length,
    updates: localSkills.filter((skill) => skill.status === "update").length,
    action: notifications.filter((item) => item.group === "action").length
  };
}

function diagnosticsSummary() {
  return [
    {
      title: "1 个工具路径需要处理",
      body: "Windsurf 仍未检测到本地路径，保留在工具与项目页里按需修复。",
      level: "high"
    },
    {
      title: "1 个本地副本存在内容改动",
      body: "上下文路由助手更新前需要先看变更摘要。",
      level: "medium"
    }
  ];
}

function filteredMarketSkills() {
  const { query, tool, status, department, category, risk, sort } = state.marketFilters;
  let items = [...skills];

  if (query.trim()) {
    const lower = query.trim().toLowerCase();
    items = items.filter((skill) =>
      skill.displayName.toLowerCase().includes(lower) ||
      skill.description.toLowerCase().includes(lower) ||
      skill.skillID.toLowerCase().includes(lower) ||
      skill.team.toLowerCase().includes(lower)
    );
  }

  if (tool !== "all") {
    items = items.filter((skill) => skill.tools.includes(tool));
  }

  if (status !== "all") {
    items = items.filter((skill) => skill.status === status);
  }

  if (department !== "all") {
    items = items.filter((skill) => skill.team === department);
  }

  if (category !== "all") {
    items = items.filter((skill) => skill.category === category);
  }

  if (risk !== "all") {
    items = items.filter((skill) => skill.verified === risk);
  }

  items.sort((left, right) => {
    if (sort === "latest") return right.updatedAt.localeCompare(left.updatedAt);
    if (sort === "installed") return Number(right.localVersion !== null) - Number(left.localVersion !== null);
    return left.status === "not_installed" ? -1 : 1;
  });

  if (!items.some((skill) => skill.skillID === state.selectedSkillID)) {
    state.selectedSkillID = items[0] ? items[0].skillID : skills[0].skillID;
  }

  return items;
}

function selectedSkill() {
  return skills.find((skill) => skill.skillID === state.selectedSkillID) || skills[0];
}

function targetSkill() {
  return installedSkills().find((skill) => skill.skillID === state.targetSkillID) || installedSkills()[0];
}

function statusLabel(skill) {
  return {
    not_installed: "未安装",
    installed: "已安装",
    enabled: "已启用",
    update: "可更新",
    restricted: "继续使用",
    blocked: "仅可查看摘要"
  }[skill.status];
}

function statusTone(skill) {
  return {
    not_installed: "info",
    installed: "neutral",
    enabled: "success",
    update: "warning",
    restricted: "warning",
    blocked: "danger"
  }[skill.status];
}

function versionSummary(skill) {
  if (skill.status === "update") {
    return `本地 v${skill.localVersion}，可更新到 v${skill.marketVersion}`;
  }
  if (skill.status === "restricted") {
    return `保留本地 v${skill.localVersion}，不再开放更新`;
  }
  if (skill.localVersion) {
    return `本地 v${skill.localVersion}，已是当前版本`;
  }
  return `市场版本 v${skill.marketVersion}`;
}

function usageSummary(skill) {
  if (skill.placements.length === 0) return "未启用到任何位置";
  return `已启用 ${skill.placements.length} 个位置`;
}

function primaryActionLabel(skill) {
  if (skill.status === "update") return "更新";
  if (skill.status === "not_installed") return "安装";
  if (skill.status === "blocked") return "查看";
  return "打开";
}

function visibleNav() {
  const base = [
    { id: "home", label: "首页", count: 0 },
    { id: "market", label: "市场", count: 0 },
    { id: "library", label: "我的 Skill", count: 0 },
    { id: "notifications", label: "通知", count: notifications.filter((item) => item.group === "action").length }
  ];

  if (state.mode === "admin") {
    base.push({ id: "admin", label: "管理工作台", count: 0 });
  }
  return base;
}

function setMode(mode) {
  state.mode = mode;
  if (mode === "customer") {
    if (state.page === "admin") state.page = "home";
    if (state.libraryTab === "published" || state.libraryTab === "publish") {
      state.libraryTab = "installed";
    }
  }
}

function iconForPage(page) {
  return {
    home: "⌂",
    market: "◫",
    library: "▣",
    notifications: "◔",
    admin: "◇"
  }[page];
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function button(label, attrs = "", className = "ghost-button") {
  return `<button class="${className}" ${attrs}>${label}</button>`;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">⌘</div>
        <div class="brand-copy">
          <strong>Enterprise Agent Hub</strong>
          <span>Refined Workspace</span>
        </div>
      </div>
      <nav class="nav-list">
        ${visibleNav()
          .map(
            (item) => `
              <button class="nav-item ${state.page === item.id ? "active" : ""}" data-nav="${item.id}">
                <span class="nav-item-main">
                  <span>${iconForPage(item.id)}</span>
                  <span>${item.label}</span>
                </span>
                <span class="nav-item-side">
                  ${item.count > 0 ? `<span class="nav-count">${item.count}</span>` : ""}
                </span>
              </button>
            `
          )
          .join("")}
      </nav>
      <div class="sidebar-footer">
        <div class="mini-copy">设置保留在统一入口里，原型目录未被修改。</div>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <form class="search-form" data-form="global-search">
        <div class="search-shell">
          <span>⌕</span>
          <input name="query" value="${escapeHTML(state.marketFilters.query)}" placeholder="按名称、标签、团队或 skill ID 搜索" />
        </div>
      </form>
      <div class="status-inline">
        <span class="status-dot"></span>
        <span>已连接</span>
      </div>
      <div class="segmented">
        <button class="segmented-button ${state.mode === "customer" ? "active" : ""}" data-mode="customer">客户工作区</button>
        <button class="segmented-button ${state.mode === "admin" ? "active" : ""}" data-mode="admin">治理视角</button>
      </div>
      <div class="account-chip">
        <div>
          <strong>${state.mode === "admin" ? "系统管理员" : "张三"}</strong>
          <small>${state.mode === "admin" ? "Admin L1" : "本地优先"}</small>
        </div>
      </div>
    </header>
  `;
}

function renderHomePage() {
  const localCounts = counts();
  const recommendations = skills.filter((skill) => skill.status === "not_installed").slice(0, 3);

  return `
    <div class="page-stack">
      <section class="band hero-band">
        <div class="page-head">
          <div>
            <div class="eyebrow">工作区</div>
            <h1>把真正需要处理的事放在前面</h1>
            <p>更新、权限变化、关键消息和推荐入口分开呈现，不再把治理字段和诊断细节一股脑堆到首屏。</p>
          </div>
          <div class="hero-actions">
            ${button("去市场", 'data-nav="market"', "ghost-button primary")}
            ${button("查看我的 Skill", 'data-nav="library"')}
            ${button("工具与项目", 'data-nav="library" data-library-tab="targets"')}
          </div>
        </div>
      </section>

      <section class="metric-grid">
        <article class="metric-tile"><span>已安装</span><strong>${localCounts.installed}</strong></article>
        <article class="metric-tile"><span>已启用位置</span><strong>${localCounts.enabled}</strong></article>
        <article class="metric-tile"><span>待更新</span><strong>${localCounts.updates}</strong></article>
        <article class="metric-tile"><span>需要处理</span><strong>${localCounts.action}</strong></article>
      </section>

      <section class="split-grid">
        <section class="band">
          <div class="section-head">
            <div>
              <div class="eyebrow">需要处理</div>
              <h2>今天先做这些</h2>
            </div>
            ${button("查看全部通知", 'data-nav="notifications"', "ghost-button")}
          </div>
          <div class="task-list">
            ${actionableTasks()
              .map(
                (item) => `
                  <article class="task-item priority-${item.level}">
                    <h3>${item.title}</h3>
                    <p>${item.body}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
        <section class="band">
          <div class="section-head">
            <div>
              <div class="eyebrow">我的 Skill</div>
              <h2>最近变化</h2>
            </div>
            ${button("进入我的 Skill", 'data-nav="library"', "ghost-button")}
          </div>
          <div class="list-stack">
            ${installedSkills()
              .slice(0, 3)
              .map(
                (skill) => `
                  <article class="library-item">
                    <img class="thumb" src="${skill.image}" alt="${escapeHTML(skill.displayName)}" />
                    <div class="library-copy">
                      <h3>${skill.displayName}</h3>
                      <p>${versionSummary(skill)}</p>
                      <div class="meta-line">
                        <span>${usageSummary(skill)}</span>
                        <span>${skill.team}</span>
                      </div>
                    </div>
                    <div class="library-actions">
                      <span class="pill ${statusTone(skill)}">${statusLabel(skill)}</span>
                      ${button("查看", `data-nav="library" data-skill="${skill.skillID}"`, "mini-button")}
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      </section>

      <section class="band">
        <div class="section-head">
          <div>
            <div class="eyebrow">推荐上手</div>
            <h2>把列表改成先决策、后展开</h2>
          </div>
          ${button("更多推荐", 'data-nav="market"', "ghost-button")}
        </div>
        <div class="list-stack">
          ${recommendations
            .map(
              (skill) => `
                <article class="market-item" data-market-skill="${skill.skillID}">
                  <img class="thumb" src="${skill.image}" alt="${escapeHTML(skill.displayName)}" />
                  <div class="market-copy">
                    <h3>${skill.displayName}</h3>
                    <p>${skill.description}</p>
                    <div class="meta-line">
                      <span>${skill.team}</span>
                      <span>${skill.category}</span>
                      <span>${skill.tools.join(" / ")}</span>
                    </div>
                  </div>
                  <div class="market-actions">
                    <span class="pill info">${skill.heat}</span>
                    ${button(primaryActionLabel(skill), `data-market-skill="${skill.skillID}"`, "mini-button primary")}
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function renderMarketPage() {
  const items = filteredMarketSkills();
  const skill = selectedSkill();
  const departmentsSet = [...new Set(skills.map((item) => item.team))];
  const toolsSet = [...new Set(skills.flatMap((item) => item.tools))];
  const categoriesSet = [...new Set(skills.map((item) => item.category))];

  return `
    <div class="page-stack">
      <section class="band">
        <div class="page-head">
          <div>
            <div class="eyebrow">市场</div>
            <h1>先决定能不能装，再决定要不要看更多</h1>
            <p>默认只展示客户需要做决定的信息，把公开级别、风险说明和技术元数据收进更多筛选或高级信息。</p>
          </div>
          <div class="chip-row">
            <span class="pill info">${items.length} 个结果</span>
            <span class="pill">${items.filter((item) => item.status === "not_installed").length} 个可直接安装</span>
          </div>
        </div>
      </section>

      <section class="band market-toolbar">
        <div class="filter-grid">
          <label class="field">
            <span>适用工具</span>
            <select data-filter="tool">
              <option value="all"${state.marketFilters.tool === "all" ? " selected" : ""}>全部</option>
              ${toolsSet.map((tool) => `<option value="${tool}"${state.marketFilters.tool === tool ? " selected" : ""}>${tool}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>状态</span>
            <select data-filter="status">
              <option value="all"${state.marketFilters.status === "all" ? " selected" : ""}>全部</option>
              <option value="not_installed"${state.marketFilters.status === "not_installed" ? " selected" : ""}>未安装</option>
              <option value="update"${state.marketFilters.status === "update" ? " selected" : ""}>可更新</option>
              <option value="enabled"${state.marketFilters.status === "enabled" ? " selected" : ""}>已启用</option>
              <option value="restricted"${state.marketFilters.status === "restricted" ? " selected" : ""}>继续使用</option>
            </select>
          </label>
          <label class="field">
            <span>发布团队</span>
            <select data-filter="department">
              <option value="all"${state.marketFilters.department === "all" ? " selected" : ""}>全部</option>
              ${departmentsSet
                .map((department) => `<option value="${department}"${state.marketFilters.department === department ? " selected" : ""}>${department}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>排序</span>
            <select data-filter="sort">
              <option value="recommended"${state.marketFilters.sort === "recommended" ? " selected" : ""}>推荐优先</option>
              <option value="latest"${state.marketFilters.sort === "latest" ? " selected" : ""}>最近更新</option>
              <option value="installed"${state.marketFilters.sort === "installed" ? " selected" : ""}>先看已安装</option>
            </select>
          </label>
        </div>
        <div class="button-row">
          ${button(state.marketAdvancedOpen ? "收起更多筛选" : "更多筛选", 'data-toggle="market-advanced"', "ghost-button")}
          ${button("清空筛选", 'data-action="reset-filters"', "ghost-button")}
        </div>
        ${state.marketAdvancedOpen
          ? `
            <div class="filter-grid">
              <label class="field">
                <span>分类</span>
                <select data-filter="category">
                  <option value="all"${state.marketFilters.category === "all" ? " selected" : ""}>全部</option>
                  ${categoriesSet
                    .map((category) => `<option value="${category}"${state.marketFilters.category === category ? " selected" : ""}>${category}</option>`)
                    .join("")}
                </select>
              </label>
              <label class="field">
                <span>验证状态</span>
                <select data-filter="risk">
                  <option value="all"${state.marketFilters.risk === "all" ? " selected" : ""}>全部</option>
                  <option value="已验证"${state.marketFilters.risk === "已验证" ? " selected" : ""}>已验证</option>
                  <option value="需注意"${state.marketFilters.risk === "需注意" ? " selected" : ""}>需注意</option>
                  <option value="受限"${state.marketFilters.risk === "受限" ? " selected" : ""}>受限</option>
                </select>
              </label>
            </div>
          `
          : ""}
        <div class="active-filter-row">
          ${state.marketFilters.query ? `<span class="filter-chip active">搜索：${escapeHTML(state.marketFilters.query)}</span>` : ""}
          ${state.marketFilters.tool !== "all" ? `<span class="filter-chip active">${state.marketFilters.tool}</span>` : ""}
          ${state.marketFilters.status !== "all" ? `<span class="filter-chip active">${state.marketFilters.status}</span>` : ""}
          ${state.marketFilters.department !== "all" ? `<span class="filter-chip active">${state.marketFilters.department}</span>` : ""}
        </div>
      </section>

      <section class="market-layout">
        <div class="band">
          <div class="market-list">
            ${items
              .map(
                (item) => `
                  <article class="market-item ${item.skillID === state.selectedSkillID ? "is-selected" : ""}" data-market-skill="${item.skillID}">
                    <img class="thumb" src="${item.image}" alt="${escapeHTML(item.displayName)}" />
                    <div class="market-copy">
                      <h3>${item.displayName}</h3>
                      <p>${item.description}</p>
                      <div class="meta-line">
                        <span>${item.team}</span>
                        <span>${item.category}</span>
                        <span>${item.tools.join(" / ")}</span>
                      </div>
                    </div>
                    <div class="market-actions">
                      <span class="pill ${statusTone(item)}">${statusLabel(item)}</span>
                      <span class="mini-copy">${versionSummary(item)}</span>
                      ${button(primaryActionLabel(item), `data-market-skill="${item.skillID}"`, "mini-button primary")}
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>

        <aside class="band detail-panel">
          <img class="detail-cover" src="${skill.image}" alt="${escapeHTML(skill.displayName)}" />
          <div class="detail-body">
            <div class="detail-copy">
              <div class="chip-row">
                <span class="pill ${statusTone(skill)}">${statusLabel(skill)}</span>
                <span class="pill info">${skill.verified}</span>
              </div>
              <h2>${skill.displayName}</h2>
              <p>${skill.detail}</p>
            </div>
            <div class="info-grid">
              <dl><dt>版本状态</dt><dd>${versionSummary(skill)}</dd></dl>
              <dl><dt>适用范围</dt><dd>${skill.tools.join(" / ")}</dd></dl>
              <dl><dt>发布团队</dt><dd>${skill.team}</dd></dl>
              <dl><dt>最近更新</dt><dd>${skill.updatedAt}</dd></dl>
            </div>
            <div class="detail-actions">
              ${button(primaryActionLabel(skill), `data-market-skill="${skill.skillID}"`, "ghost-button primary")}
              ${button("加入我的 Skill", 'data-nav="library"', "ghost-button")}
            </div>
            <details class="fold" open>
              <summary>使用说明</summary>
              <div class="fold-body">
                <p>安装后先保留当前路径与启用位置，需要时再进入“工具与项目”调整目标范围。</p>
              </div>
            </details>
            <details class="fold">
              <summary>高级信息</summary>
              <div class="fold-body">
                <dl><dt>Skill ID</dt><dd class="muted-code">${skill.advanced.skillID}</dd></dl>
                <dl><dt>维护团队</dt><dd>${skill.advanced.maintainer}</dd></dl>
                <dl><dt>审核摘要</dt><dd>${skill.advanced.review}</dd></dl>
                <dl><dt>包信息</dt><dd>${skill.advanced.packageNote}</dd></dl>
              </div>
            </details>
          </div>
        </aside>
      </section>
    </div>
  `;
}

function renderInstalledTab() {
  const localSkills = installedSkills();
  return `
    <section class="band library-layout">
      <div class="row-head">
        <div class="chip-row">
          <span class="pill info">${localSkills.length} 个本地副本</span>
          <span class="pill warning">${localSkills.filter((skill) => skill.status === "update").length} 个可更新</span>
          <span class="pill danger">${diagnosticsSummary().length} 个需要诊断</span>
        </div>
        ${button("查看诊断", 'data-library-tab="targets"', "ghost-button")}
      </div>
      <div class="list-stack">
        ${localSkills
          .map(
            (skill) => `
              <article class="library-item">
                <img class="thumb" src="${skill.image}" alt="${escapeHTML(skill.displayName)}" />
                <div class="library-copy">
                  <h3>${skill.displayName}</h3>
                  <p>${versionSummary(skill)}</p>
                  <div class="meta-line">
                    <span>${usageSummary(skill)}</span>
                    <span>${skill.updatedAt}</span>
                  </div>
                  ${skill.diagnostics.length > 0 ? `<div class="hint-line">${skill.diagnostics[0]}</div>` : ""}
                </div>
                <div class="library-actions">
                  <span class="pill ${statusTone(skill)}">${statusLabel(skill)}</span>
                  ${skill.status === "update" ? button("更新", `data-market-skill="${skill.skillID}"`, "mini-button primary") : ""}
                  ${button("管理位置", `data-target-skill="${skill.skillID}"`, "mini-button")}
                  ${button("卸载", `data-action="uninstall" data-skill="${skill.skillID}"`, "mini-button danger")}
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderTargetsTab() {
  const skill = targetSkill();
  return `
    <div class="page-stack">
      <section class="band target-board">
        <div class="page-head">
          <div>
            <div class="eyebrow">工具与项目</div>
            <h2>把目标管理并回“我的 Skill”</h2>
            <p>路径、启用位置和诊断信息不再占用顶级导航，而是在需要调整时集中处理。</p>
          </div>
          <div class="tabs">
            ${installedSkills()
              .map(
                (item) => `
                  <button class="chip-button ${item.skillID === skill.skillID ? "active" : ""}" data-target-skill="${item.skillID}">
                    ${item.displayName}
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
        <div class="target-panels">
          <section class="target-card">
            <div class="section-head">
              <div>
                <div class="eyebrow">当前技能</div>
                <h3>${skill.displayName}</h3>
              </div>
              <span class="pill ${statusTone(skill)}">${statusLabel(skill)}</span>
            </div>
            <div class="target-list">
              ${skill.placements.length > 0
                ? skill.placements
                    .map(
                      (placement) => `
                        <div class="target-item">
                          <strong>${placement}</strong>
                          <p>保持现有方式，不在首屏展开路径和回退原因。</p>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="empty">当前还没有启用位置，安装后可按需选择工具或项目。</div>`}
            </div>
          </section>
          <section class="target-card">
            <div class="section-head">
              <div>
                <div class="eyebrow">异常与诊断</div>
                <h3>仅在这里展开</h3>
              </div>
            </div>
            <div class="diagnostic-list">
              ${diagnosticsSummary()
                .map(
                  (item) => `
                    <article class="diagnostic-item priority-${item.level}">
                      <strong>${item.title}</strong>
                      <p>${item.body}</p>
                    </article>
                  `
                )
                .join("")}
            </div>
          </section>
        </div>
      </section>

      <section class="band-grid">
        <section class="band">
          <div class="section-head">
            <div>
              <div class="eyebrow">工具目标</div>
              <h2>先看是否可用</h2>
            </div>
            ${button("添加工具", 'data-action="noop"', "ghost-button primary")}
          </div>
          <div class="list-stack">
            ${targetTools
              .map(
                (tool) => `
                  <article class="target-item">
                    <div class="row-head">
                      <div>
                        <h3>${tool.name}</h3>
                        <p>${tool.path}</p>
                      </div>
                      <div class="chip-row">
                        <span class="pill ${tool.issueCount > 0 ? "warning" : "success"}">${tool.state}</span>
                        ${tool.issueCount > 0 ? `<span class="pill warning">${tool.issueCount} 条问题</span>` : ""}
                      </div>
                    </div>
                    <div class="meta-line">
                      <span>已启用 ${tool.enabledSkills} 个 Skill</span>
                      <span>${tool.note}</span>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
        <section class="band">
          <div class="section-head">
            <div>
              <div class="eyebrow">项目目标</div>
              <h2>项目级配置</h2>
            </div>
            ${button("添加项目", 'data-action="noop"', "ghost-button primary")}
          </div>
          <div class="list-stack">
            ${projects
              .map(
                (project) => `
                  <article class="target-item">
                    <div class="row-head">
                      <div>
                        <h3>${project.name}</h3>
                        <p>${project.path}</p>
                      </div>
                      <span class="pill info">${project.status}</span>
                    </div>
                    <div class="meta-line">
                      <span>${project.note}</span>
                      <span>${project.enabledSkills.length > 0 ? project.enabledSkills.join(" / ") : "当前没有已生效 Skill"}</span>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      </section>
    </div>
  `;
}

function renderPublishedTab() {
  return `
    <section class="band library-layout">
      <div class="section-head">
        <div>
          <div class="eyebrow">我发布的</div>
          <h2>作者链路单独收口</h2>
          <p>发布状态、公开级别和授权范围都保留，但不再和客户的“已安装”列表混在一起。</p>
        </div>
        ${button("去发布", 'data-library-tab="publish"', "ghost-button primary")}
      </div>
      <div class="list-stack">
        ${publishedSkills
          .map(
            (skill) => `
              <article class="published-item">
                <div class="row-head">
                  <div>
                    <h3>${skill.displayName}</h3>
                    <p>${skill.summary}</p>
                  </div>
                  <span class="pill ${skill.status === "已发布" ? "success" : "warning"}">${skill.status}</span>
                </div>
                <div class="meta-line">
                  <span>${skill.visibility}</span>
                  <span>${skill.scope}</span>
                  <span>${skill.updatedAt}</span>
                </div>
                <div class="button-row">
                  ${button("查看详情", 'data-action="noop"', "mini-button")}
                  ${button("修改范围", 'data-action="noop"', "mini-button")}
                  ${skill.status === "审核中" ? button("撤回", 'data-action="noop"', "mini-button danger") : button("发布新版本", 'data-library-tab="publish"', "mini-button primary")}
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPublishTab() {
  return `
    <section class="band publish-layout">
      <div class="section-head">
        <div>
          <div class="eyebrow">发布 Skill</div>
          <h2>拆成四步，减少一次读完所有字段的压力</h2>
          <p>基础信息、公开范围、上传包和预检确认分开组织，避免长表单把主任务埋掉。</p>
        </div>
        <span class="pill info">草稿态</span>
      </div>
      <div class="step-row">
        <div class="step-chip active">1. 基础信息</div>
        <div class="step-chip active">2. 公开范围</div>
        <div class="step-chip">3. 上传包</div>
        <div class="step-chip">4. 预检确认</div>
      </div>
      <div class="form-grid">
        <label class="field">
          <span>显示名称</span>
          <input value="Front-end A11y Guard" />
        </label>
        <label class="field">
          <span>Skill ID</span>
          <input value="frontend-a11y-guard" />
        </label>
        <label class="field full">
          <span>简介</span>
          <textarea>把页面可读性、对比度和焦点顺序检查收成一条轻量发布前流程。</textarea>
        </label>
        <label class="field">
          <span>版本号</span>
          <input value="1.1.0" />
        </label>
        <label class="field">
          <span>分类</span>
          <input value="设计协作" />
        </label>
        <label class="field">
          <span>授权范围</span>
          <select>
            <option selected>本部门及下级</option>
            <option>指定多个部门</option>
            <option>全员</option>
          </select>
        </label>
        <label class="field">
          <span>公开级别</span>
          <select>
            <option>仅自己</option>
            <option>摘要公开</option>
            <option selected>详情公开</option>
            <option>全员可安装</option>
          </select>
        </label>
        <label class="field full">
          <span>适用工具</span>
          <input value="Codex, Cursor" />
        </label>
      </div>
      <details class="fold" open>
        <summary>上传与预检</summary>
        <div class="fold-body">
          <p>上传入口保留在同一处，但文件清单、SHA 结果和包大小不在首屏平铺。</p>
          <div class="button-row">
            ${button("选择 ZIP", 'data-action="noop"', "ghost-button")}
            ${button("选择文件夹", 'data-action="noop"', "ghost-button")}
            ${button("查看预检", 'data-action="noop"', "ghost-button")}
          </div>
        </div>
      </details>
      <div class="button-row">
        ${button("保存草稿", 'data-action="noop"', "ghost-button")}
        ${button("提交发布", 'data-action="noop"', "ghost-button primary")}
      </div>
    </section>
  `;
}

function renderLibraryPage() {
  const tabs =
    state.mode === "admin"
      ? [
          ["installed", "已安装"],
          ["targets", "工具与项目"],
          ["published", "我发布的"],
          ["publish", "发布 Skill"]
        ]
      : [
          ["installed", "已安装"],
          ["targets", "工具与项目"]
        ];

  let tabContent = renderInstalledTab();
  if (state.libraryTab === "targets") tabContent = renderTargetsTab();
  if (state.libraryTab === "published") tabContent = renderPublishedTab();
  if (state.libraryTab === "publish") tabContent = renderPublishTab();

  return `
    <div class="page-stack">
      <section class="band">
        <div class="page-head">
          <div>
            <div class="eyebrow">我的 Skill</div>
            <h1>把“使用”放前面，把“治理”放后面</h1>
            <p>默认只围绕已安装和启用展开；工具、项目、发布和诊断按需进入，不再同时挤在一页里。</p>
          </div>
          <div class="tabs">
            ${tabs
              .map(
                ([id, label]) => `
                  <button class="chip-button ${state.libraryTab === id ? "active" : ""}" data-library-tab="${id}">
                    ${label}
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
      ${tabContent}
    </div>
  `;
}

function renderNotificationsPage() {
  const groups = {
    action: notifications.filter((item) => item.group === "action"),
    system: notifications.filter((item) => item.group === "system")
  };
  const current = state.notificationsTab === "action" ? groups.action : notifications;

  return `
    <div class="page-stack">
      <section class="band">
        <div class="page-head">
          <div>
            <div class="eyebrow">通知</div>
            <h1>先看影响动作的消息</h1>
            <p>用户消息和系统诊断分层展示；同步与连接类消息默认放到系统组，不跟更新提醒抢位置。</p>
          </div>
          <div class="tabs">
            <button class="chip-button ${state.notificationsTab === "action" ? "active" : ""}" data-notices="action">待处理</button>
            <button class="chip-button ${state.notificationsTab === "all" ? "active" : ""}" data-notices="all">全部</button>
          </div>
        </div>
      </section>
      <section class="band notice-group">
        ${current
          .map(
            (item) => `
              <article class="notice-item">
                <div>
                  <h3>${item.title}</h3>
                  <p>${item.body}</p>
                </div>
                <div class="notice-time">${item.time}</div>
              </article>
            `
          )
          .join("")}
      </section>
      <details class="fold">
        <summary>系统与诊断</summary>
        <div class="fold-body">
          <div class="notice-list">
            ${groups.system
              .map(
                (item) => `
                  <article class="notice-item">
                    <div>
                      <h3>${item.title}</h3>
                      <p>${item.body}</p>
                    </div>
                    <div class="notice-time">${item.time}</div>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </details>
    </div>
  `;
}

function renderAdminPage() {
  const selectedReview = reviewQueue[0];

  return `
    <div class="page-stack">
      <section class="band">
        <div class="page-head">
          <div>
            <div class="eyebrow">管理工作台</div>
            <h1>治理流单独收口，不再混进客户主路径</h1>
            <p>审核、组织和 Skill 治理继续保留完整能力，但与客户侧界面明确分层。</p>
          </div>
          <div class="tabs">
            <button class="chip-button ${state.adminTab === "reviews" ? "active" : ""}" data-admin-tab="reviews">审核队列</button>
            <button class="chip-button ${state.adminTab === "people" ? "active" : ""}" data-admin-tab="people">部门与账号</button>
            <button class="chip-button ${state.adminTab === "skills" ? "active" : ""}" data-admin-tab="skills">Skill 治理</button>
          </div>
        </div>
      </section>

      ${
        state.adminTab === "reviews"
          ? `
            <section class="review-layout">
              <section class="band">
                <div class="section-head">
                  <div>
                    <div class="eyebrow">审核队列</div>
                    <h2>先处理需要决定的单据</h2>
                  </div>
                  <span class="pill info">${reviewQueue.length} 条</span>
                </div>
                <div class="review-list">
                  ${reviewQueue
                    .map(
                      (item, index) => `
                        <article class="queue-item ${index === 0 ? "selected" : ""}">
                          <h3>${item.displayName}</h3>
                          <p>${item.summary}</p>
                          <div class="meta-line">
                            <span>${item.submitter}</span>
                            <span>${item.department}</span>
                            <span>${item.state}</span>
                          </div>
                        </article>
                      `
                    )
                    .join("")}
                </div>
              </section>
              <section class="band">
                <div class="section-head">
                  <div>
                    <div class="eyebrow">当前单据</div>
                    <h2>${selectedReview.displayName}</h2>
                  </div>
                  <span class="pill warning">${selectedReview.state}</span>
                </div>
                <div class="info-grid">
                  <dl><dt>提交人</dt><dd>${selectedReview.submitter}</dd></dl>
                  <dl><dt>部门</dt><dd>${selectedReview.department}</dd></dl>
                  <dl><dt>目标版本</dt><dd>${selectedReview.requestedVersion}</dd></dl>
                  <dl><dt>风险等级</dt><dd>${selectedReview.risk}</dd></dl>
                </div>
                <details class="fold" open>
                  <summary>审核摘要</summary>
                  <div class="fold-body">
                    <p>${selectedReview.latestComment}</p>
                  </div>
                </details>
                <label class="field">
                  <span>审核意见</span>
                  <textarea>补充审核意见、退回原因或通过说明</textarea>
                </label>
                <div class="button-row">
                  ${button("通过", 'data-action="noop"', "ghost-button primary")}
                  ${button("退回", 'data-action="noop"', "ghost-button")}
                  ${button("拒绝", 'data-action="noop"', "ghost-button danger")}
                </div>
              </section>
            </section>
          `
          : ""
      }

      ${
        state.adminTab === "people"
          ? `
            <section class="people-layout">
              <section class="band">
                <div class="section-head">
                  <div>
                    <div class="eyebrow">部门</div>
                    <h2>树状结构只保留关键摘要</h2>
                  </div>
                  ${button("新增部门", 'data-action="noop"', "ghost-button primary")}
                </div>
                <div class="people-grid">
                  ${departments
                    .map(
                      (department) => `
                        <article class="tree-item">
                          <div>
                            <strong>${department.name}</strong>
                            <small>${department.level} · 用户 ${department.users} · Skill ${department.skills}</small>
                          </div>
                          <span>›</span>
                        </article>
                      `
                    )
                    .join("")}
                </div>
              </section>
              <section class="band">
                <div class="section-head">
                  <div>
                    <div class="eyebrow">账号</div>
                    <h2>账号管理</h2>
                  </div>
                  ${button("新增用户", 'data-action="noop"', "ghost-button primary")}
                </div>
                <div class="people-list">
                  ${users
                    .map(
                      (user) => `
                        <article class="people-item">
                          <div class="row-head">
                            <div>
                              <h3>${user.name}</h3>
                              <p>${user.department}</p>
                            </div>
                            <span class="pill ${user.role.includes("管理员") ? "info" : "success"}">${user.role}</span>
                          </div>
                        </article>
                      `
                    )
                    .join("")}
                </div>
              </section>
            </section>
          `
          : ""
      }

      ${
        state.adminTab === "skills"
          ? `
            <section class="band admin-shell">
              <div class="section-head">
                <div>
                  <div class="eyebrow">Skill 治理</div>
                  <h2>列表也先给结论，再给动作</h2>
                </div>
              </div>
              <div class="skill-admin-list">
                ${managedSkills
                  .map(
                    (skill) => `
                      <article class="skill-admin-item">
                        <div class="row-head">
                          <div>
                            <h3>${skill.displayName}</h3>
                            <p>${skill.team}</p>
                          </div>
                          <span class="pill ${skill.status === "已下架" ? "warning" : "info"}">${skill.status}</span>
                        </div>
                        <div class="meta-line">
                          <span>${skill.heat}</span>
                        </div>
                        <div class="button-row">
                          ${button("查看详情", 'data-action="noop"', "mini-button")}
                          ${button(skill.status === "已下架" ? "重新上架" : "下架", 'data-action="noop"', "mini-button")}
                          ${button("归档", 'data-action="noop"', "mini-button danger")}
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
}

function renderPage() {
  if (state.page === "market") return renderMarketPage();
  if (state.page === "library") return renderLibraryPage();
  if (state.page === "notifications") return renderNotificationsPage();
  if (state.page === "admin") return renderAdminPage();
  return renderHomePage();
}

function render() {
  app.innerHTML = `
    <div class="shell">
      ${renderSidebar()}
      <div class="main">
        ${renderTopbar()}
        <main class="content">
          ${renderPage()}
        </main>
      </div>
    </div>
  `;
}

function setPage(page) {
  state.page = page;
  if (page !== "library" && state.libraryTab === "targets" && state.mode === "customer") {
    state.libraryTab = "installed";
  }
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.mode) {
    setMode(target.dataset.mode);
    render();
    return;
  }

  if (target.dataset.nav) {
    setPage(target.dataset.nav);
    if (target.dataset.libraryTab) state.libraryTab = target.dataset.libraryTab;
    render();
    return;
  }

  if (target.dataset.libraryTab) {
    state.libraryTab = target.dataset.libraryTab;
    state.page = "library";
    render();
    return;
  }

  if (target.dataset.adminTab) {
    state.adminTab = target.dataset.adminTab;
    state.page = "admin";
    render();
    return;
  }

  if (target.dataset.marketSkill) {
    state.selectedSkillID = target.dataset.marketSkill;
    if (state.page !== "market") state.page = "market";
    render();
    return;
  }

  if (target.dataset.targetSkill) {
    state.targetSkillID = target.dataset.targetSkill;
    state.page = "library";
    state.libraryTab = "targets";
    render();
    return;
  }

  if (target.dataset.notices) {
    state.notificationsTab = target.dataset.notices;
    render();
    return;
  }

  if (target.dataset.toggle === "market-advanced") {
    state.marketAdvancedOpen = !state.marketAdvancedOpen;
    render();
    return;
  }

  if (target.dataset.action === "reset-filters") {
    state.marketFilters = {
      query: "",
      tool: "all",
      status: "all",
      department: "all",
      sort: "recommended",
      category: "all",
      risk: "all"
    };
    render();
    return;
  }

  if (target.dataset.action === "uninstall") {
    state.selectedSkillID = target.dataset.skill || state.selectedSkillID;
    state.page = "library";
    render();
  }
});

app.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-filter]");
  if (!select) return;
  state.marketFilters[select.dataset.filter] = select.value;
  if (state.page !== "market") state.page = "market";
  render();
});

app.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form='global-search']");
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  state.marketFilters.query = String(formData.get("query") || "");
  state.page = "market";
  render();
});

render();
