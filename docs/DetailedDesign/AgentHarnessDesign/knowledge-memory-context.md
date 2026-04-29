# Agent Harness Knowledge / Memory / Context / Citation 详细设计

## 1. 范围与目标

本文面向企业内网通用型 Agent 助手的 `Context / Memory / Knowledge / Citation` 能力，承接：

- `docs/AgentHarnessDesign/# 企业内网通用型 Agent 助手需求文档` 中的个人偏好记忆、个人知识库、企业知识库、引用溯源、权限隔离和审计要求。
- `docs/AgentHarnessDesign/客户端 Agent Harness目录` 中第 4 层“Context / Memory / Knowledge 上下文记忆知识层”。
- `docs/Architecture/overview.md`、`docs/Architecture/domain-boundaries.md` 和 `docs/Architecture/layering-rules.md` 中对 Desktop、API、shared-contracts、PostgreSQL、MinIO、Redis/BullMQ 的边界约束。

目标是让 Agent 在不访问互联网、不越权、不伪造来源的前提下，能够：

- 组织当前会话、当前任务、附件、网页、工具结果和历史摘要，形成可控的模型上下文。
- 保存、展示、禁用、删除用户明确授权的长期偏好记忆。
- 检索个人知识库和企业知识库，并按用户权限过滤结果。
- 在回答、报告、知识入库建议和任务总结中展示可追溯引用。
- 将上下文使用、记忆使用、知识检索和引用生成纳入审计。

非目标：

- 不在第一阶段引入公网检索、外部 SaaS 知识库或外部模型服务。
- 不默认启用无确认的自动记忆写入。
- 不允许 Agent 直接修改企业知识库正式内容。
- 不把向量数据库作为首期硬依赖；首期以 PostgreSQL FTS + 权限过滤为基础，内网 Embedding/Reranker Adapter 只作为可插拔增强。
- 不在本文件设计 Admin Governance、Skill/Workflow、Audit Query 的完整后台页面；这些只作为本能力的依赖边界出现。

> 说明：本文中的接口、表名和 DTO 为目标契约草案，当前仓库尚未实现这些端点。文档不包含可直接执行的 `curl` 示例，避免把未落地接口误写为已验证命令。

## 2. 设计原则

| 原则 | 设计要求 |
| --- | --- |
| 权限先于检索 | 企业知识检索必须先计算用户可访问知识库和文档范围，再进入排序和上下文拼装。 |
| 引用不能伪造 | 模型回答只能引用 Context Builder 放入上下文包中的 `citationHandle`，Result Composer 必须拒绝未知引用。 |
| 记忆用户可控 | 长期记忆默认通过“建议保存 -> 用户确认 -> 写入”链路产生；用户可查看、禁用、删除和清空。 |
| 原文与索引分离 | MinIO 保存原始文档和附件，PostgreSQL 保存元数据、权限、索引 chunk、引用句柄和审计事件。 |
| 上下文可解释 | 每次模型调用都保存上下文包清单、来源类型、优先级、裁剪原因和 token 预算，不只保存最终 prompt 文本。 |
| 内网优先 | 检索、Embedding、Reranker 和模型调用均走本地或企业内网适配器，不将企业数据发往外网。 |
| 最小暴露 | Desktop 渲染层只看到可展示摘要、引用卡片和用户授权状态；文件、知识库、权限计算由 API/Electron 边界处理。 |

## 3. 核心概念

| 概念 | 说明 | 示例 |
| --- | --- | --- |
| `ContextItem` | 当前模型调用可使用的一段上下文输入。 | 用户输入、当前任务卡片、上传文件片段、浏览器表格、工具观察结果、知识 chunk。 |
| `ContextPackage` | 一次模型调用前由 Context Builder 生成的有序上下文集合。 | system/policy 指令、用户问题、最近会话、检索结果、记忆、引用句柄。 |
| `Memory` | 用户确认保存的长期偏好或稳定事实。 | “日报按项目/风险/明日计划三段输出”、“常用项目为 A 系统”。 |
| `KnowledgeBase` | 可检索的个人或企业知识容器。 | 个人项目笔记库、部门发布流程库、运维应急预案库。 |
| `KnowledgeDocument` | 知识库中的一份文档，具备版本、权限、状态和原始对象引用。 | Markdown 会议纪要、PDF 流程手册、Excel 检查清单。 |
| `KnowledgeChunk` | 文档被解析、分段、索引后的检索单元。 | 文档第 3 节“发布审批流程”的 800 字文本片段。 |
| `CitationHandle` | 允许模型在回答中引用的短句柄。 | `CIT-3` 指向某知识 chunk、文件片段或浏览器截图摘要。 |
| `Citation` | 对用户展示和审计保存的引用记录。 | 来源标题、版本、章节、片段摘要、访问时间、是否过期。 |

## 4. 总体架构

