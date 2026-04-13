# 当前版本 Tool Adapter 配置契约

## 1. 文档信息

| 字段 | 内容 |
|------|------|
| 文档名称 | 当前版本 Tool Adapter 配置契约 |
| 版本 | V1.1 |
| 状态 | 当前版本 定稿 |
| 日期 | 2026-04-11 |
| 关联 PRD | [当前版本 Desktop 使用闭环 PRD](20_p1_desktop_prd.md) |
| 关联数据契约 | [当前版本 Desktop 数据契约](21_p1_data_contract.md) |

## 2. 设计原则

- 当前版本 只做本机工具/项目路径配置、启用、停用、卸载，不做批量策略下发。
- Central Store 是本机唯一真源，工具和项目目录只是分发目标。
- Tool Adapter 负责路径探测、目标布局、真实格式转换、symlink/copy 分发和停用清理。
- 当前版本 默认使用 symlink 启用转换后的产物；若 symlink 因权限、文件系统、安全策略或目标冲突失败，则自动降级为 copy。
- 工具路径必须配置化，不允许把具体工具路径写死在业务流程中。
- 项目级启用优先于工具级启用。
- 扫描和去重使用目标路径 + Hash；当前版本 不做 unmanaged import 和 drift repair，只展示异常并允许重新启用/覆盖。
- Codex、Claude、Cursor、Windsurf、opencode 的转换必须由 Adapter 显式声明并通过 fixture 验收；不得对内置工具静默退化为原样目录复制。

## 3. 当前版本 目录约定

| 目录 | 用途 | 当前版本 要求 |
|------|------|---------|
| Central Store | 本地唯一 Skill 真源 | 必须存在，可在设置页展示 |
| Tool Target | 工具级 skills 目录 | 可由 Adapter 自动检测或用户手动配置 |
| Project Target | 项目级 skills 目录 | 用户手动添加项目并配置 |
| Temp Download | 下载临时目录 | Hash 校验通过后才移动到 Central Store |

默认建议：

```text
Windows:
%USERPROFILE%\.ai-skills\
├── registry\
├── skills\
├── downloads\
└── logs\

macOS:
~/Library/Application Support/com.enterpriseagenthub.desktop/EnterpriseAgentHub/
├── registry/
├── skills/
├── downloads/
└── logs/
```

## 4. Adapter 配置模型

```yaml
toolID: codex
displayName: Codex
enabled: true
platforms:
  - windows
  - macos
detection:
  methods:
    - registry
    - default_path
    - manual
  registryKeys: []
  defaultPaths:
    windows:
      - "%USERPROFILE%\\.codex\\skills"
    macos:
      - "~/.codex/skills"
target:
  globalPaths:
    windows:
      - "%USERPROFILE%\\.codex\\skills"
    macos:
      - "~/.codex/skills"
  projectPaths:
    windows: []
    macos: []
  configPath:
    windows: "%USERPROFILE%\\.codex\\config.toml"
    macos: "~/.codex/config.toml"
  pathEditable: true
install:
  supportedModes:
    - symlink
    - copy
  defaultMode: symlink
  fallbackMode: copy
layout:
  type: directory
  targetName: "{{skillID}}"
transform:
  strategy: codex_skill
validation:
  markerFiles:
    - SKILL.md
```

字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| toolID | 是 | 稳定工具 ID，lower_snake_case 或短横线均可，但同一实现内必须统一 |
| displayName | 是 | UI 展示名 |
| enabled | 是 | 是否默认启用该 Adapter |
| platforms | 是 | 支持平台；当前版本 当前要求 Windows 与 macOS runtime，正式安装包交付仍以 Windows 为主 |
| detection.methods | 是 | `registry` / `default_path` / `manual` |
| detection.registryKeys | 否 | Windows 注册表探测项；macOS 不使用注册表 |
| detection.defaultPaths | 是 | 默认路径候选，按平台配置 |
| target.globalPaths | 是 | 工具级目标路径，按平台配置 |
| target.projectPaths | 否 | 项目级相对路径候选，按平台配置 |
| target.configPath | 否 | 工具配置文件或规则入口路径，按平台配置 |
| target.pathEditable | 是 | 是否允许用户覆盖路径 |
| install.supportedModes | 是 | 当前版本 支持 `symlink` / `copy`，默认请求 `symlink` |
| install.defaultMode | 是 | 当前版本 默认为 `symlink` |
| install.fallbackMode | 是 | symlink 失败时的降级模式，当前版本 为 `copy` |
| layout.type | 是 | 当前版本 固定为 `directory` |
| layout.targetName | 是 | 目标目录名模板，当前版本 固定为 `{{skillID}}` |
| transform.strategy | 是 | 目标工具格式转换策略 |
| validation.markerFiles | 是 | 用于识别 Skill 目录的标记文件 |

## 5. 当前版本 首批内置 Adapter

> 说明：以下路径来自 当前版本 默认配置建议和历史 Central Store 草案。工具实际安装路径可能因版本或用户配置变化而不同，所以 当前版本 必须提供手动自定义路径兜底。

