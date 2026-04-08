# STACK AUTH 整改技术文档（需求梳理版）

## 文档地址

- `docs/RECTIFICATION_PLAN.md`

## 目标

本次仅做需求梳理，不改业务代码。目标如下：

1. 在当前项目中引入 Stack Auth 作为认证与会话体系。
2. 移除现有旧的人机校验流程（GeeTest 相关），改用 Stack Auth 方案内的人机校验/安全校验能力。
3. 在不破坏现有聊天业务（会话、WS、举报、管理）的前提下，形成可执行的迁移路径。

## 输入需求（确认版）

- 使用文档：`https://docs.stack-auth.com/docs/overview` 及其 Getting Started/Components/Backend Integration 章节。
- 现有系统中“之前的人机校验”需要移除。
- 人机校验切换到 Stack Auth 体系对应能力。
- 当前阶段先完成文档与计划确认，不执行代码改造。

## 目标补充（2026-04-08）

你最新确认的目标如下，后续实施必须严格按此执行：

1. 注册页面与登录页面统一采用 Stack Auth 组件体系，不再保留自建注册/登录表单主流程。
2. 现有安全验证 API（含 GeeTest 相关接口/字段/配置）整体下线，改用 Stack 体系内置的安全验证能力。
3. 快捷登录必须包含：
   - Microsoft
   - Google
   - GitHub
4. 对“其他邮箱登录/注册”采用邮箱优先流程：用户只输入邮箱并进入下一步（passwordless 路径）。

> 说明：这里的“邮箱下一步”按 Stack 文档能力默认对应 Magic Link / OTP 形态，不要求用户先输入密码。

## 推荐使用的 Stack Auth 组件

前端（React）建议使用：

1. `StackClientApp`
2. `StackProvider`
3. `StackTheme`
4. `StackHandler`
5. `useUser`
6. `SignIn`
7. `SignUp`
8. `OAuthGroup` / `OAuthButton`
9. `Magic Link` 登录相关组件（或对应自定义页面能力）

按需补充：

1. `UserButton`
2. `AccountSettings`

后端（FastAPI）建议使用：

1. Stack 的后端集成能力（服务端身份校验）
2. 统一鉴权入口（HTTP + WebSocket）读取并验证 Stack 身份凭据

## 项目现状（需整改点）

### 前端认证现状

- 认证状态依赖自建 `AuthProvider` 与 `/api/auth/session`
- 登录/注册/验证码/忘记密码走自建接口
- 现有人机校验组件为 `GeeTestField`

关键位置：

- `client/src/features/auth/auth-provider.tsx`
- `client/src/features/auth/api/auth-client.ts`
- `client/src/features/auth/ui/auth-entry-card.tsx`
- `client/src/features/auth/geetest-field.tsx`

### 后端认证现状

- 以本地 cookie（`sklinkchat_session`）为核心会话
- 自建 `/api/auth/*` 流程（注册、登录、邮箱验证、重置密码）
- HTTP 鉴权依赖 `get_current_auth`
- WebSocket `/ws` 握手也依赖本地 cookie 鉴权

关键位置：

- `server-py/app/presentation/http/routes/auth.py`
- `server-py/app/presentation/http/dependencies.py`
- `server-py/app/application/auth/service.py`
- `server-py/app/presentation/ws/chat_endpoint.py`

## 整改范围

### In Scope

1. 认证体系从自建迁移到 Stack Auth。
2. 旧人机校验（GeeTest）从注册/登录链路移除。
3. 聊天会话创建、HTTP 接口、WS 鉴权改为基于 Stack 身份。
4. 前后端环境变量、运行文档、部署配置同步更新。

### Out of Scope（本阶段不做）

1. 聊天业务规则重写（匹配、消息协议、举报、管理逻辑）。
2. UI 视觉重设计（只做认证接入改造，不改风格体系）。
3. 历史业务数据清理（仅定义映射策略，不立即执行批量迁移）。

## 迁移需求清单（按模块）

### A. 前端认证层

1. 根节点挂载 `StackProvider`，建立统一用户上下文。
2. 路由新增 `StackHandler` 所需路径。
3. 页面中以 `useUser` 取代现有 `getAuthSession` 主链路。
4. 登录/注册页面替换为 Stack 组件方案（`SignIn`/`SignUp` + OAuth + 邮箱下一步）。
5. 下线自建登录/注册/验证码表单提交链路。
6. 保留业务资料设置入口，但身份来源改为 Stack 用户标识。

