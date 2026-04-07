# CODEBASE MAP

这份文档给后续 AI 和开发者直接定位改动入口用。先看这里，再打开具体文件。

## 1. 根目录入口

- `DEVELOPMENT.md`
  本地启动、迁移、构建、lint 命令。
- `docs/CODEBASE_MAP.md`
  改动定位地图。
- `AGENTS.md`
  仓库级规则和 AI 行为约束。
- `client/`
  React + Vite 前端。
- `server-py/`
  FastAPI 后端。
- `docker-compose.yml`
  本地整套服务编排。

## 2. 前端地图

### 路由与页面入口

- `client/src/app/App.tsx`
  前端总路由。首页、管理后台路由都从这里进。
- `client/src/app/layout.tsx`
  全局页面壳和外层布局。
- `client/src/pages/home-page.tsx`
  首页入口，通常会接认证卡片或聊天工作区。
- `client/src/pages/admin-reports-page.tsx`
  管理后台举报页路由入口。
- `client/src/pages/admin-audit-page.tsx`
  管理后台审计页路由入口。

### 聊天主链路

- `client/src/features/chat/ui/chat-workspace.tsx`
  聊天页总装配。左侧资料栏、右侧聊天区、移动端抽屉都在这里。
- `client/src/features/chat/ui/chat-panel.tsx`
  聊天面板主体。头部状态、消息区、输入框、发送按钮都在这里。
- `client/src/features/chat/ui/virtual-message-list.tsx`
  消息列表和消息气泡渲染。改消息排版、昵称、气泡结构优先看这里。
- `client/src/assets/global.css`
  聊天气泡、像素风皮肤、全局视觉样式。
- `client/src/features/chat/chat-provider.tsx`
  聊天上下文提供层。
- `client/src/features/chat/hooks/use-chat-runtime.ts`
  聊天运行时总控，负责连接、消息流、状态切换。
- `client/src/features/chat/hooks/use-chat-socket.ts`
  WebSocket 收发细节。
- `client/src/features/chat/api/create-session.ts`
  创建聊天会话接口。
- `client/src/features/chat/api/close-session.ts`
  关闭聊天会话接口。
- `client/src/features/chat/api/create-report.ts`
  举报接口。

### 认证与账户

- `client/src/features/auth/auth-provider.tsx`
  登录态来源、会话恢复、登出逻辑。
- `client/src/features/auth/ui/auth-entry-card.tsx`
  注册 / 登录主卡片 UI。
- `client/src/features/auth/ui/restricted-chat-access-card.tsx`
  账号受限时的前端提示卡片。
- `client/src/features/auth/api/auth-client.ts`
  认证相关 HTTP 调用。

### 管理后台

- `client/src/features/admin/ui/admin-route-guard.tsx`
  管理路由守卫。
- `client/src/features/admin/ui/admin-layout.tsx`
  管理后台布局壳。
- `client/src/features/admin/ui/admin-reports-page.tsx`
  举报审核主界面。
- `client/src/features/admin/ui/admin-audit-page.tsx`
  审计日志界面。
- `client/src/features/admin/api/admin-client.ts`
  管理后台 HTTP 调用。

### 公共配置与状态

- `client/src/app/store.ts`
  Zustand 总 store 装配。
- `client/src/features/chat/model/chat.slice.ts`
  聊天消息状态。
- `client/src/features/chat/model/session.slice.ts`
  聊天会话状态。
- `client/src/features/settings/model/settings.slice.ts`
  设置状态。
- `client/src/shared/config/runtime.ts`
  前端 API / WebSocket 基地址推导。
- `client/src/shared/i18n/use-i18n.ts`
  文案映射和状态文本。

## 3. 后端地图

### 应用装配入口

- `server-py/app/main.py`
  ASGI 入口。
- `server-py/app/bootstrap/app_factory.py`
  FastAPI app 装配点。中间件、异常处理、路由注册都在这里。
- `server-py/app/bootstrap/lifespan.py`
  启停生命周期。
- `server-py/app/presentation/http/dependencies.py`
  路由依赖注入入口。

### HTTP 路由

- `server-py/app/presentation/http/routes/auth.py`
  注册、登录、邮箱验证、找回密码。
- `server-py/app/presentation/http/routes/account.py`
  当前用户资料读取和修改。
- `server-py/app/presentation/http/routes/session.py`
  创建 / 关闭聊天 session。
- `server-py/app/presentation/http/routes/chat_reports.py`
  举报创建。
- `server-py/app/presentation/http/routes/admin.py`
  管理后台审核、限制账号、恢复账号。
