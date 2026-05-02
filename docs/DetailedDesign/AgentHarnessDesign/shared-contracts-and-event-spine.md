# Agent Harness Shared Contracts + Event Spine 详细设计

## 1. 目标与边界

本设计补齐 `AgentHarnessDesign` 六份详细设计之间的共享契约、事件脊柱、状态组合与变更治理。它不是端点级 API、数据库 schema 或 TypeScript DTO，而是 Desktop、Local Runtime/Daemon、Tool Gateway / Workers、Policy / Approval / Credential、Knowledge / Memory、Enterprise Control Plane / Admin 与 Audit 共同遵守的概念语义基线。

### 1.1 设计目标

- 为 Run 状态、策略决策、审批、接管、Worker、Credential、Scheduler、Knowledge、Memory、Skill、Artifact 与 Audit 提供统一概念词表。
- 定义统一 `EventEnvelope`，让 Runtime Timeline、Desktop History、Admin Audit Query、Security Event 与 Knowledge/Citation Event 可以从同一事件脊柱投影。
- 明确契约 owner、producer、consumer、MVP 子集、目标态子集与变更规则，避免 UI、Runtime、API、Worker、Admin 各自扩展导致语义漂移。
- 定义关键状态组合，特别是 `PolicyDecision`、`ApprovalDecision`、`HandoffCause` 与 Run / Worker / Credential / Audit 的联动。
- 为三条 MVP 验证场景提供可追踪的跨模块事件链：交互式报告生成、受控浏览器变更、定时缺陷/工单汇总。

### 1.2 明确边界

本文件只描述跨模块共享语义，不包含：

- 端点 URL、IPC channel、GraphQL/REST 路由、具体 DTO 字段命名。
- 数据库表结构、索引、对象存储路径、消息队列主题或序列化格式。
- 具体 Electron、NestJS、Worker、浏览器自动化、Policy Engine 或审计查询实现。
- 视觉原型、页面组件、排期估算、代码 POC。

## 2. Contract Governance

### 2.1 Owner 与变更规则

| 契约类别 | 语义 owner | 主要 producer | 主要 consumer | 变更规则 |
| --- | --- | --- | --- | --- |
| Run / Step / Runtime Command | Local Runtime/Daemon + Shared Contracts | Runtime | Desktop、Worker、Audit、Admin Query | 新增状态必须定义允许转换、终态语义和 UI 投影；删除/重命名为破坏性变更。 |
| Policy / Risk / Approval / Handoff | Policy / Approval Engine + Shared Contracts | Policy、Approval Engine、Desktop | Runtime、Desktop、Worker、Audit | 新增决策必须定义 Run 转换、审批/接管行为、审计字段和 MVP/目标态归属。 |
| Tool / Worker / Sandbox | Tool Gateway / Worker Supervisor | Tool Gateway、Worker Supervisor、Worker | Runtime、Policy、Audit、Desktop | 新增 Worker 状态必须定义取消、恢复、资源清理和审计语义。 |
| Credential Grant | Credential Broker + Policy | Credential Broker、Worker | Runtime、Desktop、Audit、Policy | 新增授权状态必须定义撤销条件、可见范围和凭证不进模型/明文日志规则。 |
| Scheduler | Scheduler + Runtime | Scheduler | Runtime、Desktop、Policy、Audit | 新增触发结果必须定义是否创建 Run、是否通知、是否进入审计。 |
| Context / Knowledge / Memory / Citation | Runtime Context Builder + Knowledge/Memory 服务 | Runtime、Knowledge、Memory、Result Composer | Desktop、Audit、Admin Query | 新增来源类型必须定义权限过滤、引用、敏感标记和保留语义。 |
| Skill / Workflow | Enterprise Control Plane / Admin + Runtime | Runtime、Skill Registry、Admin | Desktop、Policy、Audit、Scheduler | 新增状态必须定义个人/企业边界、审核、执行时复核和下架影响。 |
| Event / Audit Projection | Artifact/Audit Writer + Shared Contracts | Runtime、Policy、Worker、Knowledge、Admin | Desktop、Admin Query、Security、Compliance | 新增事件必须使用统一 envelope，并定义可见性、保留、敏感级和投影。 |

变更原则：

