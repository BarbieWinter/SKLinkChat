# Post-Auth Hardening and Governance

## TL;DR
> **Summary**: Harden the newly implemented auth-enabled anonymous chat stack by upgrading the PostgreSQL schema to the stricter V2 baseline, enforcing chat invariants at DB + transaction level, and adding a minimal abuse-reporting path. Keep product scope narrow: no forum, no group chat, no matching intelligence beyond current FIFO.
> **Deliverables**:
> - Migration set that upgrades the current simplified Postgres schema to the V2 baseline
> - Repository/runtime changes that enforce single active chat session per account and no overlapping active matches per chat session
> - Message persistence upgraded with idempotency and system-message support
> - Minimal `chat_reports` backend + frontend reporting flow
> - Expanded automated coverage for auth/profile/retention/invariant edge cases
> - Updated docs aligning code, schema, and runtime boundaries
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 6 → 8

## Context
### Original Request
- 用户已经完成登录注册等功能。
- 需要基于当前实际项目状态分析下一步应做什么。
- 当前结论：下一步应优先做 schema 收口、聊天不变量加固、最小举报治理，而不是继续扩产品边界。

### Interview Summary
- Auth foundation is already implemented in code:
  - register/login/logout/verify-email/resend-verification in `server-py/app/presentation/http/routes/auth.py:54-132`
  - auth service and auto-login in `server-py/app/application/auth/service.py:89-263`
  - account profile endpoints in `server-py/app/presentation/http/routes/account.py:16-33`
  - verified-email gating for chat in `server-py/app/application/chat/access_service.py:29-55`
  - websocket ownership checks in `server-py/tests/test_websocket.py:103-229`
- Runtime/docs already moved to `PostgreSQL + Redis + Mailpit` in `README.md:3-15` and `ARCHITECTURE.md:5-12`.
- The current Postgres schema is still an early simplified baseline in `server-py/alembic/versions/0001_auth_foundation.py:20-171` and `server-py/app/infrastructure/postgres/models.py:26-195`.
- Retention already runs in-process via `server-py/app/bootstrap/lifespan.py:39-45` and `server-py/app/shared/config.py:39-46`.
- Product scope remains intentionally narrow:
  - no rooms/group chat
  - no forum implementation now
  - no language field
  - interests stored only as profile metadata, not matching logic
  - Redis queue remains FIFO

### Metis Review (gaps addressed)
- Guardrail applied: do not expand into new product areas; focus only on hardening and governance.
- Guardrail applied: preserve Redis as runtime coordinator; do not replatform queue/presence into PostgreSQL.
- Default applied: keep current table naming where already shipped (`registration_risk_events`) unless a rename is strictly required; avoid cosmetic renames in this phase.
- Default applied: active match invariant will be enforced by partial indexes for same-side protection plus transactional locking/checking in repository code for cross-side overlap prevention.

## Work Objectives
### Core Objective
Turn the current “auth already works” milestone into a production-safer baseline by closing the gaps between implemented auth flows and the still-simplified database/chat model.

### Deliverables
- Migration-aligned V2 Postgres schema
- Hardened chat persistence and invariant enforcement
- Minimal abuse-reporting capability
- Expanded automated test coverage for auth, profile, websocket, and retention edge cases
- Updated docs matching the actual runtime and schema

### Definition of Done (verifiable conditions with commands)
- `cd server-py && ./.venv/bin/python -m pytest -q`
- `cd server-py && ./.venv/bin/ruff check app tests`
- `cd server-py && python -m compileall app tests`
- `cd server-py && alembic upgrade head`
- `cd client && npm run test -- --run`
- `cd client && npm run build`
- `docker compose config`
- websocket/auth/profile/reporting integration tests pass without relying on manual inspection

### Must Have
- Keep auth behavior already implemented: register auto-login, verified-email gating, resend verification, HttpOnly cookie session
- Upgrade chat schema to support message idempotency and system-message extensibility
- Enforce one active chat session per account
- Prevent overlapping active matches for any single chat session
- Add minimal `chat_reports` persistence and user-facing reporting path
- Preserve in-process retention jobs

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No forum tables or forum endpoints
- No language field reintroduction
- No interests-based matching in V1
- No Celery / RQ / external worker split
- No account persona system or device model
- No broad schema renames done only for aesthetics

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after using existing `pytest`/`vitest`, plus websocket integration tests and migration/schema assertions.
- QA policy: Every task must include happy and failure/edge scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.

