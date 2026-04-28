# 需求到实际行为验收测试报告 - 2026-04-19

## 1. 测试范围与结论

本次验收严格以 `docs/RequirementDocument/` 为需求源，重点覆盖：

- `index.md`：真实交付入口、当前实现约束、Windows exe / Linux 服务端交付边界。
- `06_page_architecture.md`：顶栏一级导航、游客优先、管理入口权限、覆盖层规则。
- `15_core_flows.md`：发布、审核、安装、启用、卸载、下架、上架、删除流程。
- `17_interaction_ux.md`：空状态、错误状态、成功提示、确认弹窗、登录触发、离线规则。
- `19_visual_design_system.md`：浅色企业 AI 工作台、信息密度、统一控件、视觉 token。
- 补充读取：`03_roles_permissions.md`、`04_business_rules.md`、`05_lifecycle_states.md`、`07-14`、`16_search_governance.md`。

测试对象没有使用 `ui-prototype`。实际覆盖对象为：

- Desktop 前端：`apps/desktop`
- Tauri 本地能力：`apps/desktop/src-tauri`
- API 服务：`apps/api`
- Full closure / smoke / release gate 脚本：`scripts/verification/*`、`scripts/full-closure/*`、`tests/*`
- Docker/Linux 服务端配置：`infra/docker-compose.prod.yml`、`deploy/*.sh`

总体结论：核心静态编译、单元测试、Rust/Tauri 本地闭环、API 权限控制、基础浏览器 UI 主流程多数通过；但当前 release/smoke 体系存在多处阻塞，Windows 安装包目标未能在当前环境验证，通知多语言存在需求偏差，环境文件安全检查失败，部分旧测试脚本已与真实 UI/文件结构脱节。

## 2. 覆盖矩阵

| ID | 覆盖范围 | 需求来源 | 执行结果 | 主要证据 |
| --- | --- | --- | --- | --- |
| R1 | 真实交付边界，排除 `ui-prototype` | `index.md` | 通过 | 仓库入口确认 `apps/desktop` / `apps/api` / Tauri；未运行 `ui-prototype` |
| R2 | 顶栏导航与覆盖层 | `06_page_architecture.md` | 部分通过 | 浏览器 UI：游客 `主页/社区/本地`，管理员出现 `管理` |
| R3 | 游客、登录、会话状态 | `03`, `06`, `17` | 部分通过 | 登录弹窗可从头像菜单打开；API login/bootstrap 通过；full-closure 登录脚本阻塞 |
| R4 | 社区搜索/筛选/详情/热榜 | `08`, `16` | 部分通过 | mock-Tauri 浏览器 smoke 搜索 `codex` 返回 1 张卡；热榜空态存在 |
| R5 | 安装/更新/download-ticket | `04`, `14`, `15` | 部分通过 | 带 JSON body 的 download-ticket 与 package download 通过；空 body 返回 500 |
| R6 | 本地 Skills/工具/项目/诊断 | `09`, `12`, `15` | 通过（自动化层） | `cargo test` 覆盖 Central Store、enable/disable/uninstall、SQLite restore |
| R7 | 发布中心/文件预览/作者治理 | `09`, `14`, `15` | 阻塞 | `p1:full-closure` 第一个发布审核流超时，后续 5 条未跑 |
| R8 | 审核锁单/同意/退回/拒绝 | `03`, `05`, `10`, `15` | 部分通过 | API admin reviews 返回待审单；full-closure 审核链路未完成 |
| R9 | 管理权限/部门/用户/Skill 管理 | `03`, `11` | 通过（基础） | 普通用户 `/admin/*` 为 403；管理员可访问；UI 管理入口可见 |
| R10 | 通知与设置 | `13`, `17` | 失败项 | 通知面板打开但在 zh-CN 账号下显示英文标题/按钮 |
| R11 | 空/错/成功/确认态 | `17` | 部分通过 | 社区空态、热榜空态、管理详情空态可见；确认弹窗未完整跑通 |
| R12 | 离线/权限不足/会话过期 | `17`, `04` | 部分通过 | 权限不足 API 403；Rust 离线队列/本地恢复测试通过；浏览器断网未完整覆盖 |
| R13 | 视觉设计一致性 | `19` | 部分通过 | 主体符合浅色工作台；通知中英文混排与默认语言规则偏离 |
| R14 | 包规范/SKILL.md/SemVer/hash | `14`, `04` | 通过（自动化/API） | API/unit/native tests；下载 zip 591 bytes |
| R15 | Windows exe / Linux live deploy | `index.md`, `17` | 阻塞/未完成 | macOS 本机 Tauri build 通过；Windows NSIS build 命令当前环境失败 |
| R16 | 验证脚本新鲜度 | 验收要求 | 失败项 | `p1-real-delivery-static` 引用已删除文件；full-closure 引用旧 testid |

