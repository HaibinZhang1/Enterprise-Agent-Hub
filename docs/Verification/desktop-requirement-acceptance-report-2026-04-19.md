# Enterprise Agent Hub 桌面端需求到实际行为验收报告

- 日期：2026-04-19
- 测试对象：真实 Tauri 桌面端 `Enterprise Agent Hub`，bundle id `com.enterpriseagenthub.desktop`
- 测试入口：`/Users/zhb/Documents/MyProjects/EnterpriseAgentHub/apps/desktop/src-tauri/target/release/bundle/macos/Enterprise Agent Hub.app`
- 服务端：`http://127.0.0.1:3000` Docker Compose live API
- 登录账号：`superadmin / demo123`，补充权限对照账号 `demo / demo123`
- 明确排除：`ui-prototype/`，未作为交付物或验收入口
- 主要证据目录：`docs/Verification/evidence-2026-04-19/`

> 说明：macOS `screencapture` 在当前环境返回 `could not create image from display`，因此本次截图证据以 Computer Use 实时可访问性树和会话内截图为主，文件证据以 API 响应、自动冒烟日志、代码定位为主。

## 1. 测试计划与覆盖矩阵

| 阶段 | 需求来源 | 覆盖项 | 结果 |
|---|---|---|---|
| 入口与游客态 | `index.md`, `06_page_architecture.md`, `07_page_home.md` | 真实桌面入口、主页、顶栏、游客入口、主页提交跳社区 | 通过，发现局部状态同步问题 |
| 登录与权限 | `03_roles_permissions.md`, `06_page_architecture.md`, `17_interaction_ux.md` | superadmin 登录、管理入口、普通用户权限 API 对照 | 部分通过，存在会话/离线状态问题 |
| 社区发现 | `08_page_market.md`, `16_search_governance.md` | 搜索、空状态、卡片、热榜、详情 | 部分通过，存在覆盖层/文案/i18n 问题 |
| 安装与启用 | `15_core_flows.md`, `09_page_myskill.md`, `12_page_tool_project.md` | 已安装状态、本地 Central Store、启用范围、工具/项目 | 启用流程阻塞 |
| 发布中心 | `09_page_myskill.md`, `14_skill_spec.md`, `15_core_flows.md` | 表单、zip/文件夹上传、预检查、提交前置 | 部分通过，发布入口形态与需求冲突，校验反馈不足 |
| 管理与审核 | `10_page_review.md`, `11_page_manage.md`, `03_roles_permissions.md` | 审核空状态、Skills、部门、用户 | 读取通过，破坏性动作未执行 |
| 通知与设置 | `13_page_notify_settings.md`, `17_interaction_ux.md` | 通知、全部已读、设置模态、Central Store | 功能部分通过，中文/i18n 不一致 |
| 离线/恢复 | `17_interaction_ux.md` | API 断开、本地可用、远端操作禁用、恢复 | 本地可用通过，管理入口隐藏不符合要求 |
| 视觉系统 | `19_visual_design_system.md` | 浅色工作台、层级、密度、按钮状态、文案一致性 | 部分通过，多处英文/拥挤/状态不清 |

## 2. 执行记录摘要

1. 启动真实 Tauri 桌面端，确认窗口标题 `Enterprise Agent Hub`，URL 为 `tauri://localhost`。
2. 游客态默认进入 `Agent 探索`，顶栏展示 `主页 / 社区 / 本地`，管理入口默认不可见。
3. 使用 `superadmin / demo123` 登录，成功后顶栏显示 `系统管理员 Admin L1`，管理入口可见。
4. 在主页输入 `review` 并发送，自动跳转 `社区 > Skill`，搜索框保留查询。
5. 社区搜索空结果、热榜空状态、Skill 卡片、详情页面、收藏状态均已点击验证。
6. 已安装 Skill 的启用范围弹窗打开成功，选择 Codex 后执行启用，流程卡住在本地写入阶段。
7. 本地 `Skills / 工具 / 项目 / 诊断` 可访问，工具扫描和项目诊断可展示本地目录发现。
8. 通知面板可打开并执行全部已读；设置模态可打开并展示 Central Store 路径。
9. 发布页可填写基础信息，可上传 zip 和文件夹；文件夹预检查可识别 `SKILL.md`。
10. 管理页可进入审核、Skills、部门、用户；读取真实 API 数据。
11. 停止 API 容器模拟离线：本地页可浏览，远端动作出现连接失败提示；恢复 API 成功。
12. 补充 API 证据：superadmin bootstrap/admin 数据、demo 普通用户权限 403。
13. 补充自动化证据：`npm run p1:live-smoke` 失败，错误为 `admin missing manage navigation`。