```mermaid
flowchart LR
  UI[Desktop UI\n对话/知识库/记忆管理] --> Workspace[Workspace Facade]
  Workspace --> APIClient[API Client]
  Workspace --> Bridge[Electron Desktop Bridge]

  APIClient --> ConversationAPI[Conversation / Run API]
  APIClient --> KnowledgeAPI[Knowledge API]
  APIClient --> MemoryAPI[Memory API]

  Bridge --> LocalFiles[授权文件/截图/本地资料]

  ConversationAPI --> ContextBuilder[Context Builder]
  ContextBuilder --> MemoryService[Memory Service]
  ContextBuilder --> RetrievalService[Knowledge Retrieval Service]
  ContextBuilder --> ToolObservation[Tool Observation Store]
  ContextBuilder --> ModelOrchestrator[Model Orchestrator]
  ModelOrchestrator --> ResultComposer[Result Composer]

  KnowledgeAPI --> KnowledgeService[Knowledge Service]
  KnowledgeService --> ParserJobs[Parse / Index Jobs]
  ParserJobs --> PG[(PostgreSQL\nmetadata + FTS + chunks)]
  ParserJobs --> MinIO[(MinIO\noriginal files)]

  MemoryService --> PG
  RetrievalService --> PG
  RetrievalService -. optional .-> Embedder[Internal Embedding / Reranker Adapter]
  ResultComposer --> Audit[Audit / Citation Events]
  Audit --> PG
```

落地边界：

- Desktop React 负责展示对话、引用卡片、记忆管理入口和知识库选择，不直接读取任意本地文件或绕过 API 修改知识库。
- Electron 只处理用户授权的本地文件、截图和临时资料读取，并返回结构化 `ContextItem` 或文件引用，不保存企业知识库权限。
- API 模块负责会话上下文编排、记忆、知识库、引用、权限过滤和审计。
- PostgreSQL 首期承担元数据、文档 chunk、全文检索、审计和记忆存储。
- MinIO 保存原始知识文档、附件、截图和可下载产物。
- Redis/BullMQ 承担文档解析、索引构建、过期重建和引用统计等后台任务。

## 5. 模块划分

### 5.1 API 模块

建议新增或扩展以下 NestJS 模块：

```text
apps/api/src/agent-context/
├── agent-context.module.ts
├── agent-runs.controller.ts
├── context-builder.service.ts
├── context-budget.policy.ts
├── context-source.mapper.ts
├── citation-composer.service.ts
├── citation.repository.ts
└── agent-context.types.ts

apps/api/src/memory/
├── memory.module.ts
├── memory.controller.ts
├── memory.service.ts
├── memory-policy.service.ts
├── memory.repository.ts
└── memory.types.ts

apps/api/src/knowledge/
├── knowledge.module.ts
├── knowledge.controller.ts
├── knowledge-admin.controller.ts
├── knowledge.service.ts
├── knowledge-ingestion.service.ts
├── knowledge-retrieval.service.ts
├── knowledge-permission.policy.ts
├── knowledge.repository.ts
├── knowledge-index-job.processor.ts
└── knowledge.types.ts
```

| 模块 | 责任 | 不应承担 |
| --- | --- | --- |
| `agent-context` | 构建模型上下文包、分配 token 预算、生成引用句柄、记录上下文和引用审计。 | 不直接解析文件、不决定企业文档权限。 |
| `memory` | 管理用户长期记忆、记忆建议、禁用/删除、记忆使用记录。 | 不保存一次性上下文和敏感凭证。 |
| `knowledge` | 管理个人/企业知识库、文档版本、解析索引、检索、权限过滤、过期标记。 | 不直接调用模型生成最终回答。 |
| `auth/admin` | 提供用户身份、部门、角色、菜单权限和管理员动作授权。 | 不拼装模型上下文。 |
| `publishing/skills` | 后续可把稳定流程沉淀为 Skill；本文件只消费其权限和审核结论。 | 不绕过 Skill 审核自动发布。 |

### 5.2 Desktop 模块

建议 Desktop 保持现有 `services`、`state/workspace`、`ui` 分层：

```text
apps/desktop/src/services/p1Client/
├── agentRuns.ts
├── knowledge.ts
└── memory.ts

apps/desktop/src/state/workspace/
├── useWorkspaceAgentRuns.ts
├── useWorkspaceKnowledge.ts
└── useWorkspaceMemory.ts

apps/desktop/src/ui/
├── AgentChat.tsx
├── CitationPanel.tsx
├── MemorySettingsPanel.tsx
└── KnowledgePicker.tsx
```

Desktop 只展示：

- 本次回答使用了哪些记忆、知识文档、文件、网页和工具结果。
- 每条引用的标题、来源类型、更新时间、版本、过期状态和可打开入口。
- 记忆建议、保存理由、使用次数、禁用/删除操作。
- 知识库检索范围和权限受限提示。

Desktop 不展示或不保存：

- 未授权文档内容。
- 原始 prompt 中的敏感字段。
- 未脱敏的凭证、Cookie、Token 或内部系统会话数据。

## 6. 上下文构建设计

### 6.1 ContextItem 来源

