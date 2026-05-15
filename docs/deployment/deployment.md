# Deployment Guide / 部署与配置

This document is the single place for SKLinkChat runtime configuration, Docker behavior, and production deployment notes.

这份文档集中说明 SKLinkChat 的运行配置、Docker 行为和生产部署建议。

## Local Preview / 本地演示

Use Docker Compose when you want the fastest complete preview.

如果只想快速看完整项目形态，优先使用 Docker Compose。

```bash
git clone https://github.com/BarbieWinter/SKLinkChat.git
cd SKLinkChat
cp .env.example .env
docker compose up --build
```

Default URLs:

- Frontend preview: `http://localhost:4173`
- API health check: `http://localhost:8000/healthz`
- API readiness check: `http://localhost:8000/readyz`
- Stack Auth route: `http://localhost:4173/auth/stack`
- Admin reports: `http://localhost:4173/admin/reports`
- Admin audit: `http://localhost:4173/admin/audit`

Default service ports:

- PostgreSQL: `5432`
- Redis: `6379`
- FastAPI: `8000`
- Frontend preview: `4173`

For a shorter first-run guide, see [Quick Start](../getting-started/quick-start.md).

## Development Startup / 开发启动

Use split frontend/backend startup when you need hot reload and easier debugging.

需要调试时，建议前后端分开启动。

```bash
make install
```

Backend only:

```bash
cd server-py
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env .env
alembic upgrade head
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

Frontend only:

```bash
cd client
npm install
cp ../.env .env.local
npm run dev
```

Development URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Health check: `http://localhost:8000/healthz`

For full development commands, see [Development Guide](../development/development.md).

## Environment Variables / 环境变量

Start from the template:

从模板开始：

```bash
cp .env.example .env
```

Frontend variables:

- `VITE_ENDPOINT`
- `VITE_WS_ENDPOINT`
- `VITE_STACK_PROJECT_ID`
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY`

Backend variables:

- `SERVER_PY_DATABASE_URL`
- `SERVER_PY_REDIS_URL`
- `SERVER_PY_APP_BASE_URL`
- `SERVER_PY_STACK_AUTH_ENABLED`
- `SERVER_PY_STACK_PROJECT_ID`
- `SERVER_PY_STACK_SECRET_SERVER_KEY`
- `SERVER_PY_STACK_API_BASE_URL`

Production templates:

- [Production env example](../../deploy/.env.production.example)
- [Nginx reverse proxy example](../../deploy/nginx/sklinkchat.conf)

Never commit real `.env` files, API keys, database passwords, private keys, or user data.

不要提交真实 `.env`、API key、数据库密码、私钥或用户数据。

## Database / 数据库

Run migrations before using a fresh database:

使用新数据库前先执行迁移：

```bash
cd server-py
source .venv/bin/activate
alembic upgrade head
```

The repository includes a schema-only reference:

- `database/schema.sql`

It contains table definitions, indexes, and constraints, but no business data.

该文件只包含表结构、索引和约束，不包含业务数据。

## Admin Access / 管理员权限

Admin access is controlled by `accounts.is_admin`.

管理员权限由 `accounts.is_admin` 控制。

```sql
UPDATE accounts
SET is_admin = true
WHERE email_normalized = 'admin@example.com';
```

After updating the database, request `/api/auth/session` again so the frontend can receive the new admin state.

更新后重新请求 `/api/auth/session`，前端会拿到新的管理员状态。

## Production Shape / 生产部署形态

Recommended production shape:

- Build and serve the React frontend behind HTTPS.
- Run FastAPI behind a process manager or container platform.
- Use managed PostgreSQL and Redis where possible.
- Put the frontend, HTTP API, and WebSocket endpoint behind the same public domain.
- Use Nginx or Caddy as the reverse proxy.
- Keep Stack Auth server keys only on the backend.

推荐生产形态：

- React 前端构建后通过 HTTPS 对外提供。
- FastAPI 通过进程管理器或容器平台运行。
- PostgreSQL 和 Redis 优先使用托管服务。
- 前端、HTTP API 和 WebSocket 入口尽量放在同一公开域名下。
- 使用 Nginx 或 Caddy 作为反向代理。
- Stack Auth server key 只保存在后端。

## Reverse Proxy Checklist / 反向代理检查

- Forward WebSocket upgrade headers.
- Preserve `Host` and forwarded protocol headers.
- Set TLS before exposing the service publicly.
- Keep `SERVER_PY_APP_BASE_URL`, `VITE_ENDPOINT`, and `VITE_WS_ENDPOINT` aligned with the public domain.

## Verification / 验证

Before publishing changes, run:

发布前建议执行：

```bash
make lint
make test
make build
```
