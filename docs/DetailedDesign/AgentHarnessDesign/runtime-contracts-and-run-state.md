# Runtime Contracts + Run State Machine 详细设计

## 1. 目标与边界

本设计定义 Enterprise Agent Harness 的本地 Runtime/Daemon 契约语义与 Run 状态机。它承接原始需求中的对话任务、内网浏览器操作、文件整理、截图归档、定时任务、个人记忆、知识库问答、Skill 沉淀、权限分层、沙箱运行与审计留痕要求，并落实 RALPLAN 选定的 **Desktop Client + Local Agent Runtime/Daemon + Enterprise Control Plane + Isolated Workers + Unified Audit/Event Spine** 架构。

### 1.1 设计目标

- 让一次用户任务、定时任务或 Skill 任务成为可恢复、可暂停、可审计、可接管的 `Run`。
- 明确 Desktop Cockpit、Local Runtime/Daemon、Enterprise Control Plane、Isolated Workers 与 Shared Contracts 的交互边界。
- 定义 Runtime 命令、事件、状态、产物、审批、调度与审计之间的概念契约，避免 UI、Runtime、后端各自发明状态语义。
- 保证后台执行不依赖 UI 生命周期：用户关闭或重启桌面座舱后，安全允许的任务仍能恢复或给出可解释的中断结果。
- 为后续 Policy/Approval、Tool Gateway、Browser/File Worker、Knowledge/Memory、Desktop Cockpit 详细设计提供稳定接口语义。

### 1.2 明确边界

本文件只描述概念级设计，不包含：

- 数据库表结构或持久化字段设计。
- 端点级 API、IPC channel 名称或序列化字段。
- 具体代码实现、进程管理技术选型、浏览器自动化框架、调度库或模型 SDK。
- 页面高保真原型、实现排期或工作量估算。
- Policy/Approval、Credential/Sandbox、Tool Worker、Knowledge、Desktop UX 的完整细节；本文件只定义它们与 Runtime 状态机的连接点。

## 2. 输入依据

- `.omx/plans/ralplan-agent-harness-redesign.md`：确认三平面架构、Runtime/Daemon 作为主执行引擎、统一事件审计脊柱、隔离 Worker 与 Run State Machine。
- `.omx/plans/prd-agent-harness-design.md`：确认 MVP 必须包含 run state machine、可恢复执行、浏览器隔离、授权文件操作、截图/产物/执行记录、Scheduler 与治理。
- `.omx/plans/test-spec-agent-harness-design.md`：确认设计验证必须覆盖 runtime split、scheduler、audit spine、recovery、MVP/目标态兼容与非目标边界。
- `docs/AgentHarnessDesign/# 企业内网通用型 Agent 助手需求文档`：确认内网环境、无公网依赖、浏览器/文件/定时任务/知识库/Skill/权限/沙箱/审计/用户可控等原始需求。
- `docs/AgentHarnessDesign/客户端 Agent Harness目录`：确认产品交互层、Agent Core、Tool System、Security、Runtime/Scheduler/Resource、Checkpoint/Artifact/Audit/Replay 等推荐目录能力。
- `docs/DetailedDesign/AgentHarnessDesign/shared-contracts-and-event-spine.md`：统一 Run/Policy/Approval/Handoff/Scheduler/EventEnvelope 等跨文档共享语义。
- `docs/DetailedDesign/AgentHarnessDesign/data-classification-retention-matrix.md`：统一 Run Journal、事件、截图、产物、凭证、ContextPackage、Citation、Memory 与 Audit Query 的敏感级、可见性和保留语义。

## 3. 职责划分

### 3.1 模块职责

