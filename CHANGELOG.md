# Changelog

所有重要变更都会记录在这里。

格式参考 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号参考 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Added

- README 顶部 badges、项目展示图和架构概览。
- README 增加中英双语介绍、截图、本地演示入口和一键运行说明。
- README 增加稳定锚点，并将在线演示相关表述调整为本地演示。
- 新增 `docs/DEPLOYMENT.md`，集中说明本地演示、开发启动、环境变量和生产部署建议。
- GitHub Actions CI、Issue 模板、PR 模板和安全报告说明。
- `docs/SCREENSHOTS.md`、`docs/ROADMAP.md`、`docs/ARCHITECTURE.md`。
- 补充开源发布所需的基础文档、MIT License 和统一命令入口。
- 增加 `make install` 快捷安装方式。

### Changed

- README 的英文和中文分区分别只展示对应语言预览图。
- README 调整为英文摘要 + 中文主文档，减少双语重复。
- `CONTRIBUTING.md` 补充可点击文档链接、提交规范、开发风格和行为准则。
- `SECURITY.md` 补充英文说明和漏洞处理流程。
- `docs/ROADMAP.md` 改为版本里程碑和目标导向结构。
- License 调整为 MIT License。
- 清理生产配置示例，避免默认携带真实形态的密码或固定部署地址。
- 生产环境示例配置对齐当前 Stack Auth 流程。

### Removed

- 移除本地系统文件和无关临时文件。

## [0.1.0] - 2026-04-28

### Added

- 初始开源准备版本。
- React + Vite 前端、FastAPI 后端、PostgreSQL、Redis 和 Stack Auth 基础链路。
- 匿名聊天、举报提交、管理后台举报审核和审计日志。
- Docker Compose 本地启动和基础 CI 检查。