1. **向后兼容优先**：新增可选事件字段、枚举值或目标态状态是 additive change；更名、删除、语义反转是 breaking change。
2. **MVP 子集显式标记**：目标态枚举可以先进入概念 registry，但必须标记 `target_state_only`，不得隐式进入 MVP 验收。
3. **单一语义源**：六份领域设计可以解释如何使用共享契约，但不应重新定义同名状态或事件含义。
4. **跨模块评审**：涉及安全、审计、凭证、接管、保留或源系统权限的 breaking change 必须由 Runtime、Policy/Security、Governance/Audit 三方共同评审。

## 3. Canonical Registry

### 3.1 Runtime / Run

| 概念 | MVP 子集 | 目标态扩展 | 说明 |
| --- | --- | --- | --- |
| `RunState` | `created`, `planning`, `running`, `awaiting_approval`, `handoff`, `paused`, `recovering`, `completed`, `failed`, `cancelled` | 保持同一语义扩展子状态 | 终态不可原地复活；重试形成新 Run 或派生 Run。 |
| `RunCommand` | start, pause, resume, cancel, retry, submitApproval, startHandoff, endHandoff | regenerate, forkRun, exportTimeline | 命令表达请求，事件表达事实。 |
| `StepStatus` | pending, running, completed, failed, skipped, cancelled | blocked, partially_completed | Step 必须绑定 Run、owner component、inputs、policy status。 |

### 3.2 Policy / Approval / Handoff

| 概念 | MVP 子集 | 目标态扩展 | 说明 |
| --- | --- | --- | --- |
| `RiskLevel` | L0-L5 | 领域细分风险标签 | L4/L5 不得无人值守自动闭环。 |
| `PolicyDecision` | Allow, Ask, Deny, Limit, Redact, Mask, RequireHandoff | 更细粒度 constraints | `RequireHandoff` 是策略要求人工完成，不等于用户在审批中主动选择接管。 |
| `ApprovalRequestState` | pending, approved, denied, expired, cancelled, superseded | escalated, delegated | 审批状态由 Approval Engine 管理，不是通知或弹窗状态。 |
| `ApprovalDecision` | AllowOnce, AllowCurrentRun, AllowLimitedScope, Deny, RequireHandoff, CancelRun | AdminOverrideWithinPolicy | 决策必须绑定 Run、Step、Tool Action、Policy Snapshot。 |
| `HandoffCause` | policy_required, user_requested, runtime_required, credential_required | admin_required | 用于区分策略强制、人主动接管、登录/MFA/验证码等原因。 |
| `HandoffState` | pending, active, completed, abandoned, expired, failed | transferred | 接管前后 Observation 必须重新获取，Agent 不能假设用户完成动作。 |

### 3.3 Tool / Worker / Credential / Scheduler

| 概念 | MVP 子集 | 目标态扩展 | 说明 |
| --- | --- | --- | --- |
| `ToolActionState` | candidate, policy_checked, queued, running, completed, failed, cancelled, timed_out | partially_completed, compensating | 只有 policy_checked 且允许/审批通过的动作可入队。 |
| `WorkerSessionState` | created, available, running, cancelling, recovering, cleaning, closed, failed | quarantined | Worker 清理失败也必须发健康/安全事件。 |
| `SandboxSessionState` | created, running, paused, cancelled, timed_out, crashed, cleaned, cleanup_failed | isolated_for_investigation | 与 WorkerSession 关联但强调隔离边界和清理。 |
| `CredentialGrantState` | requested, granted, denied, expired, revoked, cleaned | rotated, suspended | Run 完成/取消/超时/策略变化/Worker 崩溃后必须失效或复核。 |
| `SchedulerPlanState` | active, paused, deleted, disabled_by_policy | error, needs_review | 管理触发计划，不删除历史 Run/Audit。 |
| `SchedulerTriggerOutcome` | run_created, pending_approval_run_created, skipped_by_policy, missed_skipped, missed_backfilled_latest, missed_merged, waiting_user_confirmation | synthetic_skipped_run_created | 默认：Allow 创建 Run；Ask 创建 `awaiting_approval` Run；Deny 只写 SchedulerEvent，除非合规要求 synthetic skipped Run。 |
| `MissedTriggerPolicy` | skip, backfill_latest, merge, ask_user | per_task_type_policy | 由任务类型和企业策略决定，不能静默补跑高风险动作。 |

### 3.4 Knowledge / Memory / Skill / Artifact