| 模块 | 在 Runtime 契约中的职责 | 不负责 |
| --- | --- | --- |
| Desktop Cockpit | 发起 Run、展示 Run 状态、订阅 Runtime 事件、展示审批/接管/通知、提交用户决策 | 直接执行高风险工具、保存长期 Run 真相、绕过 Runtime 修改文件或浏览器状态 |
| Local Agent Runtime/Daemon | Run 生命周期、状态机、Agent Loop、Scheduler、Worker 编排、取消传播、恢复、产物索引、审计事件写入 | 企业级角色/权限最终治理、企业知识库正式维护、UI 呈现 |
| Enterprise Control Plane | 用户/角色/部门、策略、工具/Skill 治理、企业知识库 ACL、审计查询与策略同步 | 直接读取用户本地文件、直接持有用户浏览器会话、替代本地 Runtime 执行用户桌面任务 |
| Shared Contracts | 定义 Run 状态、Runtime 命令、事件类型、审批语义、产物引用、策略/审计引用的共享语义 | 具体业务实现、存储实现、端点实现 |
| Agent Core | 任务理解、步骤规划、上下文构建、模型调用编排、结果组合 | 直接调用真实工具、绕过策略或审批 |
| Scheduler | 创建安全的触发计划、触发 Run、处理错过补偿、暂停/恢复周期任务 | 自动执行 L4/L5 高风险动作、绕过执行时策略复核 |
| Tool Gateway / Worker Supervisor | 将 Agent Core 的工具意图转成受策略约束的动作，分配给隔离 Worker，返回结构化 Observation | 自主决定越权执行、修改 Run 主状态 |
| Artifact/Audit Writer | 记录产物、截图、日志摘要、审批记录、工具观察结果与状态变化事件 | 保存超出策略允许范围的数据、替代业务结果判断 |

### 3.2 事实源划分

- **Run 执行事实源**：Local Runtime 的 Run Journal / Event Log。它记录本机任务从创建到终态的状态变化、步骤、审批、工具调用、产物和错误。
- **治理事实源**：Enterprise Control Plane 的策略、用户角色、工具/Skill 审核、企业知识库 ACL 与审计查询权限。
- **用户可见事实源**：Desktop Cockpit 基于 Runtime 事件渲染任务卡、执行记录、审批提示、产物预览和通知。
- **契约事实源**：Shared Contracts 维护状态、事件和决策语义，避免 Desktop、Runtime、后端语义漂移。

## 4. Runtime 契约总览

Runtime 与外部模块的契约分为四类：命令、事件、查询快照和控制回执。命令表达“请求做什么”，事件表达“事实发生了什么”，查询快照用于 UI 或治理面恢复视图，控制回执用于告诉调用方命令是否被接收或为何拒绝。

### 4.1 命令类契约

| 命令类别 | 典型用途 | Runtime 处理规则 |
| --- | --- | --- |
| Run 启动 | 用户对话任务、上传材料处理、模板/Skill 任务、Scheduler 触发任务 | 创建 Run，绑定发起者、任务来源、授权上下文与初始策略快照；进入 `created` 后立即写入事件 |
| Run 控制 | 暂停、恢复、取消、重试、重新生成结果 | 先校验当前状态是否允许转换，再写入状态事件；控制命令必须可被审计 |
| 审批决策 | 允许、拒绝、仅本次允许、范围内总是允许、要求人工接管 | 绑定 Run、Step、Tool Action 与 Policy Snapshot；审批结果只解除或终止等待状态，不直接越权执行工具 |
| 人工接管 | 用户接管浏览器会话、接管表单提交、结束接管 | Run 进入或退出 `handoff`；接管期间仍记录页面/文件范围、用户动作边界和接管结果摘要 |
| Scheduler 管理 | 创建、暂停、恢复、删除、立即执行、变更通知方式 | 管理的是触发计划，不等同于绕过 Run 状态机；每次触发仍创建或恢复 Run 并执行策略复核 |
| Runtime 健康与恢复 | UI 重连、Runtime 重启、Worker 清理、恢复未完成 Run | 输出当前 Run 快照和可恢复动作，不让 UI 猜测本地执行状态 |

### 4.2 事件类契约

