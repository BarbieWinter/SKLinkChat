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

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Verification

```bash
./.venv/bin/python -m pytest -q
./.venv/bin/ruff check app tests
python -m compileall app tests
alembic upgrade head
```
