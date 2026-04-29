# Tool Gateway + Browser/File Worker + Scheduler 详细设计

## 1. 目标与边界

本设计定义 Enterprise Agent Harness 执行层的 Tool Gateway、隔离 Worker 与 Scheduler 的概念契约。它承接原始需求中的内网浏览器操作、文件整理、截图归档、定时任务、工具权限分层、沙箱运行、审计留痕和用户可控要求，并落实 RALPLAN 选定的 **Desktop Client + Local Agent Runtime/Daemon + Enterprise Control Plane + Isolated Workers + Unified Audit/Event Spine** 架构。

### 1.1 设计目标

- 将模型提出的工具意图与真实可执行动作隔离，所有动作必须经过标准化、策略判定、审批或接管后才能进入 Worker。
- 为 Browser Worker、File / Document Worker、受控 Shell seam、HTTP / Connector seam 和 Scheduler 定义一致的执行语义、观察结果和审计要求。
- 确保浏览器、文件、下载目录、授权根目录、资源锁和后台触发计划都受 Runtime 管理，而不是由 Desktop UI 或模型直接控制。
- 支持可取消、可超时、可恢复、可解释失败的工具队列与 Worker Session，保证长任务、周期任务和后台任务不依赖 UI 生命周期。
- 为 Policy/Approval、Runtime Run State、Artifact/Audit、Knowledge/Memory 和 Desktop Cockpit 详细设计提供稳定连接点。

### 1.2 明确边界

本文件只描述概念级设计，不包含：

- 数据库表结构、持久化字段或索引设计。
- 端点级 API、IPC channel 名称、具体序列化字段或 SDK 调用格式。
- 具体浏览器自动化框架、文件处理库、调度库、沙箱技术、进程模型或代码实现。
- 页面高保真原型、任务排期、工作量估算或实施步骤。
- Policy/Approval、Credential、Knowledge/Memory、Admin Governance、Desktop UX 的完整细节；本文件只定义执行层与它们的连接点。

## 2. 输入依据

- `.omx/plans/ralplan-agent-harness-redesign.md`：确认 Tool Gateway、Browser Worker、File / Document Worker、Scheduler、Worker Supervisor 与统一事件审计脊柱是 Runtime 的核心组成。
- `.omx/plans/prd-agent-harness-design.md`：确认 MVP 必须包含浏览器隔离、授权文件操作、截图/产物/执行记录、Scheduler、工具治理和可恢复执行。
- `.omx/plans/test-spec-agent-harness-design.md`：确认设计验证必须覆盖 Worker 隔离、Scheduler 独立于 UI、审计脊柱、策略复核、恢复和非目标边界。
- `docs/AgentHarnessDesign/# 企业内网通用型 Agent 助手需求文档`：确认内网环境、无公网依赖、浏览器/文件/定时任务/截图/权限/沙箱/审计/用户确认等原始需求。
- `docs/AgentHarnessDesign/客户端 Agent Harness目录`：确认 Tool System、Built-in Tools、Security、Runtime/Scheduler/Resource、Checkpoint/Artifact/Audit/Replay 与 Human Handoff 的推荐能力分层。
- `docs/DetailedDesign/AgentHarnessDesign/runtime-contracts-and-run-state.md`：确认 Run、Step、Tool Action、Approval、Artifact 与 Runtime Event 的共享语义，本文件沿用这些概念而不重新定义状态机。

## 3. 职责划分

### 3.1 模块职责

| 模块 | 在执行层中的职责 | 不负责 |
| --- | --- | --- |
| Agent Core | 产生工具意图、读取结构化 Observation、根据 Observation 继续规划或组合结果 | 直接执行工具、选择绕过策略的动作、接触真实浏览器/文件句柄 |
| Tool Gateway | 工具能力过滤、Tool Intent 标准化、风险与权限声明校验、策略判定入口、Tool Queue 入队、Observation 标准化 | 替代 Policy 作最终治理、直接修改 Run 主状态、保存长期审计真相 |
| Tool Registry | 维护工具能力声明、输入输出语义、风险等级、权限要求、审计字段、可撤销/预览/定时可用性 | 注册未审核工具、保存凭证明文、决定用户是否有权执行 |
| Tool Queue | 串联策略通过后的动作，处理排队、互斥资源、取消传播、超时、重试与中断 | 越过 Run 状态机自行重试高风险动作、吞掉失败原因 |
| Worker Supervisor | 创建和回收隔离 Worker Session，分配浏览器 Profile、授权目录、下载目录、资源锁和运行预算 | 解释业务结果、改变用户授权范围、决定审批结果 |
| Browser Worker | 使用独立 Agent 浏览器环境访问授权内网站点，提取页面结构、截图、表格、下载/上传结果，并支持人工接管 | 读取用户日常浏览器历史/密码/Cookie、突破内网白名单、自动执行 L4/L5 高风险动作 |
| File / Document Worker | 在授权目录内读取、写入、转换、归档、整理文件，生成清理预览、执行确认后的变更并记录可恢复信息 | 默认扫描全盘、访问系统/凭证目录、无确认删除或批量移动文件 |
| Shell / Local Tool seam | 为内部诊断或管理员注册的企业本地工具预留受控执行 seam | 作为 MVP 的通用编程 Agent Shell、默认执行系统命令或生产操作 |
| HTTP / Connector seam | 为后续内网系统连接器提供权限声明、网络范围、上传/下载和审计语义 | 绕过源系统权限、成为公网外传通道、优先替代 Browser Worker 的 MVP 访问路径 |
| Scheduler | 保存一次性/周期/条件触发计划，触发 Run，处理错过补偿、并发限制、失败通知和策略复核 | 作为 UI 定时器、绕过用户权限、默认执行高风险提交/删除/审批动作 |
| Artifact/Audit Writer | 记录工具动作、截图、文件产物、下载/上传、审批、错误、恢复和 Worker 健康事件 | 保存超出策略允许范围的数据、替代 Worker 执行业务动作 |
| Desktop Cockpit | 展示工具执行进度、审批/接管请求、产物预览、任务完成/失败通知和执行记录 | 直接调用风险工具、持有工具队列真相、关闭后中断 Scheduler 或安全后台任务 |
| Enterprise Control Plane | 管理工具策略、浏览器范围、文件范围、角色权限、审计查询和企业治理配置 | 直接操作用户本地浏览器或文件、替代本地 Runtime 执行用户桌面任务 |