Runtime 事件是审计脊柱的输入，也是 Desktop Cockpit 视图同步的来源。事件必须表达事实，不能表达 UI 临时状态。所有 Runtime 事件进入跨模块审计脊柱前，必须能映射到 `shared-contracts-and-event-spine.md` 定义的 `EventEnvelope`、事件命名规范、Projection、Sensitivity、Visibility 与 Retention。

| 事件类别 | 语义 | 最低审计要求 |
| --- | --- | --- |
| Run Lifecycle Event | Run 创建、状态转换、终态形成 | 用户/触发源、时间、旧状态、新状态、转换原因 |
| Step Event | 规划出步骤、步骤开始/完成/失败/跳过 | Run、Step、责任组件、输入来源摘要、结果摘要 |
| Policy Decision Event | 策略判定允许、询问、拒绝、限制、脱敏 | 策略快照引用、风险等级、原因、适用范围 |
| Approval Event | 发起审批、审批超时、用户允许/拒绝、管理员审批结果 | 审批主体、动作目标、范围、可撤销性、决策者 |
| Tool Action Event | 工具动作排队、开始、完成、失败、取消 | 工具、Worker、目标资源、风险等级、错误/观察摘要 |
| Observation Event | 工具返回页面、文件、文本、截图、错误或风险提示 | 来源、可信度/不可信标记、引用、脱敏状态 |
| Artifact Event | 报告、截图、下载文件、转换文档、任务快照归档 | 产物类型、来源步骤、保留策略、可见范围 |
| Scheduler Event | 计划创建/暂停/恢复、触发、错过补偿、跳过 | 计划、触发原因、创建时授权、执行时策略复核结果 |
| Handoff Event | 接管开始、用户完成、用户放弃、Runtime 恢复控制 | 接管对象、边界、前后状态摘要、后续处理 |
| Runtime Health Event | Runtime 启动、停止、恢复、Worker 崩溃、资源熔断 | 影响范围、恢复动作、是否需要用户注意 |

### 4.3 快照类契约

快照用于恢复视图或支持管理检索，不替代事件日志。

- `Run Snapshot`：当前状态、目标摘要、发起者、最近步骤、阻塞原因、待审批项、产物引用、终态结果摘要。
- `Run Timeline`：按时间排序的关键事件摘要，供执行记录、Replay Viewer 或审计检索使用。
- `Pending Approval Snapshot`：待用户或管理员决策的动作、风险、目标、范围、策略原因和可选决策。
- `Scheduler Registry Snapshot`：周期任务配置摘要、状态、最近触发、下次触发、失败提示方式、是否需要确认。
- `Runtime Health Snapshot`：Runtime 可用性、Worker 健康、资源限制状态、恢复中 Run 数量。

## 5. Run 状态机

### 5.1 状态定义

| 状态 | 语义 | 进入条件 | 允许退出到 |
| --- | --- | --- | --- |
| `created` | Run 已创建，尚未准备上下文 | 用户、Scheduler 或 Skill 触发被 Runtime 接收 | `planning`, `cancelled`, `failed` |
| `planning` | Agent Core 正在理解目标、拆解步骤、准备上下文 | 初始任务进入，或恢复后需要重建计划 | `awaiting_approval`, `running`, `paused`, `failed`, `cancelled` |
| `awaiting_approval` | 执行动作被策略判为 Ask，等待用户或管理员决策 | Policy Decision 要求确认、管理员审批或范围授权 | `running`, `handoff`, `paused`, `failed`, `cancelled` |
| `running` | Run 正在执行步骤、调用工具、生成结果或写入产物 | 计划可执行且策略允许，或审批通过 | `awaiting_approval`, `handoff`, `paused`, `recovering`, `completed`, `failed`, `cancelled` |
| `handoff` | 用户正在接管浏览器、表单、文件选择或其他高风险交互 | 用户主动接管，或策略要求人工完成 | `running`, `paused`, `completed`, `failed`, `cancelled` |
| `paused` | 用户、策略或资源约束暂停 Run | 用户暂停、策略变更、离线/资源不足、等待外部条件 | `planning`, `running`, `recovering`, `cancelled`, `failed` |
| `recovering` | Runtime 正在根据 Run Journal 恢复、重试或清理 Worker | Worker 崩溃、Runtime 重启、可恢复错误、错过任务补偿 | `planning`, `running`, `awaiting_approval`, `paused`, `failed`, `cancelled` |
| `completed` | 用户目标已满足，结果、产物和审计摘要已形成 | Completion Judge 通过，且无未处理审批/产物缺口 | 终态 |
| `failed` | Run 无法继续且不能自动恢复 | 不可恢复错误、策略拒绝导致任务无法完成、恢复次数耗尽 | 终态；后续可由新 Run 重试 |
| `cancelled` | 用户或策略取消 Run | 用户取消、管理员/策略取消、Scheduler 删除触发终止 | 终态 |