## 3. 缺陷清单

### EAH-QA-001
- 严重程度：中
- 问题类型：需求偏差 / UI 问题
- 所属模块/页面：社区 Skill 详情
- 对应需求文档与章节：`06_page_architecture.md` 7.2 覆盖层规则；`08_page_market.md` Skill 详情
- 前置条件：superadmin 已登录，社区存在 Skill
- 复现步骤：
  1. 进入 `社区 > Skill`
  2. 点击 `Codex Review Helper` 卡片
- 期望结果：Skill 详情以覆盖层展示，保留当前社区上下文。
- 实际结果：详情以整页/舞台页形式替换社区内容，顶部出现 `返回社区`。
- 证据：Computer Use 状态中出现 `返回社区` 和 `Codex Review Helper` 详情页；代码位置 `apps/desktop/src/ui/desktopSections.tsx:902`、`apps/desktop/src/ui/DesktopApp.tsx:170`。
- 初步原因判断：当前实现同时存在 overlay 版和 stage 版详情，但主入口走了 `SkillDetailStage`。
- 修复建议：社区/本地入口统一走 `SkillDetailOverlay`，或同步修订需求文档；不要同时保留两套详情交互语法。

### EAH-QA-002
- 严重程度：中
- 问题类型：功能 bug / 体验优化
- 所属模块/页面：登录模态
- 对应需求文档与章节：`17_interaction_ux.md` 12.2 会话/登录错误提示；12.5 登录弹窗触发规则
- 前置条件：退出登录后打开登录模态
- 复现步骤：
  1. 打开登录模态
  2. 使用辅助设置方式给密码框写入 `demo123`
  3. 点击登录
- 期望结果：表单模型读取到密码值并发起登录，或密码框不展示假值。
- 实际结果：密码框显示圆点，但点击登录提示 `账号或密码不能为空`。
- 证据：Computer Use 状态显示 `secure text field 密码 Value: •••••••` 后仍出现 `账号或密码不能为空`。
- 初步原因判断：React 受控输入没有收到真实 input/change 事件，显示层与表单状态不同步。
- 修复建议：统一通过 `onInput`/`onChange` 维护表单值，避免仅 DOM value 改变；补充表单自动化/a11y 输入测试。

### EAH-QA-003
- 严重程度：高
- 问题类型：状态同步问题
- 所属模块/页面：全局会话、社区
- 对应需求文档与章节：`17_interaction_ux.md` 12.5 会话失效规则；14.3 信息一致性
- 前置条件：superadmin 已登录，社区页面可见
- 复现步骤：
  1. 登录 superadmin
  2. 在主页提交 `review` 跳转社区
  3. 清空/修改社区搜索条件
- 期望结果：身份维持 `系统管理员 Admin L1`，管理入口持续可见，除非服务端返回 401。
- 实际结果：测试中多次观察到顶栏短暂/直接退回 `本地模式 Local Mode`，管理入口消失，数据退回本机缓存；后续又可能恢复管理员态。
- 证据：Computer Use 状态先显示 `系统管理员 Admin L1`，随后搜索操作后显示 `本地模式 Local Mode` 和本地缓存卡片。
- 初步原因判断：远端列表刷新、guest bootstrap 初始化或错误处理互相覆盖了 auth/bootstrap 状态。
- 修复建议：为 auth 状态增加单一来源；远端 market 刷新失败不应直接覆盖用户态，只有 401 才清会话。

### EAH-QA-004
- 严重程度：高
- 问题类型：功能 bug / 状态同步问题
- 所属模块/页面：安装后启用范围
- 对应需求文档与章节：`15_core_flows.md` 10.9 安装与启用流程；`17_interaction_ux.md` 12.3 成功提示
- 前置条件：`Codex Review Helper` 已安装，Codex 目标检测为可用
- 复现步骤：
  1. 打开 Skill 详情
  2. 点击 `启用范围`
  3. 勾选 `Codex /Users/zhb/.codex/skills`
  4. 点击 `应用目标`
