# Policy / Approval / Credential / Sandbox 详细设计

## 1. 目标与边界

本设计定义 Enterprise Agent Harness 的策略判定、权限确认、凭证处理与沙箱隔离语义。它承接原始需求中的权限分层、用户确认、浏览器隔离、文件访问隔离、截图和日志受控、审计留痕、Skill 权限声明、内网无公网外传等要求，并落实 RALPLAN 确认的 **策略先于动作，审计伴随动作** 架构原则。

### 1.1 设计目标

- 让所有工具、浏览器、文件、知识库、Skill、Scheduler 动作先经过统一策略判定，再进入执行或审批。
- 将 L0-L5 风险等级、Allow/Ask/Deny/Mask/Redact/Limit 决策、用户确认、管理员审批和人工接管纳入同一概念模型。
- 明确 Credential/Secret 只按最小范围授权给具体工具或 Worker，不能暴露给模型、日志或普通审计内容。
- 明确 Browser、File/Document、Shell/Command、HTTP/Connector 等风险能力必须在受限沙箱中执行。
- 保证 Runtime 恢复、定时任务、Skill 执行和离线策略缓存不会复用过期授权或绕过企业治理。
- 为 Runtime、Tool Gateway、Browser/File Worker、Desktop Approval UX、Admin Governance 与 Audit 详细设计提供稳定安全语义。

### 1.2 明确边界

本文件只描述概念级安全与治理设计，不包含：

- 数据库表结构、密钥存储格式或持久化字段设计。
- 端点级 API、IPC channel 名称或序列化字段。
- 具体浏览器自动化、文件隔离、操作系统沙箱、密钥库、SSO 或安全产品选型。
- 高保真审批弹窗原型、管理端页面设计、实现排期或工作量估算。
- Admin Governance、Audit Query、Tool Worker、Knowledge/Memory 或 Desktop Cockpit 的完整细节；本文件只定义它们与策略/审批/凭证/沙箱的连接点。

## 2. 输入依据

- `.omx/plans/ralplan-agent-harness-redesign.md`：确认三平面架构、L0-L5 权限分层、策略解析顺序、离线策略缓存、隔离 Worker、Credential Handling 与统一审计脊柱。
- `.omx/plans/prd-agent-harness-design.md`：确认 MVP 必须包含治理、安全控制、浏览器隔离、授权文件操作、截图/产物/执行记录、Scheduler 与 Skill 治理 seam。
- `.omx/plans/test-spec-agent-harness-design.md`：确认设计验证必须覆盖权限 L0-L5、高风险审批、浏览器/文件/工具隔离、审计字段、Skill 权限不能越权与非目标边界。
- `docs/AgentHarnessDesign/# 企业内网通用型 Agent 助手需求文档`：确认内网环境、无公网依赖、用户确认、沙箱运行、审计留痕、数据保护、浏览器和文件边界等原始需求。
- `docs/AgentHarnessDesign/客户端 Agent Harness目录`：确认 Policy/Instruction/Governance、Hook/Middleware、Security/Permission/Credential、Checkpoint/Artifact/Audit 等推荐目录能力。
- `docs/DetailedDesign/AgentHarnessDesign/shared-contracts-and-event-spine.md`：确认 RiskLevel、PolicyDecision、ApprovalDecision、HandoffCause、CredentialGrantState、SandboxSessionState 与 EventEnvelope 的共享语义。
- `docs/DetailedDesign/AgentHarnessDesign/data-classification-retention-matrix.md`：确认凭证、截图、日志、ContextPackage、审计查询与安全事件的敏感级、可见性和保留语义。

## 3. 职责划分

### 3.1 模块职责

| 模块 | 在安全策略中的职责 | 不负责 |
| --- | --- | --- |
| Desktop Cockpit | 展示审批、风险说明、策略来源、可撤销性、截图/产物摘要；收集用户允许、拒绝、接管、取消等决策 | 自行判定高风险动作可执行、直接读取凭证、绕过 Runtime 执行工具 |
| Local Agent Runtime/Daemon | 在 Run 内持有策略快照引用、执行策略复核、维护审批状态、传播取消、调用 Credential Broker 和隔离 Worker | 成为企业权限最终权威、擅自放宽企业策略、长期保存不应本地留存的敏感数据 |
| Policy Client / Policy Engine | 合并企业/部门/角色/用户/目录/Skill/工具策略，输出 Allow/Ask/Deny/Mask/Redact/Limit 决策和原因 | 执行工具动作、保存业务产物、替代源系统权限判断 |
| Approval Engine | 创建审批对象、管理审批有效期/范围/撤销、绑定 Run/Step/Action/Policy Snapshot 与审计记录 | 把“通知已读”当作审批、允许无边界的永久授权 |
| Credential Broker | 管理凭证访问请求、范围授予、脱敏、访问审计和 Worker 临时授权 | 将 API Key、Cookie、Token、密码暴露给模型、普通日志或 UI 明文 |
| Tool Gateway | 将模型 Tool Intent 标准化为可判定 Action，强制策略检查，按决策路由到 Worker、审批或拒绝 | 让模型直接调用真实工具、让 Worker 自主决定是否越权执行 |
| Isolated Workers | 在受限沙箱内执行浏览器、文件、HTTP、连接器或受控命令动作，返回结构化 Observation | 自行提升权限、访问授权范围外资源、绕过审计写入 |
| Enterprise Control Plane | 管理用户/角色/部门、工具策略、内网白名单、文件范围、知识库 ACL、日志保留、审计查询与策略下发 | 直接操作用户本地文件或浏览器会话、替代源业务系统自身权限 |
| Artifact/Audit Writer | 记录策略决策、审批、凭证访问、沙箱会话、工具动作、截图/产物、结果/错误摘要 | 保存超出保留策略或脱敏策略允许的敏感内容 |
| Shared Contracts | 维护风险等级、策略决策、审批、凭证授权、沙箱事件和审计事件的共享语义 | 规定具体存储实现或端点实现 |