## 3. 已执行命令与结果

| 命令 | 结果 | 摘要 |
| --- | --- | --- |
| `npm run check:docs` | 通过 | Documentation structure check passed |
| `npm run check:boundaries` | 通过 | Import boundary check passed |
| `npm run check:env` | 失败 | `infra/env/server.env differs from server.env.example` |
| `npm run lint` | 通过 | API/desktop/shared lint 通过 |
| `npm run typecheck` | 通过 | API/desktop/shared typecheck 通过 |
| `npm test` | 通过 | API 20、Desktop 13、shared 3、tool fixtures 2 均通过 |
| `node --test tests/smoke/p1-acceptance-matrix.test.mjs` | 通过 | 4/4 |
| `node --test tests/smoke/real-admin-workbench-static.test.mjs` | 通过 | 6/6 |
| `node --test tests/smoke/p1-real-delivery-static.test.mjs` | 失败/阻塞 | 脚本读取已删除/迁移文件路径 |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | 通过 | Rust check 通过 |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | 通过 | 52 unit + 1 full_closure test 通过；存在 unused/dead_code warning |
| `docker compose -f infra/docker-compose.prod.yml config` | 通过 | Compose 配置可解析 |
| `bash -n deploy/*.sh` | 通过 | 部署脚本语法通过 |
| `npm run p1:source-live-smoke` | 失败 | `admin missing manage navigation` |
| `npm run p1:live-smoke` | 失败 | 同上 |
| `npm run p1:full-closure` | 失败 | 登录阶段找不到 `data-testid=open-login`，6 条 UI e2e 仅第 1 条运行且超时 |
| `npm run build --workspace @enterprise-agent-hub/api` | 通过 | API build 通过 |
| `npm run build --workspace @enterprise-agent-hub/desktop` | 通过 | Vite build 通过 |
| `npm run tauri:build --workspace @enterprise-agent-hub/desktop` | 通过 | 生成 release binary |
| `npm run tauri:build:windows --workspace @enterprise-agent-hub/desktop` | 失败/环境阻塞 | 当前 macOS Tauri CLI 不接受 `--bundles nsis` |
| `npx tauri build --bundles app` | 失败 | 默认 icon 列表打包 `.app` 失败：`The image format could not be determined` |
| `npx tauri build --bundles app --config '{"bundle":{"icon":["icons/icon.png"]}}'` | 通过 | 临时 PNG-only 配置生成 macOS `.app` |

## 4. 浏览器/桌面交互证据

浏览器 UI 入口：

- 默认真实 dev 入口：`http://127.0.0.1:1420`
- mock-Tauri 验收入口：`http://127.0.0.1:4177`
- API：`http://127.0.0.1:3000`

生成证据：

- `test-results/requirement-behavior-20260418/acceptance-smoke.json`
- `test-results/requirement-behavior-20260418/guest-home.png`
- `test-results/requirement-behavior-20260418/login-modal.png`
- `test-results/requirement-behavior-20260418/normal-community-search.png`
- `test-results/requirement-behavior-20260418/skill-detail.png`
- `test-results/requirement-behavior-20260418/admin-manage.png`
- `test-results/requirement-behavior-20260418/admin-notification-failed.png`

关键交互结果：

- 游客首屏显示 `主页 / 社区 / 本地`，符合游客优先导航。
- 登录弹窗可从头像菜单打开。
- 普通用户登录后顶栏不显示 `管理`。
- 普通用户社区搜索 `codex` 返回 1 张卡，并能打开 Skill 详情。
- 管理员 `frontadmin` 登录后顶栏显示 `管理`，管理页可打开，审核列表显示 1 条待审单。
- 通知铃铛可打开面板，但在 zh-CN 账号下显示英文 `Notifications / All / Unread / Mark All Read`。

Tauri 桌面：