| 来源类型 | 产生位置 | 默认优先级 | 是否可引用 | 说明 |
| --- | --- | --- | --- | --- |
| `policy_instruction` | 企业/部门/项目策略 | P0 | 否 | 系统约束、权限和安全规则，必须在上下文包顶部。 |
| `user_request` | 当前对话输入 | P0 | 否 | 当前用户明确问题或指令。 |
| `task_state` | Run Manager / Task Card | P1 | 可选 | 当前任务目标、步骤、状态和人工确认结果。 |
| `conversation_recent` | Conversation Manager | P1 | 否 | 最近若干轮对话，按 token 预算裁剪。 |
| `conversation_summary` | Summary Job | P2 | 否 | 长会话压缩摘要，低于当前轮输入。 |
| `memory` | Memory Service | P2 | 是 | 经用户确认保存的长期偏好，回答中可展示“使用了哪些记忆”。 |
| `knowledge_chunk` | Knowledge Retrieval | P2 | 是 | 个人/企业知识库检索结果，必须带 `citationHandle`。 |
| `file_excerpt` | Electron 授权文件读取 | P2 | 是 | 用户授权文件或上传附件片段。 |
| `browser_observation` | Browser Tool | P2 | 是 | 页面提取表格、正文、URL、截图摘要。 |
| `tool_result` | Tool System | P3 | 是 | 工具调用结构化结果，按风险等级和可信度标记。 |
| `draft_artifact` | Artifact Store | P3 | 可选 | Agent 生成中的文档草稿、表格草稿。 |

### 6.2 ContextPackage 结构

目标 DTO 草案：

```ts
interface ContextPackage {
  runID: string;
  modelCallID: string;
  userID: string;
  createdAt: ISODateTimeString;
  tokenBudget: {
    maxInputTokens: number;
    reservedOutputTokens: number;
    allocatedByTier: Record<string, number>;
  };
  items: ContextPackageItem[];
  omittedItems: ContextOmittedItem[];
  citationHandles: CitationHandle[];
  safetyFlags: string[];
}
```

字段要求：

- `items` 必须按优先级和原始顺序稳定排序，便于复现。
- `omittedItems` 记录被裁剪内容的来源、长度和裁剪原因，例如 `token_budget_exceeded`、`permission_denied`、`duplicate_lower_rank`。
- `citationHandles` 只包含模型可见且允许引用的来源；Result Composer 只能输出这些 handle。
- `safetyFlags` 记录 prompt injection、过期知识、敏感字段脱敏、权限受限等信号。

### 6.3 Token 预算策略

首期建议默认预算：

| 上下文层 | 预算建议 | 裁剪策略 |
| --- | --- | --- |
| P0 policy + user request | 必保留 | 仅允许模板化压缩，不丢弃。 |
| P1 task + recent conversation | 25% | 保留当前任务、最近 N 轮；旧轮次进入摘要。 |
| P2 retrieved knowledge + memory + files | 55% | 按权限、相关性、新鲜度、引用必要性排序。 |
| P3 tool observations + artifacts | 20% | 优先结构化摘要，长日志只保留关键行和附件引用。 |

裁剪规则：

1. 先执行权限过滤和敏感字段脱敏，再排序。
2. 相同来源重复 chunk 合并为一个引用 handle，避免同文档刷屏。
3. 长文档优先保留标题、章节路径、命中片段和相邻上下文，不整篇塞入 prompt。
4. 过期文档可以进入上下文，但必须带 `stale=true`，回答中提示可能过期。
5. 如果用户要求“只依据某文件/某知识库回答”，Context Builder 必须降低其他知识源权重并记录范围限制。

### 6.4 长任务续跑上下文

长任务或定时任务恢复时，Context Builder 不应依赖浏览器内存态，而应从持久化状态重建：

- `agent_runs`：任务目标、状态机节点、最近确认、暂停原因。
- `agent_run_steps`：步骤、工具调用摘要、结果状态。
- `agent_context_snapshots`：上次模型调用的上下文包摘要和引用 handle。
- `artifact_versions`：草稿文件、截图、表格和报告中间版本。
- `citation_events`：已使用来源，避免恢复后引用丢失。

恢复策略：

1. 读取 run 当前状态和最后成功 checkpoint。
2. 重新验证用户身份、权限、知识库可访问范围。
3. 对知识来源执行新鲜度检查；若文档版本变化，重新检索并标记 `sourceChanged=true`。
4. 生成新的 ContextPackage，而不是直接复用旧 prompt。
5. 在 UI 提示“任务已恢复，上下文已按最新权限重新构建”。

## 7. 记忆设计

### 7.1 记忆类型

| 类型 | 示例 | 默认写入方式 | 使用场景 |
| --- | --- | --- | --- |
| `format_preference` | “周报按 本周完成/风险/下周计划 输出。” | 用户确认 | 报告、日报、周报生成。 |
| `style_preference` | “回答偏简洁，先给结论。” | 用户确认 | 对话和报告语气。 |
| `project_reference` | “常用项目为支付中台。” | 用户确认 | 项目资料检索和任务分类。 |
| `knowledge_location` | “项目知识库在个人库/支付中台。” | 用户确认 | 知识库选择和默认检索范围。 |
| `intranet_shortcut` | “缺陷系统入口为内网 URL。” | 用户确认，管理员策略允许 | 浏览器操作和快捷入口。 |
| `workflow_preference` | “测试日报先查缺陷系统，再查用例系统。” | 用户确认 | 周期任务、流程模板建议。 |
| `do_not_remember` | “不要记住某类项目代号。” | 用户主动配置 | 记忆过滤和自动建议抑制。 |