| 概念 | MVP 子集 | 目标态扩展 | 说明 |
| --- | --- | --- | --- |
| `ContextSourceType` | policy_instruction, user_request, task_state, conversation_recent, memory, knowledge_chunk, file_excerpt, browser_observation, tool_result, draft_artifact | connector_result, replay_excerpt | 进入模型前必须完成权限过滤、敏感脱敏和信任标记。 |
| `CitationSourceType` | personal_knowledge, enterprise_knowledge, file, browser, tool_result, memory | replay, connector | Result Composer 只接受 ContextPackage 中存在的 handle。 |
| `MemoryType` | format_preference, style_preference, project_reference, knowledge_location, intranet_shortcut, workflow_preference, do_not_remember | policy_scoped_preference | Memory 是偏好/默认值，不是可执行 Skill。 |
| `MemoryStatus` | suggested, active, disabled, deleted, expired | conflicted, superseded | 用户确认前不得写长期记忆。 |
| `KnowledgeDocumentStatus` | uploaded, parsing, indexed, parse_failed, published, stale, archived | quarantined | 文档版本用于引用复现和审计。 |
| `SkillReviewState` | personal_template, candidate, pending_admin_review, published, rejected, paused, deprecated, withdrawn | staged_rollout | 企业 Skill 发布必须管理员审核，每次执行仍复核当前策略。 |
| `ArtifactType` | result_text, markdown_report, spreadsheet, screenshot, downloaded_file, converted_document, run_snapshot, log_summary | replay_package, export_bundle | Artifact 必须绑定来源 Run/Step/Tool/Handoff 和保留策略。 |

## 4. State Composition Rules

| 输入条件 | RunState | Approval/Handoff | Worker/Credential | Audit/Event 要求 |
| --- | --- | --- | --- | --- |
| `PolicyDecision=Allow` | `running` | 无新审批 | ToolAction 入队；Worker 执行 | `policy.decision.allowed` + `tool.action.queued` |
| `PolicyDecision=Ask` | `awaiting_approval` | ApprovalRequest `pending` | Worker 不执行 | `policy.decision.ask` + `approval.request.created` |
| `ApprovalDecision=AllowOnce/AllowCurrentRun/AllowLimitedScope` | `running` | ApprovalRequest `approved` | Worker 按范围执行；Credential 如需另行 grant | `approval.decision.allowed` |
| `ApprovalDecision=Deny` | `planning` 或 `failed` | ApprovalRequest `denied` | Worker 不执行 | `approval.decision.denied`，说明重规划/失败原因 |
| `PolicyDecision=Deny` | `planning`, `failed`, `cancelled` 或 Scheduler skip | 无审批 | Worker 不执行 | `policy.decision.denied`；Scheduler 触发写 skip outcome |
| `PolicyDecision=Limit/Mask/Redact` | 可继续 `running` | 如风险升高可叠加 Ask | Worker/Artifact/Observation 带限制和脱敏规则 | 事件 payload 只保存摘要或引用，记录限制原因 |
| `PolicyDecision=RequireHandoff` | `handoff` | HandoffCause=`policy_required` | Worker 暂停自动动作；接管后重新 Observation | `handoff.started` 绑定策略原因 |
| 用户在审批中选择 `RequireHandoff` | `handoff` | HandoffCause=`user_requested` | Worker 暂停自动动作；接管后重新 Observation | `handoff.started` 绑定用户决策 |
| Credential grant 过期/撤销 | `paused`, `awaiting_approval`, `failed` 或重规划 | 可能创建凭证审批/接管 | CredentialGrant `expired/revoked` | `credential.grant.revoked/expired` + 影响范围 |
| Runtime/Worker 崩溃可恢复 | `recovering` | 保留待审批/接管状态 | WorkerSession `recovering/cleaning` | `runtime.health.recovering` + 清理结果 |

## 5. Event Spine

### 5.1 EventEnvelope

所有领域事件进入审计脊柱前都应拥有统一 envelope。具体实现可映射为不同 DTO 或存储字段，但概念语义必须一致。

