# Web MVP 历史交付与开发总结报告

**本报告旨在向团队中的其他 Agent 和开发者简述 Agent Hub React Web MVP 的历史完成状态。**

> 当前版本边界（Windows-first intranet Desktop production）：`apps/desktop` 是本轮唯一维护的产品/演示入口；`apps/web` 仅作为早期内存运行时 MVP 的历史记录保留，不应再被描述为当前版本的产品 UI、演示 UI、参考 UI 或发布验收依赖。发布/审核相关能力本轮保留为后端回归测试，不作为 Desktop 发布 UX/退出条件。

## 📌 核心文件变动清单：

**1. 项目前端环境初始化与工程化：**
- 修改了 `apps/web/package.json`（增加了 `vite`, `react`, `antd`, `zustand`, `@tanstack/react-query`, `lucide-react` 以及预编译依赖）。
- 新建了 `apps/web/vite.config.js`，且由于底层的 `workflow.js` 有使用 `node:crypto` 的依赖，配置了 `vite-plugin-node-polyfills` 进行 Node 兼容补丁注入。
- 新建了 `apps/web/index.html` 外壳与 `apps/web/src/main.jsx` 环境入口页。

**2. 前端架构与适配层：**
- `apps/web/src/adapters/mockService.js`：将后端的模拟内存流程封装为了能由 UI 使用的异步适配器（包含针对 phase 1, phase 2 的鉴权、提交单据、查询动作）。
- `apps/web/src/stores/useAuthStore.js`：借助 `Zustand`，记录全局状态中的登录用户体系并作路由守卫拦截。

**3. Apple Style UI 布局（CSS 变量与定制框架）：**
- `apps/web/src/styles/theme.js`：重写了 Ant Design 的底层 Token，引入圆角、高阴影以及 macOS 默认的 Inter/SF-pro 文本栈。
- `apps/web/src/styles/global.css`：引入了 `.glass-sidebar` 以及 `.glass-panel` 毛玻璃毛面材质布局（模糊及半透明背景实现）。
- `apps/web/src/layouts/AppLayout.jsx`：真正的核心 App Shell，使用带有细边框的磨砂玻璃侧边导航菜单顶栏。

**4. 实现的所有业务模块的落地：**
- `apps/web/src/pages/Login.jsx`（包含了完整的登录流并拥有漂亮的全屏质感和拟物组件）
- `apps/web/src/pages/Home.jsx`（包含当前系统大纲与统计状态）
- `apps/web/src/pages/Market.jsx`（应用市场以及搜索列表）
- `apps/web/src/pages/MySkill.jsx`（自有应用展示与发布 Modal 控制台）
- `apps/web/src/pages/Review.jsx`（工单的接单与审核功能）
- `apps/web/src/pages/Notifications.jsx`（状态模拟横幅及订阅）
- `apps/web/src/pages/UserManagement.jsx`（用户大表管理）
- `apps/web/src/pages/SkillManagement.jsx`（全平台技能控制总览）
- `apps/web/src/pages/Placeholder.jsx`（用于承载工具、项目、设置项等的占位展示）。

**5. 关联的说明文档更新：**
- 更新了根目录 `README.md` 以补充提供 React MVP 并介绍命令方法。
- 更新了 `docs/phase-1-2-review.md`，将前端 UI 从纯配置/占位符更新为了 “前端 Mock MVP 落地状态”。
- 建构了新的前端解读文档 `docs/frontend-mvp-implementation.md`。

---

## ✨ 当前版本如何使用本报告：
本报告只用于理解早期 Web MVP 的历史实现与设计取舍。当前 Windows-first 内网生产版本的运行、演示与验收应使用根目录 `README.md` 和 `docs/desktop-release-runbook.md` 中的 Desktop 路径。

请不要把 `apps/web` 运行命令写入当前版本发布说明或验收清单；如需重启 Web 产品方向，必须先由后续 PRD 明确改变 `apps/web` 的非产品边界。

---

## ⚙️ 技术取舍说明：
1. **Mock 环境的复用与兼容**：保留了旧有原生模块加载模拟 `data/workflows` 代码，而通过 `mockService.js` 中引入 `Zustand` 与 `Tanstack Query` 让前端具备状态机管理模式。未来的扩展只需要替换 Axios 发送请求逻辑即可解耦完成演进。
2. **渐进式 Apple Style 设计与重写**：原生 Ant Design 直接适配 Apple 设计太过于生硬。我们剥离了系统默认字体栈，覆盖了大量的底色/字色以及去掉了高亮与线框。整体交互上结合 Glassmorphism 手绘的侧边导航及背景模糊极大地提升了系统的设计气质（同时保留了如表格、弹窗这类的基础支撑）。

## ✅ 对后续 Agent 的交接提示：
- 当前版本的新 UI/文案/验收工作应落在 `apps/desktop` 与 Desktop runbook。
- `apps/web` 可以继续作为历史代码和回归上下文存在，但不得被新文档重新提升为当前产品/演示/参考入口。
- 本文提到的市场、审核、发布交互代表历史 Web MVP；本轮 Desktop 发布只要求 login、connection status、My Skill、market/search/browse、notifications/status。