- 期望结果：写入 Codex skills 目录，显示启用成功，本地和市场状态实时变更为已启用。
- 实际结果：界面停留在 `正在调用 Tauri Adapter 启用 Skill`，无成功/失败反馈；`/Users/zhb/.codex/skills` 下未出现对应 Skill。
- 证据：Computer Use 状态 `enable · codex-review-helper` 持续 running；终端检查 `/Users/zhb/.codex/skills` 未找到 `codex-review-helper`。
- 初步原因判断：`workspace.enableSkill` 未捕获 Tauri invoke 失败或 invoke promise 未返回，`applyTargetDrafts` 没有超时/错误收敛。
- 修复建议：为 `enableSkill` 增加 try/catch、超时和失败提示；本地命令层返回结构化错误；成功后强制刷新 local bootstrap 和 scan。

### EAH-QA-005
- 严重程度：中
- 问题类型：UI 问题 / 视觉偏差
- 所属模块/页面：启用范围弹窗
- 对应需求文档与章节：`19_visual_design_system.md` 19.6 工作台页；19.9 Inspector 卡；`17_interaction_ux.md` 12.2 路径无效提示
- 前置条件：打开 `Codex Review Helper` 启用范围
- 复现步骤：
  1. 点击 `启用范围`
  2. 查看目标列表
- 期望结果：目标名称、路径、检测状态层级清晰，长路径不拥挤、不重叠。
- 实际结果：弹窗内目标卡片两列布局拥挤，路径与状态文字粘连，右侧内容被截断。
- 证据：Computer Use 截图中 `Codex /Users/zhb/.codex/skills detected` 文案粘连，右侧列超出可读范围。
- 初步原因判断：目标列表使用固定宽度双列布局，长路径没有分行/等宽截断策略。
- 修复建议：目标卡片改为单列或响应式 grid；路径用等宽、换行或中间省略；状态单独 badge。

### EAH-QA-006
- 严重程度：高
- 问题类型：需求偏差
- 所属模块/页面：发布中心
- 对应需求文档与章节：`06_page_architecture.md` 7.2/7.5 覆盖层规则；`09_page_myskill.md` 8.3 发布中心覆盖层
- 前置条件：superadmin 已登录，进入社区
- 复现步骤：
  1. 点击左侧 `发布`
  2. 查看发布工作区
- 期望结果：发布中心通过覆盖层工作台承载。
- 实际结果：发布功能是社区内嵌页，并且页面文案明确写着 `不再弹出独立发布中心`。
- 证据：Computer Use 状态 `发布 在社区内部直接起草发布、更新和权限变更，不再弹出独立发布中心。`；代码位置 `apps/desktop/src/ui/desktopSections.tsx:516`、`apps/desktop/src/ui/desktopSections.tsx:777`。
- 初步原因判断：实现口径与当前需求文档相反，可能是设计迭代未同步。
- 修复建议：若当前需求仍以覆盖层为准，恢复覆盖层入口；若内嵌页为新决策，先同步 `docs/RequirementDocument/`。

### EAH-QA-007
- 严重程度：中
- 问题类型：体验优化 / 功能 bug
- 所属模块/页面：发布表单与包校验
- 对应需求文档与章节：`09_page_myskill.md` 8.3.3 发布 Skill；`14_skill_spec.md` 9.5 上传校验规则
- 前置条件：发布表单已填写基础信息，选择测试 zip 或文件夹
- 复现步骤：
  1. 填写 skillID、显示名、描述、版本、标签、适用工具、适用系统
  2. 选择 zip 包
  3. 再选择包含 `SKILL.md` 的文件夹
  4. 尝试进入最终确认
- 期望结果：系统解析 `SKILL.md`，明确指出缺失的必填字段，合法包能继续提交。
- 实际结果：zip 只显示 `SKILL.md 待判定`；文件夹可通过 SKILL.md/大小/文件数校验，但 `下一步` 不可用时没有说明是 `变更说明` 等必填项缺失。
- 证据：Computer Use 状态显示 `包含的文件清单 (2)`、`存在 SKILL.md 通过`，但 `button (disabled) 下一步：最终确认`；代码位置 `apps/desktop/src/state/ui/publishPrecheck.ts:49`。
- 初步原因判断：`canSubmit` 依赖 `changelog` 等字段，但 UI 没有把缺失项纳入预检查结果；zip 深层校验尚未接入。
- 修复建议：预检查列表加入所有阻塞项；zip 选择后由 Tauri/后端解压检查；禁用按钮旁显示具体阻塞原因。

