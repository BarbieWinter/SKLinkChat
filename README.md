# SKLinkChat

匿名纯文本聊天平台。当前活跃运行时为：

- `client/`: React + Vite 前端
- `server-py/`: FastAPI + PostgreSQL + Redis 后端
- `docker-compose.yml`: `client + server-py + postgres + redis + mailpit` 本地编排入口

## Runtime Model

- PostgreSQL: 账号、认证会话、邮箱验证令牌、聊天持久化、风险/审计记录
- Redis: 在线状态、匹配队列、断线恢复、实时会话状态
- Mailpit: 本地 SMTP 调试收件箱
- 聊天前必须先注册并完成邮箱验证

## Local Development

### 1. Start infrastructure

```bash
docker compose up -d postgres redis mailpit
```

Mailpit UI 默认地址：`http://localhost:8025`

### 2. Start Python backend

```bash
cd server-py
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start frontend

```bash
cd client
npm install
npm run dev
```

前端默认连接 `http://localhost:8000` 和 `ws://localhost:8000/ws`。

## Docker Compose

```bash
docker compose up -d --build
```

启动后默认端口：

- Frontend: `http://localhost:4173`
- FastAPI backend: `http://localhost:8000`
- PostgreSQL: `postgresql://sklinkchat:sklinkchat@localhost:5432/sklinkchat`
- Redis: `redis://localhost:6379/0`
- Mailpit UI: `http://localhost:8025`

## Active Contracts

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
- `GET /healthz`
- `GET /readyz`
- `GET /api/users/count`
- `GET /ws?sessionId=<session_id>`

## Verification

```bash
cd server-py && ./.venv/bin/python -m pytest -q
cd server-py && ./.venv/bin/ruff check app tests
cd server-py && python -m compileall app tests
cd server-py && alembic upgrade head
cd client && npm run test -- --run
cd client && npm run build
docker compose config
curl -s http://localhost:8000/healthz
curl -s http://localhost:8000/readyz
```

## Environment

参考根目录 `.env.example`。

关键变量：

- `VITE_ENDPOINT`
- `VITE_WS_ENDPOINT`
- `VITE_TURNSTILE_SITE_KEY`
- `SERVER_PY_DATABASE_URL`
- `SERVER_PY_REDIS_URL`
- `SERVER_PY_EMAIL_PROVIDER`
- `SERVER_PY_TURNSTILE_PROVIDER`
- `SERVER_PY_FRONTEND_BASE_URL`

## Security Notes

- 浏览器认证使用服务端 `HttpOnly` Cookie
- 注册成功后自动登录，但 `email_verified = false` 时禁止创建 chat session 或进入 websocket
- 对端只能看到 `display_name` 和匿名 `session_id`
- 不向前端或 peer payload 返回 `email`、`account_id`