- `cargo test` 覆盖安装、启用、重启恢复、卸载同一已发布 Skill 的 native closure。
- `tauri build` 本机 release binary 构建成功：`apps/desktop/src-tauri/target/release/enterprise-agent-hub-desktop`。
- 默认 `npx tauri build --bundles app` 打包失败在 icon 生成；使用临时 CLI config 仅保留 `icons/icon.png` 后 `.app` 打包成功。
- `.app` 启动后 Computer Use 可识别 `Enterprise Agent Hub` 窗口。
- 使用 Computer Use 真实点击头像菜单、打开登录弹窗、输入 `superadmin/demo123`，登录成功；顶栏出现 `管理`，头像显示 `系统管理员 Admin L1`。
- 进入 `管理` 后显示 `审核 / Skills / 部门 / 用户`；`superadmin` 下审核列表为 0。随后 Computer Use 对窗口再次操作时返回 `cgWindowNotFound`，System Events 显示该 app 进程仍存在但窗口数为 0，需复测稳定性。

## 5. 问题清单

### EAH-QA-001

- 严重程度：阻塞
- 问题类型：状态同步问题 / 验收脚本失真
- 所属模块/页面：Full closure UI e2e / 登录 / 发布审核闭环
- 对应需求文档与章节：`index.md` 交付入口口径；`06_page_architecture.md` 7.1/7.2；`15_core_flows.md` 10.1、10.8、10.9
- 前置条件：运行 `npm run p1:full-closure`
- 复现步骤：
  1. 在仓库根目录执行 `npm run p1:full-closure`。
  2. 等待 Playwright 第 1 条 happy path。
- 期望结果：完成发布、审核、市场展示、可安装入口等 full closure 场景。
- 实际结果：第 1 条测试在 `getByTestId('open-login')` 等待 180 秒后超时；后续 5 条未运行。
- 证据：
  - 终端：`Test timeout of 180000ms exceeded`
  - 终端：`waiting for getByTestId('open-login')`
  - 截图：`test-results/full-closure/fc-1776531732047/playwright-output/full-closure-happy-path-pu-a9064-installable-market-artifact/test-failed-1.png`
  - 代码：`tests/full-closure/ui/full-closure.spec.ts:396`
  - 真实 UI：登录入口在头像菜单中，当前代码未提供 `data-testid=open-login`
- 初步原因判断：UI 已重构为顶栏头像菜单登录，但 full-closure 测试仍绑定旧 testid；此外 full closure 启动 Vite 时只设置 `VITE_DESKTOP_API_BASE_URL`，未设置 `VITE_P1_ALLOW_TAURI_MOCKS=true`，浏览器环境无法完整模拟 Tauri 本地 bootstrap。
- 修复建议：更新 e2e 登录 helper，优先用 role/文本定位头像菜单登录；full-closure 浏览器模式显式设置 `VITE_P1_ALLOW_TAURI_MOCKS=true`，或改为真实 Tauri 驱动；恢复 full closure 后再跑 6 条场景。

### EAH-QA-002

- 严重程度：高
- 问题类型：状态同步问题 / 验收脚本失真
- 所属模块/页面：Live smoke / Admin navigation
- 对应需求文档与章节：`06_page_architecture.md` 7.1、7.3；`03_roles_permissions.md` 4.3
- 前置条件：API 服务运行在 `http://127.0.0.1:3000`
- 复现步骤：
  1. 执行 `npm run p1:live-smoke` 或 `npm run p1:source-live-smoke`。
  2. smoke 使用 `superadmin` 登录并校验 bootstrap navigation。
- 期望结果：live smoke 与当前 IA 契约一致，通过管理员权限检查。
- 实际结果：smoke 失败：`admin missing manage navigation`。
- 证据：
  - 终端：`P1 live smoke FAIL admin missing manage navigation`
  - API bootstrap 实际返回：`navigation/menuPermissions` 包含 `review/admin_departments/admin_users/admin_skills`，不包含 top-level `manage`
  - 前端代码：`apps/desktop/src/state/useDesktopUIState.ts:71` 根据 `isAdminConnected` 派生 top-level `manage`
  - 前端代码：`apps/desktop/src/state/workspace/workspaceDerivedState.ts:170` 使用 admin menu permissions 判断管理员连接
- 初步原因判断：后端契约仍返回细粒度菜单权限，前端再聚合为顶栏 `管理`；live smoke 仍把 `manage` 当后端 navigation item，和新 IA 分层不一致。
- 修复建议：更新 `scripts/verification/p1-live-smoke.mjs`，改为校验后端返回 `review/admin_*` 和 `features.adminManage=true`；若产品决定后端也必须返回 `manage`，则同步更新 shared contracts、API 和前端映射。