### EAH-QA-008
- 严重程度：中
- 问题类型：UI 问题 / 需求偏差
- 所属模块/页面：社区、通知、设置、管理
- 对应需求文档与章节：`17_interaction_ux.md` 14.2 多语言；`13_page_notify_settings.md` 通知与设置；`19_visual_design_system.md` 19.4 文案约束
- 前置条件：默认中文环境
- 复现步骤：
  1. 查看社区卡片
  2. 打开通知面板
  3. 打开设置模态
- 期望结果：默认中文文案一致，状态词和操作词统一。
- 实际结果：多处英文混入：`Installed`、`Blocked`、`Not Installed`、`Leaderboard`、`Notifications`、`Mark All Read`、`Settings`、`Classic/Fresh/Contrast`、`Public Installable`。
- 证据：Computer Use 状态和截图；代码位置 `apps/desktop/src/ui/NotificationPopover.tsx:67`、`apps/desktop/src/ui/desktopOverlays.tsx:490`、`apps/desktop/src/ui/desktopShared.tsx:122`。
- 初步原因判断：`ui.language` 默认或 localize 入口没有统一生效，部分枚举标签仍走英文 fallback。
- 修复建议：默认语言按地区或系统设置解析为 `zh-CN`；所有枚举和状态 badge 走同一 `localize`/label map。

### EAH-QA-009
- 严重程度：高
- 问题类型：状态同步问题 / 需求偏差
- 所属模块/页面：离线模式、顶栏、管理入口
- 对应需求文档与章节：`17_interaction_ux.md` 14.5 离线场景行为规则
- 前置条件：superadmin 已登录
- 复现步骤：
  1. 执行 `docker compose ... stop api`
  2. 回到桌面端继续浏览
- 期望结果：离线后不可查看服务端通知或管理入口；恢复联网并验权成功后再显示管理入口。
- 实际结果：API 已停止时，顶栏仍显示 `系统管理员 Admin L1` 和 `管理` 入口，本地页仍可见管理导航。
- 证据：停 API 后 Computer Use 状态仍显示 `系统管理员 Admin L1`、`管理`；恢复命令已执行成功。
- 初步原因判断：连接状态没有主动降级 bootstrap/navigation；非 401/403 的 `server_unavailable` 仅设置 progress，不触发 offline navigation 收敛。
- 修复建议：对连接失败设置 `connection.status=offline`，隐藏管理入口和服务端通知；恢复连接后重新 bootstrap。

### EAH-QA-010
- 严重程度：中
- 问题类型：体验优化 / 错误状态
- 所属模块/页面：离线错误提示
- 对应需求文档与章节：`17_interaction_ux.md` 12.2 错误状态；14.5 离线场景
- 前置条件：API 停止，当前在发布/社区工作区
- 复现步骤：
  1. 停止 API
  2. 执行需要远端的动作或切换页面触发刷新
- 期望结果：显示与当前动作匹配的离线提示，例如发布/社区搜索不可用。
- 实际结果：弹层标题为 `update · request`，步骤为 `获取下载凭证 / 下载包 / 校验 SHA-256 / 写入 Central Store`，与当前发布/导航场景不匹配。
- 证据：Computer Use 状态 `update · request`、`无法连接服务，请确认服务地址、端口和网络。`
- 初步原因判断：通用 `handleRemoteError` 复用了安装/更新 progress 展示模型。
- 修复建议：错误弹层按来源 action 分类；非安装/更新请求使用通用请求失败/离线提示，不展示下载流程步骤。

### EAH-QA-011
- 严重程度：中
- 问题类型：需求偏差 / 自动化验收风险
- 所属模块/页面：API/自动冒烟
- 对应需求文档与章节：`06_page_architecture.md` 角色菜单差异；`03_roles_permissions.md` 菜单权限下发口径
- 前置条件：API 健康，执行自动化命令
- 复现步骤：
  1. 执行 `npm run p1:live-smoke`
- 期望结果：live smoke 通过或与当前需求字段一致。
- 实际结果：失败：`admin missing manage navigation`。
- 证据：`docs/Verification/evidence-2026-04-19/npm-p1-live-smoke.log`；API bootstrap 证据 `api-bootstrap-superadmin.json` 返回 `review,admin_departments,admin_users,admin_skills`，不含旧 `manage`。
- 初步原因判断：自动冒烟仍按旧导航字段 `manage` 验收，新需求/实现已拆成显式菜单权限。
- 修复建议：更新 live smoke 断言为显式菜单权限；同时保留普通用户不得有 admin 权限的断言。

