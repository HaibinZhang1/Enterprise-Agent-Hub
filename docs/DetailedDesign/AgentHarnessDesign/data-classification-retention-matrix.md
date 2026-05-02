# Agent Harness Data Classification / Retention / Visibility Matrix 详细设计

## 1. 目标与边界

本设计补齐 Agent Harness 详细设计中的数据分类、可见性、保留与删除/脱敏语义。它为 Run Journal、事件、截图、产物、凭证授权摘要、ContextPackage、Citation、Memory、Knowledge、Audit Query 等对象提供统一矩阵，支撑 Desktop 展示、Admin Audit、Security Review、用户删除权与企业审计保留之间的平衡。

本文件是概念级策略矩阵，不定义实际保留天数、数据库字段、对象存储路径或导出 API。具体保留周期由企业安全/合规策略配置。

## 2. Classification Vocabulary

### 2.1 SensitivityClass

| 等级 | 语义 | 示例 |
| --- | --- | --- |
| `public_summary` | 可对当前用户展示的低敏摘要 | Run 目标摘要、步骤标题、普通完成消息 |
| `user_private` | 当前用户个人数据或个人空间内容 | 个人记忆、个人知识库、授权目录文件摘要 |
| `enterprise_internal` | 企业内部业务资料或系统状态 | 内网页面摘要、企业知识库片段、工单摘要 |
| `sensitive_business` | 敏感业务正文、截图、批量文件清单或可能含 PII 的内容 | 高风险表单截图、审批记录详情、下载文件 |
| `credential_secret` | 凭证明文、Token、Cookie、密码、验证码、密钥 | Credential 值、MFA code、Session token |
| `security_audit` | 安全审计、策略拒绝、越界、Prompt Injection、沙箱异常 | Security Event、boundary violation |

### 2.2 VisibilityClass

| 等级 | 用户可见 | 管理员可见 | 说明 |
| --- | --- | --- | --- |
| `user_full` | 当前用户可看详情 | 管理员默认看摘要，详情需权限 | 用户自己的 Run 结果、产物入口 |
| `user_summary` | 当前用户看摘要 | 管理员按权限看摘要/详情 | 敏感截图、文件内容、模型上下文 |
| `admin_summary` | 用户可知存在性或影响 | 管理员看治理摘要 | 策略拒绝、审计查询结果、跨用户统计 |
| `security_restricted` | 用户看解释性摘要 | 安全/审计角色按权限看详情 | 凭证访问、越界尝试、Prompt Injection |
| `hidden_secret` | 不展示明文 | 不展示明文 | 凭证明文、密码、Cookie、Token、验证码永不进入普通 UI/审计明文 |

### 2.3 RetentionClass

| 等级 | 语义 | 删除/脱敏原则 |
| --- | --- | --- |
| `ephemeral` | 会话或 Worker 生命周期内临时数据 | 完成/取消/超时/清理后删除或仅保留摘要 |
| `run_lifetime` | 跟随 Run 可恢复和 Timeline 的数据 | Run 保留期内保留摘要和必要引用 |
| `audit_retained` | 企业审计要求保留的数据 | 用户删除请求通常转为脱敏/摘要保留 |
| `user_managed` | 用户可管理的个人数据 | 用户可禁用/删除/导出；审计按策略保留摘要 |
| `policy_defined` | 由企业策略配置 | 保留期、导出、删除由企业策略决定 |

## 3. Object Matrix