### 3.2 事实源划分

- **企业治理事实源**：Enterprise Control Plane 中的用户/角色/部门、工具/Skill 策略、知识库 ACL、内网白名单、文件范围、日志/截图保留规则。
- **执行时策略事实源**：Runtime 为每个 Run 或 Scheduler 触发记录的 Policy Snapshot Reference。它说明执行当时使用了哪组策略，不替代企业最新策略。
- **审批事实源**：Approval Engine 的审批对象和决策记录。审批不是 UI 弹窗状态，UI 关闭后仍必须恢复。
- **凭证访问事实源**：Credential Broker 的授权与访问记录。凭证值不进入普通 Run Journal，只记录访问摘要、作用域和结果。
- **沙箱执行事实源**：Worker Session 与 Sandbox Session 记录实际执行环境、授权范围、资源限制和清理结果。
- **审计事实源**：Artifact/Audit 脊柱记录策略、审批、凭证、沙箱与工具动作的可追责事实。

## 4. 策略与权限模型

### 4.1 策略输入

策略判定至少需要以下输入：

| 输入类别 | 说明 |
| --- | --- |
| Actor Context | 用户、角色、部门、设备、登录态、管理员身份或 Scheduler 触发身份 |
| Run Context | 用户目标、任务来源、当前状态、创建时授权、执行时策略快照、是否来自 Skill 或定时任务 |
| Action Context | 标准化后的动作、目标资源、数据范围、预期影响、是否可预览/撤销、是否需要凭证 |
| Tool Declaration | 工具能力、风险等级、权限声明、可审计字段、是否支持定时任务、是否支持撤销或预览 |
| Resource Context | 文件路径、授权根目录、浏览器 URL、域名/IP/端口、知识库、模型、截图、日志、下载/上传对象 |
| Policy Sources | 企业硬性禁止、部门策略、角色策略、用户设置、项目/目录策略、Skill 内置约束、管理员白名单/黑名单 |
| Local Safeguards | 路径越界、高危命令、敏感 URL、外网访问、数据外传、Prompt Injection、凭证泄漏、敏感字段识别 |

### 4.2 策略解析顺序

1. **企业硬性禁止策略**：数据外传、公网访问、高危系统命令、未注册工具、未授权知识库、禁用域名或路径等先行拦截。
2. **用户/角色/部门授权**：确认用户在企业体系、知识库、工具、文件范围、内网系统中的权限交集。
3. **工具/Skill 声明**：检查工具和 Skill 的风险等级、权限声明、发布范围、审核状态和是否允许用于 Scheduler。
4. **当前任务上下文与本次授权**：确认用户本次是否允许目标动作、范围、有效期和是否仍满足 Run 状态。
5. **Runtime 本地安全兜底**：对路径、URL、命令、上传/下载、截图、日志、凭证访问和不可信网页内容做最后拦截或降级。

解析结果必须采用最严格有效规则：下层策略不能放宽上层策略；本地离线缓存不能放宽企业最新策略；“始终允许”不能覆盖企业硬性禁止或更高风险等级。

### 4.3 L0-L5 风险等级

| 等级 | 风险语义 | 默认处理 | 示例 | MVP 策略 |
| --- | --- | --- | --- | --- |
| L0 纯文本处理 | 不访问外部资源，不产生外部副作用 | Allow + 审计摘要 | 总结、改写、格式转换 | 允许 |
| L1 只读查询 | 读取授权范围内数据或页面，不写入业务系统 | Allow/Ask，按数据域 | 知识库检索、授权文件读取、内网页面读取 | 允许但记录来源和引用 |
| L2 低风险写入 | 写入用户授权目录或个人空间，可预览/撤销 | Ask | 保存报告、生成 Markdown、整理授权目录 | 用户确认，优先预览 |
| L3 浏览器交互 | 对浏览器会话进行点击、输入、下载、上传、截图等交互 | Ask/Session Allow | 点击、筛选、下载附件、上传草稿、截图 | 读/导航有限允许，交互确认 |
| L4 业务状态变更 | 影响业务系统状态或流程，但通常仍可由用户明确授权完成 | Explicit Ask / Require Handoff | 提交表单、创建工单、修改状态、发起审批 | 必须确认，优先人工接管 |
| L5 高风险操作 | 删除、批量修改、生产操作、系统命令或不可逆影响 | Deny 或管理员审批 + 用户确认 | 删除数据、批量修改、生产操作、系统命令 | 默认禁用/仅预留 seam |