| toolID | displayName | Windows 默认目标路径 | macOS 默认目标/规则路径 | 项目路径 | 默认模式 | 当前版本 状态 |
|--------|-------------|-----------------------|--------------------------|----------|----------|---------|
| codex | Codex | `%USERPROFILE%\.codex\skills` | `~/.codex/skills` | Windows: 无；macOS: `.codex/skills` | symlink -> copy fallback | 内置启用 |
| claude | Claude | `%USERPROFILE%\.claude\skills` | `~/.claude/skills` | `.claude/skills` | symlink -> copy fallback | 内置启用 |
| cursor | Cursor | `%USERPROFILE%\.cursor\rules` | `~/.cursor/rules` | `.cursor/rules` | symlink -> copy fallback | 内置启用 |
| windsurf | Windsurf | `%USERPROFILE%\.windsurf\skills` | `~/.codeium/windsurf/memories` | `.windsurf/rules` | symlink -> copy fallback | 内置启用 |
| opencode | opencode | `%USERPROFILE%\.opencode\skills` | `~/.config/opencode/skills` | `.opencode/skills` | symlink -> copy fallback | 内置启用 |
| custom_directory | 自定义目录 | 用户手动选择 | 用户手动选择 | 用户手动选择 | symlink -> copy fallback | 始终可用，manual-only |

当前版本 对内置工具必须做真实格式转换，并以 golden fixture 验证转换产物。自定义目录使用通用目录复制，不承诺转换为某个第三方工具格式。

## 6. 当前版本 转换策略

| toolID | transform.strategy | 当前版本 转换要求 |
|--------|--------------------|-------------|
| codex | `codex_skill` | 输出 Codex 可识别的 Skill 目录，保留 `SKILL.md` 入口和必要资源 |
| claude | `claude_skill` | 输出 Claude Skill 目录，保留 `SKILL.md` 入口、frontmatter 和引用资源 |
| cursor | `cursor_rule` | 输出 Cursor rules 目录/文件，按 Cursor 规则格式生成可加载内容 |
| windsurf | `windsurf_rule` | 输出 Windsurf 可加载的规则/技能目录或文件 |
| opencode | `opencode_skill` | 输出 opencode 可加载的技能/指令目录或文件 |
| custom_directory | `generic_directory` | 原目录 copy，保持包内相对结构 |

转换失败时不得写入目标目录；客户端必须提示具体工具、失败阶段和可重试动作。

## 7. 检测流程

1. 读取内置 Adapter 配置。
2. 对启用的 Adapter 按平台执行探测：Windows 依次执行注册表扫描、默认路径探测；macOS 执行默认路径/规则目录探测。
3. 若找到路径，标记 `adapterStatus: detected`。
4. 若未找到路径，标记 `adapterStatus: missing`，允许用户手动配置。
5. 用户手动配置路径后，标记 `adapterStatus: manual`。
6. 校验路径不可写或不存在时，标记 `adapterStatus: invalid` 并提示修复。

当前版本 注册表扫描未命中或当前平台不支持注册表时，不得阻断手动配置。

## 8. 启用流程

输入：

- `skillID`
- `targetType`
- `targetID`
- `targetPath`
- `requestedMode`（当前版本 默认 `symlink`）
- `resolvedMode`（实际落地 `symlink` / `copy`）
- `fallbackReason`（降级 copy 时必填）

流程：

1. 校验 Skill 已安装到 Central Store。
2. 校验目标路径存在或可创建。
3. 按 Adapter 的 `transform.strategy` 生成目标工具格式产物。
4. 计算目标目录或目标文件：`targetPath / adapter targetName`。
5. 若目标目录或文件已存在，提示将覆盖。
6. 尝试以 symlink 启用转换产物。
7. symlink 失败时自动 copy，并保留失败原因。
8. 写入 `EnabledTarget` 本地状态，记录 `requestedMode`、`resolvedMode`、`fallbackReason`。
9. 生成本地事件，联网时通过 `/desktop/local-events` 上报。

## 9. 停用与卸载

停用：

- 按 `resolvedMode` 从目标工具/项目目录移除 symlink 或副本。
- 不删除 Central Store。
- 更新 `EnabledTarget.status`。

卸载：

- 先列出所有 `enabledTargets`。
- 用户确认后移除目标目录引用。
- 删除 Central Store 中对应 Skill 目录。
- 若部分目标移除失败，保留失败目标状态为 `failed`，并提示重试。

## 10. 冲突与异常

| 场景 | 当前版本 行为 |
|------|---------|
| 目标目录已存在 | 提示覆盖；用户确认后覆盖 |
| 格式转换失败 | 阻止启用；提示目标工具和失败阶段 |
| 目标路径不可写 | 阻止启用；提示修改路径 |
| 目标路径不存在 | 尝试创建；创建失败则阻止启用 |
| Central Store 缺失 | 阻止启用；提示重新安装 |
| 目标 symlink 或副本被手动修改 | 当前版本 不做自动修复；更新/重新启用时按覆盖规则处理 |
| Adapter 未检测到工具 | 允许手动添加自定义路径 |

## 11. 验收标准

- 首次启动时可展示内置 Adapter 列表及检测结果。
- Codex、Claude、Cursor、Windsurf、opencode、自定义目录均有配置项。
- 自动检测失败时用户可手动设置目标路径。
- 启用时优先创建 symlink；symlink 失败时自动 copy，并记录降级原因。
- 内置工具的格式转换 fixture 均可通过验收。
- 停用只移除目标目录副本，不删除 Central Store。
- 卸载前必须列出所有工具/项目引用。
- 项目级启用优先于工具级启用。
- 路径不可写、目标冲突、Central Store 缺失都有明确错误提示。
- 本地 `ToolConfig`、`ProjectConfig`、`EnabledTarget` 字段能满足 [当前版本 Desktop 数据契约](21_p1_data_contract.md)。
