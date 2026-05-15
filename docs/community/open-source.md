# Open Source Handoff / 开源交付说明

This document records repository hygiene, safe publishing notes, and database schema export steps for SKLinkChat maintainers.

这份文档面向 SKLinkChat 维护者，记录仓库整理、安全发布和数据库结构导出方式。

For running and deployment, start with [Quick Start](../getting-started/quick-start.md) and [Deployment Guide](../deployment/deployment.md).

运行和部署请优先阅读 [快速开始](../getting-started/quick-start.md) 和 [部署指南](../deployment/deployment.md)。

## License / 许可证

SKLinkChat is released under the MIT License. You can use, modify, and distribute it under the terms in [`LICENSE`](../../LICENSE).

SKLinkChat 按 MIT License 发布。你可以在 [`LICENSE`](../../LICENSE) 条款下使用、修改和分发本项目。

## Repository Shape / 仓库结构

- `client/`: React + Vite frontend.
- `server-py/`: FastAPI backend.
- `database/schema.sql`: schema-only database reference, with no business data.
- `.env.example`: local environment template.
- `deploy/.env.production.example`: production environment template.
- `deploy/nginx/sklinkchat.conf`: example Nginx reverse proxy config.
- `docker-compose.yml`: local full-stack orchestration.
- `docs/README.md`: documentation hub.
- `CONTRIBUTING.md`: contribution guide.
- `SECURITY.md`: security policy.
- `CHANGELOG.md`: visible project changes.
- `LICENSE`: MIT license.

## Recommended Reading Order / 推荐阅读顺序

1. [README](../../README.md)
2. [Documentation Hub](../README.md)
3. [Quick Start](../getting-started/quick-start.md)
4. [Codebase Map](../architecture/codebase-map.md)
5. [Deployment Guide](../deployment/deployment.md)

## Safe Publishing Checklist / 安全发布检查

Keep these files:

- `README.md`
- `.env.example`
- `deploy/.env.production.example`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `Makefile`
- `docs/README.md`
- `docs/getting-started/quick-start.md`
- `docs/architecture/codebase-map.md`
- `docs/deployment/deployment.md`
- `database/schema.sql`

Do not commit:

- real `.env` files
- Stack Auth secret keys
- database passwords
- private keys or access tokens
- real user data
- chat records
- local build output
- IDE-specific local configuration

## Database Schema Reference / 数据库结构文件

The repository includes:

- `database/schema.sql`

This file contains:

- database object definitions
- table structures
- indexes
- constraints

It must not contain:

- users
- chat records
- sessions
- reports
- business data rows

## Export Schema Again / 重新导出数据库结构

If your local database structure changes, export a schema-only snapshot:

如果本地数据库结构变更，可以重新导出仅包含 schema 的快照：

```bash
mkdir -p database
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat \
  > database/schema.sql
```

Review the generated file before committing:

提交前检查：

1. It should not contain `COPY ... FROM stdin`.
2. It should not contain real business data rows.
3. It should not contain local-only owner or privilege statements.

## Troubleshooting References / 排查入口

- First-run problems: [Quick Start](../getting-started/quick-start.md)
- Environment variables and deployment: [Deployment Guide](../deployment/deployment.md)
- Development commands: [Development Guide](../development/development.md)
- File ownership and code entry points: [Codebase Map](../architecture/codebase-map.md)
