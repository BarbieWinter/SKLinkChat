# Anonymous Chat PostgreSQL + Auth Foundation

## TL;DR
> **Summary**: Introduce PostgreSQL as the durable system of record for account/auth, verification, matching preferences, chat persistence, and audit/risk events while keeping Redis for live queue/presence/reconnect coordination. Replace guest chat entry with verified email account gating, Cloudflare Turnstile-backed registration, and account-scoped anonymous personas that stay hidden from other users.
> **Deliverables**:
> - PostgreSQL persistence foundation and migrations
> - Email/password account system with verified-email chat gating
> - Turnstile-backed anti-bot registration flow
> - Backend-persisted `keywords` / `language` matching preferences
> - Durable chat history + TTL retention + longer-lived audit/risk records
> - Docs for schema, rollout, and future forum extensibility boundary
> **Effort**: XL
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 7 → 8 → 10

## Context
### Original Request
- 熟悉项目现状。
- 为匿名聊天设计 PostgreSQL。
- 不能改动任何代码，本轮只输出文档/计划。
- 聊天必须先注册账号。
- 注册需要人机识别，避免脚本注册。
- 不做房间/群聊；未来论坛暂不实现，但框架要可扩展。

### Interview Summary
- Current runtime is `client/` + `server-py/` + `redis` per `README.md:3-7` and `ARCHITECTURE.md:5-10`.
- Redis currently owns active chat runtime state: session JSON, waiting queue, reconnect deadlines, recent history, and online presence in `server-py/app/infrastructure/redis/session_repository.py:25-224` and `server-py/app/infrastructure/redis/presence_repository.py`.
- The backend already exposes persistence/auth seams via `PermissionGate`, `SessionRepository`, and `PresenceRepository` in `server-py/app/application/platform/ports.py:12-90`.
- Current chat access is fully anonymous and ungated: `POST /api/session` issues session IDs in `server-py/app/presentation/http/routes/session.py:39-41`, and `GET /ws?sessionId=...` accepts connections in `server-py/app/presentation/ws/chat_endpoint.py:171-200`.
- User decisions made:
  - PostgreSQL = durable structured data; Redis = realtime coordination
  - No rooms/group chat
  - Forum not implemented now; schema/docs should stay extensible
  - Chat requires registration first
  - Registration = email + password
  - Email verification required before chat access
  - Anonymous to other users, but system can identify/govern accounts
  - Anti-bot = Cloudflare Turnstile
  - `keywords` / `language` become backend-persisted matching inputs
  - Chat content uses TTL retention; audit/risk data lasts longer
  - Implementation test strategy = tests-after

### Metis Review (gaps addressed)
- Guardrail added: websocket auth/gating is explicitly in scope, not only HTTP auth.
- Guardrail added: PostgreSQL vs Redis ownership is a hard boundary to prevent split-brain runtime state.
- Default applied: auth session model = server-managed HttpOnly cookie session for browser flows; websocket handshake authenticates via account session and binds a separate anonymous chat session internally.
- Default applied: matching policy = `language` is a hard filter; `keywords` are preference-ranked with FIFO fallback after timeout.
- Default applied: retention values = chat messages 30 days, verification tokens 24 hours, registration/verification risk events 180 days, audit/moderation events 365 days.
- Default applied: rollout scope excludes password reset, change-email, admin UI, and forum endpoints; database schema may reserve extension points only.

## Work Objectives
### Core Objective
Create an implementation plan that converts the current Redis-only anonymous chat system into a Redis + PostgreSQL system with verified-email account gating, backend-owned matching preferences, durable chat history, and explicit privacy/risk boundaries.

### Deliverables
- PostgreSQL schema for accounts, verification, auth sessions, chat identities, matching preferences, chat transcripts, and audit/risk events
- Auth and registration API contract plan
- WebSocket gating and session bootstrap redesign
- Retention and purge strategy
- Testing and rollout plan
- Architecture and data dictionary documentation

### Definition of Done (verifiable conditions with commands)
- `cd server-py && ./.venv/bin/python -m pytest -q`
- `cd server-py && ./.venv/bin/ruff check .`
- `cd server-py && python -m compileall app tests`
- `cd client && npm run test -- --run`
- `cd client && npm run build`
- `docker compose config`
- `curl -i -X POST http://localhost:8000/api/auth/register ...` returns the documented status codes for Turnstile, duplicate email, and success
- automated websocket integration tests prove unauthenticated or unverified users cannot start chat or open authorized chat sockets

