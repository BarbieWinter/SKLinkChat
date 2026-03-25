# 开发环境指南

本文档记录从零搭建到日常开发所需的全部命令。

## 前置依赖

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Python | 3.11 | 后端运行时 |
| Node.js | 18 | 前端构建 |
| PostgreSQL | 16 | 持久化存储 |
| Redis | 7 | 会话/队列/在线状态 |
| Mailpit | 任意 | 本地邮件测试 (UI http://localhost:8025) |

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

## 三、Mailpit（邮件测试）

```bash
# 如果已有 Homebrew
brew install mailpit && mailpit

# 或者用 Docker 单独跑
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
```

- SMTP：`127.0.0.1:1025`
- Web UI：http://localhost:8025

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
SERVER_PY_EMAIL_PROVIDER=mailpit
SERVER_PY_SMTP_HOST=127.0.0.1
SERVER_PY_SMTP_PORT=1025
SERVER_PY_FRONTEND_BASE_URL=http://localhost:5173
SERVER_PY_TURNSTILE_PROVIDER=fake
SERVER_PY_FAKE_TURNSTILE_ALWAYS_PASS=true
SERVER_PY_SECURE_COOKIES=false
```

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
.venv/bin/pytest tests/ -q          # 全量
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
mailpit &

# 2. 后端（新终端）
cd server-py && source .venv/bin/activate
alembic upgrade head
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000

# 3. 前端（新终端）
cd client && npm run dev
```

打开 http://localhost:5173 即可使用，邮件验证在 http://localhost:8025 查看。

## 七、Docker Compose（可选）

本机如果有 Docker，也可以一键启动全部服务：

```bash
docker compose up --build
```

注意：当前开发机没有 Docker，上面的"全栈启动顺序"是主验证路径。