### 4.4 策略决策类型

| 决策 | 语义 | 后续动作 |
| --- | --- | --- |
| Allow | 当前动作在当前范围内可执行 | Tool Gateway 将动作送入 Worker，写 Policy Decision Event |
| Ask | 需要用户确认或管理员审批 | Run 进入 `awaiting_approval`，创建 Approval Request |
| Deny | 当前动作不可执行 | Runtime 记录拒绝原因，Agent Core 重规划或 Run 失败/取消 |
| Mask | 允许执行，但需要隐藏部分输入或输出 | 执行前后应用遮蔽，审计记录遮蔽原因 |
| Redact | 允许记录或展示摘要，但敏感内容必须脱敏 | Artifact/Audit Writer 保存脱敏内容或引用 |
| Limit | 允许受限执行 | 缩小文件、URL、时间、次数、并发、截图或日志范围 |
| Require Handoff | 动作必须由用户人工完成或接管 | Run 进入 `handoff`，Desktop 展示接管边界 |

策略决策必须带原因、风险等级、策略来源、策略快照引用、适用范围和失效条件，便于审计、回放和后续争议处理。`Require Handoff` 既可能是 PolicyDecision，也可能是用户/管理员 ApprovalDecision；事件中必须通过 `HandoffCause` 区分 `policy_required`、`user_requested`、`credential_required` 或 `runtime_required`。

## 5. 权限确认与审批设计

### 5.1 审批触发条件

以下场景必须触发审批、接管或拒绝，不得静默执行：

- L2 及以上写入或整理动作：修改文件、批量移动、上传文件、保存到个人知识库或业务系统。
- L3 浏览器交互：点击、输入、上传、下载、截图敏感页面、读取受限页面内容。
- L4 业务状态变更：提交表单、创建工单、修改状态、发起/通过/驳回审批、发布内容。
- L5 高风险操作：删除数据、批量修改、生产操作、系统命令；MVP 默认拒绝或仅进入管理员审批 seam。
- 凭证访问：工具或 Worker 需要 API Key、Cookie、Token、SSO 会话或系统凭证。
- 定时任务执行时策略变化、授权过期、目标范围扩大或动作风险等级升高。
- Skill 请求使用超出其 Manifest 声明或当前用户权限交集的工具、数据域或凭证。

### 5.2 审批提示最低信息

Approval Prompt 或接管提示必须展示：

- 动作目标：要访问或修改的文件、目录、页面、知识库、系统对象或业务流程。
- 影响范围：读取/写入/上传/下载/提交/删除/审批等影响类型和数据范围。
- 风险等级：L0-L5 分类、触发策略、是否可撤销、是否需要人工接管。
- 策略来源：企业、部门、角色、用户、目录、Skill、工具或 Runtime 兜底规则。
- 执行证据：必要的动作前截图、文件清单、表单摘要、产物预览或引用摘要。
- 决策选项：允许一次、允许当前 Run、允许有限范围和期限、拒绝、要求接管、取消 Run。
- 审计提示：本次决策将记录的主体、时间、目标、范围、结果和保留策略摘要。

### 5.3 审批有效范围

- “仅本次允许”只绑定一个 Run/Step/Action，不能被其他 Run 复用。
- “当前 Run 允许”只允许同一目标、同一工具、同一风险等级和同一策略快照内的重复动作。
- “有限范围允许”必须包含目录/域名/工具/知识库/时间期限/次数等边界，且只适用于策略允许的低风险范围。
- “始终允许”不得用于 L4/L5，不得覆盖企业禁止策略，必须可查看、撤销和过期。
- Runtime 恢复、策略刷新、用户角色变化、设备变化、目录或 URL 范围扩大时，既有审批必须复核或失效。

### 5.4 用户审批与管理员审批

- 用户审批处理个人授权、当前 Run 的低中风险动作、个人知识库写入和授权目录内文件操作。
- 管理员审批处理企业策略例外、企业级 Skill 发布、高风险工具启用、跨部门数据范围、日志/截图保留策略例外等治理动作。
- 源业务系统权限仍是硬边界：即使用户或管理员在 Agent 中允许，Agent 也不能绕过源系统自身权限、MFA 或审批机制。
- 通知不是审批本身。审批状态必须由 Approval Engine 管理并绑定 Run、Step、Action、Policy Snapshot 与 Audit Event。

## 6. Credential / Secret 处理设计

### 6.1 职责与边界

Credential Broker 负责把凭证能力安全地授予具体 Worker 或连接器。它不把凭证值交给模型，不把凭证明文写入普通日志，不让 Tool Gateway 或 Agent Core 持有长期密钥。

凭证包括但不限于：

- API Key、Access Token、Refresh Token、Session Token。
- 浏览器 Cookie、企业 SSO 会话、临时授权票据。
- 内网系统账号、自动化专用凭证、连接器密钥。
- 本地证书、代理配置、设备身份或企业安全客户端授予的短期凭据。

### 6.2 凭证访问原则

