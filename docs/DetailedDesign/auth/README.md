# Auth 模块详细设计

## 目录
- [01. 模块详细设计](./01_auth_module_detailed_design.md)
- [02. 错误契约与前端反馈](./02_auth_error_contract.md)

## 设计范围
本目录只覆盖 `auth` 模块详细设计，基于以下输入：
- `.omx/plans/prd-auth-iam-design.md`
- `.omx/plans/test-spec-auth-iam-design.md`
- `docs/RequirementDocument/01_background_scope.md`
- `docs/RequirementDocument/03_roles_permissions.md`
- `docs/RequirementDocument/06_page_architecture.md`
- `docs/RequirementDocument/11_page_manage.md`
- `docs/RequirementDocument/17_interaction_ux.md`

## 输出目标
沉淀 auth 模块的准实施级设计，包括：
- 模块边界与职责
- 数据模型与状态约束
- API 设计
- 鉴权/会话/密码/冻结/Bootstrap 机制
- 与 `org`、`audit`、桌面端的交互约定
- 前端错误反馈契约

## 不在本目录内展开
- `org` 模块部门树与角色层级的内部实现
- 通用审计中心的全量表设计
- 非 auth 页面的 UI 详细设计
