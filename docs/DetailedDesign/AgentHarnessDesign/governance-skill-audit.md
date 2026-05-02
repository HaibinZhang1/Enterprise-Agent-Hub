# Admin Governance + Skill/Workflow + Audit Query 详细设计

## 1. 目标与边界

本设计定义 Enterprise Agent Harness 中管理端治理、Skill/Workflow 沉淀与审计查询的概念级方案。它落实原始需求中“管理员统一治理 Agent 能力”“Skill 需审核、版本、权限、审计”“关键行为审计留痕”“权限分层、沙箱隔离、用户确认、数据保护”的要求，并承接 RALPLAN 选定的 **Desktop Client + Local Agent Runtime/Daemon + Enterprise Control Plane/API + Isolated Workers + Unified Audit/Event Spine** 架构。

### 1.1 设计目标

- 让管理员能治理用户、角色、部门、工具、Skill、知识库、策略、数据保留与审计查询范围。
- 让重复任务从经验总结、个人流程模板逐步沉淀为受控 Skill，而不是由 Agent 自动发布可执行能力。
- 确保 Skill、Workflow、定时任务、工具调用都不能突破用户、部门、企业策略的交集。
- 让审计查询成为安全与治理事实入口，支持按用户、任务、工具、风险等级、知识库、Skill、截图、错误等维度检索。
- 为后续 Policy/Approval、Audit/Event、Runtime、Desktop Cockpit 与 Admin Control Plane 详细设计提供稳定边界。

### 1.2 明确边界

本文件只描述概念级设计，不包含：

- 数据库表结构、索引设计或存储字段。
- 端点级 API、IPC channel、GraphQL/REST 路由或请求响应字段。
- 管理端页面高保真原型、组件实现或交互稿。
- Skill 执行引擎代码、MCP Server 实现、插件打包格式细节。
- 项目排期、工作量估算、SaaS 多租户扩展或代码 POC。

## 2. 输入依据

- `.omx/plans/ralplan-agent-harness-redesign.md`：确认治理层负责企业/部门/用户/项目/Skill 指令、策略继承、工具/Skill 管理、审计查询、Skill 候选沉淀与管理员审核。
- `.omx/plans/prd-agent-harness-design.md`：确认 MVP 必须包含 admin governance for user/tool/knowledge/policy/audit，Skill 生命周期受治理，free-form autonomous publish 不在 MVP。
- `.omx/plans/test-spec-agent-harness-design.md`：确认设计必须覆盖 Skill 建议/治理、管理端治理与审计查询、权限 L0-L5、高风险审批、Skill 权限不能超过企业策略。
- `docs/AgentHarnessDesign/# 企业内网通用型 Agent 助手需求文档`：确认管理端需求、Skill 需求、工具权限、用户确认、沙箱、截图、审计留痕、数据保护与安全合规约束。
- `docs/AgentHarnessDesign/客户端 Agent Harness目录`：确认 Policy/Instruction/Governance、Skill/MCP/Workflow、Security/Permission/Credential、Checkpoint/Artifact/Audit/Replay 等能力目录。
- `docs/DetailedDesign/AgentHarnessDesign/shared-contracts-and-event-spine.md`：确认 SkillReviewState、Audit Query、Audit-of-audit、Policy/EventEnvelope 与共享契约 owner 的概念语义。
- `docs/DetailedDesign/AgentHarnessDesign/data-classification-retention-matrix.md`：确认管理员审计查询、截图/日志/产物/Skill 记录的敏感级、可见性、导出与保留语义。

## 3. 职责划分

### 3.1 模块职责

