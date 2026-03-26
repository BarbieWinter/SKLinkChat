# Draft: Phase Review And Next Stage

## Requirements (confirmed)
- 审查本项目是否完成当前阶段需求。
- 在不直接实施代码的前提下，规划下一阶段任务。
- 输出应基于仓库现状，而不是仅基于口头描述。
- 下一阶段优先级已确认：先做“最小后台治理”。
- 后台管理承载方式已确认：复用现有 `client/`，新增 `/admin` 路由树，不拆独立前端工程。
- 本轮仅做梳理与计划书，不调用其他代理模型执行。

## Technical Decisions
- 默认将“当前阶段”解释为最近完成的 `post-auth-hardening-and-governance` 阶段，除非仓库事实显示不一致。
- 本轮先做实际完成度审查，再决定下一阶段应规划为“最小后台治理”还是“上线准备”。
- 基于当前仓库缺口，默认下一阶段定义为“最小后台治理”，而不是继续改聊天底层或扩新产品功能。
- 本轮评估重点增加“是否具备启动后台管理的前置条件”，尤其检查管理员身份、权限边界、审核接口、运营路由与文档一致性。
- 用户已确认采用推荐路径：最小后台治理优先。
- 用户已确认采用方案一：在现有 `client` 内建设后台，而不是新建 admin 工程。
- 受用户限制，本轮不调用 explore / metis / oracle / momus 等其他代理；直接基于已完成的仓库勘察生成计划。

## Research Findings
- `post-auth-hardening-and-governance` 的关键产物已在仓库出现：`0002_post_auth_hardening` 迁移、强化后的 SQLAlchemy 模型、chat reporting 服务与路由、更新后的 README / ARCHITECTURE / server-py README / client README。
- `server-py/alembic/versions/0002_post_auth_hardening.py` 已补上 `chat_sessions` active 唯一索引、`chat_matches` active 索引、`chat_messages` 幂等字段、`chat_reports` 表。
- `server-py/app/infrastructure/postgres/repositories.py` 已实现单账号单 active chat session、active match 事务创建、消息幂等写入、举报写库。
- `client/src/features/chat/ui/chat-report-dialog.tsx` 与 `client/src/features/chat/api/create-report.ts` 说明最小举报前端已完成。
- `server-py/tests/test_migrations.py`、`test_reporting.py`、`test_retention.py`、`test_account.py` 说明本阶段关键 hardening 测试已补齐。
- 当前未发现后台管理、举报审核列表、账号封禁/解封、风险事件浏览等管理端能力。
- `server-py/app/presentation/http/routes/auth.py` 已暴露 `request-password-reset` 与 `reset-password`，但根 README 的 Active Contracts 未同步列出，存在代码/文档漂移。
- `server-py/app/bootstrap/app_factory.py` 当前只装配健康、认证、账户、举报、会话、WebSocket 路由，未装配任何 `/admin` 或 moderation review 路由。
- `server-py/app/infrastructure/postgres/models.py` 的 `accounts` 与相关模型未见 `role` / `is_admin` / `is_staff` 字段，说明后台管理的权限基座尚未建立。
- `client/src/app/App.tsx` 只有首页与 404 路由；前端尚无独立后台路由树。 
- 前后端测试链路已存在：前端 Vitest，后端 pytest + ruff + alembic；后端覆盖 auth、session、websocket、reporting、retention 等主链路，说明可以在现有基础上继续构建下一阶段。
- 本机缺少 `typescript-language-server`，因此无法用 LSP 对前端做类型级静态诊断；这是环境能力缺口，不等同于项目源码报错。
- Python LSP 在 `server-py/app/bootstrap/lifespan.py:61` 报出 `"Never" is not awaitable`，更像是 `app.state` 动态属性导致的类型提示问题，属于可优化项，但当前证据不足以认定为运行时阻塞问题。
- Python LSP 发现 1 个潜在类型问题：`server-py/app/bootstrap/lifespan.py:61` 对 `presence_broadcast_task` 的 await 存在 `Never is not awaitable` 提示，属于应在下一阶段前顺手清理的静态质量问题。
- TypeScript LSP 当前不可用，原因是本机未安装 `typescript-language-server`；这不是业务 blocker，但说明前端静态诊断链还不完整。

## Open Questions
- 后台管理若立即启动，默认先做“最小可用运营后台”而非完整 CMS：仅覆盖登录保护、举报审核、审计浏览、基础账号处置。

## Scope Boundaries
- INCLUDE: 计划审查、完成度判断、差距识别、下一阶段正式计划。
- EXCLUDE: 直接改代码、执行产品实现。