- **最小范围**：凭证授权必须绑定工具、Worker、目标资源、Run/Step、有效期和允许动作。
- **不进模型上下文**：模型只能看到凭证是否可用、需要何种接管或错误类别，不能看到凭证值。
- **不进普通审计明文**：审计记录凭证类型、作用域、访问主体、目标、时间和结果，不记录密钥值、Cookie 值或密码。
- **短期授予**：Worker 获取临时授权或受控句柄，任务结束、取消、超时、策略变化或 Worker 崩溃后失效。
- **用户可控**：涉及个人账号、Cookie、Token 或 SSO 会话时，用户应能在 Desktop Credential Grants 视图中查看哪些工具获得过何种范围授权、有效期、最近使用和撤销入口。
- **管理员可治理**：企业连接器凭证由治理面注册、轮换和禁用；个人凭证与企业共享凭证必须明确区分。

### 6.3 凭证访问流程

1. Tool Gateway 标准化 Action，标记需要的凭证类型、目标系统、数据范围和动作风险。
2. Policy Engine 判断用户/角色/工具/目标系统是否允许使用该凭证，并决定 Allow、Ask、Deny 或 Require Handoff。
3. 如需确认，Approval Engine 创建凭证访问审批，展示目标系统、动作范围、有效期、风险和可撤销方式。
4. Credential Broker 向 Worker 发放短期授权、受控句柄或要求用户登录/接管；不把凭证明文返回给 Agent Core。
5. Worker 在沙箱中使用凭证完成动作，返回结构化 Observation。
6. Artifact/Audit Writer 记录凭证访问事件摘要、策略/审批绑定、结果/错误和清理状态。
7. Run 完成、取消、超时、策略变化或 Worker Session 结束时，Credential Broker 撤销临时授权并记录撤销结果。

### 6.4 浏览器登录态与 MFA

- Browser Worker 使用独立 Agent Profile，不读取用户日常浏览器历史、密码、Cookie 或已有会话。
- 登录、MFA、验证码、敏感授权弹窗优先进入人工接管；用户完成后 Runtime 记录接管摘要和会话范围。
- 登录态保留必须受策略控制：可选择会话级、短期持久或每次重新登录，并支持用户清理。
- 敏感页面截图、自动保存页面内容和导出下载文件必须遵守截图/日志策略、脱敏规则和保留周期。

## 7. Sandbox / Isolation 设计

### 7.1 沙箱共同原则

所有 Worker 沙箱必须满足：

- 只接收经过策略允许或审批通过的标准化 Action。
- 只访问明确授权的目录、URL、端口、知识库、连接器或凭证范围。
- 能响应取消、超时、资源限制、策略变更和 Runtime 恢复/清理命令。
- 返回结构化 Observation：结果、错误、风险提示、产物引用、截图引用、脱敏状态和清理状态。
- 写入 Worker Session / Sandbox Session 事件，说明隔离边界、资源限制和执行结果。

### 7.2 Browser Worker 沙箱

| 维度 | 设计要求 |
| --- | --- |
| Profile | 使用独立 Agent 浏览器 Profile；不读取用户日常浏览器密码、Cookie、历史记录 |
| 网络 | 只访问内网白名单、允许域名/IP/端口；禁止成为公网外传通道 |
| 下载/上传 | 使用隔离下载目录；上传文件必须来自授权目录或明确产物引用 |
| 截图 | 支持自动截图开关、敏感页面标记、保留周期、导出控制和删除策略 |
| 页面内容 | DOM、Accessibility Tree、文本、表格和截图都标记来源；不可信页面内容进入上下文前做注入防护 |
| 高风险动作 | L4/L5 提交、审批、状态修改、删除、发布等必须确认或接管，不能自动闭环 |
| 接管 | MFA、验证码、登录和敏感表单可进入 handoff；接管前后状态和边界进入审计 |

### 7.3 File / Document Worker 沙箱

| 维度 | 设计要求 |
| --- | --- |
| 授权根 | 默认只访问用户授权目录；路径规范化后必须验证仍在授权根内 |
| 禁止范围 | 不默认扫描全盘，不访问系统目录、凭证目录、浏览器密码/Cookie/历史记录 |
| 写入 | 保存报告、生成 Markdown、整理授权目录属于 L2，需用户确认或预览 |
| 删除/移动 | 删除、批量移动、清理长期未用文件必须先展示清单并确认，优先回收站或隔离区 |
| 恢复 | 文件清理应记录可恢复信息、回滚边界和不可恢复说明 |
| 产物 | 文档转换、报告、表格、截图归档进入 Artifact Store 或用户指定授权目录 |
| 审计 | 记录访问、修改、移动、删除、恢复、错误、用户确认和产物引用摘要 |

### 7.4 Shell / Command Worker 沙箱

- 本项目不是编程 Agent，Shell 能力不作为 MVP 核心用户能力。
- MVP 原则上禁用用户可见 Shell 自动执行，或仅保留内部诊断/受控工具 seam。
- 任何系统级命令、生产操作、批量破坏性命令默认 L5，必须 Deny 或走管理员审批 + 用户确认，不得无人值守执行。
- 若目标态引入受控命令，必须声明命令白/黑名单、工作目录限制、参数脱敏、超时中断、输出保留和执行审计。

### 7.5 HTTP / Connector 沙箱

