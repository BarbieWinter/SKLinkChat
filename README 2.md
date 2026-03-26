# SKLinkChat

匿名纯文本聊天平台。当前唯一有效的本地运行时是：

- `client/`：React + Vite 前端
- `server-py/`：FastAPI + Redis 后端
- `docker-compose.yml`：`client + server-py + redis` 的本地编排入口

## Local Development

### 1. Start Redis

```bash
docker compose up -d redis
```

如果本机已经有 Redis，可跳过这一步。

### 2. Start Python backend

```bash
cd server-py
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start frontend

```bash
cd client
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
- Redis: `redis://localhost:6379/0`

## Active Contracts

- `POST /api/session`
- `GET /healthz`
- `GET /readyz`
- `GET /api/users/count`
- `GET /ws?sessionId=<session_id>`

## Verification

```bash
cd server-py && ./.venv/bin/python -m pytest -q
cd server-py && ./.venv/bin/ruff check .
cd server-py && python -m compileall app tests
cd client && npm run test -- --run
cd client && npm run build
docker compose config
curl -s http://localhost:8000/healthz
curl -s http://localhost:8000/readyz
curl -s http://localhost:8000/api/users/count
```

## Environment

参考根目录 [.env.example](/Users/lizhenwei/Documents/SKLinkChat/.env.example)。

关键变量：

- `VITE_ENDPOINT`
- `VITE_WS_ENDPOINT`
- `SERVER_PY_REDIS_URL`
- `SERVER_PY_HOST`
- `SERVER_PY_PORT`
- `SERVER_PY_LOG_LEVEL`
- `SERVER_PY_RECONNECT_WINDOW_SECONDS`

## Target Frontend Structure

- `client/src/app/`：应用入口、providers、layout、store 组合
- `client/src/pages/`：页面级容器
- `client/src/features/chat/`：会话引导、WebSocket 运行时、聊天 UI
- `client/src/features/settings/`：资料设置状态与 UI
- `client/src/features/presence/`：在线人数 API 与 UI
- `client/src/shared/`：跨 feature 共享的 config、i18n、lib、ui、types

## Target Backend Structure

- `server-py/app/bootstrap/`：应用工厂、容器装配、lifespan
- `server-py/app/presentation/http/routes/`：HTTP transport adapters
- `server-py/app/presentation/ws/`：WebSocket endpoint
- `server-py/app/application/chat/`：聊天 use cases 与 runtime service
- `server-py/app/application/platform/`：平台 ports 与通用 use cases
- `server-py/app/domain/chat/`：聊天领域模型
- `server-py/app/domain/platform/`：预留的平台领域命名空间
- `server-py/app/infrastructure/`：Redis、实时连接、观测、任务等适配器
- `server-py/app/shared/`：配置、协议、错误、日志等共享原语

## Runtime Behavior

- 匿名会话通过 `POST /api/session` 获取 `session_id`
- WebSocket 使用 `/ws?sessionId=...`
- 刷新页面时会尝试恢复原会话
- 断线恢复窗口默认 `3 分钟`
- 超过恢复窗口未重连，服务端才会真正清理会话并通知对端