### EAH-QA-012
- 严重程度：中
- 问题类型：接口异常 / 状态同步问题
- 所属模块/页面：管理 > Skills
- 对应需求文档与章节：`11_page_manage.md` 8.5.3 Skill 管理；`04_business_rules.md` 5.4 审核结果公开范围
- 前置条件：superadmin 进入 `管理 > Skills`
- 复现步骤：
  1. 打开管理入口
  2. 点击 `Skills`
  3. 查看 Skill 列表与右侧摘要
- 期望结果：展示分类、风险等级、描述、版本审核摘要等字段。
- 实际结果：列表多项显示 `未分类`、`未知风险`、`暂无说明`、`当前版本暂无审核摘要`，与社区卡片已有分类/风险/描述不一致。
- 证据：Computer Use 状态 `Prompt Lint Checklist 未分类`、`未知风险`、`暂无说明`；社区同类卡片展示 `engineering/design/operations` 等标签。
- 初步原因判断：Admin mapper/repository 未完整映射 market/detail 字段，或管理 API 返回字段缺省。
- 修复建议：复用 Skill detail 的 category/risk/reviewSummary/description 字段映射；为管理列表增加契约测试。

### EAH-QA-013
- 严重程度：低
- 问题类型：UI 问题 / 状态同步问题
- 所属模块/页面：本地 > 项目
- 对应需求文档与章节：`12_page_tool_project.md` 8.7 项目视图
- 前置条件：进入本地项目页
- 复现步骤：
  1. 点击 `本地 > 项目`
  2. 查看默认项目路径
- 期望结果：项目列表展示当前真实工作区或用户维护的有效路径，并清楚标识无效/缺失。
- 实际结果：默认项目为 `/Users/zhb/Documents/MyProjects/Enterprise-Agent-Hub`，与当前仓库 `/Users/zhb/Documents/MyProjects/EnterpriseAgentHub` 不一致，未提示路径不存在或过期。
- 证据：Computer Use 状态显示项目路径含 `Enterprise-Agent-Hub`。
- 初步原因判断：本地 SQLite 中保留旧项目配置，未在扫描时校验路径存在性。
- 修复建议：项目页扫描时标记 missing/invalid；支持一键修复到当前工作区。

## 4. 权限与 API 证据

- `api-bootstrap-superadmin.json`：superadmin 菜单权限包含 `review, admin_departments, admin_users, admin_skills`。
- `api-admin-skills-superadmin.json`：superadmin 可读取 6 个 Skill 管理项。
- `api-admin-departments-superadmin.json`：superadmin 可读取部门树。
- `api-admin-users-superadmin.json`：superadmin 可读取 7 个用户。
- `api-bootstrap-demo.json`：普通用户菜单权限仅包含 `home, market, my_installed, publisher, target_management, notifications`。
- `api-admin-users-demo-forbidden.txt`：普通用户访问 `/admin/users` 返回 `403 permission_denied`。

## 5. 未完成项与阻塞点

- 未执行冻结用户、删除用户、删除部门、下架/归档 Skill 等破坏性写操作；这些动作会改变真实治理数据，按安全策略只验证了按钮可见性和权限入口。
- 审核同意/拒绝/退回未完整执行，因为 UI 发布流程未能进入最终提交并产生新审核单；后台当前审核列表为空。
- Windows exe 安装包与 Linux live 部署未在本机环境验收，本次仅覆盖 macOS Tauri 真实桌面端和本地 Docker API。
- 系统截图文件未能保存，依赖 Computer Use 会话截图和可访问性树作为视觉证据。

## 6. 总结

- 已测范围：真实桌面入口、游客态、登录、主页跳社区、社区搜索/空状态/详情/热榜、本地 Skills/工具/项目/诊断、通知、设置、发布表单/上传预检查、管理审核/Skills/部门/用户、离线/恢复、API 权限对照、自动冒烟。
- 问题总数：13 个。
- 最严重问题：启用流程卡死、离线管理入口不隐藏、会话状态不稳定、发布入口形态与需求冲突、发布提交/预检查反馈不足。
- 当前阻塞：无法从 UI 完整走通“发布 -> 审核 -> 通过 -> 市场可安装”的闭环；无法从 UI 完整验证“启用成功后本地工具生效”的闭环。
