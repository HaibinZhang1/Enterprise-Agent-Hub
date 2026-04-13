# 项目进度归档

本目录用于归纳跨轮次计划、团队交付和验证结论。运行期上下文仍保留在 `.omx/`，但面向项目协作时以本目录和 `docs/Verification/` 里的证据文档为准。

## 文档索引

| 文档 | 用途 |
| --- | --- |
| [P1 交付进度归档（2026-04-12）](p1-delivery-progress-2026-04-12.md) | 汇总 P1 已落地的最小纵向链路、剩余工程收尾项和目标环境实机验证缺口。 |

## 当前结论

- P1 已从纯需求/详细设计推进到 monorepo、API、Desktop、Tauri/Rust Store/Adapter、部署脚本和严格门禁均存在的阶段。
- `node scripts/verification/p1-verify.mjs --strict` 最近一次记录为 PASS，覆盖 12 个命令、12 个必需交付物、13 个验收场景。
- 已验证的最小桌面纵向链路包含：真实 API `download-ticket`、Tauri 安装/更新、Central Store + SQLite 写入、Codex 启用，以及重启后的本地状态恢复。
- 当前仍不能把项目称为“目标环境可交付已完成”：Linux Docker 实机部署、Windows NSIS `.exe` 打包、`disable/uninstall`、项目目标持久化和 SQLite 离线队列恢复同步仍是收尾缺口。