### 7.2 记忆写入流程

```mermaid
sequenceDiagram
  participant Agent as Agent Loop
  participant Memory as Memory Service
  participant User as User
  participant DB as PostgreSQL
  participant Audit as Audit

  Agent->>Memory: proposeMemory(runID, candidate, evidence)
  Memory->>Memory: classify + sensitivity check + duplicate check
  Memory-->>Agent: memorySuggestion(status=needs_user_confirmation)
  Agent-->>User: 展示建议保存的记忆、来源和用途
  User->>Memory: approve / edit / reject
  alt approve or edit
    Memory->>DB: upsert user_memories
    Memory->>Audit: write memory_create event
  else reject
    Memory->>Audit: write memory_reject event
  end
```

约束：

- 默认不自动保存敏感业务信息、个人隐私、账号密码、一次性上下文和临时任务信息。
- 记忆建议必须展示来源证据，例如“来自本次对话第 4 轮用户明确要求”。
- 用户可以编辑后保存，保存版本应记录 `createdFromRunID` 和 `evidenceRef`。
- 重复记忆不重复写入，应提示合并或更新现有记忆。
- 禁用记忆仍保留历史记录用于审计和恢复；删除记忆按数据保留策略执行软删除或硬删除。

### 7.3 记忆使用流程

1. Context Builder 根据当前用户、任务类型和知识库范围查询候选记忆。
2. Memory Policy 过滤 `disabled`、`expired`、`do_not_use_for_task` 和策略禁止项。
3. 候选记忆按类型、显式匹配、最近使用、用户 pin 状态排序。
4. 进入 ContextPackage 的记忆必须生成可展示 `citationHandle` 或 `memoryUseHandle`。
5. Result Composer 输出时附带“使用了以下记忆”，用户可一键禁用或纠正。

### 7.4 记忆管理 UI

记忆管理页需要支持：

- 列表查看：类型、内容、来源、创建时间、最近使用、状态。
- 搜索和过滤：按类型、项目、知识库、是否禁用、是否过期。
- 操作：新增、编辑、禁用、启用、删除、清空、导出。
- 规则：配置“不允许自动建议记忆”的关键词、知识库、任务类型。
- 使用记录：查看某条记忆被哪些回答使用，跳转到相关会话和引用。

## 8. 知识库设计

### 8.1 知识库分类

| 类型 | 所有者 | 存储 | 权限模型 | 修改边界 |
| --- | --- | --- | --- | --- |
| 个人知识库 | 单个用户 | MinIO + PostgreSQL；可同步用户授权本地目录 | 仅本人访问，可显式授权项目/同事查看后续版本 | Agent 修改前必须用户确认。 |
| 企业知识库 | 管理员/部门 | MinIO + PostgreSQL | 按部门、角色、项目、用户白名单授权 | Agent 默认只读；正式修改走管理员审核。 |
| 会话资料库 | 用户/任务 | MinIO + PostgreSQL | 跟随 run/session 权限 | 作为执行产物保存，可由用户选择入库。 |
| 工具观察库 | 系统 | PostgreSQL 摘要 + MinIO 附件 | 跟随工具权限和会话权限 | 用于审计和复盘，不直接成为长期知识。 |

### 8.2 文档生命周期

```mermaid
stateDiagram-v2
  [*] --> uploaded
  uploaded --> parsing: enqueue parse job
  parsing --> indexed: parse ok + chunks indexed
  parsing --> parse_failed: parse error
  indexed --> published: permission grants active
  published --> stale: marked outdated or source changed
  stale --> indexed: reindex
  published --> archived: admin/user archive
  parse_failed --> uploaded: replace file
  archived --> [*]
```

规则：

- 原始文件写入 MinIO 后才创建可索引版本记录。
- 文档更新必须创建新版本，旧版本保留用于引用复现和审计。
- `published` 企业文档变更必须由管理员或具备知识库维护权限的用户执行。
- 个人知识库文档可由用户确认后写入，但批量整理、删除、合并仍需二次确认。
- 解析失败不影响原始文件保留，但该版本不可进入检索结果。

### 8.3 检索流程

```mermaid
sequenceDiagram
  participant User as User / Run
  participant Context as Context Builder
  participant Policy as Knowledge Permission Policy
  participant Retrieval as Retrieval Service
  participant DB as PostgreSQL FTS
  participant Ranker as Internal Reranker (optional)

  Context->>Policy: resolveAccessibleScopes(userID, taskContext)
  Policy-->>Context: allowedKnowledgeBaseIDs + document filters
  Context->>Retrieval: search(query, scopes, freshnessRules)
  Retrieval->>DB: FTS query with permission filters
  DB-->>Retrieval: candidate chunks
  opt internal reranker enabled
    Retrieval->>Ranker: rerank candidates inside intranet
    Ranker-->>Retrieval: reranked candidates
  end
  Retrieval-->>Context: chunks + citation metadata + stale flags
```