### 3.2 执行事实源划分

- **工具能力事实源**：Tool Registry 的工具能力声明和企业治理策略。模型只能看到经过策略过滤后的可用能力描述。
- **动作执行事实源**：Local Runtime 的 Tool Queue、Worker Session Record 与 Run Journal。它们记录动作从意图到观察结果的全过程。
- **资源占用事实源**：Worker Supervisor 维护浏览器 Profile、下载目录、授权文件根、目录锁、并发配额和 Worker 健康状态。
- **调度事实源**：Scheduler Registry 维护周期计划、最近触发、下次触发、授权范围、失败提示和暂停原因。
- **审计事实源**：Artifact/Audit Writer 维护工具动作、截图、文件变更、审批、接管、错误和恢复事件的审计引用。

### 3.3 执行层不变量

1. 模型只产生 `Tool Intent`，不能直接调用真实工具。
2. Worker 只执行已授权的 `Tool Action`，不能自行放宽权限或扩大目标范围。
3. Scheduler 每次触发都必须创建或恢复 Run，并进行执行时策略复核。
4. Browser Worker 与用户日常浏览器隔离；File Worker 与未授权目录隔离。
5. Tool Observation 进入 Agent Core 前必须结构化、标记来源，并对不可信网页/文件内容做注入防护。
6. 高风险动作的审批、接管、动作前后截图/文件快照和结果摘要必须进入审计脊柱。

## 4. Tool Gateway 与 Worker 契约总览

执行层契约分为五类：能力声明、动作标准化、队列调度、Worker 执行和观察回传。它们只描述共享语义，不规定具体类型名、传输协议或存储结构。

### 4.1 工具能力声明契约

| 声明项 | 语义 | 设计要求 |
| --- | --- | --- |
| Capability Description | 工具能解决什么问题，适用哪些任务 | 面向 Agent Core 可理解，但不得暴露绕过策略的内部能力 |
| Input / Output Semantics | 输入范围、输出类型、是否会产生文件/截图/网络访问 | 输出必须能转为结构化 Observation 或 Artifact Reference |
| Risk Level | L0-L5 或策略细化后的风险等级 | 注册时声明，执行时仍可被 Policy 根据上下文上调风险 |
| Permission Requirement | 需要的用户、角色、目录、域名、工具或知识库权限 | 不能只依赖工具自报；必须与企业策略和本次授权交叉校验 |
| Audit Fields | 最低审计信息：目标、动作、输入摘要、输出摘要、错误、产物 | 敏感字段按策略脱敏或仅保存引用 |
| Preview / Undo Support | 是否支持预览、撤销、回收站、文件快照或动作前截图 | 文件清理、批量移动、业务变更等高风险动作必须优先支持预览 |
| Scheduler Eligibility | 是否允许被周期任务调用 | L4/L5 默认不允许自动执行，只能转审批、接管或跳过 |
| Availability | 当前设备、网络、凭证、内网系统是否可用 | 不可用时返回可解释失败，不让 Agent Core 盲目重试 |

### 4.2 动作标准化契约

| 阶段 | 输入 | Runtime 处理规则 | 输出 |
| --- | --- | --- | --- |
| Intent 生成 | Agent Core 的工具意图、任务上下文、候选目标 | 检查工具是否对当前任务可见，补齐目标、范围、预期影响和风险提示 | Normalized Action Candidate |
| 策略判定 | Action Candidate、用户/角色、策略快照、资源范围 | 调用 Policy 得出 Allow/Ask/Deny/Mask/Redact/Limit，必要时生成 Approval Request | Policy-checked Action |
| 入队 | Policy-checked Action、Run/Step、资源需求 | 建立队列项，分配优先级、互斥资源、超时、取消令牌和审计关联 | Tool Queue Item |
| 执行 | Queue Item、Worker Session、授权资源 | Worker 只在授予范围内执行；失败、取消和超时必须结构化返回 | Worker Observation |
| 回传 | Observation、Artifact、Audit Event | 标记可信来源/不可信内容、脱敏、写入 Run Journal，再交回 Agent Core | Structured Observation |