```text
EventEnvelope {
  eventId: stable unique id
  eventType: dotted domain event name
  producer: runtime | policy | approval | tool_gateway | worker | scheduler | knowledge | memory | desktop | admin | audit
  occurredAt: timestamp
  actor: user | admin | runtime | scheduler | policy | worker | system
  target: run | step | tool_action | approval | handoff | credential_grant | sandbox | scheduler_plan | artifact | knowledge | memory | skill | audit_query
  runId?: string
  stepId?: string
  actionId?: string
  schedulerPlanId?: string
  artifactId?: string
  causationId?: string
  correlationId?: string
  sequence?: number
  reason?: summary
  policySnapshotRef?: string
  riskLevel?: L0-L5
  sensitivity: SensitivityClass
  visibility: VisibilityClass
  retention: RetentionClass
  auditProjection: user_timeline | admin_audit | security_audit | health | none
  payloadRefOrSummary: sanitized summary or reference
}
```

### 5.2 命名规范

使用 dotted domain events 作为概念命名：

| Domain | 示例事件 |
| --- | --- |
| Run | `run.lifecycle.created`, `run.state.changed`, `run.completed`, `run.failed`, `run.cancelled` |
| Policy / Approval | `policy.decision.ask`, `policy.decision.denied`, `approval.request.created`, `approval.decision.allowed` |
| Handoff | `handoff.started`, `handoff.completed`, `handoff.abandoned`, `handoff.expired` |
| Tool / Worker | `tool.action.queued`, `tool.action.completed`, `worker.session.created`, `sandbox.cleanup.failed` |
| Scheduler | `scheduler.plan.created`, `scheduler.trigger.run_created`, `scheduler.trigger.skipped_by_policy`, `scheduler.trigger.missed_backfilled_latest` |
| Knowledge / Memory / Citation | `knowledge.search.requested`, `knowledge.document.viewed`, `memory.suggestion.created`, `memory.updated`, `citation.generated`, `citation.unknown_handle` |
| Credential / Security | `credential.grant.requested`, `credential.grant.revoked`, `security.prompt_injection.suspected`, `security.boundary.violation_blocked` |
| Governance / Audit | `skill.review.published`, `policy.version.published`, `audit.query.requested`, `audit.query.viewed`, `audit.query.exported` |

旧文档中出现的 snake_case 事件名可作为实现层别名，但概念设计应统一映射到 dotted 事件。

### 5.3 Projection Rules

| Projection | 输入事件 | 展示/查询口径 |
| --- | --- | --- |
| Desktop Run Timeline | Run、Step、Policy、Approval、Handoff、Tool、Artifact、Citation、Error | 用户可见摘要；敏感内容按 Visibility/Sensitivity 脱敏。 |
| Admin Audit Query | 所有 auditProjection != none 的事件 | 管理员按权限看到存在性、摘要、风险、目标、结果；正文另行授权。 |
| Security Audit | Policy deny、boundary violation、credential、sandbox、prompt injection、L4/L5 | 安全团队按策略查看；凭证明文永不展示。 |
| Runtime Health | Runtime/Worker/Scheduler health events | 用于恢复、诊断、用户提示和后台任务状态。 |
| Knowledge/Citation Trace | knowledge/memory/context/citation events | 支持引用复现、权限变化解释和来源反馈。 |

## 6. Context / Knowledge / Memory Ownership Boundary

为解决 Runtime 与 Knowledge/API 之间的职责张力，采用以下边界：

| 能力 | Owner | 说明 |
| --- | --- | --- |
| Per-Run ContextPackage assembly | Local Runtime / Context Builder | Runtime 负责在每次模型调用前组装上下文包、记录预算、裁剪、来源、策略快照和模型调用审计。 |
| Durable knowledge storage/retrieval | Knowledge Service / API | Knowledge 服务负责知识库、文档版本、索引、权限过滤、检索和文档生命周期。 |
| Durable memory storage | Memory Service / API | Memory 服务负责用户确认后的长期记忆、状态、禁用/删除和使用记录。 |
| ACL / policy resolution | Governance / Policy | 解析用户、角色、部门、项目、知识库、工具和 Skill 的有效权限。 |
| Citation validation | Result Composer + Runtime | Result Composer 只允许输出 ContextPackage 内的 CitationHandle；Runtime/Audit 记录 citation events。 |
| UI projection | Desktop | Desktop 展示引用卡、记忆使用、权限受限提示和撤销入口，不生成审计事实。 |

## 7. Scheduler Trigger Outcome Defaults