| 模块                               | 在治理 / Skill / 审计中的职责                                                     | 不负责                                    |
| -------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| Desktop Cockpit                  | 展示用户可见的模板/Skill 候选、审批提示、执行记录摘要、个人模板管理入口                                  | 企业级发布审核、最终策略判定、直接修改审计事实                |
| Local Agent Runtime/Daemon       | 发现重复任务、生成 Skill 候选、执行策略复核、写入运行审计事件、在策略变更后暂停或阻断任务                         | 企业策略最终治理、企业 Skill 发布、管理员审计查询授权         |
| Enterprise Control Plane / Admin | 用户/角色/部门、策略、工具、Skill、知识库、数据保留、审计查询与发布范围治理                                | 直接读取用户本地文件、直接持有本地浏览器会话、绕过 Runtime 执行工具 |
| Policy / Approval Engine         | 对工具、Skill、Workflow、定时任务给出 Allow/Ask/Deny/Mask/Redact/Limit 决策，并保留原因和策略快照 | 真实工具执行、UI 展示、长期审计查询授权本身                |
| Tool Gateway / Worker Supervisor | 执行前强制策略检查，限制 Skill 可见工具集合，产生工具调用事件                                       | 让模型或 Skill 直接调用未注册工具、决定管理员审核结果         |
| Skill / Workflow Registry        | 保存个人模板、候选 Skill、企业发布 Skill 的概念状态、版本、权限声明、风险等级与审核状态                       | 绕过用户确认或管理员审核自动发布可执行 Skill              |
| Artifact / Audit Spine           | 记录 Skill 候选、审核、启用/禁用、执行、工具调用、审批、截图、错误与产物引用                               | 保存超出保留策略的数据、向未授权管理员暴露敏感内容              |
| Knowledge Governance             | 管理企业知识库发布范围、过期标记、用户反馈与 ACL；支持审计引用                                        | 让 Agent 擅自修改企业知识库正式内容                  |

### 3.2 事实源划分

- **治理事实源**：Enterprise Control Plane 的用户/角色/部门、策略、工具注册、Skill 审核、企业知识库 ACL、数据保留与审计查询权限。
- **执行事实源**：Local Runtime 的 Run Journal / Event Log，记录 Skill、Workflow、工具、审批、产物与错误的实际执行过程。
- **用户确认事实源**：Runtime 与 Approval Engine 绑定的用户确认、管理员审批、人接管结果。
- **Skill 状态事实源**：个人流程模板可由用户侧管理；企业级 Skill 的发布状态、版本和权限由 Admin Control Plane 治理。
- **审计可见事实源**：审计查询视图基于事件与产物索引生成，但必须按角色、数据域、截图策略和脱敏策略过滤。

## 4. 治理对象与策略模型

### 4.1 管理端治理对象

| 治理对象 | 管理目标 | 关键约束 |
| --- | --- | --- |
| User / Role / Department | 管理用户身份、角色、部门、可用能力与使用情况 | 不能替代源业务系统权限；只能在 Agent 侧追加约束 |
| Policy | 管理工具、模型、浏览器、文件、知识库、Skill、日志、截图、保留策略 | 企业硬性禁止策略优先；本地缓存不得放宽企业策略 |
| Tool | 注册/禁用工具，声明权限等级、风险等级、可用范围、审批规则与审计字段 | 未注册工具不可使用；高风险工具默认禁用或需审批 |
| Skill / Workflow | 审核、发布、下架、版本管理、权限配置、使用记录、高风险处理 | Agent 只能建议，不能自动发布企业级可执行 Skill |
| Knowledge | 企业知识库创建、文档更新、版本、发布范围、过期标记、用户反馈处理 | Agent 使用时按用户权限检索，不擅自修改正式内容 |
| Audit / Retention | 管理审计查询范围、导出、保留周期、截图/日志权限、脱敏规则，并执行 audit-of-audit | 管理员查看也需要授权边界，敏感截图/日志受控 |

### 4.2 策略解析顺序

治理策略必须采用“先收紧、后授权、再兜底”的语义：

1. **企业硬性禁止策略**：例如公网外传、生产破坏性操作、未审核 Skill 发布、未授权目录访问。
2. **用户 / 角色 / 部门授权**：决定用户是否具备工具、知识库、浏览器范围、Skill、定时任务等能力。
3. **工具 / Skill 自身声明**：根据权限要求、风险等级、可调用工具、可定时执行性、输入输出范围继续收窄。
4. **当前任务上下文与本次授权**：用户本次 Allow、Ask、Deny、人接管、仅本次或有限范围允许。
5. **Runtime 本地安全兜底**：路径越界、敏感 URL、高危命令、数据外传、策略离线过期等本地阻断条件。

策略决策必须带原因、风险等级、适用范围和 `Policy Snapshot` 引用，便于回放与审计解释。

### 4.3 L0-L5 治理映射