### 4.3 Tool Queue 契约

Tool Queue 是动作执行顺序与资源约束的事实源，不是普通内存队列。

| 队列能力 | 设计要求 |
| --- | --- |
| 取消传播 | Run 取消必须传到排队项、运行中 Worker、下载/转换/文件写入和后续 Scheduler 触发。 |
| 超时与中断 | 每类工具有默认超时和可配置上限；超时需要保留可解释错误和清理结果。 |
| 重试 | 只对幂等或明确可恢复动作自动重试；高风险写入、提交、删除、审批不自动重试。 |
| 互斥资源 | Browser Profile、下载目录、授权目录、文件写锁、连接器会话等资源必须显式加锁。 |
| 优先级 | 用户前台 Run 可高于后台 Scheduler Run，但不能饥饿长期后台任务。 |
| 背压 | Runtime 资源不足时进入 `paused`、`recovering` 或失败，而不是无限扩容 Worker。 |
| 可观测性 | 队列阻塞原因、等待资源、重试次数和最近错误必须能进入 Run Snapshot 或健康视图。 |

## 5. Worker 设计

### 5.1 Browser Worker

Browser Worker 面向授权内网系统的读取、低风险交互、截图和人工接管。

| 能力 | MVP 语义 | 边界 |
| --- | --- | --- |
| 独立 Profile | 为 Agent 创建独立浏览器 Profile，与用户日常浏览器隔离 | 不读取用户日常历史、密码、Cookie 或个人浏览器数据 |
| 内网页面访问 | 打开授权 URL，读取页面文本、DOM/Accessibility Tree、表格和状态 | 不突破 URL 白名单、IP/域名/端口策略 |
| 页面截图 | 支持用户手动截图、关键步骤截图、页面状态截图和动作前后截图 | 敏感页面截图受策略开关、脱敏、保留周期和访问范围约束 |
| 低风险交互 | 导航、筛选、搜索、分页、展开详情等 L1/L3 低风险动作 | 提交、修改状态、上传正式材料、审批等 L4/L5 必须确认或接管 |
| 下载/上传 | 下载到隔离目录，上传来自授权目录或明确产物 | 上传前必须展示目标、文件摘要和风险说明 |
| 登录与 MFA | 维持 Agent Profile 内的登录态，遇到 MFA/验证码进入人工接管 | 不保存或读取用户主浏览器凭证；凭证处理归 Credential 设计细化 |
| 不可信内容处理 | 页面内容进入上下文前标记来源、截断/脱敏、隔离指令 | 网页内容不得覆盖系统策略、工具权限或用户授权 |

### 5.2 File / Document Worker

File / Document Worker 面向授权目录内的读取、写入、整理、转换和产物归档。

| 能力 | MVP 语义 | 边界 |
| --- | --- | --- |
| 授权根目录 | 用户或策略明确授权的目录、项目空间、下载目录、截图目录或个人知识库位置 | 不默认扫描全盘；不访问系统目录、凭证目录、浏览器密码/Cookie/历史 |
| 文件读取 | 读取授权目录内文件，提取文本、表格、PDF/Office 内容摘要 | 读取结果标记来源和敏感级别，避免不可信文件内容注入 |
| 文件写入 | 保存报告、草稿、转换结果、个人知识库候选文档 | L2 写入需确认；不能无确认修改正式知识库或业务数据 |
| 文件整理 | 生成按项目、日期、类型、大小、重复度或未使用时间的整理建议 | 清理流程必须是“扫描建议 -> 用户审阅清单 -> 确认 -> 执行 -> 可恢复记录” |
| 文件转换 | 在授权范围内将文档转换为统一格式，产出进入 Artifact Store 或授权目录 | 转换失败必须保留源文件不变并返回错误摘要 |
| 删除/移动 | 默认走回收站、隔离区或可撤销记录 | 删除、批量移动、合并、重命名必须确认且可恢复 |
| 路径安全 | 所有路径先规范化，再校验授权根和越界风险 | 符号链接、相对路径、大小写差异和挂载点不能绕过授权范围 |

### 5.3 Shell / Command Worker seam

本项目不是专门面向编程的代码生成工具，Shell 能力不作为核心用户功能。MVP 原则上禁用通用 Shell，或仅保留内部诊断/受控工具执行 seam。

- 生产操作、系统级命令、批量破坏性命令默认为 L5，不进入 MVP 自动执行。
- 目标态若接入管理员注册的企业本地工具，必须声明工作目录、命令范围、输入输出、风险等级、超时、审计字段和是否可撤销。
- Shell seam 不能成为绕过 File Worker、Browser Worker 或 Connector 权限的后门。

### 5.4 HTTP / Connector seam