### 5.2 状态转换原则

1. **每次转换必须写事件**：状态变化先进入 Run Journal，再通知 Desktop 和审计链路。
2. **终态不可原地复活**：`completed`、`failed`、`cancelled` 不回到运行态；用户重试必须形成新的 Run 或明确的派生 Run。
3. **审批是 Run 状态，不是 UI 弹窗状态**：关闭 UI 不会消除 `awaiting_approval`，重新打开后必须恢复同一审批上下文。
4. **人工接管是可审计状态**：`handoff` 记录接管对象、范围、开始/结束与结果摘要；用户实际完成的业务动作仍受审计策略约束。
5. **暂停必须可解释**：进入 `paused` 时必须说明是用户主动、策略变化、资源限制、网络/模型不可用、等待人工信息还是 Scheduler 管理动作。
6. **恢复基于日志而非内存**：`recovering` 只能根据已持久化的 Run Journal、Worker Session Records、Artifact Index 与策略快照恢复。
7. **取消向下传播**：取消 Run 必须传播到 Agent Loop、Tool Queue、Worker Session、Scheduler 后续触发和未完成产物写入。
8. **策略变化可以打断执行**：执行时策略复核若从 Allow 变为 Ask/Deny/Limit，Run 必须进入 `awaiting_approval`、`paused`、`failed` 或 `cancelled`，不能沿用过期授权继续执行。
9. **状态组合必须可解释**：`PolicyDecision`、`ApprovalDecision`、`HandoffCause`、`CredentialGrantState`、`WorkerSessionState` 与 `SchedulerTriggerOutcome` 的组合关系以 `shared-contracts-and-event-spine.md` 为准；本文件只维护 Run 主状态机。

### 5.3 状态机视图

```text
created
  -> planning
      -> awaiting_approval -> running
      -> running
  running
      -> awaiting_approval
      -> handoff -> running/completed/failed/cancelled
      -> paused -> planning/running/recovering/cancelled/failed
      -> recovering -> planning/running/awaiting_approval/paused/failed
      -> completed
      -> failed
      -> cancelled
```

该视图只表达概念状态，不规定代码中的枚举名称、IPC 名称或存储模型。

## 6. 概念数据 / 事件对象

以下对象是共享语义，不是数据库 schema，也不是端点级 API。后续实现可以用不同存储或传输形式表达，但不得改变对象语义。

### 6.1 Run

| 概念字段 | 说明 |
| --- | --- |
| Identity | Run 的唯一标识、父子 Run 关系、是否来自 Scheduler/Skill/用户对话 |
| Goal | 用户目标、任务描述、输出形式、成功标准摘要 |
| Actor Context | 发起用户、角色/部门、设备、本次授权上下文 |
| Source Context | 会话、模板、Skill、Scheduler、上传材料或内网页面来源 |
| Current State | 当前状态、状态原因、最近转换时间 |
| Policy Snapshot Reference | 创建时或最近执行时采用的策略快照引用 |
| Step Summary | 当前步骤、已完成步骤、阻塞步骤摘要 |
| Pending Controls | 待审批、待接管、待用户补充信息、待资源恢复 |
| Artifact References | 结果、截图、报告、下载文件、转换文档、日志摘要等引用 |
| Audit References | 与 Run 关联的审计事件索引或摘要引用 |
| Completion Summary | 完成/失败/取消原因、用户可见结果、剩余风险或未完成事项 |

