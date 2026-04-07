# projects 页面设计

## 页面目标
维护本机项目与项目级 Skill 目录，支持项目维度启用 Skill。

## 页面区域
- 项目列表
- 项目详情
- 路径配置
- 项目级启用 Skill 面板

## 关键数据与动作
- IPC `listProjects/createProject/updateProject/deleteProject`
- `GET /installs/me`
- IPC `activateSkillForProject`

## 状态设计
- 路径失效项目显示 degraded 标签
- 项目为空时提供新增引导

## 权限要点
- 本机项目维护不受服务端角色限制
- 启用时仍要校验服务端权限与本地冲突结果