MVP 可优先通过 Browser Worker 访问内网系统；专用 HTTP / Connector 作为目标态能力保留设计 seam。

- 连接器不得绕过用户在源系统中的权限。
- 网络访问必须受内网 URL、IP、域名、端口和数据外传策略约束。
- 上传/下载必须绑定 Run、Step、用户授权、目标系统和产物引用。
- 连接器工具需要声明数据域、可执行动作、审批等级、错误语义和审计字段。

## 6. Scheduler 设计

### 6.1 Scheduler 职责

Scheduler 负责一次性任务、周期任务和条件触发任务的本地触发管理。它属于 Local Runtime/Daemon，不属于 Desktop UI。

| 能力 | 设计要求 |
| --- | --- |
| 计划创建 | 保存任务名称、描述、周期、输入范围、工具范围、知识库范围、输出位置、通知方式、是否需要确认和失败提示方式。 |
| 触发 Run | 到点后创建新的 Run 或恢复待补偿 Run；不得直接执行工具动作。 |
| 执行时复核 | 每次触发都复核用户权限、工具权限、文件/浏览器范围、知识库权限、凭证状态和策略版本。 |
| 错过补偿 | Runtime 离线、设备休眠或资源不足后，按策略决定补跑、跳过、合并或提示用户确认。 |
| 并发控制 | 限制同类周期任务、同一浏览器 Profile、同一授权目录和高资源 Worker 的并发。 |
| 暂停/恢复/删除 | 管理触发计划，不改变已形成 Run 的审计历史；删除计划不删除历史审计。 |
| 通知 | 完成、失败、需审批、需接管、策略失效或授权过期时通知用户。 |
| 健康检查 | 输出 Scheduler 健康、最近触发、失败原因、策略同步状态和资源限制状态。 |

### 6.2 Scheduler 默认适用与默认禁止

| 分类 | 默认策略 | 示例 |
| --- | --- | --- |
| 适合自动触发 | 查询、汇总、摘要、生成草稿、提醒、保存报告、生成待办 | 定时缺陷汇总、日报草稿、内网页面内容检查、知识库整理建议 |
| 需要确认后继续 | 文件写入、个人知识库新增、下载归档、低风险浏览器交互升级 | 保存报告到授权目录、上传附件、批量整理建议执行 |
| 默认禁止自动执行 | 删除、提交、审批、业务状态变更、批量修改、生产操作 | 删除文件、提交表单、通过审批、修改工单状态、生产命令 |

### 6.3 Scheduler 与 Run 状态机连接

- Scheduler 触发不等于工具授权；触发时只创建或恢复 Run。
- 策略允许时 Run 进入 `planning` / `running`，由 Agent Core 与 Tool Gateway 正常执行。
- 策略变为 Ask 时 Run 进入 `awaiting_approval`，通知用户或管理员。
- 授权失效、凭证不可用、资源不足或内网系统不可达时 Run 进入 `paused` 或 `recovering`，并记录原因。
- 计划被暂停或删除时，后续触发停止；已在执行中的 Run 必须按 Run 控制命令取消或继续，不能被静默丢弃。

## 7. 概念数据 / 事件对象

以下对象是共享语义，不是数据库 schema，也不是端点级 API。后续实现可以用不同存储或传输形式表达，但不得改变对象语义。

### 7.1 Tool Capability

| 概念字段 | 说明 |
| --- | --- |
| Identity | 工具能力标识、版本、提供者、所属 Worker 或 Connector |
| Description | 面向 Agent Core 的能力说明、适用场景和不适用场景 |
| Input Semantics | 输入目标、范围、数据类型、是否引用文件/页面/知识库 |
| Output Semantics | Observation、Artifact、Citation、错误或风险提示的输出类型 |
| Risk Declaration | 默认风险等级、可能升级风险的条件、是否可用于 Scheduler |
| Permission Declaration | 需要的角色、工具权限、目录范围、域名范围、知识库范围或凭证范围 |
| Audit Declaration | 必须记录的动作目标、输入摘要、输出摘要、产物、截图或错误字段 |
| Safety Features | 是否支持预览、撤销、回收站、动作前截图、文件快照、取消和超时 |

### 7.2 Tool Intent

| 概念字段 | 说明 |
| --- | --- |
| Purpose | Agent Core 希望通过工具完成的子目标 |
| Candidate Tool | 候选工具能力，尚未授权执行 |
| Target Hint | 可能的 URL、页面元素、文件路径、目录、知识库或系统对象 |
| Expected Effect | 预期读取、写入、点击、下载、上传、转换、整理或通知效果 |
| Context Reference | 来源 Run、Step、用户输入、上一轮 Observation 或 Scheduler 触发 |
| Untrusted Inputs | 来自网页、文件、连接器或用户上传材料的内容引用和不可信标记 |

### 7.3 Tool Action

