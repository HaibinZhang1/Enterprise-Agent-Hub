# auth 模块（索引）

`auth` 模块详细设计已单独拆分至：
- [../auth/README.md](../auth/README.md)

本页只保留与其他后端模块的协作边界：
- 为所有模块提供当前用户身份、session、authz_version 校验结果
- 与 `org` 协同完成角色/部门变更后的授权收敛
- 向 `audit` 输出安全事件
- 向 `notify` 输出登录异常、密码重置、强制下线等提示型事件