| 策略复核结果 | 默认 outcome | 是否创建 Run | 用户通知 | 审计要求 |
| --- | --- | --- | --- | --- |
| Allow | `run_created` | 是，进入 `planning` / `running` | 按通知偏好 | Scheduler Event + Run Lifecycle Event |
| Ask | `pending_approval_run_created` | 是，Run 初始进入 `awaiting_approval` 或 planning 后立即 awaiting | 必须通知/Attention Queue | Policy Decision Event + Approval Request Event |
| Deny | `skipped_by_policy` | 默认否；合规要求时可创建 synthetic skipped Run | 通知或按策略汇总 | Scheduler Event 记录策略快照、原因、影响范围 |
| Missed + skip | `missed_skipped` | 否 | 可选通知 | Scheduler Event |
| Missed + backfill latest | `missed_backfilled_latest` | 是，仅补最近一次低风险任务 | 通知 | Scheduler Event + Run Lifecycle Event |
| Missed + merge | `missed_merged` | 是，合并低风险汇总任务 | 通知 | Scheduler Event 说明合并范围 |
| Missed + ask user | `waiting_user_confirmation` | 可创建 pending Run 或仅通知 | 必须通知 | 说明用户需确认补偿策略 |

## 8. Source-system Authority Boundary

Agent 侧策略只追加限制，不替代源系统权限：

1. 源业务系统 ACL、MFA、审批流、操作日志仍是硬边界。
2. Agent 的用户确认或管理员审批不能让 Worker 使用源系统中用户本身无权执行的动作。
3. 离线策略缓存只能保持或收紧既有低风险权限；策略过期、不确定或风险升高时必须 Ask、Deny 或等待刷新。
4. Browser Worker / Connector 必须以源系统允许的用户或托管凭证作用域访问，不得把 Agent 管理员权限替代业务用户权限。
5. 审计中必须区分 Agent 侧决策、用户 handoff 动作和源系统最终业务结果。

## 9. MVP Slice

| Layer | 目标 | 必含 | 推迟 |
| --- | --- | --- | --- |
| P0 skeleton | 证明安全执行骨架闭环 | Run state machine；Tool Intent→PolicyDecision→Approval/Handoff→Worker Observation；local event journal；minimal audit projection；basic Desktop Run Card + Approval/Handoff；Browser/File Worker minimal isolation；data classification defaults | Knowledge full ingestion；Admin rich query；Skill Studio；Connector marketplace；Fleet |
| P1 usable enterprise MVP | 可用于内网查询/报告/低风险后台任务 | Scheduler low-risk runs；Credential Grant visibility/revocation seam；basic Knowledge/Citation read path；basic personal memory confirmation；basic Governance audit query + audit-of-audit；Settings 中授权目录/截图/凭证/记忆 | Full Replay；advanced retention export；enterprise Skill publishing workbench |
| P2 target-state | 平台化能力 | Full Replay；Skill Studio/version regression；broad Connector marketplace；Fleet Runtime management；advanced policy preview；controlled high-risk automation expansion | N/A |

## 10. 验证场景

| 场景 | 必须能追踪的链路 |
| --- | --- |
| 交互式报告生成 | Desktop start → Runtime Run created/planning/running → ContextPackage built → Browser/File/Knowledge Observation → Citation generated → Artifact created → Run completed → Timeline/Audit projection。 |
| 受控浏览器变更 | ToolIntent → PolicyDecision Ask/RequireHandoff → Approval/Handoff cause → Browser Worker action before/after evidence → Audit/Security events → Run completed/failed/cancelled。 |
| 定时缺陷/工单汇总 | Scheduler trigger → execution-time policy recheck → Allow/Ask/Deny outcome → low-risk report/draft only → Notification/Attention Queue → Scheduler/Run audit。 |

## 11. 验收清单

- [ ] 新增或修改的领域设计不重新定义本文件中的 canonical 状态/事件/决策语义。
- [ ] 每个新增事件都能映射到 `EventEnvelope`、Projection、Sensitivity、Visibility、Retention。
- [ ] 三个 MVP 验证场景能从 Desktop 入口追踪到 Runtime、Policy、Worker/Knowledge、Artifact/Audit。
- [ ] 高风险动作能区分 policy-required handoff 与 user-requested handoff。
- [ ] Scheduler Ask/Deny/Missed outcome 不再依赖各文档自行解释。
- [ ] Credential、ContextPackage、Citation、Memory、Audit Query 的可见性和保留由数据分类矩阵约束。
