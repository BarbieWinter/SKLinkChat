# Draft: Anonymous Chat PostgreSQL Design

## Requirements (confirmed)
- 熟知项目: 用户要求先熟悉当前项目状态与结构。
- PostgreSQL 设计: 用户今天准备上 PostgreSQL 数据库。
- 匿名聊天: 设计目标是为匿名聊天场景做数据库/数据模型设计。
- 产品边界调整: 不考虑房间/群聊；论坛板块暂不实施，但数据库框架需为未来扩展预留空间。
- 不能改动任何代码: 仅允许规划与文档产出，不做实现。
- 数据分工: PostgreSQL 持久化结构化数据，Redis 继续承担实时协调层。
- 聊天准入: 匿名聊天前提改为“必须先注册账号”，以减少杂乱注册与滥用。
- 注册风控: 注册流程必须接入人机识别/反脚本能力。
- 注册主方式: 邮箱 + 密码。
- 匿名定义: 对其他用户匿名，对系统内账号可识别、可治理。
- 人机识别方案: 首选 Cloudflare Turnstile。
- 匹配维度: `keywords` / `language` 进入后端并参与匹配。
- 数据保留: 聊天正文 TTL 保留，审计/风控数据保留更久并与正文逻辑隔离。
- 实施测试策略: tests-after。

## Technical Decisions
- 当前阶段定位为架构/数据设计规划，不进入代码实现。
- 输出载体暂定为 `.sisyphus` 内规划/草稿文档，待需求澄清后生成正式计划。
- 现有后端已具备清晰的持久化端口层（`SessionRepository` / `PresenceRepository`），PostgreSQL 设计应优先对齐这些边界。
- 现状不是“空仓库”：项目已是前后端分离匿名聊天系统，当前数据层核心依赖 Redis。
- 设计默认采用“双层存储”：PostgreSQL 管 session/message/audit 等结构化持久数据；Redis 保留 presence、matching queue、reconnect coordination。
- 设计方向从“纯 session 匿名”调整为“账号内匿名”：对系统可识别账号，对陌生人隐藏真实账号身份。
- 聊天正文与审计/风控数据在逻辑模型上分离，保留策略不同。
- 论坛板块应视为新增业务域，与实时匿名聊天共享部分基础设施，但不能强行复用聊天室模型。
- 首版账号体系按 `account -> anonymous_chat_profile/session` 分层设计，而不是把账号直接暴露给聊天对象。
- 注册风控默认纳入 `turnstile challenge verification + registration audit/risk events` 两层数据模型。
- 默认实施策略采用 tests-after，与当前仓库既有测试习惯保持一致。
- `keywords` / `language` 不再只是前端偏好，需在 PostgreSQL 中建模，并为后续匹配查询预留索引策略。

## Research Findings
- `README.md` / `ARCHITECTURE.md` 描述了当前活跃架构：`client/` + `server-py/` + `redis`。
- 当前仅有 Redis，无 PostgreSQL、ORM、迁移工具或 SQL 测试基建。
- 后端核心领域模型位于 `server-py/app/domain/chat/models.py`：`ChatSession`、`ChatHistoryEntry`、`MatchResult`。
- Redis 当前承担两类职责：
  - 偏持久数据：session、recent history
  - 偏协调数据：在线 presence、匹配队列、reconnect deadline
- 前端 `keywords`、`language` 仍是客户端状态，尚未成为后端真实持久化实体。
- 测试基建已存在：后端 `pytest` + `pytest-asyncio`，前端 `vitest`；但数据库测试仅有 FakeRedis 模式，没有真实 DB 集成测试范式。
- 当前仓库未发现 forum/thread/post/board 业务模型；论坛属于全新持久化域，需要单独定义实体边界。
- 当前仓库未发现账号/注册/登录/captcha 业务实现，但 `server-py/app/application/platform/ports.py` 已存在 `PermissionGate.allow_anonymous_chat(session_id)` 扩展点，说明“聊天准入控制”可自然纳入后续架构。

## Open Questions
- 匿名聊天的业务边界：一对一、随机匹配、房间制、群聊，还是多模式并存？
- 访问模式：实时长连接、轮询、单区/多区部署、峰值规模？
- 是否要把 `keywords` / `language` 上升为后端匹配维度并持久化？
- 是否需要 moderation / audit 数据与聊天正文分库分表式隔离（逻辑隔离即可）？
- 邮箱注册后，是否必须“邮箱已验证”才能开始聊天？

## Scope Boundaries
- INCLUDE: 项目调研、匿名聊天 PostgreSQL 领域建模、表设计方向、索引/约束/保留策略、后续实施计划。
- EXCLUDE: 任何源代码修改、数据库迁移落地、运行配置改动、部署执行。