- HTTP 工具和企业连接器只能访问内网策略允许的域名/IP/端口和数据域。
- Header、Cookie、Token 由 Credential Broker 受控授予，不进入模型上下文。
- 连接器不得绕过用户在源系统中的权限，不得用 Agent 管理员权限替代业务用户权限。
- MVP 可优先通过 Browser Worker 支持内网系统；专用连接器后置，但必须预留权限声明、审批等级和审计字段。

## 8. 关键流程

### 8.1 Tool Intent 到策略判定

1. Agent Core 产生 Tool Intent，说明想完成的动作和目标，但该意图不可直接执行。
2. Tool Gateway 将 Tool Intent 标准化为 Action，补全工具声明、资源范围、风险等级和预期影响。
3. Policy Engine 按策略解析顺序输出 Allow、Ask、Deny、Mask、Redact、Limit 或 Require Handoff。
4. Runtime 写入 Policy Decision Event，并将决策绑定到 Run、Step、Action、Tool Declaration 与 Policy Snapshot。
5. Allow/Limit/Mask/Redact 进入 Worker 执行；Ask 进入审批；Deny 触发重规划或失败；Require Handoff 进入人工接管。

### 8.2 高风险浏览器业务变更

1. 用户要求 Agent 进入内网系统修改业务状态、创建工单或提交表单。
2. Browser Worker 读取页面状态和表单摘要，动作被 Tool Gateway 标准化为 L4 或 L5。
3. Policy Engine 判断是否允许请求审批；禁止类动作直接 Deny，允许例外类动作创建 Approval Request。
4. Desktop 展示动作目标、页面/表单摘要、动作前截图、风险等级、可撤销性和策略来源。
5. 用户选择允许、拒绝、接管或取消。
6. 允许时 Worker 在授权范围内执行并记录动作后截图/结果；接管时用户完成动作，Runtime 记录接管边界和结果摘要。
7. Runtime 将结果、截图、审批记录、策略引用和错误/成功摘要写入 Run Timeline 与审计脊柱。

### 8.3 文件整理与清理

1. 用户授权一个目录并要求整理截图、报告或附件。
2. File Worker 只能在授权根目录内扫描，并返回建议清单、分类、风险和可恢复方式。
3. 只读分析属于 L1；保存报告或整理目录属于 L2；删除或批量移动需要显式确认。
4. Desktop 展示待修改文件清单、目标位置、影响范围、是否可恢复和策略原因。
5. 用户确认后，Worker 执行动作并保留恢复记录；拒绝后 Runtime 重规划或结束。
6. 审计记录访问文件、修改文件、用户确认、产物引用、错误和恢复提示。

### 8.4 凭证访问与人工接管

1. Action 需要访问受保护内网系统或企业连接器凭证。
2. Policy Engine 判定凭证作用域、用户权限、工具声明和是否需要用户确认。
3. Credential Broker 不返回明文凭证，只向 Worker 发放短期句柄、触发登录流程或要求用户 handoff。
4. 用户在独立 Agent 浏览器环境中完成登录、MFA 或授权。
5. Runtime 记录接管开始/结束、目标系统、授权范围和结果摘要，不记录密码、验证码或 Token 明文。
6. 任务结束、取消、过期或策略变化时撤销临时授权并清理会话或按策略保留。

### 8.5 Scheduler 执行时策略复核

1. Scheduler 到达触发时间后，Runtime 不直接沿用创建时授权执行动作。
2. Runtime 复核用户权限、工具权限、知识库 ACL、文件/浏览器范围、凭证有效性、截图/日志策略和当前风险等级。
3. 查询、汇总、草稿、提醒、保存报告等低风险动作可继续执行。
4. 如策略变为 Ask，Run 进入 `awaiting_approval` 并通知用户；如策略 Deny，记录跳过和原因。
5. 提交表单、审批、业务状态变更、批量修改、生产操作等不得因无人值守而自动执行。

### 8.6 策略变更与 Runtime 恢复

1. Runtime 重启或 UI 重连后，根据 Run Journal、Policy Snapshot、Approval、Worker Session 和 Credential Grant 恢复状态。
2. 对未完成动作执行最新策略复核；过期审批、过期凭证、扩大范围或风险等级升高必须重新确认。
3. 如 Worker 崩溃或沙箱清理失败，Runtime 写 Runtime Health / Sandbox Event 并给出残留影响摘要。
4. 如策略变更导致任务不可继续，Run 进入 `paused`、`awaiting_approval`、`failed` 或 `cancelled`，不能静默沿用旧授权。

## 9. 概念数据 / 事件对象

以下对象是共享语义，不是数据库 schema，也不是端点级 API。后续实现可以用不同存储或传输形式表达，但不得改变对象语义。

### 9.1 Policy Rule

| 概念字段 | 说明 |
| --- | --- |
| Scope | 企业、部门、角色、用户、项目/目录、工具、Skill、知识库、浏览器域名或文件范围 |
| Effect | Allow、Ask、Deny、Mask、Redact、Limit 或 Require Handoff |
| Risk Mapping | 适用的 L0-L5 风险等级、动作类型和资源类型 |
| Conditions | 时间、设备、网络、授权状态、目录、域名、工具、凭证、Scheduler 或 Skill 条件 |
| Precedence | 与上级/下级策略冲突时的优先级和最严格规则 |
| Lifecycle | 版本、发布状态、生效时间、失效时间、撤销状态和策略来源 |
| Audit Semantics | 决策时需要记录的原因、快照引用和可见范围 |

