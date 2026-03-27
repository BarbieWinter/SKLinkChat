# 开发环境指南

本文档记录从零搭建到日常开发所需的全部命令。

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
| 测试 | `postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat_test` |

写入 `server-py/.env` 的 key 是 `SERVER_PY_DATABASE_URL`（开发用）。测试库由 `tests/postgres_utils.py` 自动创建。

## 二、Redis

```bash
# macOS（Homebrew）
brew services start redis

# 或手动
redis-server --daemonize yes
```

默认地址 `redis://localhost:6379/0`，写入 `.env` 的 key 是 `SERVER_PY_REDIS_URL`。

## 三、Resend（邮件服务）

当前项目使用 [Resend](https://resend.com) 作为主邮件服务，已验证发件域名 `mail.sklinkchat.com`。

需要的环境变量：

```
SERVER_PY_EMAIL_PROVIDER=resend
SERVER_PY_EMAIL_FROM=noreply@mail.sklinkchat.com
SERVER_PY_RESEND_API_KEY=<your_resend_api_key>
SERVER_PY_APP_BASE_URL=http://localhost:5173
```

> **可选本地调试**：如需在本地使用 Mailpit 拦截邮件（不走真实发送），可将 `EMAIL_PROVIDER` 改为 `mailpit` 并启动 Mailpit：
> ```bash
> brew install mailpit && mailpit
> # 或 docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
> ```
> SMTP: `127.0.0.1:1025` / Web UI: http://localhost:8025

## 四、后端 (server-py)

### 4.1 初始化

```bash
cd server-py
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 4.2 环境变量

复制 `.env.example`（或直接编辑 `.env`），确保至少包含：

```
SERVER_PY_DATABASE_URL=postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat
SERVER_PY_REDIS_URL=redis://localhost:6379/0
SERVER_PY_EMAIL_PROVIDER=resend
SERVER_PY_EMAIL_FROM=noreply@mail.sklinkchat.com
SERVER_PY_RESEND_API_KEY=<your_resend_api_key>
SERVER_PY_APP_BASE_URL=http://localhost:5173
SERVER_PY_TURNSTILE_ENABLED=true
SERVER_PY_TURNSTILE_SITE_KEY=<your_turnstile_site_key>
SERVER_PY_TURNSTILE_SECRET_KEY=<your_turnstile_secret_key>
SERVER_PY_SECURE_COOKIES=false
```

如果你只单独启动前端，也可以显式配置：

```
VITE_TURNSTILE_ENABLED=true
VITE_TURNSTILE_SITE_KEY=<your_turnstile_site_key>
```

其中 `site key` 只用于前端渲染组件，`secret key` 只用于后端服务端校验。

管理员身份现在由 PostgreSQL `accounts.is_admin` 字段驱动。测试或本地切换管理员时，可直接更新数据库：

```sql
UPDATE accounts
SET is_admin = true
WHERE email_normalized = 'admin@example.com';
```

修改后无需改 `.env`，重新请求 `/api/auth/session` 即会返回最新 `is_admin` 状态。

### 4.3 数据库迁移

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

### 4.4 启动开发服务

```bash
cd server-py
source .venv/bin/activate
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

后端运行在 http://localhost:8000 ，健康检查 http://localhost:8000/api/health 。

### 4.5 运行测试

```bash
cd server-py
.venv/bin/pytest tests/ -q          # 全量（仓库正式测试）
.venv/bin/pytest tests/ -q -x       # 遇到失败立即停止
.venv/bin/pytest tests/ -q -k websocket  # 只跑包含 websocket 的用例
```

测试自动使用 `sklinkchat_test` 数据库，每个 fixture 会 drop + create 全表，互不干扰。

### 4.6 代码检查

```bash
cd server-py
.venv/bin/ruff check .
.venv/bin/ruff format --check .
```

## 五、前端 (client)

### 5.1 初始化

```bash
cd client
npm install
```

### 5.2 启动开发服务

```bash
cd client
npm run dev
```

前端运行在 http://localhost:5173 ，自动代理 API 到后端 8000 端口。

管理端路由：

- http://localhost:5173/admin/reports
- http://localhost:5173/admin/audit

### 5.3 构建 & 测试

```bash
npm run build      # 生产构建
npm run test -- --run   # 单次运行测试
npm run test:watch      # watch 模式
npm run lint            # ESLint 检查
```

## 六、全栈启动顺序

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

## 七、Docker Compose（可选）

本机如果有 Docker，也可以一键启动全部服务：

```bash
docker compose up --build
```

如果需要通过 Docker Compose 一起启用 Turnstile，请在根目录 `.env` 中提供：

```
SERVER_PY_TURNSTILE_ENABLED=true
SERVER_PY_TURNSTILE_SITE_KEY=<your_turnstile_site_key>
SERVER_PY_TURNSTILE_SECRET_KEY=<your_turnstile_secret_key>
```

注意：当前开发机没有 Docker，上面的"全栈启动顺序"是主验证路径。