### EAH-QA-003

- 严重程度：高
- 问题类型：功能 bug / 验收资产问题
- 所属模块/页面：P1 real delivery static smoke
- 对应需求文档与章节：`index.md` 交付入口口径；`06_page_architecture.md` 顶栏导航新结构
- 前置条件：运行 `node --test tests/smoke/p1-real-delivery-static.test.mjs`
- 复现步骤：
  1. 执行该 static smoke。
  2. 测试启动时读取多个源码文件。
- 期望结果：static smoke 能在当前真实代码结构上运行。
- 实际结果：脚本引用已删除/迁移文件，命令无法完成。
- 证据：
  - 代码引用：`tests/smoke/p1-real-delivery-static.test.mjs:26` `apps/desktop/src/ui/desktopPages.tsx`
  - 代码引用：`tests/smoke/p1-real-delivery-static.test.mjs:27` `apps/desktop/src/ui/desktopModals.tsx`
  - 代码引用：`tests/smoke/p1-real-delivery-static.test.mjs:28-30` `apps/desktop/src/ui/pages/*`
  - 实际文件已迁移到 `apps/desktop/src/ui/desktopSections.tsx`、`apps/desktop/src/ui/desktopOverlays.tsx`、`apps/desktop/src/ui/pageCommon.tsx`
- 初步原因判断：UI 重构后静态 smoke 未同步，导致 release-gate 不能提供可信结论。
- 修复建议：重写该 static smoke 的文件映射与断言，覆盖新 section/overlay/pageCommon 结构；避免读取不存在文件作为前置。

### EAH-QA-004

- 严重程度：高
- 问题类型：接口异常 / 发布安全风险
- 所属模块/页面：环境配置与 release gate
- 对应需求文档与章节：`index.md` 服务端 Linux 部署；`17_interaction_ux.md` 非功能性体验要求
- 前置条件：运行 `npm run check:env`
- 复现步骤：
  1. 执行 `npm run check:env`。
- 期望结果：环境安全检查通过，真实运行值不被纳入可提交工作区。
- 实际结果：失败：`infra/env/server.env differs from server.env.example. Real runtime values must not be committed.`
- 证据：
  - 终端输出如上
  - 文件：`infra/env/server.env`
- 初步原因判断：本地真实运行 env 与 example 不一致且位于仓库工作区，release gate 视为安全/交付风险。
- 修复建议：将真实运行 env 移出可提交范围或加入明确忽略策略；保留 `server.env.example` 作为模板；部署脚本从安全位置读取实际 env。

### EAH-QA-005

- 严重程度：中
- 问题类型：UI 问题 / 需求偏差
- 所属模块/页面：通知面板 / 多语言
- 对应需求文档与章节：`13_page_notify_settings.md` 8.8；`17_interaction_ux.md` 14.2；`19_visual_design_system.md` 19.3/19.4
- 前置条件：使用 `frontadmin` 登录，账号 locale 为 `zh-CN`
- 复现步骤：
  1. 登录管理员。
  2. 点击顶栏通知铃铛。
- 期望结果：通知面板标题为 `通知`，切换按钮为 `全部 / 未读 / 全部已读`。
- 实际结果：面板显示英文 `Notifications / All / Unread / Mark All Read`。
- 证据：
  - 截图：`test-results/requirement-behavior-20260418/admin-notification-failed.png`
  - 代码：`apps/desktop/src/ui/NotificationPopover.tsx:67-93` 使用 `localize`
  - 代码：`apps/desktop/src/state/ui/useDesktopPreferences.ts:30-34` 优先使用 `navigator.language`，其次才使用账号 `fallbackLocale`
- 初步原因判断：自动语言识别优先读取浏览器/系统语言，在 Playwright 环境中为 en-US，即使账号 locale 为 zh-CN 也显示英文。
- 修复建议：明确产品默认语言优先级：若已登录，优先账号 locale；未登录再使用系统/navigator；同时为品牌副标题、通知类型、按钮等统一走本地化。

### EAH-QA-006

- 严重程度：中
- 问题类型：接口异常
- 所属模块/页面：`POST /skills/:skillID/download-ticket`
- 对应需求文档与章节：`15_core_flows.md` 10.9；`14_skill_spec.md` 9.4/9.5
- 前置条件：API 服务运行，普通用户 `demo` 登录
- 复现步骤：
  1. 登录 `demo/demo123` 获取 token。
  2. 不带 body 调用 `POST /skills/codex-review-helper/download-ticket`。