### 6.2 Step

| 概念字段 | 说明 |
| --- | --- |
| Purpose | 本步骤要解决的子目标 |
| Owner Component | Agent Core、Tool Gateway、Scheduler、Worker 或 Human Handoff |
| Inputs | 用户输入、上下文引用、知识引用、上一步 Observation |
| Policy Status | 本步骤是否已通过策略、是否需要审批或限制 |
| Execution Status | 待执行、执行中、已完成、失败、跳过、取消 |
| Observations | 页面、文件、工具结果、错误、风险提示等结构化观察 |
| Artifacts | 本步骤产生的报告、截图、文件、快照 |

### 6.3 Tool Action

| 概念字段 | 说明 |
| --- | --- |
| Intent | 模型或模板提出的工具意图，尚不可直接执行 |
| Normalized Action | Runtime 标准化后的动作、目标、范围和预期影响 |
| Risk Level | L0-L5 风险等级或由策略细化后的风险分类 |
| Policy Decision | Allow/Ask/Deny/Mask/Redact/Limit 及原因 |
| Approval Link | 如需确认，绑定到具体审批对象和决策结果 |
| Worker Session | 执行动作的隔离 Worker、资源锁、超时、取消状态 |
| Observation | 执行结果、错误、截图、文件引用或页面状态摘要 |

### 6.4 Approval Decision

| 概念字段 | 说明 |
| --- | --- |
| Subject | 决策人：用户、管理员或策略自动决策 |
| Scope | 仅本次、当前 Run、当前目录/域名/工具范围、有限期限等 |
| Decision | Allow、Deny、Require Handoff、Always Allow within Scope、Cancel Run |
| Risk Explanation | 风险等级、目标、影响、可撤销性、策略来源 |
| Binding | 绑定 Run、Step、Tool Action、Policy Snapshot 和审计记录 |
| Expiry / Revocation | 有效期、撤销方式和策略变更时的失效规则 |

### 6.5 Artifact Reference

| 概念字段 | 说明 |
| --- | --- |
| Type | 文本结果、Markdown 报告、表格、截图、下载文件、转换文档、任务快照 |
| Source | 由哪个 Run/Step/Tool/Handoff 产生 |
| Sensitivity | 普通、敏感、需脱敏、仅用户可见、管理员可见受限 |
| Retention Policy | 保存周期、删除/导出限制、是否可进入审计检索 |
| Location Semantics | 本地产物、个人知识库候选、企业知识库反馈候选、临时缓存等概念位置 |

### 6.6 Runtime Event

| 概念字段 | 说明 |
| --- | --- |
| Event Identity | 事件标识、顺序、发生时间 |
| Event Type | 生命周期、步骤、策略、审批、工具、产物、调度、接管、健康等类型 |
| Actor | 用户、Runtime、Scheduler、Policy、Worker、管理员等行为主体 |
| Target | Run、Step、Tool Action、Artifact、Scheduler Plan 或 Worker Session |
| Reason | 状态变化、策略判定、用户决策、错误或恢复原因 |
| Visibility | 给用户展示、仅审计、管理员可检索、敏感受限 |
| Correlation | 与上游命令、下游审计、产物和通知的关联 |

## 7. 关键流程

### 7.1 交互式任务启动与完成

1. Desktop Cockpit 将用户目标和当前会话上下文交给 Runtime。
2. Runtime 创建 Run，写入 `created` 事件，并绑定发起者、设备、初始策略快照和输入材料引用。
3. Run 进入 `planning`，Agent Core 拆解任务、构建上下文、准备候选步骤。
4. 每个可执行动作先进入 Tool Intent，再由 Runtime 标准化为 Tool Action，并交给 Policy 判定。
5. 允许执行的动作进入 `running`，由 Tool Gateway 和 Worker 返回结构化 Observation。
6. Runtime 将 Observation、产物引用和审计事件写入 Run Journal。
7. Completion Judge 判断用户目标已满足且无待审批/产物缺口后，Run 进入 `completed`。
8. Desktop 展示结果、引用、产物、执行摘要和可追溯记录。

