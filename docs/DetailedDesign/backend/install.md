# install 模块设计

## 模块目标
记录用户安装、启用、停用、卸载、引用关系与权限收缩后的存量影响。

## 主要职责
- 安装记录与版本记录
- 工具级 / 项目级启用记录
- 卸载影响面提示与引用统计
- 权限收缩后的存量继续使用规则执行
- 更新可用性判断

## 关键实体
- `install_records`
- `activation_records`
- `install_references`
- `uninstall_events`
- `update_eligibility_cache`

## 主要 API
- `GET /installs/me`
- `POST /installs`
- `POST /installs/:id/activate`
- `POST /installs/:id/deactivate`
- `DELETE /installs/:id`
- `GET /installs/:id/references`

## 事件
- `install.created`
- `install.activated`
- `install.deactivated`
- `install.removed`
- `install.update.available`
- `install.blocked.by_scope_narrowing`

## 跨模块依赖
- 依赖 `skill` 获取当前发布版本与权限
- 依赖桌面端 `skill-sync` 执行本地落盘
- 向 `notify` 输出更新提醒与权限收缩提醒

## 主要权衡
- 服务端记录“意图与事实”，桌面端记录“本机执行结果”，两者需可对账
- 权限收缩后存量用户保留使用，但禁止更新/新增安装，必须显式建模
