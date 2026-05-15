# Quick Start / 快速开始

This guide gets SKLinkChat running locally as a complete preview.

这份文档用于快速在本地跑起 SKLinkChat 完整预览。

## Prerequisites / 前置依赖

Recommended path:

- Docker
- Docker Compose

For split development without Docker, see [Development Guide](../development/development.md).

如果需要前后端分开调试，请看 [开发指南](../development/development.md)。

## 1. Clone and Configure / 克隆与配置

```bash
git clone https://github.com/BarbieWinter/SKLinkChat.git
cd SKLinkChat
cp .env.example .env
```

Fill Stack Auth values in `.env` if you want to test the full login flow:

```env
SERVER_PY_STACK_AUTH_ENABLED=true
SERVER_PY_STACK_PROJECT_ID=<your_stack_project_id>
SERVER_PY_STACK_SECRET_SERVER_KEY=<your_stack_secret_server_key>
SERVER_PY_STACK_API_BASE_URL=https://api.stack-auth.com
VITE_STACK_PROJECT_ID=<your_stack_project_id>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=<your_stack_publishable_client_key>
```

Do not commit real `.env` files.

不要提交真实 `.env` 文件。

## 2. Start the Full Stack / 启动完整服务

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `5432`
- Redis on `6379`
- FastAPI on `8000`
- Frontend preview on `4173`

## 3. Open the App / 访问项目

- Frontend preview / 前端预览：`http://localhost:4173`
- API health check / API 健康检查：`http://localhost:8000/healthz`
- API readiness check / API 就绪检查：`http://localhost:8000/readyz`
- Stack Auth route / Stack Auth 路由：`http://localhost:4173/auth/stack`
- Admin reports / 管理后台举报页：`http://localhost:4173/admin/reports`
- Admin audit / 管理后台审计页：`http://localhost:4173/admin/audit`

## 4. Admin Access / 管理员权限

Admin access is controlled by the database field `accounts.is_admin`.

管理员权限由数据库字段 `accounts.is_admin` 控制。

```sql
UPDATE accounts
SET is_admin = true
WHERE email_normalized = 'admin@example.com';
```

After updating the database, request `/api/auth/session` again so the frontend receives the latest admin state.

更新后重新请求 `/api/auth/session`，前端会拿到新的管理员状态。

## 5. Next Steps / 下一步

- [Development Guide / 开发指南](../development/development.md)
- [Deployment Guide / 部署指南](../deployment/deployment.md)
- [Architecture Overview / 架构总览](../architecture/overview.md)
- [Codebase Map / 代码地图](../architecture/codebase-map.md)