| 等级 | 管理端默认治理 | Skill / Workflow 约束 |
| --- | --- | --- |
| L0 纯文本处理 | 可默认允许并记录摘要 | 可进入个人模板；企业发布仍需说明输入输出范围 |
| L1 只读查询 | 按知识库、文件授权目录、内网范围控制 | 必须声明可访问数据域和 Citation 要求 |
| L2 低风险写入 | 用户确认；写入授权目录或产物区 | 模板可保存报告草稿；不得自动覆盖正式资料 |
| L3 浏览器交互 | Ask 或有限 Session Allow；截图/下载受策略控制 | 必须声明域名范围、下载目录、截图策略 |
| L4 业务状态变更 | Explicit Ask，优先人接管 | 企业 Skill 发布需更严格审核；定时自动执行默认不允许 |
| L5 高风险操作 | 默认 Deny 或管理员审批 + 用户确认 | MVP 不提供闭环自动化；只能保留设计 seam |

### 4.4 共享契约治理

管理端负责把共享契约治理落到组织流程，但不替代 Shared Contracts 的概念定义：

- `shared-contracts-and-event-spine.md` 定义 canonical 状态、事件、决策、EventEnvelope、MVP/目标态子集和 breaking change 规则。
- Enterprise Control Plane 管理策略版本、工具/Skill 发布范围、审计查看权限和数据保留策略。
- 任何影响 PolicyDecision、ApprovalDecision、HandoffCause、Audit Projection、RetentionClass 或 SkillReviewState 的破坏性变更，都必须记录策略版本、影响范围和回滚/迁移说明。


## 5. Skill / Workflow 治理

### 5.1 生命周期

```text
任务执行经验
  -> 经验总结
  -> 个人流程模板候选
  -> 用户确认保存个人模板
  -> Skill 候选
  -> 管理员审核
  -> 企业发布 / 限定范围发布
  -> 执行审计与回归证据
  -> 版本升级 / 暂停 / 下架
```

生命周期约束：

1. **经验总结只产生建议**：Runtime 可总结目标、步骤、使用系统、知识库、输出格式、问题和可复用经验，但不能自动转为可执行企业 Skill。
2. **个人模板需要用户确认**：用户确认后可保存为个人流程模板；模板仍受用户权限和工具策略约束。
3. **企业 Skill 必须审核**：发布范围、权限、风险等级、可调用工具、定时能力、错误处理、版本信息必须经管理员审核。
4. **执行时仍需复核策略**：Skill 审核通过不代表永久授权；每次执行仍按当前用户、部门、工具、知识库、文件、浏览器与截图策略复核。
5. **策略变更可暂停 Skill**：工具禁用、知识库权限收紧、浏览器范围变化、数据保留规则变化时，相关 Skill/模板进入需复核或暂停状态。

### 5.2 Skill Manifest 概念语义

以下是概念对象，不是具体文件格式或 API 字段：

| 概念段 | 说明 |
| --- | --- |
| Identity | Skill 名称、描述、版本、审核状态、发布范围 |
| Audience / Scope | 适用人群、部门、角色、项目、使用场景 |
| Inputs / Outputs | 输入参数、必要上下文、输出格式、产物类型、Citation 要求 |
| Steps | 执行步骤、可重试/可跳过步骤、需要用户补充的信息 |
| Tool Permissions | 可调用工具、工具范围、权限等级、是否允许定时执行 |
| Risk Profile | L0-L5 风险等级、关键风险点、审批策略、可撤销性 |
| Knowledge Scope | 可用个人知识、企业知识库、数据域、过期内容处理 |
| Error Handling | 常见失败、降级方式、何时暂停、何时请求人工接管 |
| Audit Requirements | 必须记录的工具、页面、文件、截图、审批、产物和错误摘要 |
| Review Evidence | 管理员审核意见、回归证据、变更说明、历史版本关系 |

### 5.3 个人模板与企业 Skill 的边界

- 个人模板面向个人重复任务，默认只能在个人授权范围内使用。
- 企业 Skill 面向部门或组织复用，必须具备审核状态、版本、权限、发布范围、使用记录与下架机制。
- 个人模板升级为企业 Skill 时，不能自动继承个人授权；必须重新声明工具、知识库、浏览器、文件和定时任务权限。
- Skill 内置指令参与指令合成，但优先级低于企业硬性策略；冲突时必须记录冲突处理依据。
- Skill 不拥有独立越权能力；它只能组合已注册、已授权、已审计的工具和知识范围。