| 对象 | 默认敏感级 | 默认可见性 | 默认保留 | 用户删除/撤销 | 管理员查看 | 审计要求 |
| --- | --- | --- | --- | --- | --- | --- |
| Run Journal / Run State | enterprise_internal | user_summary | audit_retained | 用户不能删除企业审计事实；可隐藏本地展示或请求脱敏 | 可按权限检索摘要 | 状态变化、原因、actor、policy snapshot 必留。 |
| Run Timeline 投影 | enterprise_internal | user_full/user_summary | run_lifetime + audit_retained summary | 用户可清理本地历史入口；审计摘要按策略保留 | 管理员按权限看摘要 | Timeline 不应暴露凭证明文和无关正文。 |
| Policy Decision | security_audit | user_summary | audit_retained | 不可删除；可申诉或请求解释 | 安全/管理员可检索 | 必须保留风险、原因、范围、快照引用。 |
| Approval Request / Decision | sensitive_business | user_full | audit_retained | 决策记录不可删除；可撤销未来授权 | 管理员按权限看摘要/详情 | 记录决策人、范围、有效期、可撤销性。 |
| Handoff Session | sensitive_business | user_summary | audit_retained | 接管敏感输入不保留；接管摘要按审计保留 | 管理员看边界和结果摘要 | 区分用户动作与 Agent 动作。 |
| Credential Grant Summary | security_audit | user_summary | audit_retained | 用户可撤销未过期授权；历史摘要按审计保留 | 管理员看类型/作用域/结果，不看 secret | 凭证明文永不进入普通日志/审计/UI。 |
| Credential Secret Value | credential_secret | hidden_secret | ephemeral | 任务结束、取消、超时、策略变化或撤销后失效 | 不可明文查看 | 只记录访问摘要和清理结果。 |
| Worker / Sandbox Session | security_audit | user_summary | audit_retained | 用户不可删除安全事实 | 安全/管理员按权限检索 | 边界、资源、清理、异常必须记录。 |
| Browser Observation Summary | enterprise_internal | user_full/user_summary | run_lifetime | 用户可删除产物入口；审计摘要按策略保留 | 管理员看摘要，敏感正文受限 | URL/域名、时间、来源、脱敏状态必留。 |
| Browser Screenshot | sensitive_business | user_summary | policy_defined | 用户可删除个人产物；审计引用按策略脱敏/保留 | 默认摘要；详情需截图权限 | 敏感页面截图受开关、保留期、导出限制。 |
| File Operation Plan / File List | user_private/sensitive_business | user_full | run_lifetime + audit_retained summary | 用户可取消计划；已执行摘要保留 | 管理员默认只看范围摘要 | 批量移动/删除必须保留确认和恢复摘要。 |
| Artifact / Report | user_private/enterprise_internal | user_full | user_managed 或 policy_defined | 用户可删除个人产物；企业产物按策略 | 管理员按数据域权限查看 | Artifact 需绑定 Run/Step/Tool 和来源。 |
| ContextPackage Summary | enterprise_internal | user_summary | audit_retained summary | 不保留完整敏感 prompt；用户可要求隐藏展示 | 管理员看来源清单/裁剪原因，不默认看正文 | 保存来源、预算、裁剪、策略快照，不默认保存完整正文。 |
| ContextPackage Item Body | user_private/sensitive_business | user_summary | ephemeral/run_lifetime by policy | 可按来源删除或重新过滤 | 管理员默认不可看正文 | 权限变化后不得复用旧正文突破新权限。 |
| CitationHandle / CitationCard | enterprise_internal | user_full/user_summary | audit_retained summary | 来源删除后显示不可打开原因 | 管理员按权限查看引用摘要 | contentHash、版本、过期状态用于复现。 |
| User Memory | user_private | user_full | user_managed | 用户可编辑、禁用、删除、清空 | 管理员默认不可看个人内容，仅看策略摘要 | 记忆创建/更新/禁用/删除留审计摘要。 |
| Memory Suggestion | user_private | user_full | run_lifetime | 用户拒绝后不写长期记忆 | 管理员默认不可看正文 | 敏感过滤结果和用户决策需记录摘要。 |
| Personal Knowledge Document | user_private | user_full | user_managed | 用户可删除/归档；审计摘要按策略 | 管理员默认不可看正文 | 写入需用户确认；版本用于引用。 |
| Enterprise Knowledge Document | enterprise_internal | user_summary by ACL | policy_defined | 用户不可直接删除正式内容，可反馈问题 | 管理员按 ACL/维护权限查看 | 变更、发布、归档和引用需审计。 |
| Skill / Workflow Template | enterprise_internal | user_summary | policy_defined | 个人模板可删除；企业 Skill 下架走治理 | 管理员可看 manifest/审核记录 | 执行、审核、发布、下架、版本变更留审计。 |
| Scheduler Plan | enterprise_internal | user_full/user_summary | policy_defined | 用户可暂停/删除自己的计划；历史触发保留 | 管理员看治理摘要 | 创建时授权、执行时复核、跳过/补偿必留。 |
| Audit Query | security_audit | admin_summary | audit_retained | 查询事实不可删除 | 查询者行为也受审计 | `audit.query.requested/viewed/exported` 必留。 |
| Notification Item | enterprise_internal | user_full | run_lifetime/policy_defined | 用户可清理通知历史；关键安全提醒摘要保留 | 管理员默认不看个人通知正文 | 通知不是事实源，必须关联事件。 |

## 4. Default Handling Rules

1. **凭证明文永不落普通链路**：Credential secret value 不进入模型上下文、普通日志、普通审计、Desktop UI 或导出包。
2. **审计保留优先保留摘要和引用**：敏感正文、截图、文件内容默认不复制进审计，只保留可追责摘要、hash、来源和策略快照。
3. **用户可控不等于删除审计事实**：用户可删除个人产物、禁用记忆、撤销凭证授权；企业审计按策略保留脱敏摘要。
4. **管理员可检索存在性不等于可看正文**：Admin Audit Query 默认返回治理摘要；查看敏感正文、截图或导出需单独权限并写 audit-of-audit。
5. **权限变化后重新过滤**：Run 恢复、定时任务、后台总结和后续模型调用必须按最新权限重建 ContextPackage。
6. **截图和日志受策略开关控制**：自动截图、敏感页面截图、下载文件、工具参数和运行日志都有独立保留/导出/删除策略。

## 5. Audit-of-audit

任何审计查询行为自身都必须进入事件脊柱：

| 行为 | 事件 | 最低字段 |
| --- | --- | --- |
| 查询审计 | `audit.query.requested` | 查询者、目的、筛选条件摘要、结果数量、访问决策。 |
| 查看详情 | `audit.query.viewed` | 查询者、目标事件/Run/Artifact、可见级别、脱敏状态。 |
| 导出审计 | `audit.query.exported` | 查询者、导出范围、导出格式、审批/策略引用、保留/水印规则。 |
| 被拒绝 | `audit.query.denied` | 查询者、目标范围、拒绝原因、策略引用。 |

## 6. 验收清单

- [ ] 所有新增事件、Artifact、Context、Credential、Memory、Knowledge、Skill 对象都能映射到 Sensitivity / Visibility / Retention。
- [ ] Desktop 展示敏感对象时只使用允许的摘要、引用或脱敏内容。
- [ ] Admin Audit Query 能查询存在性和治理摘要，但敏感正文/截图/导出需要额外权限并写 audit-of-audit。
- [ ] 用户撤销 Credential Grant 后，未过期授权立即失效；历史访问只保留摘要。
- [ ] 用户删除个人记忆或个人知识后，后续 ContextPackage 不再使用该来源。
- [ ] 企业审计保留与用户删除诉求冲突时，有明确脱敏/摘要保留解释。
