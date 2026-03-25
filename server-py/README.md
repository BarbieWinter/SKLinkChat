# server-py

FastAPI backend for the active SKLinkChat runtime.

## Structure

- `app/bootstrap/`: 应用装配和 lifespan
- `app/presentation/http/routes/`: 认证、账户、健康检查、chat session HTTP 入口
- `app/presentation/ws/`: websocket 聊天入口
- `app/application/auth/`: 注册、登录、验证、cookie 会话逻辑
- `app/application/chat/`: 聊天运行时与 chat session 鉴权
- `app/infrastructure/postgres/`: SQLAlchemy 模型、数据库初始化、持久化仓储
- `app/infrastructure/redis/`: presence、queue、reconnect 运行时适配器
- `alembic/`: 数据库迁移

## Runtime Contracts

- PostgreSQL 是主持久化与主验证环境
- Redis 仅负责在线状态、队列、断线恢复和实时协调
- 开发环境邮件优先使用 `mailpit`
- 测试环境邮件使用 `fake`
- 生产环境邮件使用 `resend`
- 开发/测试环境 Turnstile 不依赖真实校验，可使用 `fake` 或 Cloudflare 测试 key
- 生产环境 Turnstile 必须使用真实 Cloudflare 校验

## Data Invariants

- 一个账号最多只能有一个 active `chat_session`
- 一个 `chat_session` 不能同时处于多个 active `chat_match`
- `chat_messages` 通过 `client_message_id` 支持幂等写入
- 举报只允许针对当前 active match 对方
- 不存在 `language` 字段；`interests` 不参与当前匹配 hard filter

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

需要的核心环境变量：

- `SERVER_PY_DATABASE_URL`
- `SERVER_PY_REDIS_URL`
- `SERVER_PY_EMAIL_PROVIDER`
- `SERVER_PY_TURNSTILE_PROVIDER`
- `SERVER_PY_FRONTEND_BASE_URL`

## Verification

```bash
./.venv/bin/python -m pytest -q
./.venv/bin/ruff check app tests
python -m compileall app tests
alembic upgrade head
```

## Key Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `GET /api/auth/session`
- `GET /api/account/profile`
- `PATCH /api/account/profile`
- `POST /api/session`
- `POST /api/session/close`
- `POST /api/chat/reports`
- `GET /healthz`
- `GET /readyz`