## 6. 审计查询与回放治理

### 6.1 审计范围

审计系统必须覆盖：

- 用户会话记录与任务目标摘要。
- 工具调用、文件访问/修改、浏览器访问、截图、下载/上传。
- 知识库访问、Citation、企业/个人知识域区分。
- Skill 候选生成、审核、发布、下架、版本变更、执行记录。
- 定时任务创建、触发、跳过、失败、策略复核结果。
- 用户确认、管理员审批、人接管、拒绝、超时。
- 高风险操作、错误异常、策略拒绝、脱敏/限制决策。

### 6.2 查询维度

管理端审计查询应支持按以下维度组合筛选：

| 维度 | 示例 |
| --- | --- |
| 主体 | 用户、角色、部门、管理员、Runtime、Scheduler、Skill |
| 时间 | 会话时间、任务时间、工具调用时间、审批时间、截图时间 |
| 任务 | Run、Step、Scheduler Plan、Workflow Template、Skill 版本 |
| 风险 | L0-L5、Ask/Deny、业务状态变更、高风险工具 |
| 资源 | 文件路径范围、知识库、内网页面域名、工具、模型、产物类型 |
| 决策 | Policy Decision、用户确认、管理员审批、人接管、策略变更 |
| 结果 | 成功、失败、取消、跳过、错误类型、恢复结果 |

查询结果必须区分“可见摘要”和“受限详情”。管理员能检索到存在性和治理摘要，不代表默认能查看完整会话内容、文件正文、敏感截图或工具参数。

### 6.3 审计与 Replay 的关系

- MVP 必须记录足够的事件语义，支持执行记录、审计查询和问题追踪。
- 完整 Replay UX 可后置，但事件模型从 MVP 起要保留 Run、Step、Tool Action、Policy Decision、Approval、Artifact、Screenshot、Skill Version 的关联。
- 浏览器操作回放只能在策略允许范围内展示；敏感页面截图可被脱敏、隐藏或限制导出。
- 审计导出必须应用数据保留、脱敏、管理员查看范围和企业安全策略。

## 7. 关键流程

### 7.1 管理员配置工具与策略

1. 管理员注册或启用工具，声明能力、风险等级、可用范围、审批规则和审计字段。
2. 管理员配置用户/角色/部门/知识库/浏览器/文件/Skill 策略。
3. Enterprise Control Plane 形成新的策略版本，并下发给 Runtime。
4. Runtime 缓存策略快照；后续 Tool Action、Skill 执行、Scheduler 触发均引用该快照。
5. 如策略收紧影响进行中的 Run 或计划任务，Runtime 将其转入待审批、暂停或拒绝，并写入审计事件。

### 7.2 重复任务沉淀为个人流程模板

1. Runtime 发现用户多次执行相似任务，或用户主动要求沉淀流程。
2. Agent Core 总结任务目标、输入、步骤、工具、知识库、输出格式、风险等级和需要确认的动作。
3. Desktop Cockpit 展示模板候选，由用户确认保存、修改或拒绝。
4. 用户保存后，模板作为个人 Workflow 使用；每次运行仍经过当前策略与授权复核。
5. 模板使用记录进入 Audit Spine，后续可作为 Skill 候选依据。

### 7.3 企业 Skill 审核与发布

1. 用户或管理员将稳定个人模板提交为 Skill 候选。
2. 系统生成 Manifest 概念摘要：适用范围、步骤、工具、权限、风险、输出、错误处理、审计要求。
3. 管理员审核权限声明、工具范围、知识库范围、风险等级、回归证据和发布范围。
4. 审核通过后，Skill 在限定范围内可见；审核拒绝或要求修改时记录原因。
5. Skill 执行时，Runtime 基于执行用户和当前策略重新判定；若不满足则 Ask、Deny 或暂停。
6. Skill 升级、下架、禁用或发布范围变化都产生审计事件，并影响后续执行。

### 7.4 审计查询高风险操作

1. 管理员按时间、用户、工具、风险等级或 Skill 版本筛选高风险操作。
2. 系统返回可见摘要：Run、Step、动作目标、风险等级、审批结果、执行结果、错误摘要、相关产物。
3. 管理员请求查看截图、文件摘要或会话详情时，再按审计查看权限、截图策略和脱敏策略过滤。
4. 查询、查看、导出行为本身也写入审计，避免审计数据二次滥用。