| 概念字段 | 说明 |
| --- | --- |
| Normalized Action | Runtime 标准化后的动作类型、目标、范围、输入摘要和预期影响 |
| Risk Level | 结合工具声明、目标资源、用户上下文和策略后的风险等级 |
| Policy Decision | Allow/Ask/Deny/Mask/Redact/Limit 及原因 |
| Approval Binding | 如需确认，绑定 Approval Request、决策范围和有效期 |
| Queue Binding | 关联 Tool Queue Item、资源锁、优先级、超时、取消令牌 |
| Worker Binding | 执行 Worker、Worker Session、隔离资源和运行预算 |
| Audit Binding | 关联 Run、Step、Policy Snapshot、Artifact 和审计事件 |

### 7.4 Worker Session

| 概念字段 | 说明 |
| --- | --- |
| Worker Type | Browser、File/Document、Shell seam、HTTP/Connector seam 或其他内置工具 |
| Isolation Scope | Browser Profile、下载目录、授权根、工作目录、连接器会话或资源锁 |
| Lifecycle | 创建、可用、执行中、取消中、恢复中、清理中、已关闭、异常 |
| Resource Budget | 并发、CPU/内存/磁盘、网络范围、运行时长和重试预算的概念限制 |
| Cancellation | 取消令牌、用户取消、策略取消、资源熔断或 Runtime 停止原因 |
| Recovery Reference | 可恢复状态、动作前快照、临时文件、浏览器状态或失败摘要 |
| Health Summary | 最近错误、超时、崩溃、资源耗尽或清理结果 |

### 7.5 Worker Observation

| 概念字段 | 说明 |
| --- | --- |
| Source | 产生 Observation 的 Worker、工具能力、Run/Step 和目标资源 |
| Content Type | 文本、表格、页面状态、文件摘要、截图、下载文件、上传记录、错误或风险提示 |
| Trust Marking | 用户输入、网页内容、文件内容、连接器结果、工具诊断等来源可信度标记 |
| Sanitization | 脱敏、截断、注入防护、敏感字段移除或仅保留引用 |
| Artifact References | 截图、报告、下载文件、转换文档、文件快照或临时产物引用 |
| Result Summary | 成功、失败、部分成功、取消、超时、等待接管或需要审批的摘要 |
| Next-step Hints | 可继续执行、需重试、需接管、需审批、需重规划或应失败终止的提示 |

### 7.6 Browser Session

| 概念字段 | 说明 |
| --- | --- |
| Profile Scope | 独立 Agent Profile、会话生命周期、清理策略 |
| Allowed Targets | 允许访问的内网域名、IP、端口、路径范围和下载/上传范围 |
| Page State | 当前 URL、标题、页面摘要、DOM/Accessibility 引用、登录/接管状态 |
| Screenshot Policy | 是否自动截图、关键步骤截图、敏感标记、保留和导出策略 |
| Download Scope | 隔离下载目录、下载文件产物引用、清理规则 |
| Handoff State | MFA/验证码、敏感操作、用户接管开始/结束和边界摘要 |

### 7.7 File Operation Plan

| 概念字段 | 说明 |
| --- | --- |
| Authorized Roots | 本次操作可访问的目录、项目空间、个人知识库或产物目录 |
| Scan Criteria | 文件类型、大小、时间、重复度、项目标签或用户指定条件 |
| Proposed Changes | 建议新增、修改、移动、重命名、合并、转换、删除或归档的清单摘要 |
| Risk Summary | 涉及敏感文件、批量变更、不可撤销风险、冲突或越界风险 |
| User Review State | 待审阅、已允许、已拒绝、部分允许、要求修改建议 |
| Recovery Plan | 回收站、隔离区、文件快照、单文件回滚或手工恢复说明 |
| Execution Result | 实际执行项、跳过项、失败项和产物引用 |

### 7.8 Scheduler Plan

| 概念字段 | 说明 |
| --- | --- |
| Schedule Identity | 计划标识、创建者、来源会话或模板 |
| Task Definition | 任务名称、描述、目标、输出形式和成功标准摘要 |
| Trigger Rule | 一次性、周期、条件触发、错过补偿策略和暂停状态 |
| Authorized Scope | 创建时授权、工具范围、知识库范围、文件/浏览器范围和凭证范围引用 |
| Execution Policy | 是否需要每次确认、允许的动作类型、禁止动作、失败提示方式 |
| Notification Preference | 完成、失败、审批、接管、授权过期和策略变化的通知规则 |
| Recent Runs | 最近触发、最近结果、连续失败、最近跳过原因或需要用户注意事项 |

### 7.9 Execution Event

| 事件类型 | 语义 | 最低审计要求 |
| --- | --- | --- |
| Tool Capability Event | 工具注册、启用、禁用、策略变更、可用性变化 | 工具、版本、策略来源、操作者、原因 |
| Tool Action Event | 动作标准化、入队、开始、完成、失败、取消、超时 | Run、Step、工具、目标、风险、策略、结果/错误 |
| Worker Session Event | Worker 创建、资源分配、崩溃、恢复、清理 | Worker、资源范围、影响 Run、恢复动作 |
| Browser Event | 页面访问、截图、下载、上传、接管、动作前后状态 | URL/域名范围、截图引用、用户/Agent 边界、结果 |
| File Event | 扫描、预览、写入、移动、删除、转换、恢复 | 授权根、文件摘要、确认记录、恢复引用、结果 |
| Scheduler Event | 计划创建、暂停、恢复、删除、触发、跳过、补偿 | 计划、触发原因、策略复核、关联 Run、通知结果 |
| Observation Event | Worker 返回结构化观察或风险提示 | 来源、可信度、脱敏状态、产物引用、下一步提示 |
| Resource Event | 资源锁、队列背压、配额耗尽、健康异常 | 资源、影响范围、用户可见状态、恢复建议 |