- 期望结果：若 body 可选，应默认当前版本；若 body 必填，应返回 400 `validation_failed`。
- 实际结果：返回 500 `server_unavailable`。
- 证据：
  - 终端：`500 {"error":{"code":"server_unavailable","message":"服务端暂时不可用","retryable":true}}`
  - 代码：`apps/api/src/skills/skills.controller.ts:24-30`
  - 代码：`apps/api/src/skills/package-download.service.ts:42` 读取 `request.targetVersion`
  - 对照：带 JSON body `{purpose:"install", targetVersion:"1.2.0"}` 时返回 201，下载 zip 返回 200 / 591 bytes
- 初步原因判断：`@Body()` 在空 body 请求下为 `undefined`，service 未做默认值或 DTO 校验，触发未捕获异常后被全局 filter 转成 500。
- 修复建议：controller 对 body 默认 `{}`，或加 DTO validation；缺 body 时不要返回 500。

### EAH-QA-007

- 严重程度：中
- 问题类型：需求偏差 / 交付阻塞
- 所属模块/页面：Windows 安装包构建
- 对应需求文档与章节：`index.md` 当前实现约束、客户端交付
- 前置条件：macOS 当前环境
- 复现步骤：
  1. 执行 `npm run tauri:build:windows --workspace @enterprise-agent-hub/desktop`。
- 期望结果：生成或至少进入 Windows NSIS 目标构建链路。
- 实际结果：当前 Tauri CLI 返回：`invalid value 'nsis' for '--bundles [<BUNDLES>...]' [possible values: ios, app, dmg]`。
- 证据：
  - 终端输出如上
  - 脚本：`apps/desktop/package.json` `tauri:build:windows`
- 初步原因判断：当前在 macOS 环境不能验证 Windows NSIS 构建；脚本本身是 Windows 目标脚本，缺少平台保护和替代说明。
- 修复建议：在 Windows CI/目标机执行并保存产物证据；在脚本或文档中标注平台前置条件；若需要跨平台验收，应增加专用 CI lane。

### EAH-QA-008