### Must Have
- Verified email required before entering chat queue
- Password hashing design based on Argon2id-compatible implementation
- Server-side Turnstile verification and registration risk logging
- Account identity separated from public anonymous chat identity
- PostgreSQL owns durable records; Redis owns presence/queue/reconnect runtime
- `keywords` and `language` persisted server-side and used in matching
- Chat content TTL does not delete audit/risk evidence

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No rooms, no group chat, no forum endpoints/UI in this implementation
- No plaintext passwords or reversible password storage
- No exposing account IDs/emails in chat payloads
- No attempt to replace Redis as live queue/presence coordinator
- No vague auth mode decisions left to implementer
- No “future-proof” polymorphic over-design for forum; only additive extension seams

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after using existing `pytest`/`pytest-asyncio` and `vitest`; add PostgreSQL integration tests plus websocket auth tests.
- QA policy: Every task includes agent-executed happy + failure scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: foundation and contracts — tasks 1-4
Wave 2: backend auth/persistence behavior — tasks 5-8
Wave 3: frontend/chat integration/docs/retention — tasks 9-12

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4, 5, 6, 7, 8
- 2 blocks 5, 6, 7, 8, 9, 10, 11
- 3 blocks 5, 6, 7
- 4 blocks 7, 8, 10
- 5 blocks 6, 7, 8, 9, 10
- 6 blocks 7, 8, 9, 10
- 7 blocks 8, 9, 10
- 8 blocks 10, 11
- 9 blocks 10, 11
- 10 blocks 11, 12
- 11 blocks 12

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 4 tasks → `deep`, `unspecified-high`, `writing`
- Wave 2 → 4 tasks → `deep`, `fullstack-dev`, `unspecified-high`
- Wave 3 → 4 tasks → `fullstack-dev`, `writing`, `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Add PostgreSQL foundation, config, and migration tooling

  **What to do**: Add PostgreSQL runtime wiring for local/dev/test, choose a single Python SQL stack and migration tool, and document the durable-vs-ephemeral ownership table. Use `SERVER_PY_` env naming, add Postgres service to local orchestration, and establish one migration entrypoint that can create all durable tables. Choose SQLAlchemy 2.x + Alembic + psycopg as the canonical stack. Keep Redis in compose and app boot because queue/presence/reconnect remain Redis-owned.
  **Must NOT do**: Do not replace Redis; do not mix migration choices; do not introduce a second ORM/query layer; do not leave ownership rules undocumented.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: touches backend infrastructure, persistence boundaries, and migration conventions.
  - Skills: [`fullstack-dev`] — why needed: coordinate backend infra and client/dev environment assumptions.
  - Omitted: [`frontend-dev`] — why not needed: no UI design work here.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5, 6, 7, 8 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `README.md:3-7` — current runtime topology is `client + server-py + redis` only.
  - Pattern: `README.md:72-85` — existing env naming and config surface.
  - Pattern: `ARCHITECTURE.md:147-169` — current local deployment and verification command style.
  - Pattern: `server-py/app/shared/config.py:8-35` — backend `SERVER_PY_` config convention.
  - Pattern: `docker-compose.yml` — current service orchestration file to extend with PostgreSQL.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd server-py && ./.venv/bin/python -m pytest -q` passes with new config code and no Redis regressions.
  - [ ] `cd server-py && alembic upgrade head` creates the baseline PostgreSQL schema in a local test database.
  - [ ] `docker compose config` includes `postgres`, `redis`, `server-py`, and `client` without validation errors.
  - [ ] `.env.example` includes all required PostgreSQL variables using the `SERVER_PY_` prefix.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Local stack recognizes PostgreSQL and Redis roles
    Tool: Bash
    Steps: Run `docker compose config` from repo root; inspect generated services for `postgres` and `redis`; run `cd server-py && alembic upgrade head` against local DB.
    Expected: Compose validates; migration completes successfully; no Redis settings are removed.
    Evidence: .sisyphus/evidence/task-1-postgres-foundation.txt

  Scenario: Missing PostgreSQL env fails clearly
    Tool: Bash
    Steps: Run backend startup or migration with required Postgres env omitted in a controlled test shell.
    Expected: Process exits with a deterministic configuration error naming the missing `SERVER_PY_...` variable.
    Evidence: .sisyphus/evidence/task-1-postgres-foundation-error.txt
  ```

  **Commit**: YES | Message: `chore(server): add postgres config and migration scaffold` | Files: `server-py/**`, `docker-compose.yml`, `.env.example`, `README.md`

- [ ] 2. Define durable PostgreSQL schema for accounts, auth, preferences, chat, and risk

  **What to do**: Create the baseline durable schema with exact tables and constraints: `accounts`, `auth_sessions`, `email_verification_tokens`, `auth_risk_events`, `account_interests`, `chat_sessions`, `chat_matches`, `chat_messages`, `chat_reports`, and `audit_events`. Use normalized lowercased unique email with all business lookup routed through `email_normalized`; hashed password column; verified timestamp; hashed verification tokens; durable auth sessions; normalized interest child rows; durable chat session records linked to account IDs; durable 1:1 match rows with active-match uniqueness protection; durable message rows with `message_type`, optional `client_message_id`, and `expires_at`; minimal abuse-reporting rows; and audit/risk tables with longer retention fields. Add `future_forum_namespace_reserved` only in docs, not as a real table.
  **Must NOT do**: Do not create room/group tables; do not store plaintext tokens; do not store raw IP addresses when a hash/truncated value is sufficient; do not make forum tables now; do not keep `language` in schema.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: core data model and irreversible constraints.
  - Skills: [] — why needed: internal schema design work, no special UI skill.
  - Omitted: [`fullstack-dev`] — why not needed: no client integration yet.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5, 6, 7, 8, 9, 10, 11 | Blocked By: 1

  **References**:
  - Pattern: `server-py/app/domain/chat/models.py:13-39` — current durable concepts are `ChatSession`, `ChatHistoryEntry`, `MatchResult`.
  - Pattern: `server-py/app/infrastructure/redis/session_repository.py:64-167` — current runtime fields and recent-history behavior to map into durable tables.
  - Pattern: `server-py/app/application/chat/runtime_service.py:81-165` — queue, match, and message lifecycle semantics.
  - Pattern: `client/src/features/settings/model/settings.slice.ts:9-23` — current `displayName` and `keywords` source fields; `language` is to be removed in V1.

  **Acceptance Criteria**:
  - [ ] `cd server-py && alembic upgrade head` creates all listed tables, indexes, foreign keys, and uniqueness constraints.
  - [ ] `cd server-py && ./.venv/bin/python -m pytest -q tests/test_migrations.py` passes for schema smoke tests.
  - [ ] Unique email comparison is case-insensitive and verification tokens are stored hashed, not raw.
  - [ ] `chat_messages` includes `message_type`, optional `client_message_id`, and `expires_at`.
  - [ ] Active 1:1 match uniqueness is enforced for open matches.
  - [ ] Minimal `chat_reports` table exists with foreign keys to reporter, match, and reported chat session.

  **QA Scenarios**:
  ```
  Scenario: Schema enforces durable identity and retention rules
    Tool: Bash
    Steps: Run migration; execute schema inspection tests asserting unique lowercased email, FK links from chat rows to account rows, `message_type` and `client_message_id` on `chat_messages`, active-match uniqueness, and presence of `chat_reports`.
    Expected: All constraints exist exactly once; account identity never depends on chat partner-visible fields; open matches cannot overlap for a single chat session.
    Evidence: .sisyphus/evidence/task-2-durable-schema.txt

  Scenario: Raw token/plaintext password storage is impossible
    Tool: Bash
    Steps: Run repository/model tests that attempt to persist a raw verification token and unhashed password string.
    Expected: Tests fail unless hashing/validation layer transforms values before persistence.
    Evidence: .sisyphus/evidence/task-2-durable-schema-error.txt
  ```

  **Commit**: YES | Message: `feat(server): add auth and chat durable schema` | Files: `server-py/alembic/**`, `server-py/app/**`, `server-py/tests/**`

- [ ] 3. Split Redis runtime repositories from new PostgreSQL durable repositories

  **What to do**: Refactor backend ports and container wiring so Redis keeps ownership of `SessionRepository`/`PresenceRepository` queue runtime semantics, while PostgreSQL gets dedicated repositories for accounts, auth sessions, email verification, matching preferences, transcripts, and audit/risk events. Update dependency assembly so implementers never try to force queue operations into PostgreSQL-backed repositories. Keep the current `PermissionGate` seam and replace `NoOpPermissionGate` with account-aware gating once auth is ready.
  **Must NOT do**: Do not overload the existing Redis `SessionRepository` with SQL-only responsibilities; do not remove the in-memory `ConnectionHub`; do not duplicate business rules in both repo layers.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: architecture seam work across ports, container, and adapters.
  - Skills: [] — why needed: server architecture only.
  - Omitted: [`frontend-dev`] — why not needed: no frontend change.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 6, 7, 8 | Blocked By: 1

  **References**:
  - Pattern: `server-py/app/application/platform/ports.py:12-90` — current extension seams and Redis-oriented session contract.
  - Pattern: `server-py/app/bootstrap/container.py:61-104` — adapter construction and use-case wiring pattern.
  - Pattern: `server-py/app/infrastructure/permission_gate.py:1-4` — current noop gate to replace.
  - Pattern: `server-py/app/infrastructure/redis/session_repository.py:25-224` — runtime-only queue/history implementation that must stay Redis-owned.

  **Acceptance Criteria**:
  - [ ] Backend dependency graph compiles with distinct durable and ephemeral repository interfaces.
  - [ ] Existing Redis queue/presence tests still pass unchanged or with explicit fixture updates only.
  - [ ] New PostgreSQL repositories can be instantiated in tests without touching websocket runtime code.

  **QA Scenarios**:
  ```
  Scenario: Container builds with both durable and ephemeral repositories
    Tool: Bash
    Steps: Run backend unit tests covering container assembly and instantiate app with test PostgreSQL + FakeRedis fixtures.
    Expected: Application container resolves all dependencies; Redis queue code and PostgreSQL durable repos coexist without circular dependencies.
    Evidence: .sisyphus/evidence/task-3-repository-split.txt

  Scenario: Queue logic accidentally moved to PostgreSQL is rejected
    Tool: Bash
    Steps: Run architecture tests asserting queue/presence methods remain on Redis-backed repos only.
    Expected: Tests fail if PostgreSQL repositories expose waiting-queue or presence mutation APIs.
    Evidence: .sisyphus/evidence/task-3-repository-split-error.txt
  ```

  **Commit**: YES | Message: `refactor(server): split durable and runtime repositories` | Files: `server-py/app/application/**`, `server-py/app/bootstrap/**`, `server-py/app/infrastructure/**`, `server-py/tests/**`

- [ ] 4. Define auth, email verification, Turnstile, and cookie-session contracts

  **What to do**: Lock the exact backend contract before implementation. Add request/response DTOs, ports, and config for `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/verify-email`, and `GET /api/auth/session`. Registration accepts email, password, display name, language, keywords, and a Turnstile token. Successful login sets a server-managed HttpOnly cookie session. Verification tokens expire after 24 hours and are single-use. Verified email is required before `POST /api/session` and `/ws?sessionId=...` can succeed. Registration risk events record hashed/truncated IP and user agent metadata plus Turnstile verification outcome.
  **Must NOT do**: Do not leave token TTLs or cookie behavior unspecified; do not use bearer tokens for browser chat; do not let unverified accounts pass chat gating.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: security-sensitive contract design with exact API shapes.
  - Skills: [`fullstack-dev`] — why needed: align client/server contract decisions.
  - Omitted: [`frontend-dev`] — why not needed: no visual implementation yet.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 6, 9, 10 | Blocked By: 1

  **References**:
  - Pattern: `README.md:50-56` — current active route contract naming to extend.
  - Pattern: `server-py/app/presentation/http/routes/session.py:39-61` — current session route to gate rather than replace blindly.
  - Pattern: `server-py/app/presentation/ws/chat_endpoint.py:171-200` — current websocket entrypoint to protect with account session validation.
  - Pattern: `server-py/tests/test_session.py:1-25` — existing HTTP route contract test style.
  - Pattern: `server-py/tests/conftest.py:15-39` — fixture/env style to preserve.

  **Acceptance Criteria**:
  - [ ] Contract tests exist for all five auth routes plus gated `POST /api/session` semantics.
  - [ ] Session cookie flags and expiry rules are asserted in backend tests.
  - [ ] Verification token expiry and single-use semantics are encoded in tests and DTO docs.

  **QA Scenarios**:
  ```
  Scenario: Auth contract is fully specified and testable
    Tool: Bash
    Steps: Run API contract tests for register/login/logout/verify/session; inspect generated OpenAPI or route docs if present.
    Expected: Every route has a fixed payload shape, fixed status codes, and explicit cookie/verification behavior.
    Evidence: .sisyphus/evidence/task-4-auth-contracts.txt

  Scenario: Unverified account cannot reach chat bootstrap contract
    Tool: Bash
    Steps: Register account without consuming verification token; call `POST /api/session` and open `/ws?sessionId=test` in integration tests.
    Expected: HTTP returns 403/401 per contract; websocket connection is rejected before chat bootstrap completes.
    Evidence: .sisyphus/evidence/task-4-auth-contracts-error.txt
  ```

  **Commit**: YES | Message: `feat(server): define auth and gating contracts` | Files: `server-py/app/presentation/**`, `server-py/app/application/**`, `server-py/app/shared/**`, `server-py/tests/**`

- [ ] 5. Implement verified registration, login, logout, and email verification flows

  **What to do**: Implement the full account lifecycle in backend code and tests: email normalization, Argon2id password hashing, duplicate-email handling, Turnstile server-side verification, verification token issuance/storage, verification completion, server-managed auth session cookie issuance, logout revocation, and `GET /api/auth/session` for SPA bootstrap. Persist `display_name`, `language`, and `keywords` during registration as the initial matching profile. Use an email delivery port with dev/test fake adapter and production SMTP-compatible adapter.
  **Must NOT do**: Do not create a password-reset flow; do not skip server-side Turnstile verification; do not allow login or register endpoints to leak whether a token was valid beyond contract decisions.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: core security implementation across hashing, tokens, sessions, and persistence.
  - Skills: [`fullstack-dev`] — why needed: route behavior and client bootstrap contract alignment.
  - Omitted: [`frontend-dev`] — why not needed: backend-only task.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6, 9, 10 | Blocked By: 2, 3, 4

  **References**:
  - Pattern: `server-py/app/bootstrap/container.py:61-104` — add concrete auth adapters here.
  - Pattern: `server-py/tests/test_session.py:1-25` — maintain route-first testing style.
  - Pattern: `server-py/tests/conftest.py:15-39` — env/fixture patterns for backend tests.
  - Pattern: `client/src/features/settings/model/settings.slice.ts:9-23` — registration should persist the same preference primitives now owned by backend.

  **Acceptance Criteria**:
  - [ ] `cd server-py && ./.venv/bin/python -m pytest -q tests/test_auth_register.py tests/test_auth_login.py tests/test_auth_verify_email.py` passes.
  - [ ] Register with `test.user+1@example.com` creates an unverified account and risk event; login before verification does not permit chat.
  - [ ] Verifying a valid token marks the account verified exactly once; reusing or expiring the token fails deterministically.
  - [ ] Successful login sets the documented HttpOnly cookie session.

  **QA Scenarios**:
  ```
  Scenario: Verified account lifecycle succeeds end-to-end
    Tool: Bash
    Steps: Register `test.user+1@example.com` with password `CorrectHorseBatteryStaple!23`, display name `Traveler`, language `en`, keywords `["music","travel"]`, and a valid fake Turnstile token; consume emailed verification token in tests; log in; call `GET /api/auth/session`.
    Expected: Account exists, email becomes verified, auth cookie is set, session endpoint returns authenticated account summary without exposing password hash or raw token.
    Evidence: .sisyphus/evidence/task-5-auth-lifecycle.txt

  Scenario: Duplicate email and invalid Turnstile are rejected
    Tool: Bash
    Steps: Attempt second registration for the same normalized email; attempt registration with an invalid Turnstile response.
    Expected: Duplicate email returns the chosen conflict status; invalid Turnstile returns the chosen validation status; both create risk/audit records.
    Evidence: .sisyphus/evidence/task-5-auth-lifecycle-error.txt
  ```

  **Commit**: YES | Message: `feat(server): implement registration and verification flows` | Files: `server-py/app/**`, `server-py/tests/**`

- [ ] 6. Gate anonymous chat bootstrap and websocket access behind verified account sessions

  **What to do**: Rework chat bootstrap so `POST /api/session` no longer creates a guest identity; instead it creates or restores an account-linked anonymous chat session only when the request carries a valid authenticated cookie and the account is email-verified. Update `/ws?sessionId=...` so the server accepts the socket only when the cookie-authenticated account owns that `sessionId`. Preserve current reconnect semantics and partner-disconnect handling after authorization succeeds. Replace `NoOpPermissionGate` with account verification checks and ownership validation.
  **Must NOT do**: Do not expose account ID/email in websocket payloads; do not trust `sessionId` alone; do not break reconnect or partner disconnect timing.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: risky integration across auth, HTTP bootstrap, websocket transport, and runtime service.
  - Skills: [`fullstack-dev`] — why needed: browser-cookie and websocket behavior alignment.
  - Omitted: [`frontend-dev`] — why not needed: transport logic only.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8, 9, 10 | Blocked By: 2, 3, 4, 5

  **References**:
  - Pattern: `server-py/app/presentation/http/routes/session.py:39-61` — current bootstrap and close-session behavior.
  - Pattern: `server-py/app/presentation/ws/chat_endpoint.py:16-200` — current user serialization, queue, message, typing, and websocket bootstrap flow.
  - Pattern: `server-py/app/application/chat/runtime_service.py:52-98` — register connection and queue entry points already using `PermissionGate`.
  - Pattern: `server-py/app/infrastructure/permission_gate.py:1-4` — noop gate replacement point.
  - Test: `server-py/tests/test_websocket.py:93-290` — websocket contract patterns to preserve.

  **Acceptance Criteria**:
  - [ ] Verified authenticated user can call `POST /api/session` and open `/ws?sessionId=...` successfully.
  - [ ] Unauthenticated, logged-out, or unverified users receive deterministic rejection for both HTTP and websocket entrypoints.
  - [ ] Existing reconnect and disconnect behavior remains green under authenticated ownership checks.

  **QA Scenarios**:
  ```
  Scenario: Verified account can bootstrap and reconnect chat
    Tool: Bash
    Steps: Log in a verified account; call `POST /api/session`; open websocket with returned `sessionId`; run queue/match/reconnect integration tests using authenticated cookie state.
    Expected: Initial `user-info`, queue, match, reconnect, and disconnect behaviors still follow existing contract while remaining account-owned.
    Evidence: .sisyphus/evidence/task-6-chat-gating.txt

  Scenario: Stolen or foreign sessionId is rejected
    Tool: Bash
    Steps: Log in account A; attempt websocket connect using a `sessionId` issued to account B; attempt unauthenticated `POST /api/session`.
    Expected: Websocket is rejected before bootstrap and HTTP returns 401/403; no partner-visible data is leaked.
    Evidence: .sisyphus/evidence/task-6-chat-gating-error.txt
  ```

  **Commit**: YES | Message: `feat(server): gate chat bootstrap behind verified auth` | Files: `server-py/app/**`, `server-py/tests/**`

- [ ] 7. Persist matching preferences and upgrade matchmaking from FIFO-only to filter-plus-fallback

  **What to do**: Store `display_name`, `language`, and normalized `keywords` server-side and use them when selecting partners from the Redis queue. Implement matching policy exactly as follows: `language` is a hard filter when set; `keywords` increase match priority but do not block forever; after a configurable wait threshold, fallback to broader same-language then any-language matching. Keep queue membership in Redis, but query PostgreSQL preferences for candidate ranking/eligibility. Update profile editing so websocket/user-info name changes and settings changes stay synchronized with persisted preferences.
  **Must NOT do**: Do not move queue ordering into PostgreSQL; do not treat keywords as a permanent hard filter; do not keep preferences client-only.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: combines runtime matchmaking with durable preference reads.
  - Skills: [`fullstack-dev`] — why needed: backend matching and client settings alignment.
  - Omitted: [`frontend-dev`] — why not needed: no UI polish requirement.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10, 11 | Blocked By: 2, 3, 5

  **References**:
  - Pattern: `client/src/features/settings/model/settings.slice.ts:9-23` — current preference fields.
  - Pattern: `server-py/app/application/chat/runtime_service.py:81-131,253-275` — current FIFO queue and matchability checks.
  - Pattern: `server-py/app/presentation/ws/chat_endpoint.py:53-70` — current profile update path.
  - Test: `server-py/tests/test_websocket.py:105-149` — current queue and message flow.

  **Acceptance Criteria**:
  - [ ] Backend tests prove same-language candidates are preferred over cross-language candidates.
  - [ ] Backend tests prove shared keywords rank ahead of no-overlap candidates within the same language.
  - [ ] Backend tests prove fallback occurs after the configured wait threshold instead of starving users indefinitely.

  **QA Scenarios**:
  ```
  Scenario: Matching prefers language and keyword overlap
    Tool: Bash
    Steps: Create verified users with preferences `(en,[music,travel])`, `(en,[music])`, and `(zh-CN,[music])`; enqueue them in controlled order and run matching tests.
    Expected: The first user matches the second before the third because language is a hard filter and keyword overlap improves ranking.
    Evidence: .sisyphus/evidence/task-7-matching-preferences.txt

  Scenario: Match fallback prevents starvation
    Tool: Bash
    Steps: Enqueue a user with unique keywords and no immediate keyword overlap; advance the wait-threshold clock in tests.
    Expected: User first waits for preferred candidates, then matches under the documented fallback order instead of staying in queue forever.
    Evidence: .sisyphus/evidence/task-7-matching-preferences-error.txt
  ```

  **Commit**: YES | Message: `feat(server): persist preferences and improve matching` | Files: `server-py/app/**`, `server-py/tests/**`, `client/src/**`

- [ ] 8. Move durable chat transcripts and match records into PostgreSQL without breaking Redis runtime

  **What to do**: Persist every successful 1:1 match and delivered message into PostgreSQL tables while preserving Redis as the live coordination layer. Introduce durable `chat_matches` rows when a pair is formed and durable `chat_messages` rows when a message is successfully normalized and routed. Keep partner disconnect/reconnect semantics in Redis runtime service, but ensure the durable transcript can be queried for moderation, TTL deletion, and future forum/account analytics extension. Preserve current per-session history UX while sourcing long-term truth from PostgreSQL.
  **Must NOT do**: Do not write undelivered or invalid messages into durable transcript tables; do not depend on PostgreSQL for live typing/presence state; do not break the current reconnect window.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: durable transcript design tied to existing websocket lifecycle.
  - Skills: [`fullstack-dev`] — why needed: persistence + API/runtime coordination.
  - Omitted: [`frontend-dev`] — why not needed: no design-first UI task.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 9, 10, 11 | Blocked By: 2, 3, 6

  **References**:
  - Pattern: `server-py/app/application/chat/runtime_service.py:140-165` — current message normalization and append-history behavior.
  - Pattern: `server-py/app/infrastructure/redis/session_repository.py:142-167` — current recent-history append/load behavior.
  - Test: `server-py/tests/test_websocket.py:128-149,213-289` — current message delivery contract to preserve.
  - Pattern: `server-py/app/domain/chat/models.py:13-39` — existing session/message primitives.

  **Acceptance Criteria**:
  - [ ] Delivered messages create durable `chat_messages` rows linked to durable `chat_matches` rows.
  - [ ] Failed/invalid messages do not create transcript rows.
  - [ ] Websocket integration tests remain green for connect, match, message, typing, disconnect, and reconnect flows.

  **QA Scenarios**:
  ```
  Scenario: Successful conversation persists durable transcript
    Tool: Bash
    Steps: Run websocket integration test for two verified users from queue through message delivery; inspect PostgreSQL transcript tables after the exchange.
    Expected: One durable match row and the correct message rows exist; Redis still handles live presence and queue state.
    Evidence: .sisyphus/evidence/task-8-durable-transcript.txt

  Scenario: Malformed or undeliverable message is not persisted
    Tool: Bash
    Steps: Send malformed payload and send a message after the partner has intentionally left.
    Expected: Socket returns the documented error/disconnect behavior and PostgreSQL transcript tables remain unchanged for those failed attempts.
    Evidence: .sisyphus/evidence/task-8-durable-transcript-error.txt
  ```

  **Commit**: YES | Message: `feat(server): persist chat matches and transcripts` | Files: `server-py/app/**`, `server-py/tests/**`

- [ ] 9. Add retention jobs and longer-lived audit/risk evidence

  **What to do**: Implement scheduled cleanup and evidence retention rules exactly as planned: delete or tombstone expired `chat_messages` after 30 days, invalidate unconsumed verification tokens after 24 hours, keep `registration_risk_events` for 180 days, and keep `audit_events` for 365 days. Ensure purge jobs do not orphan foreign keys or remove the ability to trace abuse events from anonymous chat activity back to governed account records. Add job tests and operational docs for safe reruns.
  **Must NOT do**: Do not let chat-message purge delete audit/risk rows; do not retain raw Turnstile tokens; do not require manual cleanup.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: operational correctness and compliance-style retention work.
  - Skills: [] — why needed: backend job and data lifecycle work.
  - Omitted: [`frontend-dev`] — why not needed: no UI component.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 2, 5, 8

  **References**:
  - Pattern: `server-py/app/application/chat/runtime_service.py:239-304` — existing stale-session expiry job behavior to mirror structurally.
  - Pattern: `ARCHITECTURE.md:101-102` — current `infrastructure/jobs/` ownership.
  - Pattern: `server-py/tests/test_websocket.py:292-350` — current restart/expiry-oriented runtime regression style.

  **Acceptance Criteria**:
  - [ ] Job tests prove chat messages older than 30 days are purged/tombstoned according to the chosen schema behavior.
  - [ ] Risk/audit rows remain queryable after chat message cleanup.
  - [ ] Expired verification tokens cannot be consumed.

  **QA Scenarios**:
  ```
  Scenario: Retention jobs remove only chat content on schedule
    Tool: Bash
    Steps: Seed old chat messages, fresh chat messages, old risk events, and old audit events; run retention job tests.
    Expected: Only the rows past their configured retention windows are deleted or tombstoned according to policy; audit/risk survival matches policy.
    Evidence: .sisyphus/evidence/task-9-retention-jobs.txt

  Scenario: Purge job breaks moderation traceability
    Tool: Bash
    Steps: Attempt to resolve a historical abuse event after chat-content cleanup in integration tests.
    Expected: Trace from anonymous chat activity to governed account/audit records still works; test fails if join path is broken.
    Evidence: .sisyphus/evidence/task-9-retention-jobs-error.txt
  ```

  **Commit**: YES | Message: `feat(server): add retention and audit lifecycle jobs` | Files: `server-py/app/**`, `server-py/tests/**`, `README.md`

- [ ] 10. Build client registration, login, verification, and verified-chat gating flows

  **What to do**: Add client auth pages/components and app boot logic for register, login, verify-email, logout, and authenticated-session bootstrap. Use the existing app/provider structure, keep chat hidden or disabled until `GET /api/auth/session` reports an authenticated verified account, and pass cookies on all auth/session requests. Registration UI must collect email, password, display name, language, keywords, and Turnstile token. If the account is logged in but unverified, show a dedicated verification-needed state and block queue entry.
  **Must NOT do**: Do not expose raw verification tokens in visible UI after consumption; do not let client-side checks replace backend gating; do not surface account email to chat partners.

  **Recommended Agent Profile**:
  - Category: `fullstack-dev` — Reason: client auth flows depend on the exact backend contract and cookie semantics.
  - Skills: [`fullstack-dev`] — why needed: coordinated frontend/backend integration.
  - Omitted: [`frontend-dev`] — why not needed: product asks for functional gating, not marketing polish.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 4, 5, 6

  **References**:
  - Pattern: `client/src/app/providers.tsx` — current provider registration entrypoint.
  - Pattern: `client/src/app/store.ts` — current store composition and sessionStorage use.
  - Pattern: `client/src/features/chat/hooks/use-session-bootstrap.ts` — current anonymous session bootstrap location to replace/gate.
  - Pattern: `client/src/pages/home-page.tsx` — current onboarding/home entrypoint.
  - Pattern: `client/src/features/settings/model/settings.slice.ts:9-23` — preference fields already present in client state.

  **Acceptance Criteria**:
  - [ ] `cd client && npm run test -- --run` passes with auth route hooks/components and gating logic.
  - [ ] Unauthenticated users see register/login UI instead of a working chat bootstrap.
  - [ ] Logged-in but unverified users see a verification-required screen and cannot start queueing.

  **QA Scenarios**:
  ```
  Scenario: Verified user reaches chat shell after auth bootstrap
    Tool: Playwright
    Steps: Navigate to `/`; complete registration with test values; complete verification via seeded test link; log in; verify chat shell loads and queue button becomes enabled.
    Expected: Authenticated verified state persists across refresh; chat shell is available without exposing account identity in visible peer UI.
    Evidence: .sisyphus/evidence/task-10-client-auth-gating.png

  Scenario: Unverified user is blocked from chat
    Tool: Playwright
    Steps: Register but do not verify; refresh `/`; attempt to start chat from the home/chat view.
    Expected: UI shows verification-required state; queue trigger stays disabled or returns the documented blocked error state.
    Evidence: .sisyphus/evidence/task-10-client-auth-gating-error.png
  ```

  **Commit**: YES | Message: `feat(client): add auth and verified chat gating flows` | Files: `client/src/**`, `client/package.json`, `client/src/**/*.test.*`

- [ ] 11. Sync settings to backend-owned preferences and keep chat persona anonymous

  **What to do**: Replace client-only preference ownership with backend-backed preference APIs and sync logic. Persist `displayName`, `language`, and `keywords` to PostgreSQL through authenticated APIs, hydrate them during app bootstrap, and use them for matchmaking while keeping partner-visible payloads limited to the anonymous display name and session-scoped chat identity. Ensure chat UI can still update display name and settings without exposing account metadata.
  **Must NOT do**: Do not leave a second source of truth in sessionStorage; do not send email/account ID to peer-facing payloads; do not make settings edits bypass backend validation.

  **Recommended Agent Profile**:
  - Category: `fullstack-dev` — Reason: full-stack preference ownership and peer-visible anonymity.
  - Skills: [`fullstack-dev`] — why needed: synchronize API, store, and runtime behavior.
  - Omitted: [`frontend-dev`] — why not needed: no advanced visual design requirement.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 5, 7, 8, 10

  **References**:
  - Pattern: `client/src/features/settings/model/settings.slice.ts:9-23` — current local-only state to replace.
  - Pattern: `server-py/app/presentation/ws/chat_endpoint.py:16-22,53-70,131-168` — peer-visible payload shape must stay anonymous.
  - Pattern: `client/src/shared/types/index.ts` — peer-facing type surface to preserve.
  - Pattern: `client/src/features/chat/chat-provider.tsx` — existing chat state orchestration entrypoint.

  **Acceptance Criteria**:
  - [ ] Preferences fetched after login match PostgreSQL values, not stale sessionStorage values.
  - [ ] Updating settings changes future matchmaking inputs and chat display name.
  - [ ] Peer-facing websocket payloads never include account email or durable account IDs.

  **QA Scenarios**:
  ```
  Scenario: Backend-owned preferences drive future matchmaking
    Tool: Playwright
    Steps: Log in as a verified user; set display name `Traveler`, language `en`, keywords `music,travel`; refresh; queue with a matching peer.
    Expected: Preferences survive refresh, queue behavior uses saved values, and peer sees only `Traveler` plus anonymous chat identity.
    Evidence: .sisyphus/evidence/task-11-preference-sync.png

  Scenario: Client-side tampering cannot expose account identity
    Tool: Bash
    Steps: Run API/integration tests that inject extra account fields into client payload attempts and inspect websocket message payloads.
    Expected: Backend strips or rejects non-contract fields; peer-visible payload remains limited to anonymous shape.
    Evidence: .sisyphus/evidence/task-11-preference-sync-error.txt
  ```

  **Commit**: YES | Message: `feat(fullstack): move preferences to backend ownership` | Files: `server-py/app/**`, `client/src/**`, `server-py/tests/**`, `client/src/**/*.test.*`

- [ ] 12. Document schema, rollout, rollback, and future forum extensibility boundaries

  **What to do**: Write the implementation-facing docs that explain the final architecture: PostgreSQL vs Redis ownership table, schema/data dictionary, auth route contract, websocket gating rules, retention policy, local setup, rollback strategy, and future forum extension boundary. Explicitly state that future forum work may reuse `accounts` and moderation/audit infrastructure but must add separate `forum_*` tables later instead of reusing chat transcript tables. Include operator runbooks for enabling auth gating gradually and rolling back to a state where login remains available but chat gating can be feature-flagged off if needed.
  **Must NOT do**: Do not document forum endpoints or schema as implemented now; do not leave rollback behavior implicit; do not omit migration order.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: documentation clarity and operator guidance are the core deliverable.
  - Skills: [] — why needed: technical writing only.
  - Omitted: [`fullstack-dev`] — why not needed: implementation is already done by this step.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: none | Blocked By: 2, 4, 9, 10, 11

  **References**:
  - Pattern: `README.md:58-85` — current verification and environment documentation style.
  - Pattern: `ARCHITECTURE.md:23-30,68-103,105-145` — architecture doc structure and flow sections to extend.
  - Pattern: `server-py/README.md` — backend-local verification doc style.

  **Acceptance Criteria**:
  - [ ] Docs name every durable table, owner, retention rule, and feature flag in one place.
  - [ ] Rollout doc includes migration order, cookie/auth enablement sequence, and rollback path.
  - [ ] Docs explicitly mark forum support as future scope with additive `forum_*` namespace only.

  **QA Scenarios**:
  ```
  Scenario: Operator can follow rollout doc without guessing
    Tool: Bash
    Steps: Review docs while executing setup in a clean environment: env setup, migrations, backend start, client start, verification commands.
    Expected: Every step is present, ordered, and references exact commands; no undocumented prerequisite is discovered.
    Evidence: .sisyphus/evidence/task-12-rollout-docs.txt

  Scenario: Rollback path is incomplete
    Tool: Bash
    Steps: Simulate reading docs during a failed deploy where auth gating must be disabled but login kept intact.
    Expected: Docs specify exactly which feature flag/config to revert and which migrations are non-reversible vs safe to keep.
    Evidence: .sisyphus/evidence/task-12-rollout-docs-error.txt
  ```

  **Commit**: YES | Message: `docs(architecture): document auth persistence and rollout` | Files: `README.md`, `ARCHITECTURE.md`, `server-py/README.md`, `docs/**`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: `chore(server): add postgres config and migration scaffolding`
- Commit 2: `feat(server): add account auth and verification schema`
- Commit 3: `feat(server): add registration login and turnstile validation`
- Commit 4: `feat(server): persist chat identity preferences and gating`
- Commit 5: `feat(server): move durable chat history into postgres`
- Commit 6: `feat(client): add registration login and verified gating UI`
- Commit 7: `docs(architecture): document persistence ownership and retention`

## Success Criteria
- A verified-email account is required before any chat bootstrap or queue entry succeeds.
- The browser can authenticate without exposing account identity to chat partners.
- Matching can query persisted `language` and `keywords` without moving live queue ownership out of Redis.
- Chat content can expire on schedule while risk/audit records remain queryable.
- The design remains additive for future forum support without implementing forum now.