### 9.2 Policy Snapshot

| 概念字段 | 说明 |
| --- | --- |
| Snapshot Identity | Run、Step 或 Scheduler 触发时采用的策略快照引用 |
| Source Versions | 企业、部门、角色、用户、目录、工具、Skill 和本地兜底规则的版本摘要 |
| Actor Scope | 适用用户、角色、部门、设备和触发方式 |
| Effective Rules | 判定当前动作时参与生效的规则摘要 |
| Freshness | 是否来自在线策略、离线缓存、缓存年龄和需要刷新条件 |
| Expiry / Revocation | 快照失效条件、策略变更后的复核要求 |

### 9.3 Policy Decision

| 概念字段 | 说明 |
| --- | --- |
| Subject Action | 被判定的标准化 Action、工具、目标资源和预期影响 |
| Risk Level | L0-L5 或策略细化后的风险分类 |
| Decision | Allow、Ask、Deny、Mask、Redact、Limit、Require Handoff |
| Reason | 触发原因、策略来源、冲突处理结果和用户可解释说明 |
| Constraints | 限制范围、脱敏要求、截图/日志要求、凭证约束、资源限制 |
| Binding | 绑定 Run、Step、Tool Action、Policy Snapshot 和后续审批/审计记录 |

### 9.4 Approval Request

| 概念字段 | 说明 |
| --- | --- |
| Requested Action | 待确认动作、目标、范围、风险等级和可撤销性 |
| Prompt Evidence | 文件清单、页面摘要、动作前截图、产物预览、策略原因或凭证说明 |
| Eligible Deciders | 可决策主体：用户、管理员、审批组或要求人工接管 |
| Options | 允许一次、允许当前 Run、有限范围允许、拒绝、接管、取消 |
| Expiry | 审批过期、策略变化失效、Run 取消失效或用户撤销方式 |
| Binding | Run、Step、Action、Policy Decision、Credential Grant 和 Audit Event 关联 |

### 9.5 Approval Decision

| 概念字段 | 说明 |
| --- | --- |
| Decider | 决策人或策略自动决策主体 |
| Decision | Allow、Deny、Require Handoff、Always Allow within Scope、Cancel Run |
| Scope | 本次、当前 Run、目录/域名/工具范围、有限期限、次数或其他约束 |
| Rationale | 用户或管理员看到的风险说明、策略来源和决策理由摘要 |
| Validity | 生效条件、过期条件、撤销方式、策略变更复核要求 |
| Audit Link | 绑定审批事件、Run Timeline 和审计检索引用 |

### 9.6 Credential Grant

| 概念字段 | 说明 |
| --- | --- |
| Credential Type | API Key、Token、Cookie、SSO 会话、连接器凭证、证书或临时票据类型 |
| Subject | 获得授权的 Worker、工具、Run、Step 和目标系统 |
| Scope | 数据域、动作、URL、文件范围、连接器、有效期和次数 |
| Delivery Semantics | 临时句柄、受控代理、系统密钥库引用、用户 handoff 或连接器托管 |
| Redaction | 日志、审计、错误、UI 展示中的脱敏要求 |
| Revocation | 完成、取消、超时、策略变化、用户撤销、管理员禁用或 Worker 崩溃后的失效规则 |
| Audit Summary | 访问时间、访问主体、目标、结果、错误类别和清理状态；不包含明文凭证 |

### 9.7 Sandbox Session

| 概念字段 | 说明 |
| --- | --- |
| Worker Type | Browser、File/Document、Shell、HTTP/Connector 或 Local Tool |
| Boundary | 目录、域名/IP/端口、下载目录、Profile、进程、命令、凭证和资源限制 |
| Lifecycle | 创建、运行、暂停、取消、超时、崩溃、清理、恢复状态 |
| Inputs | 标准化 Action、Policy Decision、Approval Decision、Credential Grant 和 Artifact 引用 |
| Outputs | Observation、产物、截图、下载文件、错误、风险提示和清理结果 |
| Cleanup | 临时文件、浏览器会话、下载目录、凭证句柄、进程和锁的清理摘要 |
| Audit Link | Worker Session、Tool Action、Run Timeline 和安全事件关联 |

### 9.8 Security Event

| 概念字段 | 说明 |
| --- | --- |
| Event Type | 策略拒绝、越界访问、凭证访问、脱敏、沙箱清理、Prompt Injection、数据外传、高危命令等 |
| Actor | 用户、Runtime、Policy Engine、Credential Broker、Worker、管理员或外部系统 |
| Target | Run、Step、Action、Credential Grant、Sandbox Session、文件、URL、知识库或工具 |
| Severity | 信息、警告、阻断、高风险、需要管理员关注等分级 |
| Evidence Summary | 目标、范围、规则命中、错误摘要、脱敏状态、截图/产物引用 |
| Visibility | 用户可见、管理员可见、仅安全审计、敏感受限 |
| Follow-up | 重规划、审批、暂停、取消、清理、凭证撤销、策略更新或人工调查 |

