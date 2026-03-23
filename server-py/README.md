# server-py

FastAPI backend for the active SKLinkChat runtime.

## Structure

- `app/bootstrap/`：应用装配和 lifespan
- `app/presentation/`：HTTP 与 WebSocket 入口
- `app/application/`：chat/platform use cases
- `app/domain/`：领域模型
- `app/infrastructure/`：Redis、连接中心、审计与任务适配器
- `app/shared/`：配置、协议、日志、错误

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Verification

```bash
./.venv/bin/python -m pytest -q
./.venv/bin/ruff check .
python -m compileall app tests
```
