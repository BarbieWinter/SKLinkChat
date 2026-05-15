# Development Guide / 开发指南

This guide covers reusable local development commands for SKLinkChat.

这份文档记录 SKLinkChat 的通用本地开发流程和常用命令。

## Command Entry / 统一命令入口

Prefer the root `Makefile` when possible:

优先使用根目录 `Makefile`：

```bash
make setup   # install frontend and backend dependencies
make install # create .env when missing, then install dependencies
make dev     # start the full stack with Docker Compose
make lint    # run backend and frontend lint checks
make test    # run current backend compile validation
make build   # build the frontend
make clean   # remove local build/cache artifacts
```

## Prerequisites / 前置依赖

| Component / 组件 | Minimum / 最低版本 | Purpose / 用途 |
| --- | --- | --- |
| Python | 3.11 | Backend runtime / 后端运行时 |
| Node.js | 18 | Frontend build / 前端构建 |
| PostgreSQL | 16 | Durable storage / 持久化存储 |
| Redis | 7 | Presence, matching, realtime state / 在线状态、匹配和实时状态 |

Docker Compose is the fastest complete preview path. Split startup is better for hot reload and debugging.

Docker Compose 适合最快完整预览；前后端分开启动更适合热更新和调试。

## Environment / 环境变量

Start from the root template:

从根目录模板开始：

```bash
cp .env.example .env
```

Backend essentials:

```env
SERVER_PY_DATABASE_URL=postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat
SERVER_PY_REDIS_URL=redis://localhost:6379/0
SERVER_PY_APP_BASE_URL=http://localhost:5173
SERVER_PY_STACK_AUTH_ENABLED=true
SERVER_PY_STACK_PROJECT_ID=<your_stack_project_id>
SERVER_PY_STACK_SECRET_SERVER_KEY=<your_stack_secret_server_key>
SERVER_PY_STACK_API_BASE_URL=https://api.stack-auth.com
SERVER_PY_SECURE_COOKIES=false
```

Frontend essentials:

```env
VITE_STACK_PROJECT_ID=<your_stack_project_id>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=<your_stack_publishable_client_key>
```

The project also accepts Stack Auth's default server variable names:

项目也兼容 Stack Auth 常见服务端变量名：

```env
STACK_PROJECT_ID=<your_stack_project_id>
STACK_SECRET_SERVER_KEY=<your_stack_secret_server_key>
```

## Backend / 后端

Initialize:

初始化：

```bash
cd server-py
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env .env
```

Run migrations:

执行迁移：

```bash
cd server-py
source .venv/bin/activate
alembic upgrade head
```

Start the backend:

启动后端：

```bash
cd server-py
source .venv/bin/activate
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

Useful backend checks:

后端常用检查：

```bash
cd server-py
./.venv/bin/ruff check app
python -m compileall app
```

Backend URLs:

- API: `http://localhost:8000`
- Health check: `http://localhost:8000/healthz`
- Readiness check: `http://localhost:8000/readyz`

## Frontend / 前端

Initialize:

初始化：

```bash
cd client
npm install
cp ../.env .env.local
```

Start the frontend:

启动前端：

```bash
cd client
npm run dev
```

Useful frontend checks:

前端常用检查：

```bash
cd client
npm run lint
npm run build
```

Frontend URLs:

- App: `http://localhost:5173`
- Stack Auth route: `http://localhost:5173/auth/stack`
- Stack handler: `http://localhost:5173/handler/*`
- Admin reports: `http://localhost:5173/admin/reports`
- Admin audit: `http://localhost:5173/admin/audit`

## Manual Full-Stack Startup / 手动全栈启动

Use this when you are not using Docker Compose.

不使用 Docker Compose 时可按下面顺序启动。

```bash
# 1. Start PostgreSQL and Redis with your local service manager.
#    Ensure PostgreSQL is available on 127.0.0.1:5432
#    and Redis is available on 127.0.0.1:6379.

# 2. Backend terminal
cd server-py
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000

# 3. Frontend terminal
cd client
npm run dev
```

Open `http://localhost:5173`.

## Database / 数据库

Create local databases and roles using your preferred PostgreSQL tooling. The default development connection string is:

使用你习惯的 PostgreSQL 工具创建本地数据库和账号。默认开发连接串为：

```text
postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat
```

Migration commands:

迁移命令：

```bash
cd server-py
source .venv/bin/activate
alembic upgrade head
alembic current
alembic downgrade -1
```

## Admin Role / 管理员身份

Admin status is stored in PostgreSQL:

管理员身份存储在 PostgreSQL：

```sql
UPDATE accounts
SET is_admin = true
WHERE email_normalized = 'admin@example.com';
```

After the update, request `/api/auth/session` again.

更新后重新请求 `/api/auth/session`。