- 严重程度：建议优化
- 问题类型：体验优化 / 技术债
- 所属模块/页面：Tauri Rust 层
- 对应需求文档与章节：`12_page_tool_project.md` 工具/项目/诊断；`15_core_flows.md` 安装启用闭环
- 前置条件：运行 `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- 复现步骤：
  1. 执行 cargo test。
- 期望结果：测试通过且 warning 可控。
- 实际结果：测试通过，但存在 unused import、dead code warning，例如 `AdapterResult`、`enable_artifact`、多个 `as_str`。
- 证据：
  - 终端 warning 输出
  - 文件：`apps/desktop/src-tauri/src/adapters/mod.rs`
  - 文件：`apps/desktop/src-tauri/src/adapters/distribution.rs`
- 初步原因判断：本地能力重构后部分导出/函数暂未使用。
- 修复建议：清理未使用导出或补充未来预留注释；若是明确扩展点，可集中 suppress 并说明。

### EAH-QA-009

- 严重程度：高
- 问题类型：功能 bug / 交付阻塞
- 所属模块/页面：macOS app bundle / Tauri icons
- 对应需求文档与章节：`index.md` 客户端交付；`19_visual_design_system.md` 图标系统
- 前置条件：当前 macOS 环境，执行 `.app` 打包
- 复现步骤：
  1. 进入 `apps/desktop`。
  2. 执行 `npx tauri build --bundles app`。
- 期望结果：成功生成 `Enterprise Agent Hub.app`。
- 实际结果：默认配置打包失败：`Failed to create app icon: The image format could not be determined`。
- 证据：
  - 终端输出如上
  - 默认 icon 配置：`apps/desktop/src-tauri/tauri.conf.json`
  - 临时绕过：`npx tauri build --bundles app --config '{"bundle":{"icon":["icons/icon.png"]}}'` 成功
  - `file apps/desktop/src-tauri/icons/*` 显示 PNG/ICO/SVG 均存在，但 bundler 对默认列表失败
- 初步原因判断：默认 bundle icon 列表中的某个格式在 macOS bundler 路径下不可接受或解析异常；PNG-only 可以生成 `.app`。
- 修复建议：按 Tauri macOS bundle 要求重新生成 icon set，或为 macOS 使用 platform-specific config 只引用可解析的 PNG/ICNS；将 `.app` 打包纳入 CI smoke。

### EAH-QA-010

- 严重程度：中
- 问题类型：功能 bug / 状态同步问题
- 所属模块/页面：真实桌面窗口 / 管理页
- 对应需求文档与章节：`06_page_architecture.md` 7.1/7.3；`11_page_manage.md` 管理；`03_roles_permissions.md` 4.2.3
- 前置条件：通过临时 PNG-only config 生成并打开 `Enterprise Agent Hub.app`
- 复现步骤：
  1. 使用 Computer Use 打开真实 `.app`。
  2. 点击头像菜单 -> 登录。
  3. 输入 `superadmin/demo123`。
  4. 登录成功后点击 `管理`。
- 期望结果：一级管理员稳定进入管理工作台，并能看到其全局管理范围内应可处理/查看的数据。
- 实际结果：登录成功，顶栏出现 `管理`，但审核列表计数为 0；继续点击管理子入口时 Computer Use 返回 `cgWindowNotFound`，System Events 显示该 app 进程仍存在但窗口数为 0。
- 证据：
  - Computer Use state：登录后 `系统管理员 Admin L1`，顶栏 `管理`
  - Computer Use state：管理页 `审核 / Skills / 部门 / 用户`，审核 0
  - API 对照：`frontadmin` 调 `/admin/reviews` 返回 1 条，`superadmin` 调 `/admin/reviews` 返回 `[]`
  - System Events：`frontmost false, visible true, 0 windows`（PID 11329）
- 初步原因判断：一级管理员的审核范围与“全局管理员/跨部门治理职责”存在需求解释风险；窗口丢失可能是 `.app`/Tauri runtime 稳定性或本轮构建/多实例冲突导致，需要独立复测。
- 修复建议：产品先明确一级管理员是否应看到所有待审单；若是，调整 admin review query scope。对 `.app` 窗口丢失增加 crash/log 捕获，并在单实例干净环境复跑 Computer Use 点击。

## 6. 已确认通过的关键行为

- `apps/desktop` 是真实前端入口，`ui-prototype` 未作为验收对象。
- 游客首屏不被全屏登录阻断，进入 `主页`，顶栏有 `主页 / 社区 / 本地`。
- 普通用户登录 API 成功，bootstrap 不包含管理权限。
- 管理员登录 API 成功，bootstrap 包含 `review/admin_departments/admin_users/admin_skills` 和 `adminManage=true`。
- 普通用户访问 `/admin/users`、`/admin/reviews` 返回 403；管理员访问返回 200。
- `/skills?q=codex` 对普通用户返回 `codex-review-helper`。
- 带规范 body 的 download-ticket 返回 201，并可下载 zip 包。
- Rust/Tauri 本地层的 install/enable/restart/uninstall native closure 通过。
- Desktop production build 和 macOS release binary build 通过。
- Docker Compose prod config 可解析，deploy shell 脚本语法通过。

## 7. 未完成项与阻塞点

- Windows exe / NSIS 安装包没有在 Windows 目标环境完成验收。
- macOS `.app` 默认打包因 icon 失败；已用临时 PNG-only config 绕过生成可点击 app，但正式配置仍需修复。
- Linux live 部署没有执行完整 `deploy/server-up.sh` 到健康态，只完成 Compose config 与当前本地 API/DB/MinIO/Redis 联调。
- Full closure UI e2e 阻塞，发布、审核、退回、拒绝、权限变更、版本更新 6 条浏览器主链未形成完整通过证据。
- 真实 Tauri 桌面窗口点击已补充：Computer Use 成功登录 `superadmin/demo123` 并进入管理；但管理子入口继续操作时窗口丢失，需要复测。
- 离线/断网、会话过期、确认弹窗全量场景只覆盖到自动化/局部证据，未完成逐项手动 UI 验收。

## 8. 建议优先级

1. 先修复验收脚本失真：`p1:full-closure`、`p1:live-smoke`、`p1-real-delivery-static`，否则 release gate 不能可信使用。
2. 补 Windows CI/目标机安装包验收，产出 exe/NSIS 路径、安装、启动、登录、bootstrap 证据。
3. 修复通知/语言默认规则，避免 zh-CN 账号下英文面板。
4. 修复 download-ticket 空 body 500，至少返回 400 或默认当前版本。
5. 清理 env 文件交付风险，确保真实运行值不进入可提交工件。
