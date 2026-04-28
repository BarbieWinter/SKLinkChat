# 开发环境指南

本文档记录从零搭建到日常开发所需的全部命令。

## 常用入口

优先使用根目录 `Makefile` 中的统一命令：

```bash
make setup   # 安装前后端依赖
make install # 创建 .env 并安装依赖
make dev     # 使用 Docker Compose 启动整套服务
make lint    # 前后端代码检查
make test    # 当前后端基础验证
make build   # 前端生产构建
```

如果只想调试某一端，也可以使用下面的分项命令。

## 前置依赖

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Python | 3.11 | 后端运行时 |
| Node.js | 18 | 前端构建 |
| PostgreSQL | 16 | 持久化存储 |
| Redis | 7 | 会话/队列/在线状态 |

## 一、PostgreSQL

### 1.1 本地手动安装（macOS，非 Homebrew）

当前机器的 PostgreSQL 安装在 `~/.local/postgresql-16`，数据目录 `~/.local/postgresql-16/data`。

```bash
# 启动
~/.local/postgresql-16/bin/pg_ctl -D ~/.local/postgresql-16/data -l ~/.local/postgresql-16/data/server.log start

# 停止
~/.local/postgresql-16/bin/pg_ctl -D ~/.local/postgresql-16/data stop

# 查看状态
~/.local/postgresql-16/bin/pg_ctl -D ~/.local/postgresql-16/data status
```

### 1.2 创建数据库和账号（首次）

```bash
~/.local/postgresql-16/bin/psql -U postgres -c "CREATE ROLE sklinkchat WITH LOGIN PASSWORD 'sklinkchat';"
~/.local/postgresql-16/bin/psql -U postgres -c "CREATE DATABASE sklinkchat OWNER sklinkchat;"
~/.local/postgresql-16/bin/psql -U postgres -c "CREATE DATABASE sklinkchat_test OWNER sklinkchat;"
```

### 1.3 连接串

| 用途 | 连接串 |
|------|--------|
| 开发 | `postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat` |

写入 `server-py/.env` 的 key 是 `SERVER_PY_DATABASE_URL`。

## 二、Redis

```bash
# macOS（Homebrew）
brew services start redis

# 或手动
redis-server --daemonize yes
```

默认地址 `redis://localhost:6379/0`，写入 `.env` 的 key 是 `SERVER_PY_REDIS_URL`。

## 三、后端 (server-py)

### 3.1 初始化

```bash
cd server-py
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 3.2 环境变量

复制 `.env.example`（或直接编辑 `.env`），确保至少包含：

```
SERVER_PY_DATABASE_URL=postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat
SERVER_PY_REDIS_URL=redis://localhost:6379/0
SERVER_PY_APP_BASE_URL=http://localhost:5173
SERVER_PY_STACK_AUTH_ENABLED=true
SERVER_PY_STACK_PROJECT_ID=<your_stack_project_id>
SERVER_PY_STACK_SECRET_SERVER_KEY=<your_stack_secret_server_key>
SERVER_PY_STACK_API_BASE_URL=https://api.stack-auth.com
SERVER_PY_SECURE_COOKIES=false
```

如果你只单独启动前端，也可以显式配置：

```
VITE_STACK_PROJECT_ID=<your_stack_project_id>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=<your_stack_publishable_client_key>
# 或者使用 Stack 文档默认命名（本项目已兼容）
NEXT_PUBLIC_STACK_PROJECT_ID=<your_stack_project_id>
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=<your_stack_publishable_client_key>
```

前端未登录时会直接跳转 `/auth/stack`，旧登录/注册/GeeTest 链路已经从项目中删除。

如果你习惯使用 Stack 默认变量名，也支持：

```
STACK_PROJECT_ID=<your_stack_project_id>
STACK_SECRET_SERVER_KEY=<your_stack_secret_server_key>
```

管理员身份现在由 PostgreSQL `accounts.is_admin` 字段驱动。测试或本地切换管理员时，可直接更新数据库：

```sql
UPDATE accounts
SET is_admin = true
WHERE email_normalized = 'admin@example.com';
```

修改后无需改 `.env`，重新请求 `/api/auth/session` 即会返回最新 `is_admin` 状态。

### 3.3 数据库迁移

```bash
cd server-py
source .venv/bin/activate

# 升级到最新
alembic upgrade head

# 查看当前版本
alembic current

# 降级一个版本
alembic downgrade -1

# 查看 schema
psql -U sklinkchat -d sklinkchat -c "\dt+"
```

### 3.4 启动开发服务

```bash
cd server-py
source .venv/bin/activate
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

后端运行在 http://localhost:8000 ，健康检查 http://localhost:8000/healthz 。

### 3.5 代码检查

```bash
cd server-py
.venv/bin/ruff check app
python -m compileall app
```

## 四、前端 (client)

### 4.1 初始化

```bash
cd client
npm install
```

### 4.2 启动开发服务

```bash
cd client
npm run dev
```

前端运行在 http://localhost:5173 ，自动代理 API 到后端 8000 端口。

管理端路由：

- http://localhost:5173/admin/reports
- http://localhost:5173/admin/audit

Stack Auth 前端接入验证路由（M1）：

- http://localhost:5173/auth/stack
- http://localhost:5173/handler/*

### 4.3 构建 & 检查

```bash
npm run build      # 生产构建
npm run lint            # ESLint 检查
```

## 五、全栈启动顺序

```bash
# 1. 基础设施
~/.local/postgresql-16/bin/pg_ctl -D ~/.local/postgresql-16/data start
redis-server --daemonize yes

# 2. 后端（新终端）
cd server-py && source .venv/bin/activate
alembic upgrade head
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000

# 3. 前端（新终端）
cd client && npm run dev
```

打开 http://localhost:5173 即可使用。

## 六、Docker Compose（可选）

本机如果有 Docker，也可以一键启动全部服务：

```bash
docker compose up --build
```

如果需要通过 Docker Compose 启用 Stack Auth，请在根目录 `.env` 中提供：

```
SERVER_PY_STACK_AUTH_ENABLED=true
SERVER_PY_STACK_PROJECT_ID=<your_stack_project_id>
SERVER_PY_STACK_SECRET_SERVER_KEY=<your_stack_secret_server_key>
SERVER_PY_STACK_API_BASE_URL=https://api.stack-auth.com
```

注意：当前开发机没有 Docker，上面的"全栈启动顺序"是主验证路径。
