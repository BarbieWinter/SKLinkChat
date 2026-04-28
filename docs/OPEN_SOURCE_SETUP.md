# Open Source Setup / 开源使用手册

这份文档面向第一次接触 SKLinkChat 的开发者，重点说明怎么启动、怎么配置、怎么理解项目结构，以及怎么重新导出数据库结构。

SKLinkChat is released under the MIT License. You can use, modify, and distribute it under the terms in `LICENSE`.

SKLinkChat 按 MIT License 发布。你可以在 `LICENSE` 条款下使用、修改和分发本项目。

## 1. 项目简介

SKLinkChat 是一个匿名随机聊天项目，当前仓库包含：

- 前端：React + Vite
- 后端：FastAPI
- 数据库：PostgreSQL
- 缓存与在线状态：Redis
- 登录方案：Stack Auth
- 管理后台：举报审核、审计查看

## 2. 仓库结构

### 根目录

- `client/`
  前端工程
- `server-py/`
  后端工程
- `database/schema.sql`
  数据库结构导出文件，无业务数据
- `.env.example`
  环境变量示例
- `docker-compose.yml`
  本地整套服务编排
- `DEVELOPMENT.md`
  偏开发过程的命令记录
- `LICENSE`
  MIT 开源许可证
- `CONTRIBUTING.md`
  贡献说明
- `CHANGELOG.md`
  版本变更记录

### 推荐优先阅读

1. `README.md`
2. `docs/OPEN_SOURCE_SETUP.md`
3. `docs/CODEBASE_MAP.md`

## 3. 运行前准备

### 3.1 软件版本

- Node.js 18 或更高
- Python 3.11 或更高
- PostgreSQL 16
- Redis 7

### 3.2 必填环境变量

最快方式：

```bash
make install
```

这会创建根目录 `.env`，并安装后端和前端依赖。

请先复制：

```bash
cp .env.example .env
```

然后按需填写：

### 前端相关

- `VITE_ENDPOINT`
- `VITE_WS_ENDPOINT`
- `VITE_STACK_PROJECT_ID`
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY`

### 后端相关

- `SERVER_PY_DATABASE_URL`
- `SERVER_PY_REDIS_URL`
- `SERVER_PY_APP_BASE_URL`
- `SERVER_PY_STACK_AUTH_ENABLED`
- `SERVER_PY_STACK_PROJECT_ID`
- `SERVER_PY_STACK_SECRET_SERVER_KEY`
- `SERVER_PY_STACK_API_BASE_URL`

## 4. 本地开发启动

这是最推荐的方式，因为前后端都能单独调试。

### 4.1 启动数据库与 Redis

确认下面两个地址可用：

- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

### 4.2 后端初始化并启动

```bash
cd server-py
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env .env
alembic upgrade head
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

启动后检查：

- `http://localhost:8000/healthz`

### 4.3 前端初始化并启动

```bash
cd client
npm install
cp ../.env .env.local
npm run dev
```

启动后检查：

- `http://localhost:5173`
- `http://localhost:5173/auth/stack`

## 5. Docker Compose 启动

如果你的机器有 Docker，可以一键拉起整套服务：

```bash
docker compose up --build
```

对应端口：

- PostgreSQL: `5432`
- Redis: `6379`
- 后端: `8000`
- 前端: `4173`

注意：

- 根目录 `.env` 需要提前准备好
- Stack Auth 相关变量不能留空

## 6. 常见访问地址

### 前端

- 首页：`http://localhost:5173`
- Stack Auth：`http://localhost:5173/auth/stack`
- Stack Handler：`http://localhost:5173/handler/*`
- 管理后台举报页：`http://localhost:5173/admin/reports`
- 管理后台审计页：`http://localhost:5173/admin/audit`

### 后端

- 健康检查：`http://localhost:8000/healthz`
- 就绪检查：`http://localhost:8000/readyz`

## 7. 管理员后台说明

管理员身份不靠前端配置，而是由数据库决定。

控制字段：

- 表：`accounts`
- 字段：`is_admin`

示例：

```sql
UPDATE accounts
SET is_admin = true
WHERE email_normalized = 'admin@example.com';
```

改完后重新获取会话，前端就会显示管理员入口。

## 8. 数据库结构文件说明

项目中已经放入：

- `database/schema.sql`

这个文件只包含：

- 数据库对象定义
- 表结构
- 索引
- 约束

这个文件不包含：

- 用户数据
- 聊天记录
- 会话数据
- 举报数据

## 9. 如何重新导出数据库结构

如果你本地数据库结构变了，可以重新导出：

```bash
mkdir -p database
~/.local/postgresql-16/bin/pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat \
  > database/schema.sql
```

导出后建议自行检查两件事：

1. 文件中不应出现 `COPY ... FROM stdin`
2. 文件中不应出现真实业务数据行

## 10. 建议的开源交付方式

如果你准备公开到 GitHub，建议至少保留这些文件：

- `README.md`
- `.env.example`
- `deploy/.env.production.example`
- `LICENSE`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `Makefile`
- `docs/OPEN_SOURCE_SETUP.md`
- `docs/CODEBASE_MAP.md`
- `database/schema.sql`

同时不要提交这些内容：

- 真实 `.env`
- 真实 Stack secret key
- 本地数据库数据
- 本地构建产物

## 11. 常用开发命令

### 统一入口

```bash
make install
make dev
make lint
make test
make build
make clean
```

### 前端

```bash
cd client
npm run dev
npm run build
npm run lint
```

### 后端

```bash
cd server-py
source .venv/bin/activate
alembic upgrade head
.venv/bin/ruff check app
python -m compileall app
```

## 12. 故障排查

### 前端提示 Stack Auth 未配置

优先检查：

- `client/.env.local` 是否存在
- `VITE_STACK_PROJECT_ID` 是否已填写
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY` 是否已填写

### 后端起不来

优先检查：

- PostgreSQL 是否真的在 `5432`
- Redis 是否真的在 `6379`
- `SERVER_PY_DATABASE_URL` 是否正确
- `alembic upgrade head` 是否执行成功

### 管理后台没有入口

优先检查：

- 当前账号是否已经登录
- `accounts.is_admin` 是否为 `true`
- `/api/auth/session` 返回里是否已经带上管理员状态