### B. 人机校验切换

1. 删除 `GeeTestField` 的运行依赖与页面接入。
2. 移除前后端 GeeTest 配置项、校验调用与错误码分支。
3. 使用 Stack Auth 方案中的内置安全校验能力（不再单独维护自建安全验证 API）。
4. 验收标准：注册/登录流程不再依赖 GeeTest 字段。

### C. 后端鉴权层

1. 新增 Stack 身份解析依赖（替代当前 cookie-only 认证入口）。
2. HTTP 接口统一通过新依赖获取当前用户身份。
3. WebSocket 握手改为校验 Stack 身份并映射到本地账户。
4. 兼容策略：迁移期间可短期并行支持旧会话（灰度开关控制）。

### D. 数据与账户映射

1. 本地 `accounts` 增加与 Stack User 绑定字段（如 `stack_user_id`，唯一）。
2. 首次登录自动创建/绑定本地账户（保留 `gender/is_admin/chat_access_restricted` 等业务字段）。
3. 旧账号迁移策略：按邮箱或确认规则绑定，冲突进入人工处理列表。

### E. 配置与运维

1. 前端新增 Stack 公钥/项目配置环境变量。
2. 后端新增 Stack 服务端密钥配置。
3. 清理 GeeTest 相关环境变量与文档说明。
4. 更新 `DEVELOPMENT.md` 的本地启动与调试步骤。

## 执行里程碑（建议）

1. **M1（接入层）**：前端 `StackProvider + StackHandler + useUser` 接入完成，不切业务。
2. **M2（鉴权层）**：后端完成 Stack 身份校验依赖，HTTP 与 WS 均可识别 Stack 用户。
3. **M3（替换层）**：下线 GeeTest 与自建 auth 主流程，认证全面切到 Stack。
4. **M4（收口层）**：清理遗留接口、环境变量、文档与监控告警。

## 风险与决策点

1. 是否保留旧 `/api/auth/*` 作为短期兼容层（建议保留一版迭代后删除）。
2. WebSocket 身份透传方案：
   - 方案 A：握手携带可校验 token
   - 方案 B：先经 HTTP 交换短期会话再握手
3. 旧用户绑定策略的冲突处理规则（自动/人工）。
4. Stack 侧人机校验能力的具体开启方式与配置项需要在实施前最终确认。

## 验收标准（计划执行后）

1. 用户可通过 Stack 完成注册/登录/登出，前后端身份一致。
2. 登录页/注册页具备 Microsoft、Google、GitHub 快捷登录入口。
3. 邮箱路径仅输入邮箱后可进入下一步认证（passwordless）。
4. 系统不再依赖 GeeTest 字段或相关接口。
5. `/api/session`、`/ws`、`/api/account/profile` 均基于 Stack 身份正常工作。
6. 现有聊天核心功能（匹配、收发、断线重连）无行为回归。
7. `DEVELOPMENT.md` 与部署配置可支持一键按新方案启动。

## 当前状态

- 已完成 M1（接入层）：
  - 前端已安装 `@stackframe/react` / `@stackframe/js`
  - 已新增 `StackProvider + StackTheme` 注入（受配置开关控制）
  - 已新增 `/auth/stack` 与 `/handler/*` 路由入口
  - 已补充 Stack 相关前端环境变量说明
- 已进入 M2（鉴权层）并完成核心改造：
  - 后端支持 `x-stack-access-token` 身份解析（调用 Stack `/api/v1/users/me`）
  - 本地 `accounts` 增加 `stack_user_id` 绑定字段（迁移：`0010_account_stack_user_id`）
  - `/api/auth/session` 已支持 Stack 身份桥接并回写本地会话 cookie
  - HTTP 鉴权与 WS 鉴权入口均已支持 Stack token 回退
- 已进入 M3（替换层）并完成首批下线：
  - `stack` 模式下首页强制进入 Stack 组件登录页
  - 旧 `/api/auth/register|login|verify-email|resend-verification|request-password-reset|reset-password`
    在 `SERVER_PY_STACK_AUTH_ENABLED=true` 时返回 `410 LEGACY_AUTH_DISABLED`
  - 旧表单链路仅用于回滚场景（`VITE_AUTH_MODE=legacy` + `SERVER_PY_STACK_AUTH_ENABLED=false`）