## 10. 策略、审计与安全考虑

### 10.1 安全不变量

- Agent 不能绕过企业权限体系、源业务系统权限、MFA 或审批流程。
- 模型输出不能直接执行工具；所有动作必须经过 Tool Gateway 标准化和策略判定。
- Skill 权限不能超过用户、部门、企业策略和工具声明的交集。
- Scheduler 不能因为无人值守而提升权限；创建时授权和执行时策略复核必须同时成立。
- Browser Worker 不读取用户日常浏览器密码、Cookie、历史记录；File Worker 不默认扫描全盘或访问凭证目录。
- Credential 明文不进入模型上下文、普通日志、普通审计或用户界面。
- Runtime 恢复不能复用过期审批、过期凭证或过期策略快照。
- 本地离线策略缓存只能维持既有低风险动作，不能放宽企业禁止策略或新增高风险权限。

### 10.2 审计最低范围

审计事件至少覆盖：

- 操作用户、时间、设备、Run、Step、目标和状态变化。
- 策略判定、策略快照引用、风险等级、决策原因和限制条件。
- 审批请求、用户/管理员决策、审批范围、有效期和撤销信息。
- 工具调用、访问文件、修改文件、访问页面、截图记录、上传/下载、知识库引用。
- Credential 访问摘要、凭证类型、作用域、结果、错误和撤销状态。
- Sandbox Session 创建、边界、资源限制、崩溃、清理和残留影响。
- 执行结果、错误信息、用户确认、人工接管、Scheduler 触发/跳过/补偿。

审计内容必须遵守最小化和脱敏原则：不默认保存完整敏感页面、凭证、Cookie、Token、密码、无关文件内容或超过策略允许的截图。

### 10.3 数据保护

- 会话记录、截图、文件内容、工具参数、浏览器操作记录、定时任务结果、个人记忆、个人知识库和 Skill 执行记录都需要访问控制和保留策略。
- 截图必须支持自动开关、敏感标记、删除、导出、保留周期和管理员可见范围控制。
- 日志必须区分用户可见运行日志、开发诊断日志和安全审计记录；权限和保留规则不同。
- 用户个人数据删除请求与企业审计保留要求可能冲突，必须通过策略说明哪些内容可删、哪些仅脱敏或保留摘要。
- 不可信网页、文件和工具输出进入模型上下文前必须保留来源标记，并应用注入防护和敏感字段识别。

### 10.4 策略与用户信任

- 用户应能看到 Agent 访问了什么、准备做什么、记住了什么、使用了哪些凭证、产生了哪些截图或产物。
- 高风险动作必须在执行前说明目标、影响、可撤销性和策略来源，而不是执行后解释。
- 拒绝和限制也需要可解释：用户应知道是企业策略、权限不足、工具声明、目录/域名越界还是 Runtime 安全兜底导致。
- 审批历史、授权范围、自动截图、个人记忆、个人知识库写入和凭证授权必须可查看和撤销；凭证授权只展示类型、范围、目标和结果，不展示 secret value。

## 10.5 源系统权限与离线缓存边界

Agent 侧策略只能追加限制，不能替代源业务系统权限：

- 源系统 ACL、MFA、审批流和操作日志仍是硬边界；用户或管理员在 Agent 中允许，不代表源系统中无权动作可以执行。
- Browser Worker / Connector 必须以源系统允许的用户身份、会话或托管凭证作用域访问。
- 本地离线策略缓存只能保持或收紧既有低风险权限；策略过期、不确定或风险升高时必须 Ask、Deny 或等待刷新。
- 审计中必须区分 Agent 侧策略/审批、用户 handoff 动作和源系统最终业务结果。

## 11. MVP vs 目标态

### 11.1 MVP

MVP 必须保留安全治理骨架，但压缩功能面：

- 支持 L0-L5 风险等级和 Allow/Ask/Deny/Limit/Redact 的基础判定语义。
- 支持用户确认：L2 文件/报告写入、L3 浏览器交互、L4 业务状态变更前的显式确认或人工接管。
- L5 高风险操作默认禁用或仅保留管理员审批 seam，不做无人值守自动化闭环。
- 支持策略快照引用、离线缓存只读/低风险复用和执行时策略复核。
- 支持独立 Browser Profile、内网 URL 白名单、截图策略、下载目录隔离和 MFA/验证码 handoff。
- 支持授权目录文件访问、路径校验、清理清单预览、确认后执行、优先可恢复。
- 支持 Credential Broker 概念 seam：凭证不进模型、不进明文日志；Worker 使用短期授权或用户接管；Desktop 提供基础 Credential Grant 可见与撤销入口。
- 支持基础审计事件：策略决策、审批、工具动作、文件/页面访问、截图/产物、凭证访问摘要、沙箱清理、错误。
- 支持 Scheduler 查询/汇总/草稿/提醒类任务的执行时策略复核；提交、审批、状态修改、删除、批量修改不自动执行。
- 支持 Skill 只作为个人流程模板候选或受控运行入口；企业发布与复杂审核后置。

