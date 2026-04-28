# SKLinkChat

SKLinkChat 是一个匿名随机聊天项目，包含前端、后端、管理后台，以及基于 Stack Auth 的登录链路。

本项目仅允许非商业使用。禁止将本项目或其修改版本用于销售、付费托管、商业项目交付、广告变现、订阅服务或其他营利场景。详细条款见 [LICENSE](LICENSE)。

这个仓库适合两种使用方式：

- 本地开发：前端和后端分开启动，便于调试
- Docker Compose：一次拉起 PostgreSQL、Redis、后端和前端

## 项目组成

- `client/`
  React + Vite 前端
- `server-py/`
  FastAPI 后端
- `docker-compose.yml`
  本地整套服务编排
- `database/schema.sql`
  从本地数据库导出的结构文件，只包含表结构，不包含业务数据
- `docs/OPEN_SOURCE_SETUP.md`
  更完整的开源使用手册
- `LICENSE`
  非商业使用许可证
- `CONTRIBUTING.md`
  贡献流程和提交规范
- `CHANGELOG.md`
  版本变更记录

## 运行环境

### 必需依赖

- Node.js 18+
- Python 3.11+
- PostgreSQL 16
- Redis 7

### 可选依赖

- Docker / Docker Compose

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/BarbieWinter/SKLinkChat.git
cd SKLinkChat
```

### 2. 快捷安装

```bash
make install
```

这会自动创建根目录 `.env`，并安装后端和前端依赖。

### 3. 准备环境变量

`make install` 会自动复制 `.env.example`。如果你想手动准备，也可以执行：

```bash
cp .env.example .env
```

然后按你的实际配置填写下面这些值：

- `VITE_STACK_PROJECT_ID`
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY`
- `SERVER_PY_RESEND_API_KEY`
- `SERVER_PY_STACK_PROJECT_ID`
- `SERVER_PY_STACK_SECRET_SERVER_KEY`

如果你只想先跑通后端基础接口，也可以暂时保留默认本地数据库和 Redis 地址。

## 本地启动

### 1. 启动 PostgreSQL 和 Redis

确保下面两个服务可用：

- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

### 2. 启动后端

```bash
cd server-py
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env .env
alembic upgrade head
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

后端地址：

- API: `http://localhost:8000`
- 健康检查: `http://localhost:8000/healthz`

### 3. 启动前端

新开一个终端：

```bash
cd client
npm install
cp ../.env .env.local
npm run dev
```

前端地址：

- 首页: `http://localhost:5173`
- Stack Auth: `http://localhost:5173/auth/stack`
- 管理后台举报页: `http://localhost:5173/admin/reports`
- 管理后台审计页: `http://localhost:5173/admin/audit`

## Docker Compose 启动

如果你更想一键启动，可以直接在根目录执行：

```bash
docker compose up --build
```

默认服务端口：

- PostgreSQL: `5432`
- Redis: `6379`
- FastAPI: `8000`
- 前端预览: `4173`

注意：

- Docker Compose 启动前，请先准备好根目录 `.env`
- `SERVER_PY_RESEND_API_KEY` 不能为空，否则后端容器不会正常启动

## 管理员权限

管理员权限由数据库中的 `accounts.is_admin` 字段控制。

示例：

```sql
UPDATE accounts
SET is_admin = true
WHERE email_normalized = 'admin@example.com';
```

更新后重新请求 `/api/auth/session`，前端就会拿到新的管理员状态。

## 数据库结构文件

仓库中已经包含一个不含数据的数据库导出文件：

- `database/schema.sql`

这个文件适合用来：

- 快速查看表结构
- 审查数据库设计
- 给新开发者了解模型关系

如果你需要重新导出，可以参考 [docs/OPEN_SOURCE_SETUP.md](docs/OPEN_SOURCE_SETUP.md) 里的命令。

## 常用命令

### 统一入口

```bash
make setup
make install
make dev
make lint
make test
make build
```

### 前端

```bash
cd client
npm install
npm run dev
npm run build
npm run lint
```

### 后端

```bash
cd server-py
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
.venv/bin/ruff check app
python -m compileall app
```

## 更多说明

更完整的安装、启动、环境变量、数据库说明，请看：

- [docs/OPEN_SOURCE_SETUP.md](docs/OPEN_SOURCE_SETUP.md)
- [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CHANGELOG.md](CHANGELOG.md)