### 7.5 策略变更影响定时 Skill

1. 管理员收紧某工具、知识库或浏览器范围。
2. Enterprise Control Plane 下发策略版本，Runtime 标记受影响模板、Skill 和 Scheduler Plan。
3. 下次触发前执行策略复核；若不再允许，则跳过并通知用户；若需要确认，则进入 `awaiting_approval`。
4. 审计记录包含策略变更、受影响对象、跳过/暂停原因和用户可见说明。

## 8. 概念数据 / 事件对象

以下对象用于稳定语义，不是 DB schema，也不是端点级 API。

### 8.1 Governance Policy

| 概念字段 | 说明 |
| --- | --- |
| Scope | 企业、部门、角色、用户、项目/目录、工具、Skill、知识库、浏览器范围 |
| Decision Semantics | Allow、Ask、Deny、Mask、Redact、Limit 及适用条件 |
| Risk Binding | 对 L0-L5 风险等级、工具类型、数据域、高风险动作的绑定 |
| Priority | 企业硬禁、角色/部门授权、Skill 声明、本次授权、本地兜底的优先级 |
| Lifecycle | 生效、过期、撤销、策略版本、变更原因 |
| Audit Link | 策略快照、管理员变更、受影响 Run/Skill/工具的审计引用 |

### 8.2 Skill Candidate / Skill Package

| 概念字段 | 说明 |
| --- | --- |
| Source | 来自哪些 Run、个人模板、用户建议或管理员创建 |
| Purpose | 适用场景、目标、期望输出和成功标准 |
| Execution Plan | 概念步骤、工具、知识库、输入输出和失败处理 |
| Permission Claim | 所需权限、风险等级、可定时执行性、审批要求 |
| Review State | 草稿、待用户确认、待管理员审核、已发布、已拒绝、已下架 |
| Version Lineage | 当前版本、历史版本、升级原因、回退关系 |
| Evidence | 使用记录、回归证据、审核意见、已知风险 |

### 8.3 Workflow Template

| 概念字段 | 说明 |
| --- | --- |
| Owner | 个人用户、部门或企业范围 |
| Trigger | 手动触发、对话中建议、Scheduler 触发 |
| Inputs | 用户每次需要提供的内容、默认上下文、必要凭据/授权提示 |
| Steps | 可复用流程步骤、工具范围、是否需要确认 |
| Output Contract | 结果格式、产物保存位置语义、Citation 要求 |
| Governance Status | 是否可升级为 Skill、是否受策略变更影响、是否允许定时执行 |

### 8.4 Audit Event

| 概念字段 | 说明 |
| --- | --- |
| Actor | 用户、管理员、Runtime、Scheduler、Tool Gateway、Worker、Skill |
| Action | 查询、写入、审批、发布、下架、执行、截图、导出、策略变更等 |
| Target | Run、Step、Tool、File、Page、Knowledge、Skill、Policy、Artifact |
| Risk / Policy | L0-L5、Policy Decision、Policy Snapshot、审批/确认结果 |
| Evidence Summary | 输入摘要、输出摘要、截图/文件/产物引用、Citation、错误摘要 |
| Visibility | 用户可见、管理员可见、敏感受限、脱敏后可见、不可导出 |
| Retention | 保留周期、删除/归档规则、导出限制 |
| Correlation | 与 Run Journal、Approval、Skill Version、Scheduler Plan、Artifact 的关联 |

### 8.5 Audit Query

| 概念字段 | 说明 |
| --- | --- |
| Query Intent | 合规检查、问题排查、高风险复核、用户申诉、Skill 质量评估 |
| Filters | 主体、时间、风险、工具、知识库、Skill、结果、错误、审批决策 |
| Viewer Context | 查询者身份、角色、部门、审计查看权限、可见数据域 |
| Result Projection | 摘要、详情、截图、产物、导出包等不同可见级别 |
| Access Decision | 是否允许查看、是否脱敏、是否隐藏截图/参数、是否允许导出 |
| Audit of Audit | 查询行为、查看行为、导出行为自身的审计记录 |

## 9. 策略 / 审计 / 安全考虑

