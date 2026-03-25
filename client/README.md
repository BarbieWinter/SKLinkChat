# client

React + Vite frontend for SKLinkChat.

## Frontend Scope

- 注册、登录、账户资料页
- 邮箱验证等待页与验证链接落地
- 匹配与 1:1 匿名聊天
- 当前 active chat partner 举报弹窗
- 前端不暴露 `language` 选择

## Runtime Assumptions

- 使用服务端 `HttpOnly` cookie 认证
- 未验证邮箱用户不可进入匹配和聊天
- 聊天时前端只展示匿名 `display_name`
- 发送消息会附带 `client_message_id`，用于服务端幂等持久化

## Local run

```bash
npm install
npm run dev
```

默认依赖以下环境变量：

- `VITE_ENDPOINT=http://localhost:8000`
- `VITE_WS_ENDPOINT=ws://localhost:8000/ws`
- `VITE_TURNSTILE_SITE_KEY=`

## Verification

```bash
npm run test -- --run
npm run build
```
