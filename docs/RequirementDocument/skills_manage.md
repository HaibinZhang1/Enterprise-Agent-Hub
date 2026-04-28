# 多 AI 工具统一 Skills 管理器设计草案

## 1. 设计目标

做一个本地 Skills 管理器，解决以下问题：

1. **统一存储**
   所有 skills 有一个唯一真源（central registry / central store）。
2. **多工具分发**
   同一个 skill 可同步到不同 AI 工具的 skills 目录。
3. **路径不一致兼容**
   不同工具 skills 配置路径不同，支持默认路径、用户自定义路径、项目级路径。
4. **多格式兼容**
   支持不同工具要求的 skill 目录结构或文件格式。
5. **安装方式可回退**
   当前版本 默认先尝试 `symlink`，失败时自动回退到 `copy`，并记录真实模式与失败原因。
6. **扫描与去重**
   能扫描已存在的各工具目录，并基于目标路径与 Hash 识别“同一个 skill 被多个工具引用”的情况。
7. **可扩展**
   后续新增 AI 工具时，只需新增一个 adapter，不改核心架构。

------

## 2. 总体架构

建议采用四层结构：

### 2.1 Central Store

统一中心库存放所有原始 skill 内容。

### 2.2 Registry

维护 skill 元数据、工具适配配置、安装记录、同步状态。

### 2.3 Tool Adapter

每个 AI 工具一个 adapter，负责：

- 默认路径定义
- 路径探测
- skill 格式转换
- 安装/卸载
- 扫描/识别

### 2.4 Sync Engine

负责：

- 从中心库同步到目标工具目录
- 检测漂移
- 增量更新
- 冲突处理

------

## 3. 推荐目录结构

```text
~/.ai-skills/
├── config.yaml                 # 全局配置
├── registry/
│   ├── skills.db               # SQLite 元数据
│   ├── cache/
│   └── state.json              # 运行状态、版本、迁移标记
├── skills/                     # 中心 skill 仓库（唯一真源）
│   ├── code-review/
│   │   ├── skill.yaml
│   │   ├── README.md
│   │   ├── prompt.md
│   │   ├── assets/
│   │   └── templates/
│   ├── java-refactor/
│   │   ├── skill.yaml
│   │   └── prompt.md
│   └── frontend-debug/
│       ├── skill.yaml
│       └── prompt.md
├── adapters/
│   ├── claude.yaml
│   ├── codex.yaml
│   ├── cursor.yaml
│   ├── opencode.yaml
│   ├── windsurf.yaml
│   └── custom/
├── logs/
│   ├── app.log
│   └── sync.log
└── backups/
```

------

## 4. Skill 在中心库中的标准格式

每个 skill 一个目录，目录名建议为稳定 slug。

### 4.1 skill.yaml

```yaml
id: code-review
name: Code Review
version: 1.2.0
description: Review Java and frontend code changes
author: local
homepage: ""
license: MIT
tags:
  - review
  - java
  - frontend
entry: prompt.md
assets:
  - templates/report.md
  - assets/example.json

compatibility:
  tools:
    - claude
    - codex
    - cursor
    - windsurf
    - opencode

install:
  preferred_mode: copy
  allow_symlink: false

format:
  type: directory
  engine: markdown

transform:
  claude:
    output_layout: claude-skill-dir
  codex:
    output_layout: codex-skill-dir
  cursor:
    output_layout: cursor-rule-dir
```

### 4.2 prompt.md

存放 skill 主提示词正文。

### 4.3 README.md

说明 skill 用途、输入输出、示例。

------

## 5. 全局配置模型

推荐一个主配置文件：`config.yaml`

