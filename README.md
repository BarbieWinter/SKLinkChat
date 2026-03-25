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
- 当前不支持多语言，数据库和前后端都不包含 `language` 字段
- `interests` 仅作为资料元数据保留，不参与当前版本匹配 hard filter

## Local Development

### 1. Start infrastructure with Docker

```bash
docker compose up -d postgres redis mailpit
```

Mailpit UI 默认地址：`http://localhost:8025`

### 2. Start infrastructure locally without Docker

本地直接运行时，需要自行启动 PostgreSQL、Redis 和可选的 Mailpit。

- PostgreSQL: `postgresql://sklinkchat:sklinkchat@localhost:5432/sklinkchat`
- Redis: `redis://localhost:6379/0`
- Mail provider:
  - 开发环境优先 `mailpit`
  - 测试环境使用 `fake`
  - 生产环境使用 `resend`
- Turnstile:
  - 开发/测试环境使用 `fake` 或 Cloudflare 官方测试 key
  - 生产环境必须使用真实 Cloudflare Turnstile 校验

### 3. Start Python backend

```bash
cd server-py
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Start frontend

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
- `POST /api/chat/reports`
- `GET /healthz`
- `GET /readyz`
- `GET /api/users/count`
- `GET /ws?sessionId=<session_id>`

## Current Behavior

- 注册成功后自动登录，并建立 `HttpOnly` cookie 会话
- 默认登录会话有效期 7 天，只注销当前设备会话
- 邮箱验证使用单次 token 链接，有效期 15 分钟，成功使用后立即失效
- 未验证邮箱的账号允许访问账户相关页面，但禁止创建 chat session、进入匹配和 websocket 聊天
- `POST /api/auth/resend-verification` 仅允许已登录且未验证邮箱用户调用，包含 60 秒冷却和每小时 5 次上限
- 单账号最多只有一个 active `chat_session`
- 任一 `chat_session` 不能同时处于多个 active `chat_match`
- 聊天消息支持 `client_message_id` 幂等去重，避免重复发送写入多条持久化消息
- 举报仅支持当前 active match 的对方，原因固定为 `harassment`、`sexual_content`、`spam`、`hate_speech`、`other`
- 当举报原因为 `other` 时，`details` 必填

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

`docker compose config` 仅在本机安装 Docker 时可执行；不影响本地直接运行的 Python/Node 验证路径。

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
- PostgreSQL 通过约束和索引保证 chat session / active match 关键不变量，应用事务负责并发兜底