1. **最小权限**：用户、工具、Skill、Workflow、Scheduler 只能取得完成当前任务所需的最小能力。
2. **策略不可被 Skill 覆盖**：Skill 内置指令不能降低企业硬性策略、部门策略或 Runtime 本地兜底策略。
3. **发布与执行分离**：管理员审核 Skill 发布范围；Runtime 每次执行仍按实际用户和当前策略复核。
4. **审计不是 debug log**：审计记录必须服务安全、合规、回放和追责，不能混入无治理语义的普通调试噪声。
5. **敏感内容受控**：截图、文件内容、工具参数、会话记录、个人知识库、Skill 执行记录必须支持脱敏、保留、权限控制和删除策略。
6. **管理员行为也受审计**：策略变更、Skill 审核、审计查看和导出本身都必须留痕。
7. **离线缓存不放权**：Runtime 离线策略缓存只能保持或收紧能力；策略过期或不确定时，高风险动作必须 Ask 或 Deny。
8. **定时任务不扩大授权**：定时 Skill 或 Workflow 使用创建时授权 + 执行时策略复核，策略变化可暂停或跳过任务。
9. **源系统权限不被绕过**：Agent 侧治理只能追加限制，不能替代或绕过工单、测试、运维、知识库等源系统自身权限。

## 10. MVP vs 目标态

| 能力 | MVP | 目标态 |
| --- | --- | --- |
| 管理端治理 | 用户/角色/工具/知识库/策略/审计基础管理；L0-L5 判定 | 策略生效预览、影响分析、跨部门治理、Fleet Runtime 健康联动 |
| Skill / Workflow | 重复任务总结、个人流程模板、企业发布审核入口或 seam | 完整 Skill 审核工作台、版本/回归/灰度/下架、模板市场式治理 |
| 工具治理 | 注册工具、禁用工具、风险等级、审批规则、调用记录 | 连接器生态、工具质量评分、风险模型增强、自动影响分析 |
| 审计查询 | 按用户、任务、工具、风险、Skill、错误进行基础检索；敏感内容脱敏；查询/查看/导出行为本身写 audit-of-audit | 高级 Replay、浏览器操作回放、复杂导出、异常检测、审计报表 |
| 数据保留 | 日志/截图/产物基础保留与删除策略 | 分级保留、法务留存、跨系统归档、策略模拟 |
| 高风险自动化 | L4 必须显式确认或人接管；L5 默认禁用或预留 | 在严格审批、回放、回归和隔离下开放有限企业场景 |

## 11. 验收清单

- [ ] 管理端治理对象覆盖用户、角色、部门、工具、Skill、知识库、策略、审计和数据保留。
- [ ] Skill 从经验总结到个人模板、企业审核、发布、执行、版本、下架的链路清晰。
- [ ] 文档明确 Agent 不能绕过用户确认或管理员审核自动发布可执行 Skill。
- [ ] 文档明确 Skill 权限不能超过用户、部门、企业策略和工具自身声明的交集。
- [ ] 文档保留 L0-L5 风险等级并说明对应治理动作。
- [ ] 审计范围包含用户、时间、任务、工具、页面/文件、截图、知识库引用、审批、结果和错误。
- [ ] 审计查询支持按用户、任务、时间、工具、风险等级、知识库、Skill、高风险操作、错误筛选。
- [ ] 管理员查看与导出审计数据也受权限、脱敏、保留和二次审计控制，并产生 `audit.query.viewed/exported` 事件。
- [ ] MVP 与目标态清晰区分，MVP 保留治理骨架但不引入富 Skill Studio 或高风险自动化闭环。
- [ ] 文档未包含 DB schema、端点级 API、高保真原型、排期估算、SaaS 多租户扩展或代码 POC。

## 12. 开放问题

1. 企业身份源与角色/部门同步方式尚未指定；本设计只要求能表达用户、角色、部门和管理员权限。
2. 审计保留周期、截图保存策略、敏感字段分类和导出审批规则需由企业安全策略确定。
3. Skill 回归证据的最低标准尚未指定；MVP 可先保留审核记录与运行记录，目标态再扩展为系统化回归。
4. 企业知识库正式内容的反馈、修订、发布流程需与知识库详细设计对齐。
5. 管理端审计查询是否需要对接企业 SIEM、堡垒机或现有审计平台尚未确定。
6. 高风险 L5 能力是否完全禁用、仅管理员审批开放，或只作为未来 seam，需要安全评审进一步决策。