## 8. 关键流程

### 8.1 Tool Intent 到 Worker Observation

1. Agent Core 基于用户目标、上下文和可见工具能力生成 Tool Intent。
2. Tool Gateway 将 Intent 标准化为 Tool Action Candidate，补齐目标、范围、预期影响、风险和审计字段。
3. Policy 根据用户、角色、工具声明、资源范围、任务上下文和策略快照给出 Allow/Ask/Deny/Mask/Redact/Limit。
4. Ask 动作进入 Runtime 的审批流程；Deny 动作返回可解释拒绝并触发重规划或失败。
5. Allow 或审批通过的动作进入 Tool Queue，绑定 Run、Step、资源锁、超时、取消令牌和审计引用。
6. Worker Supervisor 创建或复用符合隔离要求的 Worker Session。
7. Worker 执行动作并返回结构化 Observation、Artifact Reference 或错误摘要。
8. Runtime 写入 Tool Action Event、Observation Event 和必要的 Artifact Event，再将 Observation 交回 Agent Core。

### 8.2 内网页面读取与报告生成

1. 用户要求查询内网系统或生成报告。
2. Agent Core 识别需要 Browser Worker 或 File Worker 读取信息。
3. Tool Gateway 对 URL、文件目录、知识库和工具风险进行策略检查。
4. Browser Worker 使用独立 Profile 访问授权页面，提取页面文本、表格、截图和状态摘要。
5. File Worker 读取授权文件或产物目录，返回来源标记和内容摘要。
6. Observation 进入 Result Composer 前完成来源标记、脱敏和注入防护。
7. 报告草稿保存为 Artifact，并可在用户确认后写入授权目录。
8. Desktop 展示报告、来源、截图/文件引用和执行摘要。

### 8.3 受控浏览器业务变更

1. Agent Core 准备点击、填写、上传、提交或修改业务状态。
2. Tool Gateway 将动作标准化，并根据目标页面、输入内容和业务影响判定风险。
3. L4/L5 或策略要求确认的动作进入 `awaiting_approval`，Approval Request 包含动作目标、页面截图、风险说明和可选决策。
4. 用户可允许、拒绝、要求人工接管或取消 Run。
5. 用户允许时，Browser Worker 在动作前记录页面状态/截图，执行动作后记录结果状态/截图。
6. 用户接管时，Run 进入 `handoff`；接管期间记录边界和结果摘要，结束后 Runtime 重新获取页面状态。
7. 所有审批、接管、动作前后状态和结果进入审计链路。

### 8.4 文件整理与清理

1. 用户指定授权目录和整理目标，例如下载目录、截图目录、项目资料或个人知识库候选目录。
2. File Worker 先执行只读扫描，按文件类型、大小、时间、重复度或项目标签生成整理建议。
3. Tool Gateway 标准化 Proposed Changes，并根据新增、修改、移动、删除、批量范围判定风险。
4. Runtime 展示审阅清单、冲突/重复提示、风险说明和恢复方式。
5. 用户确认全部或部分变更后，File Worker 执行写入、移动、转换或清理。
6. 删除和批量移动优先进入回收站或隔离区，并记录可恢复引用。
7. Runtime 写入文件事件、产物引用和执行摘要；失败项保持源文件不变并返回原因。

### 8.5 定时缺陷/工单汇总

1. 用户创建周期任务，指定系统、周期、输出、通知、工具范围和是否需要确认。
2. Scheduler 保存计划和创建时授权上下文。
3. 到点后 Scheduler 创建 Run，并执行用户权限、工具权限、浏览器/文件范围、知识库权限和凭证状态复核。
4. 策略允许时，Run 通过 Tool Gateway 调用 Browser/File/Knowledge Worker 读取信息并生成草稿或报告。
5. 如任务需要提交、修改状态、删除或批量变更，Run 转入审批或接管，而不是自动执行。
6. 任务完成后 Artifact Writer 保存报告，Notification 通知用户。
7. 策略失效、系统不可达或资源不足时，Scheduler 记录跳过/暂停/补偿原因并通知用户。

### 8.6 取消、恢复与 Worker 清理

1. 用户、策略或 Runtime 健康检查触发取消、暂停或恢复。
2. Runtime 将控制信号传播到 Tool Queue 和正在运行的 Worker Session。
3. Browser Worker 停止新动作，保留必要页面状态、截图或下载结果摘要，然后清理临时资源。
4. File Worker 在安全点停止写入；已执行部分必须记录结果和可恢复信息，未执行部分保持待处理或取消状态。
5. Scheduler 对未触发任务保持计划状态，对运行中 Run 按 Run 控制结果记录。
6. Runtime 将清理结果、失败原因、可恢复动作和用户可见状态写入 Run Journal。

