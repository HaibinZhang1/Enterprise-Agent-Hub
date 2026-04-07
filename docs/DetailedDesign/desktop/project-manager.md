# project-manager 模块设计

## 模块目标
维护本机项目列表、项目路径、项目级 Skill 目录与项目启用目标。

## 主要职责
- 新增/删除/编辑项目路径
- 校验路径存在性与写权限
- 维护项目级 Skill 根目录
- 为启用/停用提供 project target

## 本地状态
- `desktop_projects`
- `desktop_project_roots`
- `desktop_project_health`

## 交互
- IPC：项目 CRUD、路径检测
- HTTP：获取项目级启用所需的 Skill 元数据

## 失败/恢复
- 路径失效时标记 degraded，不自动删除项目
- 提供一键重试检测

## 风险/权衡
- 项目路径由用户维护，系统只做约束与健康检查，不做猜测性纠错