排序信号：

- 文本相关性：PostgreSQL FTS rank。
- 权限近度：个人知识 > 项目授权知识 > 部门公共知识 > 企业通用知识，除非用户指定范围。
- 新鲜度：最新版本、未过期、最近维护。
- 质量信号：管理员认证、用户反馈、引用成功率。
- 任务匹配：任务类型、项目名、标签、知识库选择。
- 去重：同文档相邻 chunk 合并，避免重复引用。

### 8.4 解析和索引

首期支持格式建议：

| 格式 | 解析策略 | 备注 |
| --- | --- | --- |
| Markdown / TXT | 直接解析标题层级和段落。 | 首选知识沉淀格式。 |
| PDF | 使用内网部署解析器提取文本和页码。 | 保留页码用于引用。 |
| DOCX | 使用文档解析服务提取段落、标题、表格摘要。 | 原文件保存在 MinIO。 |
| XLSX / CSV | 表头、sheet、区域摘要和行级片段。 | 大表只索引摘要和关键列。 |
| HTML / 内网页面快照 | 保存 URL、标题、抓取时间、正文区域。 | 需要浏览器访问权限和审计。 |
| 图片 / 截图 | 首期只保存元数据和人工说明；OCR 为可选增强。 | OCR 必须走内网服务。 |

Chunk 生成规则：

- 每个 chunk 保留 `documentVersionID`、章节路径、页码/行号/URL fragment、文本 hash。
- chunk 大小建议 300-900 中文字，保留 1 个相邻段落窗口作为引用上下文。
- 对表格生成结构化摘要，避免把整表塞进模型上下文。
- 对含敏感字段的 chunk 设置 `sensitivityFlags`，检索后仍需二次脱敏。

## 9. 引用溯源设计

### 9.1 CitationHandle 生成

Context Builder 为可引用来源生成短句柄：

```ts
interface CitationHandle {
  handle: string; // CIT-1, CIT-2...
  sourceType: "personal_knowledge" | "enterprise_knowledge" | "file" | "browser" | "tool_result" | "memory";
  sourceID: string;
  sourceVersionID?: string;
  title: string;
  locationLabel?: string; // page/section/sheet/url/step
  excerpt: string;
  stale: boolean;
  permissionScope: string;
  contentHash: string;
}
```

生成要求：

- `handle` 在一次模型调用内唯一、短小、稳定排序。
- `excerpt` 必须来自真实可访问来源，且已经完成敏感字段脱敏。
- `contentHash` 用于审计复现和后续检测来源是否变化。
- 不允许模型自己创造 `CIT-*`；Result Composer 只接受 ContextPackage 里存在的 handle。

### 9.2 模型输出约束

Prompt / Instruction Builder 应明确要求：

- 使用知识库、文件、网页或工具结果回答时，必须在相关句子后标注引用 handle。
- 无可靠来源时必须说明“不确定”或“当前知识库未找到依据”。
- 不得引用未出现在上下文包里的来源。
- 对过期来源必须提示“该来源已标记过期”。
- 个人知识和企业知识需要在引用卡片中区分。

Result Composer 校验：

1. 扫描模型输出中的引用 handle。
2. 丢弃或标红未知 handle，并触发 `citation_unknown_handle` 安全事件。
3. 如果回答包含知识性断言但没有引用，按任务类型触发补救：重新要求模型补引用，或向用户提示“该回答未找到可引用来源”。
4. 生成 UI 可展示 `CitationCard[]`，并写入 `citation_events`。

### 9.3 用户展示

引用卡片至少包含：

- 来源标题。
- 来源类型：个人知识、企业知识、授权文件、内网页面、工具结果、记忆。
- 位置：章节、页码、sheet、URL、工具步骤。
- 更新时间或抓取时间。
- 文档版本。
- 是否过期、是否权限受限、是否来自用户个人知识。
- 打开来源、复制引用、反馈问题入口。

当引用不可打开时，UI 应说明原因：

- 用户当前权限已变化。
- 来源已归档或删除。
- 本地文件不在当前授权目录。
- 浏览器页面快照已过期但审计摘要仍可查看。

## 10. 数据模型草案

### 10.1 PostgreSQL 表

`knowledge_bases`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 知识库 ID。 |
| `type` | text | `personal` / `enterprise` / `session`。 |
| `owner_user_id` | uuid nullable | 个人知识库所有者。 |
| `owner_department_id` | uuid nullable | 部门或企业知识库归属。 |
| `name` | text | 名称。 |
| `description` | text | 描述。 |
| `status` | text | `active` / `archived` / `disabled`。 |
| `default_visibility` | text | 默认访问范围。 |
| `created_at` / `updated_at` | timestamptz | 时间戳。 |

