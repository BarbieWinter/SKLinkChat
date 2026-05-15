# Contributing / 贡献指南

感谢你愿意参与 SKLinkChat。

提交贡献即表示你理解并接受：本项目按 MIT License 发布，所有贡献也会按同一许可证提供。

## 开始前

1. 阅读 [README.md](README.md)、[文档中心](docs/README.md) 和 [代码地图](docs/architecture/codebase-map.md)。
2. 按 [快速开始](docs/getting-started/quick-start.md) 或 [部署指南](docs/deployment/deployment.md) 准备 `.env` 和本地服务。
3. 执行 `make install` 创建 `.env` 并安装前后端依赖。
4. 提交前执行 `make lint`、`make test`，前端相关改动还需要执行 `make build`。

## 分支与提交

- 分支名建议使用 `feat/short-name`、`fix/short-name`、`docs/short-name`。
- 提交信息使用英文 Conventional Commits，例如 `feat: add chat session model`、`fix: handle empty report reason`。
- 每个 PR 尽量只解决一个问题。

## 开发风格

- 优先沿用现有目录结构和命名方式。
- 前端改动先看 `client/src/features/`，后端改动先看 `server-py/app/`。
- 涉及运行、部署和环境变量的说明统一写入 [docs/deployment/deployment.md](docs/deployment/deployment.md)。
- 涉及用户可见行为的改动，请在 PR 中说明验证方式。

## Pull Request

PR 请包含：

- 改了什么
- 为什么要改
- 如何验证
- 关联的 issue 或任务链接，如有
- UI 改动的截图或录屏，如有

仓库已提供：

- [Bug report](.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature request](.github/ISSUE_TEMPLATE/feature_request.md)
- [Question](.github/ISSUE_TEMPLATE/question.md)
- [Pull request template](.github/pull_request_template.md)

## 行为准则

- 尊重不同经验水平的贡献者。
- 讨论问题时聚焦事实、复现步骤和改进方案。
- 不发布真实用户数据、私密凭据或可被滥用的漏洞细节。

## 安全与隐私

不要提交：

- `.env` 或任何真实环境变量文件
- API key、数据库密码、私钥、访问 token
- 真实用户数据、聊天记录、邮箱地址列表
- 本地构建产物或 IDE 配置

如果发现安全问题，请不要公开创建 issue。请先通过项目维护者指定的私密渠道报告。
