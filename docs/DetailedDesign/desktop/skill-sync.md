# skill-sync 模块设计

## 模块目标
负责从服务端下载 Skill 制品、校验、解压、本地安装、启用、停用、覆盖更新与卸载。

## 主要职责
- 下载发布制品
- hash 校验与解压
- 写入 central store
- 执行 symlink/copy 分发到工具或项目目录
- 回写本地执行结果与服务端安装状态

## 本地状态
- `desktop_sync_jobs`
- `desktop_local_skills`
- `desktop_install_targets`
- `desktop_sync_failures`

## 交互
- HTTP：下载制品、安装/启用/卸载意图上报
- IPC：本地文件操作、解压、链接创建

## 失败/恢复
- 失败任务支持重试和部分回滚
- 本地执行结果与服务端事实不一致时进入 reconcile 队列

## 风险/权衡
- symlink 更省空间，copy 更兼容；需按工具适配配置选择