### 7.2 策略阻塞与用户审批

1. Tool Action 涉及 L2 写入、L3 浏览器交互、L4 业务变更或其他策略判定为 Ask 的动作。
2. Runtime 写入 Policy Decision Event，并将 Run 转入 `awaiting_approval`。
3. Desktop 展示审批信息：动作、目标、范围、风险等级、策略原因、可撤销性、相关截图/文件摘要。
4. 用户或管理员提交决策。
5. Runtime 写入 Approval Event：
   - Allow：继续 `running`。
   - Deny：跳过该动作、重规划，或在无法完成目标时进入 `failed`。
   - Require Handoff：进入 `handoff`。
   - Cancel：进入 `cancelled`。
6. 所有决策都绑定 Run、Step、Tool Action 和 Policy Snapshot，供审计与回放。

### 7.3 UI 关闭后的恢复

1. Desktop 关闭或崩溃时，Runtime 不把 UI 连接状态当作 Run 终态。
2. 安全允许的后台任务继续运行；需要用户决策的任务停留在 `awaiting_approval` 或 `paused`。
3. Desktop 重新连接后请求 Runtime 快照和 Run Timeline。
4. Runtime 返回当前 Run 状态、待审批、最近事件、产物引用和健康状态。
5. Desktop 按事件事实重建任务卡，而不是依赖本地 React 状态。

### 7.4 周期任务触发

1. 用户创建 Scheduler 计划，明确任务描述、执行周期、范围、工具、知识库、结果形式、通知方式、是否需要确认和失败提示方式。
2. Runtime 记录计划并绑定创建时授权上下文。
3. 到达触发时间后，Scheduler 先执行策略复核：用户权限、工具权限、知识库权限、文件/浏览器范围、截图/日志策略是否仍然允许。
4. Scheduler 触发结果遵循统一 outcome：Allow 创建新 Run；Ask 创建 `awaiting_approval` Run 并通知用户；Deny 默认只写 `skipped_by_policy` Scheduler Event，除非合规策略要求创建 synthetic skipped Run。
5. 周期任务默认只执行查询、汇总、摘要、生成草稿、提醒、保存报告等低风险动作；提交表单、审批流程、修改业务状态、批量修改数据、生产操作等不得自动执行。
6. 错过任务补偿必须写 Scheduler Event，默认按任务类型选择 `skip`、`backfill_latest`、`merge` 或 `ask_user`，不得静默补跑高风险动作。

### 7.5 人工接管

1. 浏览器页面登录、MFA、验证码、L4/L5 业务状态变更或用户主动要求接管时，Run 进入 `handoff`。
2. Runtime 将接管对象、允许范围、风险提示和接管前状态交给 Desktop。
3. 用户完成或放弃接管后，Runtime 记录接管结果摘要。
4. Agent Core 只能基于接管后的结构化状态继续执行；不能假设用户完成了未记录动作。
5. 如接管完成了关键业务动作，审计记录必须保留动作目标、时间、用户主体和结果摘要。

### 7.6 失败、恢复与取消

- Worker 崩溃、模型不可用、网络/内网系统异常、资源限制或文件锁冲突时，Run 进入 `recovering` 或 `paused`。
- Runtime 依据 Run Journal 判断可重试、可重规划、需用户确认还是不可恢复。
- 取消命令从 Run 向下传播到 Tool Queue、Worker Session、下载/上传、文件写入和 Scheduler 未完成触发。
- `failed` 必须输出可理解原因、已完成步骤、已生成产物、可重试建议和潜在数据影响。
- `cancelled` 必须说明取消主体、取消时状态、已完成动作和是否有需要用户处理的残留产物。

## 8. 策略、审计与安全考虑

