# package 模块设计

## 模块目标
处理 zip 上传、解压、目录结构校验、hash 计算、manifest 补全与风险预检。

## 主要职责
- 上传 zip 接收与存储
- 包 hash、文件列表、目录树、体积统计
- 结构校验：`SKILL.md`、README、scripts/resources 等
- YAML / JSON schema 校验
- 生成 package report，供审核页与发布页使用

## 关键实体
- `package_uploads`
- `package_extractions`
- `package_validation_reports`
- `package_risk_findings`

## 主要 API
- `POST /packages/upload`
- `GET /packages/:packageId/report`
- `POST /packages/:packageId/revalidate`
- `GET /packages/:packageId/files`

## 异步任务
- 解压任务
- schema 校验任务
- 风险扫描任务
- 清理过期工作区任务

## 跨模块依赖
- 向 `skill` 提供可发布版本输入
- 向 `review` 输出结构风险与预检报告
- 向 `audit` 输出上传/重检动作日志

## 主要权衡
- 预检做“风险提示”而非“自动安全判决”
- 原始包与工作区分离存储，降低污染和误删风险