Wave 1: schema and backend foundations — tasks 1-3
Wave 2: runtime hardening and governance — tasks 4-6
Wave 3: frontend integration, regression coverage, docs — tasks 7-9

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4, 5, 6, 7, 8, 9
- 2 blocks 4, 5, 6, 8, 9
- 3 blocks 4, 5, 8
- 4 blocks 5, 7, 8
- 5 blocks 7, 8
- 6 blocks 7, 8, 9
- 7 blocks 9
- 8 blocks 9

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → `deep`, `unspecified-high`
- Wave 2 → 3 tasks → `deep`, `fullstack-dev`, `unspecified-high`
- Wave 3 → 3 tasks → `fullstack-dev`, `writing`, `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Upgrade the shipped Postgres baseline to the V2 schema without expanding product scope

  **What to do**: Create follow-up Alembic migrations that evolve the existing `0001_auth_foundation` baseline into the hardened schema used by current product decisions. Keep current naming unless a rename is strictly necessary. Required changes: add state columns and constraints to `chat_sessions`; add end metadata and stronger indexes to `chat_matches`; replace `chat_messages.content`/`match_id` shape with V2 fields needed by the current blueprint (`message_type`, nullable `client_message_id`, sender display snapshot, consistent FK naming); add the new `chat_reports` table; tighten `accounts`, `auth_sessions`, `email_verification_tokens`, `registration_risk_events`, and `audit_events` only where current behavior requires it. Do **not** add `language`, forum tables, or interests-based matching columns.
  **Must NOT do**: Do not perform cosmetic renames that ripple through runtime code with no functional gain; do not drop existing auth data without an explicit in-migration backfill; do not introduce enum types or worker tables.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: migration-safe schema evolution across already-shipped auth code.
  - Skills: [] — why needed: backend schema work only.
  - Omitted: [`fullstack-dev`] — why not needed: no frontend work in this task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5, 6, 7, 8, 9 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `server-py/alembic/versions/0001_auth_foundation.py:20-171` — current simplified migration baseline to evolve.
  - Pattern: `server-py/app/infrastructure/postgres/models.py:26-195` — ORM model shape currently lagging behind desired schema.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-ddl-draft.md` — approved DDL direction for the hardened baseline.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-schema-blueprint.md` — business semantics and storage boundary.
  - Pattern: `README.md:9-15,61-76,107-112` — current product/runtime contract already documented and must stay true.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `cd server-py && alembic upgrade head` succeeds against a clean database.
  - [ ] `cd server-py && ./.venv/bin/python -m pytest -q tests/test_migrations.py` passes with schema assertions for new columns, constraints, and `chat_reports`.
  - [ ] No new table/column reintroduces `language` or forum scope.
  - [ ] Existing auth tests still pass after migration/model changes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Hardened schema migrates from current baseline successfully
    Tool: Bash
    Steps: Apply all Alembic migrations to a fresh Postgres DB and run schema assertion tests for `chat_sessions`, `chat_matches`, `chat_messages`, `registration_risk_events`, `chat_reports`, and `audit_events`.
    Expected: Migration completes cleanly; required columns and indexes exist; no out-of-scope tables are introduced.
    Evidence: .sisyphus/evidence/task-1-schema-upgrade.txt

  Scenario: Out-of-scope schema creep is rejected
    Tool: Bash
    Steps: Run schema assertion tests that explicitly fail if `language`, `forum_*`, or worker-oriented tables exist after migration.
    Expected: Tests stay green only when scope remains narrow.
    Evidence: .sisyphus/evidence/task-1-schema-upgrade-error.txt
  ```

  **Commit**: YES | Message: `feat(server): upgrade post auth schema baseline` | Files: `server-py/alembic/**`, `server-py/app/infrastructure/postgres/**`, `server-py/tests/**`

