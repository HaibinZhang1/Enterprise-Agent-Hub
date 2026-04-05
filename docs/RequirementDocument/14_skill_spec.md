# 9. Skill 元数据与包规范

## 9.1 设计原则
本系统的 Skill 规范参考 Claude 官方对 skills 的定义方式：以目录为单位、以 `SKILL.md` 为入口文件、支持 YAML frontmatter、支持附带脚本与参考资源、支持按作用域进行发现与加载；在此基础上补充企业内部市场治理所需的元数据、审核信息、权限信息与兼容性声明，形成统一的企业 Skill 包规范。

## 9.2 Skill 包最小结构
每个 skill 至少应采用如下目录结构：

```text
<skill-id>/
├── SKILL.md                # 必填，主入口说明文件
├── README.md               # 选填，面向用户的使用说明
├── CHANGELOG.md            # 选填，版本变更记录
├── icon.png                # 选填，图标
├── examples/               # 选填，示例输入输出
├── resources/              # 选填，参考资料、模板、说明文档
├── scripts/                # 选填，辅助脚本
└── assets/                 # 选填，截图、演示素材
```

说明：
- `SKILL.md` 为入口文件，缺失则视为非法 skill 包
- `manifest.json` **由系统在发布时自动生成**，数据来源于发布表单，用户无需手动创建
- `README.md` 为市场详情页默认展示材料
- `scripts/` 中的脚本默认视为可执行资源，但需在审核中明确风险等级
- `resources/` 中的内容默认视为说明或模板材料
- 用户本地未发布的 skill 无需包含 manifest.json，系统仍可通过扫描 SKILL.md 识别

## 9.3 SKILL.md 规范
`SKILL.md` 由两部分组成：
1. 顶部 YAML frontmatter
2. 下方 Markdown 指令内容

建议字段如下：

```yaml
---
name: example-skill
description: 该 skill 的用途与适用场景
allowed-tools: Read Grep
disable-model-invocation: false
---
```

### 字段说明
- `name`：skill 调用名；默认建议与 `skillID` 一致，仅允许小写字母、数字、连字符
- `description`：skill 的用途、适用场景、何时触发；为推荐字段
- `allowed-tools`：声明 skill 运行时可访问的工具集合
- `disable-model-invocation`：是否禁止模型自动调用，仅允许人工触发

### 内容规范
- `SKILL.md` 必须说明用途、输入、输出、限制条件、依赖、风险提示
- 应尽量聚焦主说明，不承载超长参考资料
- 大型参考资料应拆到 `resources/` 或其他文档中
- 建议控制长度，避免成为过长的大杂烩说明文件

---

## 9.4 manifest.json 说明

`manifest.json` 由系统在发布时自动生成，包含以下元数据：

### 基础信息
- skillID
- 显示名称
- 描述
- 图标
- 标签 / 分类

### 归属信息
- 发布者
- 所属部门
- 维护者
- 发布时间
- 更新时间

### 使用信息
- 适用工具
- 适用项目
- 支持环境
- 安装方式
- 启用方式

### 权限与风险信息
- 授权范围
- 公开级别
- 风险等级
- 风险说明
- 审核意见摘要

### 生命周期信息
- 当前状态
- 当前版本
- 历史版本
- 变更说明
- 是否上架
- 是否已归档

### 依赖信息
- 依赖项列表（**仅作展示用，不做自动解析**）

---

## 9.5 上传校验规则
上传后系统至少执行以下校验：

### 结构校验
- 根目录存在 `SKILL.md`
- `skill_id` 与目录名一致
- `entry` 可解析且文件存在

### 元数据校验
- 必填字段完整
- `skill_id` 合法且未冲突
- `version` 格式正确（SemVer）
- `compatible_tools` 与 `compatible_systems` 不为空

### 内容校验
- README 可正常展示
- 图标、截图、示例文件类型合法
- 脚本文件可被识别并标记风险

### 安全初审校验
- 是否包含脚本
- 是否声明外部访问能力
- 是否声明依赖项
- 是否存在高风险文件类型
- 命中异常时进入"待人工复核"，不直接拒绝

## 9.6 版本与升级约束
- 版本号需遵循 **SemVer** 规范（`MAJOR.MINOR.PATCH`）
- 版本号必须递增，不支持预发布版本号
- 同一 `skill_id` 仅允许存在一个当前有效版本
- 历史版本仅用于展示和追溯，不允许多版本同时安装
- 更新不计入下载量
- 版本切换默认为覆盖升级（全量覆盖）