```yaml
version: 1

store:
  root: ~/.ai-skills
  skills_dir: ~/.ai-skills/skills
  db_path: ~/.ai-skills/registry/skills.db

sync:
  default_mode: copy
  fallback_to_copy: false
  remove_stale_targets: true
  verify_checksum: true

scan:
  follow_symlinks: false
  dedupe_by_hash: true
  detect_unmanaged_skills: true

tools:
  claude:
    enabled: true
    mode: copy
    global_paths:
      - ~/.claude/skills
    project_paths:
      - .claude/skills
    format: claude-skill-dir

  codex:
    enabled: true
    mode: copy
    global_paths:
      - ~/.codex/skills
    project_paths: []
    format: codex-skill-dir

  cursor:
    enabled: true
    mode: copy
    global_paths:
      - ~/.cursor/skills
      - ~/.cursor/rules
    project_paths:
      - .cursor/rules
    format: cursor-rule-dir

  windsurf:
    enabled: true
    mode: copy
    global_paths:
      - ~/.windsurf/skills
    project_paths: []
    format: generic-dir

  opencode:
    enabled: true
    mode: copy
    global_paths:
      - ~/.config/opencode/skills
    project_paths:
      - .opencode/skills
    format: opencode-skill

  custom_tool_x:
    enabled: true
    mode: copy
    global_paths:
      - D:/AI/custom-tool/skills
    project_paths: []
    format: generic-dir
```

------

## 6. Tool Adapter 配置模型

每个工具一个 adapter 定义，核心是“路径 + 布局 + 转换规则”。

例如 `adapters/claude.yaml`

```yaml
tool_id: claude
display_name: Claude
platforms:
  - windows
  - macos
  - linux

paths:
  global:
    - ~/.claude/skills
  project:
    - .claude/skills

discovery:
  marker_files:
    - README.md
    - prompt.md
    - skill.yaml

install:
  supported_modes:
    - copy
  default_mode: copy

layout:
  type: directory
  target_name: "{{skill.id}}"

transform:
  files:
    - source: skill.yaml
      required: false
    - source: README.md
      required: false
    - source: prompt.md
      target: prompt.md
      required: true
```

例如 `adapters/cursor.yaml`

```yaml
tool_id: cursor
display_name: Cursor

paths:
  global:
    - ~/.cursor/skills
    - ~/.cursor/rules
  project:
    - .cursor/rules

install:
  supported_modes:
    - copy
  default_mode: copy

layout:
  type: directory
  target_name: "{{skill.id}}"

transform:
  strategy: cursor_rules
  files:
    - source: prompt.md
      target: rule.md
      required: true
```

------

## 7. 数据库表设计

建议 SQLite。

### 7.1 skills