- [ ] 2. Align ORM models and repositories with the upgraded schema fields and retention semantics

  **What to do**: Refactor SQLAlchemy models and Postgres repositories so they exactly match the upgraded migration baseline. Replace outdated field names and table assumptions (`content`, `match_id`, simplified `registration_risk_events`, simplified `audit_events`) with the current schema contract. Add repository methods required by the new schema: storing message type, optional client message id, sender display snapshot, report creation/query helpers, and any missing row-state updates for `chat_sessions` / `chat_matches`. Keep current retention architecture: TTL columns + in-process cleanup via `RetentionService`.
  **Must NOT do**: Do not change repository responsibilities between Postgres and Redis; do not move queue or presence into SQL; do not remove current retention loop in `lifespan.py`.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: model/repository correctness directly affects data integrity.
  - Skills: [] — why needed: backend persistence refactor only.
  - Omitted: [`frontend-dev`] — why not needed: no UI work.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 6, 8, 9 | Blocked By: 1

  **References**:
  - Pattern: `server-py/app/infrastructure/postgres/models.py:26-195` — current ORM layer to update.
  - Pattern: `server-py/app/infrastructure/postgres/repositories.py:24-419` — current repository methods and retention delete paths.
  - Pattern: `server-py/app/bootstrap/container.py:102-162` — repository construction and retention dependency wiring.
  - Pattern: `server-py/app/bootstrap/lifespan.py:39-45` — existing in-process retention job runner to preserve.
  - Pattern: `server-py/app/shared/config.py:39-46` — TTL and cleanup interval configuration already present.

  **Acceptance Criteria**:
  - [ ] ORM metadata and migrations are in sync; model-based tests no longer reference removed/legacy column names.
  - [ ] Retention service still purges auth sessions, expired verification tokens, expired chat messages, registration risk events, and audit events correctly.
  - [ ] Repository layer exposes the methods needed by later tasks without leaking queue/presence responsibilities into SQL.

  **QA Scenarios**:
  ```
  Scenario: Repository layer matches hardened schema
    Tool: Bash
    Steps: Run repository-focused tests after migration; instantiate session factory and execute create/read/update flows for accounts, chat sessions, messages, and reports.
    Expected: No SQL/ORM mismatch errors occur; retention operations still target the right tables/columns.
    Evidence: .sisyphus/evidence/task-2-model-repository-alignment.txt

  Scenario: Legacy field usage is eliminated
    Tool: Bash
    Steps: Run tests that fail if repository/model code still references removed legacy shapes like `content`-only messages or old risk/audit assumptions.
    Expected: Tests confirm all persistence code uses the new schema contract.
    Evidence: .sisyphus/evidence/task-2-model-repository-alignment-error.txt
  ```

  **Commit**: YES | Message: `refactor(server): align repositories with hardened schema` | Files: `server-py/app/infrastructure/postgres/**`, `server-py/app/bootstrap/**`, `server-py/tests/**`