### 8.1 策略先于动作

Runtime 必须落实 `Policy Decision -> Approval if required -> Worker Execute -> Observation -> Audit Event` 链路。模型输出只能形成工具意图，不能直接触发真实工具。Tool Action 在进入 Worker 前必须获得策略判定。

最低策略输入包括：

- 用户、角色、部门和当前设备上下文。
- 工具/Skill 权限声明与风险等级。
- 文件路径、浏览器 URL、知识库、截图、日志、模型调用等资源范围。
- 本次授权、创建时授权、执行时策略复核和离线策略缓存状态。
- Runtime 本地安全兜底：路径越界、高危命令、敏感 URL、数据外传、不可信网页内容等。

### 8.2 审计伴随动作

Run 状态机必须从 MVP 起写入审计可用事件。审计范围至少覆盖：

- 操作用户、时间、执行目标、状态变化。
- 工具调用、访问文件、修改文件、访问页面、截图记录。
- 知识库引用、用户确认、人工接管、执行结果、错误信息。
- Scheduler 触发、跳过、补偿和失败提示。
- 策略判定原因、策略快照引用和审批绑定关系。

审计记录应支持最小化与脱敏：不把完整敏感页面、凭证、Cookie、Token 或无关文件内容默认写入审计；截图和日志遵守保留周期、敏感标记和管理员可见范围。

### 8.3 Runtime 安全不变量

- Runtime 不访问互联网；模型、知识库和内网系统访问必须符合企业内网约束。
- Runtime 不默认扫描全盘，不访问系统目录、凭证目录、用户日常浏览器密码/Cookie/历史。
- Browser Worker 使用独立 Agent 浏览器环境和下载目录；页面内容作为不可信输入进入上下文。
- File/Document Worker 只能操作授权根目录内的文件；删除、移动、批量整理必须先展示清单并确认。
- Scheduler 不会因为无人值守而提升权限；创建时授权和执行时策略复核必须同时成立。
- Skill 权限不能超过用户、部门、企业策略交集；Skill 任务仍然生成普通 Run 并经过同一状态机。
- Runtime 恢复不能复用过期审批；策略快照过期或权限变化时必须复核。

### 8.4 数据保留与用户可控

- 用户应能查看 Agent 访问了什么、记住了什么、生成了什么、等待什么确认。
- 产物、截图、会话记录和任务日志必须遵守 `data-classification-retention-matrix.md` 中的 Sensitivity / Visibility / Retention 语义，并具备可解释保留策略。
- 个人记忆和个人知识库写入必须由用户确认；企业知识库正式修改走管理员治理。
- 用户删除个人数据或关闭自动截图时，Runtime 后续事件和产物必须遵守新的策略；历史审计按企业保留规则处理。

## 9. MVP vs 目标态

### 9.1 MVP

MVP 必须保留不可逆架构骨架，但压缩功能面：

- 单机 Local Runtime/Daemon，承载 Run Manager、Run State Machine、Agent Core、Scheduler、Tool Gateway、Artifact/Audit Writer 的最小闭环。
- Desktop 通过共享契约发起/控制 Run，并订阅状态、审批、通知和产物摘要。
- 支持有限并发和基础资源限制；至少能取消传播、超时处理、Worker 异常恢复。
- 支持可恢复 Run Journal：UI 重启后能恢复任务卡、待审批、最近事件和产物引用。
- 支持安全的周期任务：查询、汇总、草稿、提醒、保存报告；高风险动作默认不自动执行。
- 支持 L0-L5 风险等级的连接点：Runtime 能识别 Allow/Ask/Deny/Limit 并进入正确状态。
- 支持基础审计事件：状态、工具、审批、截图/产物、错误、Scheduler 触发。
- 支持 Browser/File Worker 的隔离接入语义，但不要求完整连接器生态或高级 Replay UX。

### 9.2 目标态

目标态在保持同一状态机语义的基础上扩展：

