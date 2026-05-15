# SKLinkChat

<p align="center">
  <strong>Anonymous real-time chat with Stack Auth, FastAPI, React, PostgreSQL, Redis, moderation, and audit trails.</strong>
</p>

<p align="center">
  <a href="https://github.com/BarbieWinter/SKLinkChat/actions/workflows/ci.yml"><img src="https://github.com/BarbieWinter/SKLinkChat/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/Python-3.11%2B-blue" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/React-18-61dafb" alt="React 18">
  <img src="https://img.shields.io/badge/FastAPI-0.116%2B-009688" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-dc382d" alt="Redis">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ed" alt="Docker Compose">
</p>

<p align="center">
  <a href="#english">English</a> ·
  <a href="#中文">中文</a> ·
  <a href="docs/README.md">Documentation</a> ·
  <a href="docs/getting-started/quick-start.md">Quick Start</a> ·
  <a href="docs/architecture/overview.md">Architecture</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<a id="english"></a>

## English

SKLinkChat is a full-stack anonymous chat project for real-time matching, private conversation, reporting, moderation, and admin audit workflows. It is designed as a practical reference for building real-time community products, not only a single chat screen.

<p align="center">
  <img src="image/English.png" alt="SKLinkChat English preview" width="920">
</p>

## Why It Exists

Anonymous chat products are easy to prototype but hard to operate responsibly. SKLinkChat keeps the real-time interaction loop while adding login, reports, account restrictions, audit logs, and a maintainable frontend/backend boundary.

## Features

- Anonymous real-time chat over WebSocket.
- Stack Auth login synchronized into local sessions.
- PostgreSQL persistence for accounts, chat sessions, reports, restrictions, and audit logs.
- Redis-backed presence, matching state, and realtime coordination.
- Admin console for report review, account restriction, account recovery, and audit search.
- Docker Compose local preview with PostgreSQL, Redis, backend, and frontend.
- Open-source community files: MIT license, CI, issue templates, PR template, contributing guide, and security policy.

## Quick Start

```bash
git clone https://github.com/BarbieWinter/SKLinkChat.git
cd SKLinkChat
cp .env.example .env
docker compose up --build
```

Open:

- Frontend preview: `http://localhost:4173`
- API health check: `http://localhost:8000/healthz`
- Admin reports: `http://localhost:4173/admin/reports`
- Admin audit: `http://localhost:4173/admin/audit`

More setup details: [Quick Start](docs/getting-started/quick-start.md), [Development](docs/development/development.md), [Deployment](docs/deployment/deployment.md).

<a id="中文"></a>

## 中文

SKLinkChat 是一套匿名实时聊天全栈项目，覆盖随机匹配、私密聊天、举报、审核、审计、登录、本地部署和基础工程治理。它的目标不是做一个孤立的聊天页面，而是提供一个能被阅读、运行、改造和继续扩展的真实参考项目。

如果这个项目对你有帮助，欢迎给一个 star。star 会帮助更多开发者发现这个项目。

<p align="center">
  <img src="image/China.png" alt="SKLinkChat 中文预览" width="920">
</p>

## 项目亮点

- 匿名实时聊天：基于 WebSocket 的会话消息链路。
- 认证链路：Stack Auth 登录，并同步成本地 session。
- 数据持久化：PostgreSQL 保存账号、会话、举报、限制和审计日志。
- 实时状态：Redis 支撑在线状态、匹配状态和事件协调。
- 管理后台：支持举报审核、账号限制、账号恢复和审计查询。
- 一键本地演示：Docker Compose 拉起 PostgreSQL、Redis、后端和前端。
- 开源友好：MIT License、CI、Issue 模板、PR 模板、贡献指南和安全说明。

## 本地预览

```bash
git clone https://github.com/BarbieWinter/SKLinkChat.git
cd SKLinkChat
cp .env.example .env
docker compose up --build
```

访问：

- 前端预览：`http://localhost:4173`
- API 健康检查：`http://localhost:8000/healthz`
- 管理后台举报页：`http://localhost:4173/admin/reports`
- 管理后台审计页：`http://localhost:4173/admin/audit`

完整启动、开发和部署说明见：[快速开始](docs/getting-started/quick-start.md)、[开发指南](docs/development/development.md)、[部署指南](docs/deployment/deployment.md)。

## Tech Stack / 技术栈

| Layer / 层级 | Technology / 技术 |
| --- | --- |
| Frontend / 前端 | React 18, Vite, TypeScript, Zustand |
| Backend / 后端 | FastAPI, SQLAlchemy, Alembic, WebSocket |
| Database / 数据库 | PostgreSQL 16 |
| Realtime / 实时状态 | Redis 7 |
| Auth / 认证 | Stack Auth |
| Tooling / 工程化 | Docker Compose, GitHub Actions |

## Documentation / 文档

- [Documentation Hub / 文档中心](docs/README.md)
- [Quick Start / 快速开始](docs/getting-started/quick-start.md)
- [Development / 开发指南](docs/development/development.md)
- [Deployment / 部署指南](docs/deployment/deployment.md)
- [Architecture / 架构说明](docs/architecture/overview.md)
- [Codebase Map / 代码地图](docs/architecture/codebase-map.md)
- [Screenshots / 截图展示](docs/product/screenshots.md)
- [Roadmap / 路线图](docs/product/roadmap.md)
- [Contributing / 贡献指南](CONTRIBUTING.md)
- [Security / 安全说明](SECURITY.md)
- [Changelog / 变更日志](CHANGELOG.md)

## License

SKLinkChat is released under the [MIT License](LICENSE).