- `server-py/app/presentation/http/routes/health.py`
  `/healthz` 和 `/readyz`。

### WebSocket 与实时聊天

- `server-py/app/presentation/ws/chat_endpoint.py`
  WebSocket 聊天主入口。
- `server-py/app/presentation/ws/presence_updates.py`
  在线人数 / presence 广播。
- `server-py/app/presentation/ws/disconnect_notices.py`
  断线通知和延迟断开处理。

### 业务层

- `server-py/app/application/auth/`
  认证、验证码、会话、密码相关业务。
- `server-py/app/application/chat/`
  匹配、消息、session、连接状态相关业务。
- `server-py/app/application/platform/`
  平台级能力和公共流程。
- `server-py/app/application/admin/`
  举报审核、审计、账号治理。

### 基础设施层

- `server-py/app/infrastructure/postgres/models.py`
  核心数据库表模型。
- `server-py/app/infrastructure/postgres/repositories.py`
  主仓储实现。
- `server-py/app/infrastructure/postgres/database.py`
  数据库连接与 session 管理。
- `server-py/app/infrastructure/redis/session_repository.py`
  会话状态和匹配相关 Redis 读写。
- `server-py/app/infrastructure/redis/presence_repository.py`
  在线状态相关 Redis 读写。
- `server-py/app/infrastructure/redis/redis_event_bus.py`
  Redis 事件总线。
- `server-py/app/infrastructure/realtime/in_memory_connection_hub.py`
  进程内连接管理。

### 配置与共享

- `server-py/app/shared/config.py`
  环境变量和运行配置。
- `server-py/app/shared/errors.py`
  统一业务错误定义。
- `server-py/app/shared/protocol.py`
  服务端协议常量 / 类型。
- `server-py/alembic/`
  数据库迁移。

## 4. 按需求快速定位

### 改页面结构

- 首页或路由切换：`client/src/app/App.tsx`、`client/src/pages/home-page.tsx`
- 聊天页整体布局：`client/src/features/chat/ui/chat-workspace.tsx`
- 管理后台结构：`client/src/features/admin/ui/admin-layout.tsx`

### 改聊天视觉

- 气泡样式、像素风、全局主题：`client/src/assets/global.css`
- 消息列表结构：`client/src/features/chat/ui/virtual-message-list.tsx`
- 输入框、头部状态栏：`client/src/features/chat/ui/chat-panel.tsx`

### 改聊天行为

- 前端消息收发：`client/src/features/chat/hooks/use-chat-runtime.ts`
- WebSocket 前端实现：`client/src/features/chat/hooks/use-chat-socket.ts`
- WebSocket 后端实现：`server-py/app/presentation/ws/chat_endpoint.py`
- 创建 / 关闭 session：`client/src/features/chat/api/*.ts` 和 `server-py/app/presentation/http/routes/session.py`

### 改登录注册或用户资料

- 前端登录注册 UI：`client/src/features/auth/ui/auth-entry-card.tsx`
- 前端认证状态：`client/src/features/auth/auth-provider.tsx`
- 前端认证请求：`client/src/features/auth/api/auth-client.ts`
- 后端认证接口：`server-py/app/presentation/http/routes/auth.py`
- 后端账户接口：`server-py/app/presentation/http/routes/account.py`

### 改举报或管理后台

- 前端举报弹窗：`client/src/features/chat/ui/chat-report-dialog.tsx`
- 前端举报 / 管理接口：`client/src/features/chat/api/create-report.ts`、`client/src/features/admin/api/admin-client.ts`
- 后端举报：`server-py/app/presentation/http/routes/chat_reports.py`
- 后端管理：`server-py/app/presentation/http/routes/admin.py`

### 改配置或环境变量

- 前端运行时地址：`client/src/shared/config/runtime.ts`
- 后端环境变量：`server-py/app/shared/config.py`
- 项目级命令说明：`DEVELOPMENT.md`

## 5. 当前建议工作流

1. 先看 `docs/CODEBASE_MAP.md` 确认入口文件。
2. 再打开对应 feature 下的 UI、hook、api、route。
3. 前端改动完成后至少执行 `cd client && npm run build`。
4. 后端改动完成后至少执行 `cd server-py && ./.venv/bin/ruff check app`。

## 6. 当前仓库约定

- 已移除自动化测试源码，仓库保持轻量，便于 AI 和人工直接定位业务文件。
- 如后续重新引入测试，建议统一放到根级 `tests/` 或各端独立 `tests/` 目录，不再混放在业务源码旁边。