```sql
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  version TEXT,
  description TEXT,
  entry_file TEXT,
  checksum TEXT,
  source_type TEXT,         -- local/git/zip/imported/scanned
  source_ref TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### 7.2 tool_configs

```sql
CREATE TABLE tool_configs (
  tool_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  mode TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at TEXT
);
```

### 7.3 installations

```sql
CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  scope TEXT NOT NULL,      -- global/project
  target_path TEXT NOT NULL,
  real_path TEXT,
  mode TEXT NOT NULL,       -- symlink/copy，当前版本 默认 symlink + copy fallback
  checksum TEXT,
  status TEXT NOT NULL,     -- installed/missing/drift/conflict
  created_at TEXT,
  updated_at TEXT
);
```

### 7.4 project_configs

```sql
CREATE TABLE project_configs (
  project_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  skills_path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 7.5 offline_event_queue

```sql
CREATE TABLE offline_event_queue (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/syncing/synced/failed
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  occurred_at TEXT NOT NULL,
  synced_at TEXT
);
```

当前 当前版本 Desktop 的本地真源以 SQLite 为准：

- `local_skill_installs` / `enabled_targets` 记录安装、启用、停用、卸载闭环。
- `project_configs` 持久化项目目标，并由 `get_local_bootstrap` 返回真实 `projects`。
- `offline_event_queue` 在重启后恢复待同步事件，并继续提交到 `/desktop/local-events`。

### 7.4 scan_results

```sql
CREATE TABLE scan_results (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  scanned_path TEXT NOT NULL,
  detected_skill_name TEXT,
  detected_real_path TEXT,
  managed INTEGER NOT NULL,
  matched_skill_id TEXT,
  raw_meta_json TEXT,
  scanned_at TEXT
);
```

### 7.5 sync_history

```sql
CREATE TABLE sync_history (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,     -- install/update/remove/repair
  skill_id TEXT,
  tool_id TEXT,
  target_path TEXT,
  result TEXT NOT NULL,     -- success/fail/skipped
  message TEXT,
  created_at TEXT
);
```

------

## 8. 核心流程设计

## 8.1 安装 skill

输入：`skill_id + tool_id + scope + target_path(optional)`

流程：

1. 从中心库读取 skill
2. 根据 tool adapter 生成目标布局
3. 计算目标目录
4. 按配置生成目标工具格式
5. 使用 `copy` 写入目标目录
6. 写入 installation 记录
7. 写 sync_history

------

## 8.2 扫描现有技能目录

流程：

1. 遍历各工具声明的 `global_paths` / `project_paths`
2. 找到候选 skill 目录
3. 读取元数据
4. 解析目标路径并计算 checksum
5. 用 `target_path + checksum + 规则匹配` 去重
6. 标记：
   - managed：中心库已管理
   - unmanaged：外部技能
   - conflict：名称相同内容不同
   - orphan：安装记录存在但目录缺失

------

## 8.3 同步

流程：

1. 遍历 registry 中所有启用的 skill
2. 计算目标工具集合
3. 比较中心库 checksum 与目标 checksum
4. 增量更新
5. 清理 stale target
6. 输出同步报告

------

## 9. 路径不一致问题的解决策略

这是核心。

## 9.1 不做“单目录强绑”

不要要求所有 AI 工具都去读同一个目录。多数工具并不支持。

## 9.2 建立“逻辑统一，物理分发”

统一的是：

- skill 标识
- skill 内容
- skill 元数据
- 安装状态

不统一的是：

- 物理安装路径
- 工具目录结构
- 工具格式要求

## 9.3 通过 path mapping 解耦

路径全部通过配置驱动：

```yaml
tools:
  claude:
    global_paths:
      - ~/.claude/skills

  codex:
    global_paths:
      - ~/.codex/skills

  cursor:
    global_paths:
      - ~/.cursor/skills
      - ~/.cursor/rules
```

## 9.4 用目标路径与 Hash 去重

当前版本 默认 symlink，失败会自动回退 copy；无论最终落到哪种模式，只要多个工具目录中的内容来自同一个 Central Store 版本，扫描时都应通过安装记录、目标路径和 checksum 识别为同一个 skill 的多个启用目标，而不是多个独立 skill。

## 9.5 支持 override

用户可覆盖默认路径，例如：

```yaml
tools:
  claude:
    global_paths:
      - D:/MyAI/ClaudeSkills
```

## 9.6 支持项目级路径

例如：

- `.claude/skills`
- `.cursor/rules`

这样可以做到“全局技能”和“项目私有技能”并存。

------

## 10. 冲突处理策略

建议定义四类冲突：

### 10.1 Name conflict

同名 skill，内容不同。
处理：保留不同 `id`，提示重命名。

### 10.2 Path conflict

目标目录已存在且不为空。
处理：跳过并提示 `force install`。

### 10.3 Drift

已安装 skill 被目标工具目录手工修改。
处理：标记 `drift`，可执行 `repair` 覆盖恢复。

### 10.4 Unmanaged import

扫描到一个未纳入中心库的 skill。
处理：支持 `import` 进入中心库。

------

## 11. 推荐 CLI 命令设计

```bash
skills init
skills scan
skills list
skills show code-review
skills install code-review --tool claude
skills install code-review --tool cursor --mode copy
skills sync
skills sync --tool claude
skills uninstall code-review --tool claude
skills import /path/to/external-skill
skills repair --tool claude
skills doctor
```

------

## 12. 推荐内部模块划分

```text
src/
├── cli/
├── core/
│   ├── registry/
│   ├── scanner/
│   ├── sync/
│   ├── installer/
│   ├── resolver/
│   └── checksum/
├── adapters/
│   ├── base/
│   ├── claude/
│   ├── codex/
│   ├── cursor/
│   └── custom/
├── storage/
│   ├── sqlite/
│   └── fs/
└── utils/
```

### 模块职责

- `registry`: skill 元数据管理
- `scanner`: 路径扫描与识别
- `sync`: 同步决策
- `installer`: copy 执行
- `resolver`: 路径解析、变量展开
- `checksum`: 文件摘要与变更检测

------

## 13. 最小可用版本建议

第一版先做这 6 个功能就够：

1. 中心库初始化
2. skill 导入
3. tool 路径配置
4. install/sync
5. scan/dedupe
6. drift 检测

先不要急着做：

- UI
- marketplace
- Git 备份
- 远程仓库安装
- watcher 实时同步

------

## 14. 最推荐的落地原则

一句话总结：

**用中心库存真源，用 tool adapter 适配差异，用 path mapping 解决不同路径，用 copy 分发，用 Hash 和目标路径去重。**