`knowledge_documents`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 文档 ID。 |
| `knowledge_base_id` | uuid | 所属知识库。 |
| `title` | text | 标题。 |
| `source_kind` | text | `upload` / `markdown` / `browser_snapshot` / `generated_artifact`。 |
| `status` | text | `draft` / `published` / `stale` / `archived`。 |
| `tags` | text[] | 标签。 |
| `created_by` / `updated_by` | uuid | 操作人。 |
| `created_at` / `updated_at` | timestamptz | 时间戳。 |

`knowledge_document_versions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 文档版本 ID。 |
| `document_id` | uuid | 文档 ID。 |
| `version_number` | integer | 单文档递增版本。 |
| `bucket` / `object_key` | text | MinIO 原始文件位置。 |
| `content_sha256` | text | 原始内容 hash。 |
| `parse_status` | text | `pending` / `indexed` / `failed`。 |
| `parser_version` | text | 解析器版本。 |
| `published_at` | timestamptz nullable | 发布时间。 |

`knowledge_chunks`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | chunk ID。 |
| `document_version_id` | uuid | 文档版本。 |
| `chunk_index` | integer | 顺序号。 |
| `section_path` | text | 章节路径。 |
| `location_label` | text | 页码、行号、sheet 或 URL fragment。 |
| `content_text` | text | 脱敏后可检索文本。 |
| `content_hash` | text | chunk hash。 |
| `fts_vector` | tsvector | PostgreSQL FTS 索引。 |
| `sensitivity_flags` | text[] | 敏感标记。 |
| `created_at` | timestamptz | 时间戳。 |

`knowledge_access_grants`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 授权 ID。 |
| `knowledge_base_id` / `document_id` | uuid nullable | 授权范围。 |
| `subject_type` | text | `user` / `department` / `role` / `project`。 |
| `subject_id` | text | 主体 ID。 |
| `permission` | text | `read` / `maintain` / `admin`。 |
| `expires_at` | timestamptz nullable | 过期时间。 |

`user_memories`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 记忆 ID。 |
| `user_id` | uuid | 用户。 |
| `type` | text | 记忆类型。 |
| `content` | text | 记忆内容。 |
| `status` | text | `active` / `disabled` / `deleted`。 |
| `source_run_id` | uuid nullable | 来源会话。 |
| `evidence_ref` | text | 来源证据描述。 |
| `scope` | jsonb | 适用项目、知识库、任务类型。 |
| `last_used_at` | timestamptz nullable | 最近使用。 |
| `created_at` / `updated_at` | timestamptz | 时间戳。 |

`agent_context_packages`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 上下文包 ID。 |
| `run_id` | uuid | Agent run。 |
| `model_call_id` | uuid | 模型调用。 |
| `user_id` | uuid | 用户。 |
| `token_budget` | jsonb | 预算和分配。 |
| `item_summary` | jsonb | 上下文来源清单，不默认保存完整敏感内容。 |
| `omitted_summary` | jsonb | 裁剪清单。 |
| `created_at` | timestamptz | 时间戳。 |

`citation_events`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 引用事件 ID。 |
| `run_id` / `model_call_id` | uuid | 关联调用。 |
| `handle` | text | 引用句柄。 |
| `source_type` | text | 来源类型。 |
| `source_id` / `source_version_id` | text | 来源 ID。 |
| `content_hash` | text | 引用内容 hash。 |
| `display_title` | text | 展示标题。 |
| `location_label` | text | 位置。 |
| `stale` | boolean | 是否过期。 |
| `created_at` | timestamptz | 时间戳。 |

### 10.2 MinIO 对象布局

```text
knowledge/
├── personal/{userID}/{knowledgeBaseID}/{documentID}/{versionID}/original
├── enterprise/{knowledgeBaseID}/{documentID}/{versionID}/original
├── session/{runID}/{artifactID}/original
└── derived/{documentVersionID}/parser-output.json
```

要求：

- 原始对象不可被覆盖；更新必须产生新 `versionID`。
- 派生解析产物可重建，但应记录 `parserVersion` 和 `contentSha256`。
- 删除个人知识库时，根据数据保留策略决定立即删除或进入延迟删除队列。

## 11. API 与本地命令草案

### 11.1 Desktop/API HTTP

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| `POST` | `/agent-runs/{runID}/context/preview` | 预览本次模型调用会使用的知识库、记忆和文件来源。 | 当前 run 用户。 |
| `GET` | `/agent-runs/{runID}/citations` | 查询一次会话或模型调用的引用卡片。 | 当前 run 用户或审计权限。 |
| `GET` | `/memories` | 查询当前用户记忆。 | 当前用户。 |
| `POST` | `/memories` | 用户手动新增记忆。 | 当前用户。 |
| `PATCH` | `/memories/{memoryID}` | 编辑、禁用、启用记忆。 | 当前用户。 |
| `DELETE` | `/memories/{memoryID}` | 删除记忆。 | 当前用户。 |
| `POST` | `/memories/suggestions/{suggestionID}/approve` | 批准 Agent 的记忆建议。 | 当前用户。 |
| `GET` | `/knowledge-bases` | 查询可访问知识库。 | 当前用户。 |
| `POST` | `/knowledge-bases/personal` | 创建个人知识库。 | 当前用户。 |
| `POST` | `/knowledge-bases/{knowledgeBaseID}/documents` | 上传或创建知识文档。 | 个人库本人；企业库维护权限。 |
| `GET` | `/knowledge-bases/{knowledgeBaseID}/documents` | 查询文档列表。 | read 权限。 |
| `POST` | `/knowledge/search` | 在授权范围内检索知识库。 | read 权限。 |
| `POST` | `/knowledge/documents/{documentID}/feedback` | 反馈答案或文档问题。 | read 权限。 |

### 11.2 Electron local commands

| Command | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| `read_authorized_file_excerpt` | `fileToken, range?, maxChars` | `file_excerpt ContextItem` | 只读取用户授权文件。 |
| `create_session_artifact` | `runID, artifactType, contentRef` | `artifactID, objectRef` | 保存会话资料或草稿。 |
| `capture_browser_source_snapshot` | `browserSessionID, url, title, text, screenshotRef?` | `browser_observation ContextItem` | 保存网页来源快照和引用元数据。 |
| `prepare_personal_knowledge_import` | `authorizedDirectoryToken, includePatterns` | `importPlan` | 本地个人知识库导入预览，真正入库仍需确认。 |

Electron 命令必须继续遵守现有安全边界：renderer 不直接访问文件系统，所有路径必须来自用户授权或安全对话框返回的 token。

## 12. 权限、安全与审计

### 12.1 权限规则

- 企业知识检索必须使用 Auth/Admin 模块解析出的用户、部门、角色、项目范围。
- 文档级授权优先于知识库默认授权；显式 deny 优先于 allow。
- 个人知识默认只允许本人访问；共享能力必须单独设计确认和撤销链路。
- Run 恢复、定时任务执行、后台总结均需重新计算权限，不复用旧检索结果的权限结论。
- 用户被移出部门或项目后，后续 ContextPackage 不得再包含原范围企业文档。

### 12.2 Prompt injection 防护

对知识 chunk、网页、文件和工具结果统一标记为“非可信内容”：

- 非可信内容不得覆盖企业级指令、用户指令和权限策略。
- 如果来源文本包含“忽略之前指令”“导出全部文档”等可疑内容，记录 `prompt_injection_suspected`，并在上下文中作为数据而非指令呈现。
- Result Composer 对高风险工具建议、知识库修改建议和文件删除建议强制要求用户确认。

### 12.3 审计事件

本能力至少写入以下审计事件：

| 事件 | 触发时机 | 关键字段 |
| --- | --- | --- |
| `context_package_created` | 每次模型调用前 | runID、item counts、omitted reasons、token budget。 |
| `knowledge_search` | 每次检索 | query hash、knowledgeBaseIDs、result count、permission filters。 |
| `knowledge_document_accessed` | chunk 进入上下文或用户打开来源 | documentID、versionID、userID、runID。 |
| `citation_generated` | 回答生成引用 | handle、sourceID、contentHash、stale。 |
| `memory_suggested` | Agent 建议保存记忆 | candidate type、evidenceRef、sensitivity flags。 |
| `memory_created/updated/disabled/deleted` | 用户管理记忆 | memoryID、operator、reason。 |
| `knowledge_document_created/updated/archived` | 文档变更 | documentID、versionID、operator、approval state。 |

审计存储应优先保存结构化元数据和 hash，避免默认复制完整敏感正文。

## 13. 典型流程

### 13.1 企业知识库问答

1. 用户提问：“公司发布流程是怎样的？”
2. Context Builder 识别任务需要企业知识库检索。
3. Knowledge Permission Policy 计算用户可访问的发布流程知识库。
4. Retrieval Service 使用 PostgreSQL FTS 检索相关 chunk，可选调用内网 Reranker。
5. Context Builder 生成 `CIT-1`、`CIT-2` 等引用句柄。
6. Model Orchestrator 调用内网模型，要求基于上下文回答并标注引用。
7. Result Composer 校验引用句柄，生成引用卡片。
8. Audit 写入知识检索、文档访问、引用生成事件。

### 13.2 会议纪要写入个人知识库

1. 用户上传或选择会议纪要文件。
2. Electron 返回授权文件摘要和文件引用，不暴露任意路径访问能力。
3. Agent 提取主题、时间、参会人、结论和待办，生成 Markdown 草稿。
4. UI 展示保存路径、文档标题、标签和内容预览。
5. 用户确认后调用个人知识库文档创建接口。
6. Knowledge Ingestion 写入 MinIO、创建文档版本、排队解析索引。
7. 审计记录文件读取、用户确认、个人知识库写入。

### 13.3 记忆建议保存

1. 用户多次要求“日报按项目、风险、明日计划三段输出”。
2. Memory Service 生成 `format_preference` 建议。
3. UI 展示建议内容、来源会话和未来用途。
4. 用户编辑后确认保存。
5. 后续日报任务中 Context Builder 自动带入该记忆，并在回答尾部展示“使用了 1 条记忆”。

## 14. 失败与降级

| 场景 | 降级行为 | 用户提示 |
| --- | --- | --- |
| 知识库索引未完成 | 仅检索已完成版本；显示索引中状态。 | “部分文档仍在索引，结果可能不完整。” |
| 文档解析失败 | 保留原文件，不进入检索；管理员或用户可重试。 | “该文档暂不可检索，请查看解析错误。” |
| 用户权限变化 | 重新过滤上下文，移除不可访问来源。 | “部分来源因权限变化已从上下文移除。” |
| 引用来源过期 | 允许引用但标记 `stale`。 | “引用来源已标记过期，请核对最新制度。” |
| 内网 Reranker 不可用 | 回退 PostgreSQL FTS 排序。 | 一般不打断用户，只记录降级事件。 |
| token 超限 | 记录 omittedItems，优先保留 P0/P1 和高相关来源。 | “部分低优先级上下文已裁剪。” |
| 未找到可靠来源 | 不编造答案。 | “当前授权知识库未找到依据。” |

## 15. Shared Contracts 影响

后续实现应先在 `packages/shared-contracts` 增加共享契约，再更新 API/Desktop：

- `ContextSourceType`、`ContextPackagePreview`、`ContextOmittedReason`。
- `MemoryType`、`UserMemory`、`MemorySuggestion`、`MemoryStatus`。
- `KnowledgeBaseType`、`KnowledgeDocumentStatus`、`KnowledgeSearchRequest/Response`。
- `CitationSourceType`、`CitationCard`、`CitationStaleReason`。
- API route constants：`agentRunsRoutes`、`memoryRoutes`、`knowledgeRoutes`。

保持现有 JSON 风格：字段使用 camelCase，历史 ID 字段可延续 `userID`、`runID`、`knowledgeBaseID` 写法。

## 16. 验收标准

### 16.1 功能验收

- 用户可以查看、保存、编辑、禁用、删除个人记忆。
- Agent 使用记忆时，UI 能显示使用了哪些记忆。
- 用户可以创建个人知识库并上传 Markdown 文档。
- 管理员可以创建企业知识库、上传文档、设置部门/角色/项目权限。
- 普通用户只能检索自己有权限的企业文档。
- 回答引用知识库内容时展示引用卡片，引用卡片能打开到对应文档或说明不可打开原因。
- 文档被标记过期后，回答仍可引用但必须提示过期。
- 用户权限变化后，新一轮回答不得继续使用已失效来源。

### 16.2 安全验收

- 未经用户确认，Agent 不会长期保存新的个人记忆。
- 记忆建议不会包含密码、Cookie、Token、一次性上下文和被策略禁止保存的信息。
- 企业知识库正式内容不会被 Agent 直接修改。
- prompt injection 文本只能作为非可信资料进入上下文，不能覆盖系统策略。
- 引用句柄必须来自 ContextPackage，模型输出未知引用时会被拦截或标记。
- 审计事件能追踪知识检索、文档访问、记忆变更和引用生成。

### 16.3 工程验收

- 新增 API 模块遵守 controller/service/repository/policy 分层。
- Desktop UI 通过 workspace facade 调用知识库、记忆和引用能力。
- shared-contracts 是跨端 DTO 和 route 常量真源。
- 文档原文进入 MinIO，数据库只保存元数据、索引 chunk、权限和审计。
- PostgreSQL FTS 可在无 Embedding 服务时独立完成首期检索闭环。

## 17. 实施顺序建议

1. 在 `packages/shared-contracts` 增加 Context/Memory/Knowledge/Citation 基础 DTO 和 route constants。
2. 实现 `memory` 模块：用户记忆 CRUD、建议确认、使用记录。
3. 实现 `knowledge` 模块：个人知识库、企业知识库、文档版本、权限和 PostgreSQL FTS 检索。
4. 实现文档解析和索引 BullMQ 任务，先支持 Markdown/TXT，再扩展 PDF/DOCX/XLSX。
5. 实现 `agent-context` 模块：ContextPackage 预览、token 预算、引用句柄生成。
6. 接入 Model Orchestrator 和 Result Composer 引用校验。
7. Desktop 增加引用面板、记忆管理和知识库选择入口。
8. 增加审计查询、权限变化回归测试和 prompt injection 负例测试。

## 18. 测试建议

| 类型 | 测试重点 |
| --- | --- |
| Unit | 记忆敏感内容过滤、权限策略、token 预算、引用句柄校验、FTS 查询构造。 |
| Integration | 文档上传 -> MinIO -> 解析 -> chunk 入库 -> 检索 -> 引用卡片。 |
| Contract | shared-contracts 与 API/Desktop DTO 字段一致。 |
| Security | 越权检索、未知引用、prompt injection、敏感记忆建议、高风险知识库修改。 |
| E2E | 企业知识库问答、会议纪要入个人知识库、记忆建议保存和禁用。 |
| Regression | 用户权限变化后上下文重建、文档过期提示、Reranker 降级到 FTS。 |