### 8.7 不可信网页/文件内容进入上下文

1. Browser/File Worker 返回的网页文本、表格、文件内容或连接器结果默认视为不可信输入。
2. Tool Gateway 或 Context Builder 为内容添加来源、时间、目标、可信度和敏感级别。
3. 系统指令、策略、工具权限、用户授权和审批要求不得被不可信内容覆盖。
4. 高风险建议必须回到 Tool Action 标准化和 Policy 判定流程，不能由网页/文件文本直接触发执行。
5. 审计记录保留内容摘要、来源引用和脱敏状态，避免把完整敏感内容无差别写入日志。

## 9. 策略、审计与安全考虑

### 9.1 策略先于工具执行

- Tool Gateway 是所有工具动作的入口；Browser/File/Shell/Connector Worker 不接受绕过 Gateway 的执行请求。
- 策略判定必须同时考虑工具默认风险、目标资源、用户角色、当前 Run、Scheduler 授权范围和本地安全兜底。
- L4/L5 高风险动作默认 Ask、Require Handoff、管理员审批或 Deny；Scheduler 不得自动执行。
- 策略变更可以打断排队或运行中的动作；Runtime 必须进入审批、暂停、失败或取消，而不是沿用过期授权。

### 9.2 浏览器安全

- Browser Worker 使用独立 Agent Profile、隔离下载目录和受控会话生命周期。
- 不读取用户日常浏览器数据、密码、Cookie、历史记录或未授权 Profile。
- 内网页面内容、DOM、表格和下载内容均按不可信输入处理。
- 敏感页面截图受策略开关、敏感标记、保留周期、导出限制和管理员可见范围约束。
- MFA/验证码、敏感提交、审批和不可自动化动作进入人工接管。

### 9.3 文件安全

- File Worker 的所有路径先规范化，再校验授权根目录和越界风险。
- 不默认扫描全盘，不访问系统目录、凭证目录或浏览器数据目录。
- 文件清理必须先展示清单并确认；删除、移动、合并、重命名等动作保留可恢复记录。
- 文档转换、报告写入和知识库写入必须保存产物引用和来源摘要。
- 文件内容进入模型上下文前要标记来源、裁剪敏感信息并防止提示注入。

### 9.4 Scheduler 安全

- Scheduler 不是权限放大器；创建时授权不代表永久授权，每次触发都要执行时复核。
- 周期任务默认适合查询、汇总、草稿、提醒和报告保存；默认禁止删除、提交、审批、业务状态变更和生产操作。
- 授权过期、策略变化、凭证失效、资源不足或设备离线时必须进入可解释暂停、跳过、补偿或审批状态。
- 失败通知必须可追踪到具体计划、触发、Run 和策略原因。

### 9.5 审计与数据最小化

- 每个工具动作至少关联用户、Run、Step、工具、目标、风险、策略、输入摘要、输出摘要、结果/错误和产物引用。
- 审计不是普通 debug log；它是安全与治理事实的一部分。
- 不把完整敏感网页、文件内容、截图或凭证明文无差别写入日志。
- 动作前后截图、文件快照和回收站记录按策略保留、脱敏、删除、导出和访问控制。
- 本地审计与企业审计同步需要支持离线缓存、失败重试和保留策略，但不能因同步失败丢失本地执行事实。

### 9.6 资源与可恢复性

- Worker Supervisor 需要限制浏览器实例、目录锁、转换任务、下载/上传和高资源任务并发。
- Worker 崩溃、Runtime 重启或设备休眠后，只能基于 Run Journal、Worker Session Record、Artifact Index 和 Scheduler Registry 恢复。
- 幂等只读动作可以重试；高风险写入、提交、删除、审批不自动重试。
- 清理失败本身也要进入健康事件，避免残留 Profile、临时文件或锁造成后续任务误判。

## 10. MVP vs 目标态

### 10.1 MVP

MVP 必须覆盖可信助手所需的执行骨架：

- Tool Registry / Tool Gateway：工具声明、能力过滤、动作标准化、风险等级、策略判定入口和 Observation 标准化。
- Tool Queue / Worker Supervisor：有限并发、取消传播、超时、互斥资源、Worker 健康、基础恢复和错误摘要。
- Browser Worker：独立 Profile、内网页面读取、截图、表格提取、低风险导航/筛选、下载目录隔离；业务变更必须确认或接管。
- File / Document Worker：授权目录读写、报告保存、文档转换、文件整理预览；删除/批量移动必须确认且可恢复。
- Scheduler：查询、汇总、草稿、提醒和保存报告类周期任务；创建时授权 + 执行时策略复核；失败和审批通知。
- Artifact/Audit：工具动作、浏览器截图、文件变更、下载/上传、审批/接管、Scheduler 触发和 Worker 错误的基础事件。
- Shell：默认禁用通用命令执行，仅保留内部诊断或受控工具 seam。
- Connector：不建设广泛连接器市场；优先通过 Browser Worker 支撑内网系统访问，保留专用连接器 seam。