- Fleet 管理、远程健康上报、中心化资源配额、企业共享执行器协同。
- 多模型路由、模型健康熔断、不同数据敏感级别的模型能力路由。
- 完整 Replay Viewer、复杂审计过滤、截图/产物批量导出和策略生效预览。
- 更丰富的 Worker 类型：企业连接器、受控 Shell、文档转换、浏览器自动化增强。
- Skill/Workflow 沉淀闭环：重复 Run 模式形成候选模板，经用户确认和管理员审核后发布。
- 更细的策略继承、审批有效期、授权撤销、跨设备可见性和保留策略。

## 10. 设计验收清单

### 10.1 覆盖性

- [ ] 对话任务、浏览器任务、文件任务、定时任务、Skill 任务都能映射到统一 Run。
- [ ] Run 能表达规划、执行、审批、接管、暂停、恢复、完成、失败、取消。
- [ ] Scheduler 不依赖 UI 常驻，并且每次触发都走策略复核和审计。
- [ ] 产物、截图、知识引用、工具观察和用户确认都能挂接到 Run Timeline。

### 10.2 边界正确性

- [ ] Desktop 只做座舱、控制和展示，不直接执行高风险工具。
- [ ] Local Runtime/Daemon 是执行事实源，并拥有恢复、调度、Worker 编排和审计写入职责。
- [ ] Enterprise Control Plane 是治理事实源，不直接接管本地浏览器会话或文件访问。
- [ ] Shared Contracts 统一状态、事件、审批和产物语义。

### 10.3 治理与安全

- [ ] 每个 Tool Action 在 Worker 执行前都有策略判定。
- [ ] L2-L5 风险动作能进入审批或接管状态，不会静默执行。
- [ ] 策略变更能暂停、拒绝或重新审批正在执行或待触发的 Run。
- [ ] 审计事件包含用户、时间、目标、工具、页面/文件、审批、结果/错误上下文。
- [ ] Runtime 恢复不会复用过期授权或越过新策略。

### 10.4 MVP 纪律

- [ ] MVP 保留 Runtime/Policy/Audit/Worker/Scheduler 骨架。
- [ ] MVP 不引入完整连接器生态、复杂 Skill Studio、高风险无人值守自动化或 Fleet 管理。
- [ ] 本设计没有 DB schema、端点级 API、高保真 UI、代码 POC、排期估算或 SaaS 多租户扩展。

### 10.5 场景验证

- [ ] 交互式报告生成：Run 从对话进入规划、检索、产物生成、审计和完成。
- [ ] 受控浏览器变更：Run 能在 L4/L5 动作前进入审批或人工接管，并记录前后状态。
- [ ] 定时缺陷汇总：Scheduler 能触发后台 Run，生成草稿和通知，不依赖 UI 进程。
- [ ] Skill 演进候选：重复 Run 的经验可形成候选模板，但发布仍需用户确认和管理员审核。

## 11. 开放问题

这些问题不阻塞本设计，但会影响后续详细设计参数：

1. 首个 MVP 支持的桌面 OS、Runtime/Daemon 自启动方式、退出策略和升级策略是什么？
2. 企业统一身份、SSO、角色/部门来源如何同步到 Runtime 的离线策略缓存？
3. 审计、截图、Run Journal、产物索引的保留周期、脱敏规则和管理员可见范围如何确定？
4. Scheduler 的错过补偿策略应按任务类型默认补跑、跳过、合并还是等待用户确认？
5. Runtime 在离线状态下允许哪些低风险动作继续执行，哪些动作必须等待策略刷新？
6. 首批内网系统主要通过浏览器自动化还是企业连接器访问？这会影响 Browser Worker 的稳定性要求和接管 UX。
7. Shared Contracts 的概念 owner、MVP/目标态子集和事件 envelope 已由 `shared-contracts-and-event-spine.md` 收敛；后续实现阶段仍需确定代码仓库中的评审流程、版本发布和 breaking change 门禁。
8. 用户手动删除产物或关闭截图后，历史审计引用与个人数据删除诉求如何平衡？
