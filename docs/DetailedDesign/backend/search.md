# search 模块设计

## 模块目标
提供 Skill 全文搜索、筛选、排序、排行榜与治理指标计算。

## 主要职责
- FTS 索引维护
- 权限过滤后的搜索结果生成
- 排序规则与榜单口径实现
- 下载量、Star、曝光榜指标维护

## 关键实体
- `search_skill_documents`
- `search_metric_snapshots`
- `skill_stars`
- `skill_download_metrics`

## 主要 API
- `GET /search/skills`
- `GET /search/leaderboard`
- `POST /search/reindex/:skillId`
- `POST /skills/:skillId/star`
- `DELETE /skills/:skillId/star`

## 事件
- `search.document.upserted`
- `search.document.removed`
- `metric.download.recorded`
- `metric.star.changed`

## 跨模块依赖
- 接收 `skill` 发布/下架事件
- 接收 `install` 安装成功事件以计算下载口径
- 与 `auth/org` 协作做权限过滤

## 主要权衡
- 先权限过滤后排序，避免受限内容进入结果集
- 排行榜默认展示前 20，降低治理争议和查询成本
