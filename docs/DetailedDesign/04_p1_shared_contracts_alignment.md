# 04. 当前版本 共享契约落地对齐

## 1. 目的

`packages/shared-contracts` 是 当前版本 Desktop 与 API 的共享 TypeScript 契约源，承接 `docs/RequirementDocument/21_p1_data_contract.md` 中的枚举、DTO、分页、错误响应、最小 HTTP 路由和 Tauri command 签名，避免 Desktop/API/Rust command 边界出现字段漂移。

## 2. 落地范围

- 根目录采用 npm workspaces：`apps/*` 与 `packages/*`。
- 根目录脚本固定为 `build`、`typecheck`、`test`、`lint`、`clean`，当前通过 workspace 转发执行。
- `packages/shared-contracts` 导出 当前版本 枚举、错误码、分页响应、Bootstrap/Login/Skill/DownloadTicket/Notification/LocalEvents DTO、`menuPermissions`、`adminLevel`、管理端 DTO、本地状态模型，以及最小 Tauri command 请求/响应映射。
- JSON 字段继续使用 camelCase，历史业务字段保持 `skillID`、`userID`、`departmentID`、`deviceID` 写法。

## 3. symlink-first/copy-fallback 约束

共享契约显式保留以下字段，用于安装、启用、离线事件和本地状态上报：

- `installMode`: 实际落地模式，取值 `symlink | copy`。
- `requestedMode`: 用户或系统请求模式，默认应为 `symlink`。
- `resolvedMode`: 实际解析模式，symlink 失败降级时为 `copy`。
- `fallbackReason`: 发生 copy 降级时必须携带的结构化原因。

Store/Adapter/Rust command 实现不得退回 copy-only 文案或数据模型；目标目录只是分发输出，Central Store 仍是唯一真源。

## 4. 后续对接规则

- API/Nest DTO 与 Desktop API client 应从 `@enterprise-agent-hub/shared-contracts` 复用类型或保持同名字段映射。
- `DesktopBootstrapResponse`、`LoginResponse` 与前端领域模型需统一包含 `menuPermissions`；管理员用户需统一包含 `adminLevel`。
- Tauri command wrapper 应使用 `LocalCommandRequestMap` / `LocalCommandResponseMap` 校准命令签名。
- 若 `21_p1_data_contract.md` 变更字段或枚举，必须同步更新共享契约和本文件，并运行根目录 `npm run typecheck` 与 `npm test`。