### 10.2 目标态

目标态可以在不破坏 MVP 契约的前提下演进：

- 更多经过管理员注册和审核的企业内网连接器，具备数据域、审批等级和审计字段声明。
- 更完整的 Worker 资源治理、健康视图、异常熔断、自动清理和跨任务资源复用策略。
- 更细粒度的 Tool Policy，包括按部门、系统、目录、域名、时间窗口、数据敏感级别和 Skill 来源控制。
- 高级 Replay、审计分析、失败案例沉淀和工具回归测试。
- 企业通知渠道和管理员运维视图。
- Fleet 级 Runtime 管理可作为后续平台化能力，但不阻塞 MVP。

### 10.3 明确推迟

- L4/L5 高风险自动化闭环。
- 通用 Shell 编程 Agent 或生产命令自动执行。
- 广泛企业连接器市场。
- 完整浏览器操作回放 UX。
- Fleet 级 Runtime 管理。
- 复杂多模型成本/质量路由或远程服务器执行器为主的模式。

## 11. 设计验收清单

### 11.1 覆盖性

- [ ] 覆盖 Tool Gateway、Tool Registry、Tool Queue、Worker Supervisor、Browser Worker、File / Document Worker、Scheduler 的职责边界。
- [ ] 覆盖内网浏览器访问、低风险交互、截图、下载/上传、MFA/验证码接管和高风险业务变更确认。
- [ ] 覆盖授权目录读写、文件整理预览、删除/批量移动确认、文档转换和产物归档。
- [ ] 覆盖一次性/周期/条件触发计划、错过补偿、策略复核、失败通知和并发限制。
- [ ] 覆盖 Shell/Connector 作为 seam 而非 MVP 默认自动化能力。

### 11.2 边界正确性

- [ ] Agent Core 只产生 Tool Intent，不直接调用真实工具。
- [ ] Worker 不决定是否允许执行，所有动作先过 Tool Gateway 和 Policy。
- [ ] Desktop Cockpit 不作为调度器或工具执行器。
- [ ] Scheduler 不绕过 Run 状态机，不绕过执行时策略复核。
- [ ] Browser Worker 不读取用户日常浏览器数据；File Worker 不默认扫描全盘。

### 11.3 治理与安全

- [ ] 工具声明包含能力、输入输出、风险等级、权限要求、审计字段、预览/撤销能力和 Scheduler 可用性。
- [ ] L4/L5 动作默认审批、接管或拒绝；周期任务不自动执行提交、删除、审批、业务状态变更和生产操作。
- [ ] 网页、文件和连接器结果按不可信输入处理，进入 Agent Core 前有来源标记、脱敏和注入防护。
- [ ] 文件清理流程满足“扫描建议 -> 用户审阅清单 -> 确认 -> 执行 -> 可恢复记录”。
- [ ] 审计事件包含用户、Run、Step、工具、目标、风险、策略、输入摘要、输出摘要、结果/错误和产物引用。

### 11.4 MVP 纪律

- [ ] MVP 保留执行骨架、策略入口、审计事件和 Worker 隔离，不追求完整连接器市场。
- [ ] MVP 不提供通用 Shell 自动执行能力。
- [ ] MVP 不自动闭环 L4/L5 高风险动作。
- [ ] MVP 不引入 DB schema、端点级 API、代码实现、页面高保真原型或排期估算。

### 11.5 场景验证

- [ ] 交互式报告生成：Browser/File Worker 返回结构化 Observation，Result Composer 生成 Artifact，Desktop 展示来源和执行摘要。
- [ ] 受控浏览器业务变更：Tool Gateway 判定 L4/L5，Runtime 触发审批/接管，Browser Worker 记录动作前后状态和结果。
- [ ] 文件整理清理：File Worker 先生成预览清单，用户确认后执行，删除/批量移动有可恢复记录。
- [ ] 定时缺陷/工单汇总：Scheduler 到点创建 Run，执行时复核策略，只做查询/汇总/草稿/提醒，需修改时转审批。
- [ ] 取消与恢复：Run 取消传播到 Tool Queue 和 Worker Session，Runtime 记录清理结果和可恢复状态。

## 12. 开放问题

1. 首批 MVP 内网系统是优先通过 Browser Worker 自动化访问，还是存在必须前置的专用 Connector？
2. 浏览器截图、页面状态和下载文件的敏感分级、保留周期、管理员可见范围和导出规则如何配置？
3. File Worker 的默认授权根目录、个人知识库目录、下载目录和截图目录由用户配置、管理员策略下发，还是二者叠加？
4. Scheduler 错过补偿策略的默认行为是跳过、补跑最近一次、合并多次，还是每类任务单独配置？
5. Worker 资源限制的 MVP 默认值如何确定：浏览器实例数、并发文件转换数、目录锁超时和后台任务优先级？
6. 企业统一身份、源系统权限、浏览器登录态和凭证授权之间的边界需要由 Credential 详细设计进一步确认。
7. 是否允许管理员注册受控 Shell / Local Tool；若允许，首批只覆盖诊断工具还是业务工具？