### 11.2 目标态

目标态在保持同一安全语义的基础上扩展：

- 更细的策略继承、冲突解释、策略生效预览、授权撤销、审批有效期和跨设备可见性。
- 企业级 Credential 生命周期：托管凭证注册、轮换、禁用、密钥审计、连接器专用授权。
- 更强沙箱：Fleet 级资源配额、中心化浏览器/连接器执行器、细粒度网络隔离、端点安全集成。
- 完整 Replay 与安全分析：策略变化回放、高风险事件聚合、截图/产物批量导出、失败案例库。
- 更丰富连接器和受控命令能力，但仍通过 Tool Declaration、Policy、Approval、Credential Broker 与 Audit 约束。
- Skill/Workflow 沉淀闭环：候选模板、权限声明、回归测试、管理员审核、版本发布和回滚。

## 12. 设计验收清单

### 12.1 覆盖性

- [ ] L0-L5 风险等级能覆盖文本处理、只读查询、低风险写入、浏览器交互、业务状态变更和高风险操作。
- [ ] Policy、Approval、Credential、Sandbox、Audit 都有明确职责和连接点。
- [ ] 浏览器、文件、HTTP/Connector、受控命令能力都能映射到统一策略与沙箱语义。
- [ ] Scheduler 和 Skill 执行不会绕过普通 Run 的策略、审批、凭证和审计链路。

### 12.2 边界正确性

- [ ] Desktop 只展示审批和收集决策，不直接执行高风险工具或读取凭证。
- [ ] Runtime 执行策略复核和审批状态管理，但不是企业治理最终权威。
- [ ] Policy Engine 只判定，不执行工具；Worker 只执行已授权动作，不自主提升权限。
- [ ] Credential Broker 不把凭证明文交给模型、普通日志或普通审计。
- [ ] Enterprise Control Plane 不直接操作用户本地文件或浏览器会话。

### 12.3 治理与安全

- [ ] 每个 Tool Action 在 Worker 执行前都有策略判定和可审计原因。
- [ ] L2-L5 动作能进入审批、接管、拒绝或限制状态，不会静默执行。
- [ ] 策略变更、角色变化、审批过期、凭证过期和 Runtime 恢复都能触发复核。
- [ ] Browser Worker 不读取日常浏览器数据；File Worker 不默认扫描全盘或访问凭证目录。
- [ ] 审计事件包含用户、时间、目标、工具、页面/文件、策略、审批、凭证访问摘要、结果/错误上下文。
- [ ] 截图、日志、凭证、文件内容和个人数据遵守脱敏、保留和访问控制。

### 12.4 MVP 纪律

- [ ] MVP 保留 Runtime/Policy/Approval/Credential/Sandbox/Audit 骨架。
- [ ] MVP 不引入高风险无人值守自动化、完整连接器市场、复杂 Skill Studio、Fleet 沙箱管理或高级 Replay 分析。
- [ ] 本设计没有 DB schema、端点级 API、高保真 UI、代码 POC、排期估算或 SaaS 多租户扩展。

### 12.5 场景验证

- [ ] 受控浏览器变更：L4/L5 动作前展示风险、截图/表单摘要和审批选项，允许后记录前后状态。
- [ ] 文件整理清理：授权目录内先生成清单和预览，确认后执行，删除/移动可恢复并审计。
- [ ] 定时缺陷汇总：Scheduler 触发时复核策略，只生成查询/汇总/草稿，提交或修改转审批。
- [ ] 凭证访问：连接器或浏览器会话使用短期授权或用户接管，凭证不进入模型或明文日志。
- [ ] Skill 运行：Skill 声明权限低于或等于用户/部门/企业策略交集，越权工具调用被拒绝或重新审批。

## 13. 开放问题

这些问题不阻塞本设计，但会影响后续详细设计参数：

1. 企业统一身份、SSO、角色/部门来源与本地 Runtime 离线策略缓存如何同步和失效？
2. 首个 MVP 需要接入哪些凭证来源：系统密钥库、企业安全客户端、浏览器 Profile、连接器托管凭证还是用户每次 handoff？
3. 审计、截图、Run Journal、凭证访问摘要和 Sandbox Session 的保留周期、敏感分级、管理员可见范围如何确定？
4. 哪些 L3 浏览器交互可以在 Session Allow 内连续执行，哪些必须每次确认？
5. 文件清理的“可恢复”边界是什么：回收站、隔离区、版本快照还是只支持操作预览？
6. L5 高风险操作在目标态是否允许管理员审批后执行，还是永久只允许人工接管并由源系统完成？
7. 离线状态下允许哪些 L1/L2 动作继续执行，哪些必须等待策略刷新或凭证重新验证？
8. 用户删除个人数据、关闭自动截图或撤销凭证授权后，历史企业审计保留与个人可控要求如何平衡？
9. 首批内网系统主要通过 Browser Worker 访问还是已有 API/Connector 访问？这会影响凭证和沙箱边界。
10. Policy、Approval、Credential、Sandbox 的概念共享语义已由 `shared-contracts-and-event-spine.md` 收敛；后续实现仍需确定代码层契约 owner、版本发布节奏和 breaking change 评审流程。