- [ ] 3. Make account-owned chat session creation safe under concurrency and persistence rules

  **What to do**: Replace the current “latest session + process lock” approach with a DB-backed invariant: one account can have at most one active `chat_session`. Implement the DB partial unique index from the schema task and update `ChatAccessService` plus durable chat repository code so `POST /api/session` creates or reuses the single active session transactionally. If an old session is superseded or intentionally closed, status/closure fields must be updated consistently. Preserve current behavior where verified users can reuse the same session id across repeated `/api/session` calls.
  **Must NOT do**: Do not rely only on the in-process `asyncio.Lock`; do not create parallel active chat sessions for one account; do not change the verified-email gating semantics.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: concurrency and data integrity at the auth/chat boundary.
  - Skills: [] — why needed: backend logic only.
  - Omitted: [`fullstack-dev`] — why not needed: no client contract change.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 8 | Blocked By: 1

  **References**:
  - Pattern: `server-py/app/application/chat/access_service.py:18-55` — current chat session creation and authorization flow.
  - Pattern: `server-py/app/infrastructure/postgres/repositories.py:243-281` — current durable chat session ownership/reuse logic.
  - Test: `server-py/tests/test_session.py:32-84` — current expected behavior for unauthenticated, unverified, and verified session creation.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-ddl-draft.md` — `ux_chat_sessions_one_active_per_account` partial unique index requirement.

  **Acceptance Criteria**:
  - [ ] Verified accounts still receive a stable `session_id` on repeated `POST /api/session` calls.
  - [ ] Concurrent session creation tests cannot produce two active chat sessions for one account.
  - [ ] Unauthenticated and unverified error behavior remains unchanged.

  **QA Scenarios**:
  ```
  Scenario: Concurrent chat session creation collapses to one active row
    Tool: Bash
    Steps: Run concurrent backend tests that trigger two or more `POST /api/session` requests for the same verified account.
    Expected: Exactly one active `chat_session` row remains; all successful responses resolve to the same `session_id` or a transaction-safe reuse path.
    Evidence: .sisyphus/evidence/task-3-chat-session-invariant.txt

  Scenario: Auth gating regresses during refactor
    Tool: Bash
    Steps: Re-run `tests/test_session.py` cases for unauthenticated and unverified users after the transactional changes.
    Expected: Responses remain `401 UNAUTHENTICATED` and `403 EMAIL_NOT_VERIFIED` respectively.
    Evidence: .sisyphus/evidence/task-3-chat-session-invariant-error.txt
  ```

  **Commit**: YES | Message: `refactor(server): enforce single active chat session per account` | Files: `server-py/app/application/chat/**`, `server-py/app/infrastructure/postgres/**`, `server-py/tests/**`

- [ ] 4. Enforce the active-match invariant for 1:1 chat at transaction level

  **What to do**: Upgrade durable match creation so no `chat_session` can participate in overlapping active matches. Add the same-side partial unique indexes from the schema task, then change `DurableChatRepositoryImpl.create_match()` so it no longer only ends the old match for the exact same pair. The new algorithm must run in one DB transaction, lock both candidate chat sessions, close or reject any existing active matches involving either side, and create exactly one new open match. Preserve current Redis FIFO runtime and current websocket contract.
  **Must NOT do**: Do not move queue orchestration into Postgres; do not rely only on the left/right partial indexes; do not allow the same account to be matched against itself through duplicate sessions.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the highest-risk runtime integrity invariant after auth.
  - Skills: [] — why needed: backend/runtime coordination only.
  - Omitted: [`frontend-dev`] — why not needed: no UI work.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5, 7, 8 | Blocked By: 1, 2, 3

  **References**:
  - Pattern: `server-py/app/infrastructure/postgres/repositories.py:293-389` — current match creation/end logic that only handles same-pair cleanup.
  - Pattern: `server-py/tests/test_websocket.py:197-229` — current regression around duplicate sessions from the same account.
  - Pattern: `server-py/app/application/chat/runtime_service.py` — queue/match lifecycle must remain Redis-driven.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-ddl-draft.md` — partial unique index plus transaction-locking requirement for active matches.

  **Acceptance Criteria**:
  - [ ] No test can create two simultaneous open `chat_matches` involving the same `chat_session`.
  - [ ] Existing queue/match websocket flows remain green.
  - [ ] Duplicate sessions from the same account still cannot self-match.

  **QA Scenarios**:
  ```
  Scenario: Match creation prevents overlapping active matches
    Tool: Bash
    Steps: Run backend tests that attempt to match the same chat session with multiple partners in quick succession and from competing transactions.
    Expected: At most one open match survives for any chat session; later attempts either close prior state safely or fail deterministically per implementation choice.
    Evidence: .sisyphus/evidence/task-4-active-match-invariant.txt

  Scenario: Duplicate account sessions slip into self-match or overlap
    Tool: Bash
    Steps: Re-run and extend websocket/integration tests around `test_try_match_skips_duplicate_sessions_from_same_account` with concurrent matching pressure.
    Expected: Same-account duplicate sessions never produce self-match or double-open matches.
    Evidence: .sisyphus/evidence/task-4-active-match-invariant-error.txt
  ```

  **Commit**: YES | Message: `refactor(server): enforce active match invariants` | Files: `server-py/app/infrastructure/postgres/**`, `server-py/app/application/chat/**`, `server-py/tests/**`

- [ ] 5. Upgrade durable message persistence with idempotency and future system-message support

  **What to do**: Replace the current simple transcript write path so `chat_messages` stores the richer V2 shape. Add `message_type`, optional `client_message_id`, sender display-name snapshot, and the correct foreign-key column naming. For normal user messages, use `client_message_id` as an idempotency key when provided; retries must not create duplicate durable rows inside the same match. Reserve `message_type='system'` for server-generated timeline events without requiring immediate UI changes. Keep transcript persistence limited to successfully accepted/delivered messages only.
  **Must NOT do**: Do not persist malformed payloads; do not duplicate message rows on retries; do not change peer-facing websocket payload shape unless required by tests.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: durable messaging sits at the boundary of transport correctness and persistence correctness.
  - Skills: [`fullstack-dev`] — why needed: persistence and transport payloads must stay aligned.
  - Omitted: [`frontend-dev`] — why not needed: no visual redesign.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8 | Blocked By: 1, 2, 4

  **References**:
  - Pattern: `server-py/app/infrastructure/postgres/repositories.py:322-359` — current `append_message()` implementation.
  - Pattern: `server-py/app/infrastructure/postgres/models.py:151-173` — current simplified `ChatMessage` model.
  - Test: `server-py/tests/test_websocket.py:116-194` — current message and reconnect contract.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-ddl-draft.md` — `chat_messages` V2 column set and partial unique idempotency index.

  **Acceptance Criteria**:
  - [ ] Durable message rows include `message_type`, optional `client_message_id`, and sender display snapshot.
  - [ ] A repeated send using the same `client_message_id` does not create duplicate durable rows within the same match.
  - [ ] Existing websocket message delivery tests remain green.

  **QA Scenarios**:
  ```
  Scenario: Retried client message remains idempotent
    Tool: Bash
    Steps: Run integration/repository tests that submit the same logical message twice with the same `client_message_id` inside one active match.
    Expected: Only one durable row exists; peer-facing delivery semantics remain correct.
    Evidence: .sisyphus/evidence/task-5-message-idempotency.txt

  Scenario: Invalid payload still writes transcript rows
    Tool: Bash
    Steps: Send malformed websocket message payloads and inspect the transcript table afterward.
    Expected: No durable row is inserted for malformed or rejected messages.
    Evidence: .sisyphus/evidence/task-5-message-idempotency-error.txt
  ```

  **Commit**: YES | Message: `feat(server): harden durable message persistence` | Files: `server-py/app/infrastructure/postgres/**`, `server-py/app/application/chat/**`, `server-py/tests/**`

- [ ] 6. Add minimal abuse reporting to the backend with durable governance storage

  **What to do**: Implement the smallest useful reporting feature for anonymous campus chat. Add `chat_reports` persistence, backend service/repository methods, and one authenticated endpoint for submitting a report tied to a durable `chat_match` and `reported_chat_session_id`. The endpoint should verify that the reporter participated in the referenced match, that the reported session belongs to the same match, and that report reason/details satisfy contract validation. Do not build a moderation console in this phase.
  **Must NOT do**: Do not add admin dashboards; do not allow arbitrary account-wide reporting outside the chat context; do not persist reports without verifying match participation.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: governance feature with moderate backend scope and strict validation rules.
  - Skills: [] — why needed: backend API + persistence only.
  - Omitted: [`frontend-dev`] — why not needed: frontend is separate in task 7.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8, 9 | Blocked By: 1, 2

  **References**:
  - Pattern: `server-py/app/presentation/http/routes/account.py:16-33` — current authenticated route style.
  - Pattern: `README.md:61-76` — active contracts section to extend consistently.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-schema-blueprint.md` — `chat_reports` purpose and minimum fields.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-ddl-draft.md` — `chat_reports` table and FK expectations.

  **Acceptance Criteria**:
  - [ ] Authenticated participant can submit a report for a peer in an actual match.
  - [ ] Non-participants or malformed report targets receive deterministic rejection.
  - [ ] Report rows persist with the expected foreign-key graph and status lifecycle.

  **QA Scenarios**:
  ```
  Scenario: Valid participant report is accepted and stored
    Tool: Bash
    Steps: Create a verified chat match between two accounts; submit a report from one participant against the other with a valid reason.
    Expected: Endpoint succeeds; one `chat_reports` row exists referencing the reporter, match, and reported chat session.
    Evidence: .sisyphus/evidence/task-6-chat-reporting.txt

  Scenario: User reports a session outside their conversation
    Tool: Bash
    Steps: Attempt to submit a report for a chat session that the current authenticated user never matched with.
    Expected: Endpoint rejects the request with the documented forbidden/validation error; no report row is created.
    Evidence: .sisyphus/evidence/task-6-chat-reporting-error.txt
  ```

  **Commit**: YES | Message: `feat(server): add minimal chat reporting` | Files: `server-py/app/**`, `server-py/tests/**`, `README.md`

- [ ] 7. Add the smallest user-facing report flow without widening product scope

  **What to do**: Add a minimal frontend reporting entrypoint inside the existing authenticated chat UI. Surface one report action only when the user is currently or recently in a 1:1 chat with a partner. Collect a required reason and optional details, call the new report endpoint, and show success/error feedback. Keep the UI simple and internal to current chat surfaces; do not create a moderation inbox, reputation system, or forum-style complaint flow.
  **Must NOT do**: Do not expose account identity in the report UX; do not add moderator/admin UI; do not create reporting flows outside chat.

  **Recommended Agent Profile**:
  - Category: `fullstack-dev` — Reason: thin UI plus exact backend integration.
  - Skills: [`fullstack-dev`] — why needed: endpoint wiring and existing chat UI integration.
  - Omitted: [`frontend-dev`] — why not needed: functional UX is the goal, not a design overhaul.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9 | Blocked By: 4, 5, 6

  **References**:
  - Pattern: `client/src/pages/home-page.tsx:321-410` — existing authenticated sidebar/profile/partner UI region.
  - Pattern: `client/src/features/auth/auth-provider.tsx:117-164` — current auth/provider integration style.
  - Pattern: `client/src/features/chat/ui/chat-panel.tsx` — primary chat interaction surface to extend conservatively.
  - Pattern: `client/src/shared/ui/use-toast.ts` and existing toast usage in `client/src/pages/home-page.tsx:84-133,287-300` — feedback pattern.

  **Acceptance Criteria**:
  - [ ] Verified authenticated users can submit a report from the chat UI.
  - [ ] Report success and failure states are surfaced without page reload.
  - [ ] No UI element reveals email, account id, or other real identity fields.

  **QA Scenarios**:
  ```
  Scenario: User reports abusive partner from chat UI
    Tool: Playwright
    Steps: Log in as a verified user, enter a chat with another verified user, trigger the report action, submit a valid reason/details payload.
    Expected: UI shows success feedback; backend stores the report; no account identity is exposed in the visible chat UI.
    Evidence: .sisyphus/evidence/task-7-report-ui.png

  Scenario: Report submission fails gracefully
    Tool: Playwright
    Steps: Trigger the report flow with backend forced to reject the request (e.g. invalid target or mocked 403/422).
    Expected: UI shows an error toast/message and remains usable; no duplicate or phantom success state appears.
    Evidence: .sisyphus/evidence/task-7-report-ui-error.png
  ```

  **Commit**: YES | Message: `feat(client): add minimal in-chat reporting flow` | Files: `client/src/**`, `client/src/**/*.test.*`

- [ ] 8. Expand automated regression coverage around auth edge cases, profile endpoints, invariants, and retention

  **What to do**: Fill the current test gaps now that auth is live. Add explicit tests for account profile read/update routes, verification expiry, resend cooldown and hourly limit, verified-user resend idempotency, single-active-chat-session concurrency, active-match overlap prevention, message idempotency, report authorization, and retention cleanup of auth sessions / verification tokens / chat messages / registration risk events / audit events. Keep backend tests in `pytest`; add frontend tests only where UI logic changed.
  **Must NOT do**: Do not leave new invariants protected only by code comments; do not depend on manual browser testing for core auth/reporting paths; do not split implementation and tests into separate tasks.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: large but bounded verification hardening across multiple layers.
  - Skills: [`fullstack-dev`] — why needed: some tests touch both backend contracts and frontend wiring.
  - Omitted: [`frontend-dev`] — why not needed: visual design is not the focus.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9 | Blocked By: 2, 3, 4, 5, 6

  **References**:
  - Test: `server-py/tests/test_auth.py:25-106` — current auth baseline coverage.
  - Test: `server-py/tests/test_session.py:32-84` — current chat-session gating baseline.
  - Test: `server-py/tests/test_websocket.py:103-229` — current websocket ownership and match flow baseline.
  - Pattern: `server-py/app/presentation/http/routes/account.py:16-33` — profile endpoints currently lacking dedicated tests.
  - Pattern: `server-py/app/bootstrap/lifespan.py:39-45` — retention loop entrypoint to keep covered indirectly.

  **Acceptance Criteria**:
  - [ ] New tests exist for account profile routes, resend edge cases, verification expiry, reporting, and retention jobs.
  - [ ] Concurrency/invariant tests fail on the old buggy behavior and pass on the hardened implementation.
  - [ ] Full backend and frontend test commands remain green.

  **QA Scenarios**:
  ```
  Scenario: Full regression suite covers hardened post-auth behavior
    Tool: Bash
    Steps: Run `cd server-py && ./.venv/bin/python -m pytest -q` and `cd client && npm run test -- --run` after all feature work lands.
    Expected: Auth, websocket, profile, reporting, and retention regressions all pass.
    Evidence: .sisyphus/evidence/task-8-regression-suite.txt

  Scenario: Previously missed edge case is still untested
    Tool: Bash
    Steps: Run targeted mutation/regression tests for expired verification token, resend cooldown/hourly limit, and overlapping match attempts.
    Expected: Tests fail if any of those paths are not truly enforced.
    Evidence: .sisyphus/evidence/task-8-regression-suite-error.txt
  ```

  **Commit**: YES | Message: `test(fullstack): harden post auth regressions` | Files: `server-py/tests/**`, `client/src/**/*.test.*`

- [ ] 9. Update architecture, schema, and operator docs to match the hardened implementation

  **What to do**: Bring all project docs into alignment with the hardened state after tasks 1-8. Update README, ARCHITECTURE, and any backend docs so they accurately describe the evolved schema, active invariants, minimal reporting capability, retention behavior, and exact runtime boundaries between PostgreSQL and Redis. Include migration order, rollback cautions for schema changes, and explicit note that reporting now exists but moderation console/forum still do not.
  **Must NOT do**: Do not document unimplemented forum/moderation features; do not leave the old simplified schema language in place; do not omit rollback notes for migration-heavy changes.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: documentation correctness and operator clarity are the primary output.
  - Skills: [] — why needed: technical writing only.
  - Omitted: [`fullstack-dev`] — why not needed: implementation should already be complete by this point.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: none | Blocked By: 1, 6, 7, 8

  **References**:
  - Pattern: `README.md:3-15,61-112` — current runtime, contract, and security notes to update.
  - Pattern: `ARCHITECTURE.md:5-104` — current ownership, flow, and retention sections to update.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-ddl-draft.md` — DDL baseline that shipped schema should now approximate.
  - Pattern: `.sisyphus/drafts/anonymous-chat-postgresql-schema-blueprint.md` — business semantics and governance boundary.

  **Acceptance Criteria**:
  - [ ] Docs describe the real schema and active invariants now enforced in code.
  - [ ] Docs mention minimal reporting and explicitly state that forum/multi-language/interests-based matching remain out of scope.
  - [ ] Docs provide migration verification and rollback guidance for the hardening release.

  **QA Scenarios**:
  ```
  Scenario: Operator docs match the shipped hardening release
    Tool: Bash
    Steps: Follow README/ARCHITECTURE instructions on a clean environment: infra up, migration, backend start, tests, and auth/chat verification commands.
    Expected: No undocumented step is required; docs match the actual service contract and schema behavior.
    Evidence: .sisyphus/evidence/task-9-doc-alignment.txt

  Scenario: Docs still describe pre-hardening behavior
    Tool: Bash
    Steps: Search docs for stale claims such as old simplified schema fields, missing reporting capability, or missing invariant notes.
    Expected: Stale references are absent; docs fail review if old baseline language remains.
    Evidence: .sisyphus/evidence/task-9-doc-alignment-error.txt
  ```

  **Commit**: YES | Message: `docs(architecture): align hardening release docs` | Files: `README.md`, `ARCHITECTURE.md`, `server-py/README.md`, `docs/**`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: `feat(server): upgrade post auth schema baseline`
- Commit 2: `refactor(server): enforce chat session and match invariants`
- Commit 3: `feat(server): add durable message metadata and reporting`
- Commit 4: `feat(client): add report flow and profile regression coverage`
- Commit 5: `test(fullstack): harden auth websocket and retention regressions`
- Commit 6: `docs(architecture): align runtime schema and governance docs`

## Success Criteria
- Current auth features remain green.
- Schema and model code align with the hardened V2 baseline.
- No account can own multiple active chat sessions concurrently.
- No chat session can be placed into overlapping active matches.
- Message persistence supports retry idempotency and future system messages.
- Users can submit minimal abuse reports for anonymous chats.
- Docs and tests describe the actual shipped behavior, not the old simplified schema.
