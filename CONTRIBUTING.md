# Contributing

感谢你愿意参与 SKLinkChat。

提交贡献即表示你理解并接受：本项目按 MIT License 发布，所有贡献也会按同一许可证提供。

## 开始前

1. 阅读 `README.md` 和 `DEVELOPMENT.md`。
2. 复制 `.env.example` 到 `.env`，按本地环境填写。
3. 执行 `make install` 创建 `.env` 并安装前后端依赖。
4. 提交前执行 `make lint` 和 `make test`。

## 分支与提交

- 分支名建议使用 `feat/short-name`、`fix/short-name`、`docs/short-name`。
- 提交信息使用简短的祈使句，例如 `feat: add chat session model`。
- 每个 PR 尽量只解决一个问题。

## Pull Request

PR 请包含：

- 改了什么
- 为什么要改
- 如何验证
- 关联的 issue 或任务链接，如有
- UI 改动的截图或录屏，如有

## 安全与隐私

不要提交：

- `.env` 或任何真实环境变量文件
- API key、数据库密码、私钥、访问 token
- 真实用户数据、聊天记录、邮箱地址列表
- 本地构建产物或 IDE 配置

如果发现安全问题，请不要公开创建 issue。请先通过项目维护者指定的私密渠道报告。
