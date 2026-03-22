# Campus Anonymous Chat Refactor Plan

## TL;DR
> **Summary**: Retain the existing React/Vite frontend, replace the Bun WebSocket backend with a new FastAPI backend, and introduce Redis + PostgreSQL + CI/testing so the product can support anonymous realtime chat with moderation for a conservative 2-3k concurrent-user target.
> **Deliverables**:
> - New `server-py/` FastAPI service with WebSocket + REST + moderation APIs
> - Shared protocol contract preserving the existing chat behavior during migration
> - Redis-backed matchmaking/realtime state and PostgreSQL-backed governance data
> - React client adaptation for tokenized FastAPI WebSocket access and report flow
> - Test, CI, Docker Compose, observability, and cutover runbook
> **Effort**: XL
> **Parallel**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 4 → Task 5 → Task 7 → Task 8

## Context
### Original Request
Introduce the current project and create a refactor plan for a campus anonymous chat website using front-end/back-end separation, with a Python backend and a target scale around 2-3k users.

### Interview Summary
- Keep the existing React frontend rather than migrating to another frontend framework.
- Use FastAPI as the new Python backend framework.
- Product scope is planning-only at this stage; no implementation should be done now.
- Phase-1 product keeps anonymous random chat as the core flow.
- Phase-1 includes moderation/report/ban capability.
- Phase-1 includes short-term message retention.
- Phase-1 does **not** include campus identity verification.
- Capacity planning should assume **2-3k concurrent users** rather than DAU.
- Deployment should start as **single instance, explicitly extensible**.
- Testing and CI should be introduced **during** the refactor, not deferred.

### Metis Review (gaps addressed)
- Protocol compatibility is the primary migration risk; the plan anchors on a contract-first approach.
- Moderation scope must stay API-first and minimal to prevent UI/admin sprawl.
- Existing repository has zero tests and zero CI; the plan makes automated verification mandatory from the start.
- Old Bun server must coexist until final cutover so rollback remains possible.

## Work Objectives
### Core Objective
Produce a migration-ready architecture and execution sequence that transforms the current Bun-based anonymous chat MVP into a front-end/back-end separated system with a FastAPI backend, preserving chat behavior while adding scale seams, governance, and delivery discipline.

### Deliverables
- `server-py/` Python backend skeleton and target module map
- Shared WebSocket/HTTP contract specification and compatibility rules
- Redis-backed realtime architecture for queue, pairing, rate limiting, and ephemeral session state
- PostgreSQL-backed report/ban/audit persistence model
- Client adaptation scope for protocol normalization, session bootstrap, and report submission
- CI, test strategy, Docker Compose topology, logging, and deployment runbook

### Definition of Done (verifiable conditions with commands)
- `cd server-py && pytest -q` passes for protocol, matchmaking, moderation, and integration suites.
- `cd server-py && ruff check . && ruff format --check .` passes.
- `docker compose up -d --build` starts `client`, `server-py`, `redis`, and `postgres` successfully.
- `curl -s http://localhost:8000/healthz` returns an OK JSON health payload.
- `curl -s http://localhost:8000/api/users/count` returns a valid JSON online-count payload.
- `python scripts/ws_smoke.py` proves connect → queue → match → message → report flow end to end.
- React client connects to FastAPI backend with no Bun dependency remaining in active runtime path.

### Must Have
- Preserve the current anonymous chat UX and message semantics during migration.
- Introduce a FastAPI backend in a new `server-py/` directory instead of editing Bun server in place.
- Keep WebSocket contract values stable unless the plan explicitly standardizes a known inconsistency.
- Use Redis for realtime coordination and PostgreSQL for moderation/reporting persistence.
- Add automated tests and CI before broad migration work proceeds.
- Keep single-instance launch as the deployment target while preserving scale-out seams.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No campus identity verification, SSO, OAuth, or school-email gating in phase 1.
- No admin dashboard UI in phase 1; moderation operations are API-only.
- No video/audio calling, `PayloadType.Call` revival, or media uploads.
- No interest-based matching or keyword-driven pairing; matchmaking stays FIFO random.
- No multi-worker/multi-region deployment in phase 1.
- No long-term chat archive beyond the short-term retention policy defined here.
- No redesign of the React UI beyond migration-required changes and the report action.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: `tests-after` for project bootstrap, then `TDD` for every backend feature task using `pytest`, `pytest-asyncio`, and FastAPI test tooling.
- QA policy: Every task includes an agent-executed happy path and failure/edge path.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`
- Coverage gate: backend coverage floor set to 80% once Task 3 lands.
- Client verification: Playwright or scripted browser smoke tests for chat lifecycle and report flow.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: foundation and contracts (`Task 1-3`)
Wave 2: realtime backend core (`Task 4-5`)
Wave 3: governance and frontend adaptation (`Task 6-7`)
Wave 4: delivery, cutover, and cleanup (`Task 8-9`)

### Dependency Matrix (full, all tasks)
- `Task 1` blocks all other implementation tasks.
- `Task 2` depends on `Task 1`; blocks `Task 4`, `Task 5`, and `Task 7`.
- `Task 3` depends on `Task 1`; blocks all tasks that require CI/test enforcement.
- `Task 4` depends on `Task 2`; blocks `Task 5`, `Task 6`, and `Task 7`.
- `Task 5` depends on `Task 4`; blocks `Task 7` and `Task 8`.
- `Task 6` depends on `Task 4`; can run in parallel with `Task 5` once core connection flow exists.
- `Task 7` depends on `Task 2`, `Task 4`, `Task 5`, and `Task 6`.
- `Task 8` depends on `Task 3`, `Task 5`, `Task 6`, and `Task 7`.
- `Task 9` depends on `Task 8`.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → `deep`, `unspecified-high`
- Wave 2 → 2 tasks → `deep`, `unspecified-high`
- Wave 3 → 2 tasks → `unspecified-high`, `visual-engineering`
- Wave 4 → 2 tasks → `writing`, `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Establish target workspace skeleton and migration boundary

  **What to do**: Create a new `server-py/` service tree, keep existing `server/` untouched, add the exact Python project skeleton (`app/`, `routers/`, `services/`, `schemas/`, `tests/`, `scripts/`), and define environment/config surfaces for local/dev/prod. Pin Python tooling in `pyproject.toml`; adopt `ruff`, `pytest`, `pytest-asyncio`, `httpx`, `websockets`, `redis`, `asyncpg` or SQLAlchemy-compatible stack, and Docker assets. Add `.env.example` files for backend and frontend runtime variables.
  **Must NOT do**: Do not edit existing Bun runtime behavior, do not delete `server/`, do not introduce Kubernetes, and do not choose a framework other than FastAPI.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: foundation choices affect every downstream task.
  - Skills: [`fullstack-dev`] — why needed: align service boundaries, env model, and local stack.
  - Omitted: [`frontend-dev`] — why not needed: no UI design work in this task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: `Task 2`, `Task 3`, `Task 4`, `Task 5`, `Task 6`, `Task 7`, `Task 8`, `Task 9` | Blocked By: none

  **References**:
  - Pattern: `server/package.json:1` — current backend runtime manifest being replaced in parallel rather than edited in place.
  - Pattern: `server/src/index.ts:1` — existing boot entrypoint that remains active until cutover.
  - Pattern: `client/package.json:1` — frontend runtime expectations and existing script conventions.
  - Pattern: `server/Dockerfile:1` — current containerization baseline to replace with Python stack parity.

  **Acceptance Criteria**:
  - [ ] `server-py/` exists with the planned module tree and no changes to active Bun behavior.
  - [ ] `cd server-py && pytest -q` runs against an initial smoke suite successfully.
  - [ ] `cd server-py && ruff check .` succeeds.
  - [ ] `.env.example` files document all required backend/frontend variables.

  **QA Scenarios**:
  ```
  Scenario: Python service skeleton boots locally
    Tool: Bash
    Steps: Run `cd server-py && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
    Expected: Server starts without import/config errors and exposes configured routes
    Evidence: .sisyphus/evidence/task-1-skeleton.txt

  Scenario: Missing env validation fails clearly
    Tool: Bash
    Steps: Run backend start with intentionally missing required Redis/Postgres env values
    Expected: Process exits with a deterministic validation error naming the missing variables
    Evidence: .sisyphus/evidence/task-1-skeleton-error.txt
  ```

  **Commit**: YES | Message: `chore(server-py): scaffold FastAPI workspace` | Files: `server-py/**`, `.env.example`, `docker-compose.yml`

- [ ] 2. Freeze protocol contract and normalize compatibility rules

  **What to do**: Define the canonical WebSocket and minimal HTTP contract in Python schemas and shared frontend types. Preserve existing event names for `message`, `user-info`, `error`, `queue`, `match`, `disconnect`, and `typing`. Remove `call` from the new implementation plan. Explicitly normalize the current `UserInfo` envelope inconsistency by moving user identifiers into `payload` everywhere and document the migration rule for the React client.
  **Must NOT do**: Do not add new chat events, do not redesign payload naming, and do not silently break the current React message switch.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: protocol compatibility is the top migration risk.
  - Skills: [`fullstack-dev`] — why needed: coordinate backend schemas with frontend contract changes.
  - Omitted: [`frontend-dev`] — why not needed: protocol design over presentation.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: `Task 4`, `Task 5`, `Task 7` | Blocked By: `Task 1`

  **References**:
  - API/Type: `server/src/types.ts:1` — existing backend payload enum and wire-model baseline.
  - API/Type: `client/src/types/index.ts:1` — duplicated client-side protocol that must be reconciled.
  - Pattern: `client/src/providers/chat-provider.tsx:48` — inbound event switch that new backend must continue satisfying.
  - Pattern: `server/src/lib/response.ts:1` — current `{ type, payload }` response envelope.

  **Acceptance Criteria**:
  - [ ] A versioned protocol module exists and is imported by backend handlers and frontend integration code.
  - [ ] Contract tests cover all active event types and the normalized `user-info` payload shape.
  - [ ] No task after this one is allowed to invent new payload shapes without updating the contract suite.

  **QA Scenarios**:
  ```
  Scenario: Contract suite validates all active event types
    Tool: Bash
    Steps: Run `cd server-py && pytest tests/test_ws_protocol.py -q`
    Expected: Tests pass for message, user-info, error, queue, match, disconnect, and typing envelopes
    Evidence: .sisyphus/evidence/task-2-protocol.txt

  Scenario: Invalid payload shape is rejected
    Tool: Bash
    Steps: Run the protocol tests that send malformed JSON or wrong payload shape
    Expected: Backend emits deterministic validation errors and does not crash
    Evidence: .sisyphus/evidence/task-2-protocol-error.txt
  ```

  **Commit**: YES | Message: `test(contract): freeze websocket protocol for migration` | Files: `server-py/app/schemas/**`, `server-py/tests/test_ws_protocol.py`, `client/src/types/**`

- [ ] 3. Add quality gates, local stack, and CI pipeline

  **What to do**: Add GitHub Actions (or the repo’s chosen CI system) for backend lint/test, frontend lint/build, and Docker Compose validation. Stand up a local stack with `server-py`, `redis`, `postgres`, and existing `client`. Enforce backend coverage threshold and ensure frontend env wiring points at the new backend. Add scripts for smoke verification and developer bootstrap.
  **Must NOT do**: Do not add deployment automation beyond CI validation, do not require manual checklist verification, and do not skip frontend checks.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross-cutting infra and repo-wide quality gates.
  - Skills: [`fullstack-dev`] — why needed: integrate services and CI coherently.
  - Omitted: [`frontend-dev`] — why not needed: build validation, not UI work.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `Task 8`, `Task 9` | Blocked By: `Task 1`

  **References**:
  - Pattern: `client/package.json:1` — existing frontend scripts that CI must keep exercising.
  - Pattern: `client/vite.config.ts:1` — client build assumptions and alias handling.
  - Pattern: `server/Dockerfile:1` — current backend container baseline being superseded.

  **Acceptance Criteria**:
  - [ ] CI runs backend lint/test, frontend lint/build, and compose validation automatically.
  - [ ] Local stack boots all required services with one documented command.
  - [ ] Backend coverage gate is enforced at 80% or higher once nontrivial tests exist.

  **QA Scenarios**:
  ```
  Scenario: CI-equivalent local checks pass
    Tool: Bash
    Steps: Run the documented bootstrap plus lint, test, build, and compose validation commands locally
    Expected: All checks complete successfully without manual intervention
    Evidence: .sisyphus/evidence/task-3-ci.txt

  Scenario: CI fails on broken backend tests
    Tool: Bash
    Steps: Intentionally trigger a failing backend test in a controlled branch run
    Expected: Pipeline exits non-zero and surfaces the failing stage clearly
    Evidence: .sisyphus/evidence/task-3-ci-error.txt
  ```

  **Commit**: YES | Message: `ci(fullstack): add lint test build pipeline` | Files: `.github/workflows/**`, `docker-compose.yml`, `server-py/scripts/**`, docs/bootstrap files

- [ ] 4. Implement connection lifecycle, session bootstrap, and online presence

  **What to do**: Build the FastAPI app entrypoint, session bootstrap endpoint, WebSocket authentication flow using anonymous signed tokens, connection manager, health endpoints, and online-count/users endpoints. Track live WebSocket connections in process, keep ephemeral session metadata in Redis, and preserve reconnect/disconnect semantics needed by the current client UX.
  **Must NOT do**: Do not rely on browser custom headers for WS auth, do not use permanent accounts, and do not remove the Bun server yet.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the backend runtime spine.
  - Skills: [`fullstack-dev`] — why needed: coordinate FastAPI, Redis, settings, and endpoint contracts.
  - Omitted: [`frontend-dev`] — why not needed: no presentation decisions here.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: `Task 5`, `Task 6`, `Task 7` | Blocked By: `Task 1`, `Task 2`

  **References**:
  - Pattern: `server/src/lib/app.ts:57` — current websocket open/close lifecycle and client registry behavior.
  - Pattern: `server/src/index.ts:1` — current server startup and port binding behavior.
  - Pattern: `client/src/providers/chat-provider.tsx:88` — existing client websocket connection expectations.
  - Pattern: `client/src/lib/api.ts:1` — current REST usage that expands into session bootstrap + presence endpoints.

  **Acceptance Criteria**:
  - [ ] `GET /healthz`, `POST /api/session`, and presence endpoints are implemented and tested.
  - [ ] `ws://.../ws?token=...` accepts valid anonymous tokens and rejects invalid/expired tokens.
  - [ ] Connection/disconnect events update online presence consistently.
  - [ ] Reconnect within a short window does not crash the server or leak stale connections.

  **QA Scenarios**:
  ```
  Scenario: Session bootstrap and websocket connect succeed
    Tool: Bash
    Steps: Call `POST /api/session`, extract token, open websocket using the returned token, then query online count
    Expected: WebSocket is accepted and presence reflects the connected client
    Evidence: .sisyphus/evidence/task-4-connection.txt

  Scenario: Invalid token is rejected
    Tool: Bash
    Steps: Attempt websocket connect with an expired or tampered token
    Expected: Connection is rejected with a deterministic auth error and no presence leak
    Evidence: .sisyphus/evidence/task-4-connection-error.txt
  ```

  **Commit**: YES | Message: `feat(ws): add FastAPI connection lifecycle` | Files: `server-py/app/main.py`, `server-py/app/routers/**`, `server-py/app/services/connection.py`, connection tests

- [ ] 5. Rebuild matchmaking, chat relay, and short-term retention

  **What to do**: Reimplement FIFO anonymous matchmaking on Redis, enforce no self-match and no immediate rematch rules, handle partner disconnects, relay messages and typing indicators, and retain short-term chat history for **7 days** with a capped per-pair history window. Use Redis for queue/pair state and short-term message history; treat Redis as ephemeral realtime storage, not a compliance archive.
  **Must NOT do**: Do not add keyword-based matching, do not preserve `PayloadType.Call`, and do not store indefinite chat history.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this task ports the core business logic.
  - Skills: [`fullstack-dev`] — why needed: async websocket relay + Redis coordination.
  - Omitted: [`frontend-dev`] — why not needed: server behavior first.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: `Task 7`, `Task 8` | Blocked By: `Task 2`, `Task 4`

  **References**:
  - Pattern: `server/src/lib/queue.ts:1` — current in-memory FIFO queue behavior to preserve logically.
  - Pattern: `server/src/lib/app.ts:92` — current match loop cadence and pair creation behavior.
  - Pattern: `server/src/lib/handlers/queue.ts:22` — current state transitions for entering queue and leaving active partner.
  - Pattern: `server/src/lib/handlers/message.ts:28` — current message and typing relay semantics.
  - Pattern: `server/src/lib/user.ts:43` — current anti-rematch history guard.

  **Acceptance Criteria**:
  - [ ] Queueing two eligible users produces exactly one match event per user.
  - [ ] Same-session multi-tab users cannot match with each other.
  - [ ] Partner disconnects trigger the correct disconnect flow for the remaining user.
  - [ ] Messages and typing events relay correctly after match establishment.
  - [ ] Short-term history is retained for 7 days and pruned automatically.

  **QA Scenarios**:
  ```
  Scenario: Two users queue, match, and exchange messages
    Tool: Bash
    Steps: Create two anonymous sessions, connect both sockets, send queue events, wait for match, exchange message and typing events
    Expected: Both clients receive match payloads, typing notifications, and relayed messages in order
    Evidence: .sisyphus/evidence/task-5-chat.txt

  Scenario: Multi-tab self-match and partner disconnect are handled safely
    Tool: Bash
    Steps: Open two sockets with the same session token plus a third socket with another token; queue all three and force one disconnect mid-chat
    Expected: Same-session sockets never match with each other; remaining partner receives disconnect event without server error
    Evidence: .sisyphus/evidence/task-5-chat-error.txt
  ```

  **Commit**: YES | Message: `feat(matchmaking): add Redis-backed chat core` | Files: `server-py/app/services/matchmaker.py`, `server-py/app/services/chat.py`, related tests

- [ ] 6. Add moderation data model, report flow, and timed bans

  **What to do**: Introduce PostgreSQL-backed moderation persistence for reports, ban records, and audit timestamps. Add API-only moderation endpoints for submitting reports, listing reports for operators, creating timed bans, revoking bans, and enforcing active bans during session bootstrap and websocket connect. Default ban strategy to anonymous session/device fingerprint plus IP hash; default timed-ban presets should include 1 hour, 24 hours, and 7 days.
  **Must NOT do**: Do not build an admin UI, do not add appeals, and do not require identity verification.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: governance rules plus persistence design.
  - Skills: [`fullstack-dev`] — why needed: backend APIs, data model, and enforcement flow.
  - Omitted: [`frontend-dev`] — why not needed: admin UI is out of scope.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: `Task 7`, `Task 8` | Blocked By: `Task 4`

  **References**:
  - Pattern: `client/src/components/pages/home.tsx:14` — current user flow where report entry points will be added later.
  - Pattern: `client/src/providers/chat-provider.tsx:96` — client action layer that will eventually submit report events/API calls.
  - Pattern: `server/src/lib/user.ts:1` — current anonymous-session concept that moderation must extend without user accounts.

  **Acceptance Criteria**:
  - [ ] Reports can be created against active or recently disconnected chat counterparts.
  - [ ] Timed bans block new sessions and active websocket connects for banned actors.
  - [ ] Moderation list/revoke APIs are covered by automated tests.
  - [ ] Governance data persists across backend restarts.

  **QA Scenarios**:
  ```
  Scenario: Report submission and timed ban enforcement work
    Tool: Bash
    Steps: Create a matched chat pair, submit a report against one participant, create a timed ban through admin API, then attempt a new session/connect for the banned actor
    Expected: Report is stored, ban is created, and the banned actor is rejected until expiry
    Evidence: .sisyphus/evidence/task-6-moderation.txt

  Scenario: Ban expiry and revoke restore access
    Tool: Bash
    Steps: Create a short-lived ban or revoke an active ban, then retry session bootstrap and websocket connect
    Expected: Access is denied while ban is active and restored after expiry/revoke with correct audit state
    Evidence: .sisyphus/evidence/task-6-moderation-error.txt
  ```

  **Commit**: YES | Message: `feat(moderation): add report and timed ban APIs` | Files: `server-py/app/routers/admin.py`, moderation services/models/tests

- [ ] 7. Adapt React client to FastAPI session and moderation flow

  **What to do**: Rewire the React client to obtain an anonymous session token over HTTP before opening the WebSocket, update `chat-provider` to use the normalized protocol contract, keep existing store patterns, add the minimal report action in the chat UI, and switch all runtime config to the new backend endpoints. Preserve the current visual structure unless a migration bug forces a small localized UI fix.
  **Must NOT do**: Do not redesign the UI, do not add admin screens, and do not break the existing Zustand slice model.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: small but user-facing interaction changes inside the existing React app.
  - Skills: [`frontend-dev`] — why needed: precise React integration without unnecessary redesign.
  - Omitted: [`fullstack-dev`] — why not needed: backend contract is already defined by prior tasks.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: `Task 8` | Blocked By: `Task 2`, `Task 4`, `Task 5`, `Task 6`

  **References**:
  - Pattern: `client/src/providers/chat-provider.tsx:1` — main websocket integration point to update.
  - Pattern: `client/src/lib/api.ts:1` — minimal HTTP layer that expands to session bootstrap and report APIs.
  - Pattern: `client/src/lib/store/index.ts:1` — keep Zustand composition unchanged.
  - Pattern: `client/src/lib/store/users.slice.ts:1` — preserve user/stranger mutation semantics.
  - Pattern: `client/src/components/pages/home.tsx:1` — current connect/join UX to keep stable.
  - Pattern: `client/src/components/template/layout.tsx:1` — provider wiring location.

  **Acceptance Criteria**:
  - [ ] Client fetches a session token before websocket connect.
  - [ ] Client works with normalized `user-info` payloads and all active event types.
  - [ ] Report action exists in the active chat flow and submits to backend successfully.
  - [ ] Existing layout/theme/i18n behavior remains intact.

  **QA Scenarios**:
  ```
  Scenario: Browser flow completes connect-to-chat cycle on new backend
    Tool: Playwright
    Steps: Open the app, start a session, connect two browser contexts, queue both users, verify match, send messages, and confirm UI updates
    Expected: Existing chat UX works end to end against FastAPI without Bun backend
    Evidence: .sisyphus/evidence/task-7-client.png

  Scenario: Report action handles backend failure gracefully
    Tool: Playwright
    Steps: Trigger report submission while backend moderation endpoint returns an error or network failure
    Expected: UI shows deterministic failure feedback and chat session remains stable
    Evidence: .sisyphus/evidence/task-7-client-error.png
  ```

  **Commit**: YES | Message: `feat(client): connect React app to FastAPI backend` | Files: `client/src/providers/chat-provider.tsx`, `client/src/lib/api.ts`, chat UI files, shared type imports

- [ ] 8. Add observability, delivery runbook, and cutover stack

  **What to do**: Add structured JSON logging, request/session correlation IDs, service health probes, smoke scripts, and deployment docs for the single-instance production target. Document the exact cutover path from Bun to FastAPI, the rollback path, Redis/Postgres backup expectations, and the operating limits for a 2-3k concurrent-user target.
  **Must NOT do**: Do not add hosted monitoring vendors by default, do not promise horizontal scaling in phase 1, and do not delete the Bun server yet.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this task is documentation-heavy with some infra glue.
  - Skills: [`fullstack-dev`] — why needed: operational docs must match service topology.
  - Omitted: [`frontend-dev`] — why not needed: no UI changes.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: `Task 9` | Blocked By: `Task 3`, `Task 5`, `Task 6`, `Task 7`

  **References**:
  - Pattern: `README.md:1` — existing project overview to be replaced with architecture-aware runbook content.
  - Pattern: `server/Dockerfile:1` — current deployment baseline informing migration notes.
  - Pattern: `client/package.json:1` — frontend run/build commands that docs must preserve.

  **Acceptance Criteria**:
  - [ ] Runbook documents local dev, staging, production startup, rollback, and dependency expectations.
  - [ ] Smoke scripts exercise health, session bootstrap, chat connect, matchmaking, and report flow.
  - [ ] Logs and health probes are sufficient for basic operator diagnosis.

  **QA Scenarios**:
  ```
  Scenario: Smoke script validates the whole stack
    Tool: Bash
    Steps: Start the compose stack, then run the documented smoke script against health, session, websocket, chat, and report endpoints
    Expected: Script exits zero and saves machine-readable evidence
    Evidence: .sisyphus/evidence/task-8-ops.txt

  Scenario: Rollback runbook is executable
    Tool: Bash
    Steps: Follow the documented rollback commands to switch traffic/runtime back to Bun in a local/staging simulation
    Expected: Bun stack resumes serving core chat flow and FastAPI stack can be stopped cleanly
    Evidence: .sisyphus/evidence/task-8-ops-error.txt
  ```

  **Commit**: YES | Message: `docs(ops): add cutover and rollback runbook` | Files: `README.md`, deployment docs, smoke scripts, logging config

- [ ] 9. Execute cutover, deprecate Bun runtime, and verify post-migration state

  **What to do**: Switch the active runtime path to `server-py`, update compose/docs/scripts to make FastAPI the default backend, archive or remove the Bun server only after all prior verification passes, and confirm no frontend path still depends on Bun-specific assumptions. Leave a clear deprecation note for the old server code if it is retained temporarily.
  **Must NOT do**: Do not remove the Bun server before full smoke verification, and do not leave ambiguous dual-default startup paths.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: final cutover touches runtime defaults and rollback safety.
  - Skills: [`fullstack-dev`] — why needed: cross-service cutover discipline.
  - Omitted: [`frontend-dev`] — why not needed: cutover, not design.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: Final verification | Blocked By: `Task 8`

  **References**:
  - Pattern: `server/src/index.ts:1` — old backend entrypoint being retired from the default path.
  - Pattern: `client/src/providers/chat-provider.tsx:88` — final client connection behavior that must no longer depend on Bun.
  - Pattern: `README.md:1` — existing startup documentation that must be rewritten to point to FastAPI as the default backend.

  **Acceptance Criteria**:
  - [ ] FastAPI is the default backend in local/dev/prod documentation and startup scripts.
  - [ ] Bun server is either removed or clearly marked deprecated and non-default.
  - [ ] Full smoke suite passes with Bun disabled.

  **QA Scenarios**:
  ```
  Scenario: FastAPI-only stack passes final smoke tests
    Tool: Bash
    Steps: Start the stack with Bun backend disabled, run all final smoke and integration scripts
    Expected: All core flows pass and no command references Bun as an active dependency
    Evidence: .sisyphus/evidence/task-9-cutover.txt

  Scenario: Residual Bun dependency is detected and fixed before completion
    Tool: Bash
    Steps: Run repo-wide checks for Bun-based startup paths after cutover
    Expected: Any remaining Bun-default path fails the task until corrected; final state has a single clear backend default
    Evidence: .sisyphus/evidence/task-9-cutover-error.txt
  ```

  **Commit**: YES | Message: `chore(cutover): make FastAPI backend the default runtime` | Files: startup scripts, compose files, backend docs, deprecated `server/` notes or removal

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit in reviewable slices aligned to each task’s acceptance criteria.
- Keep the Bun server intact until `Task 9` cutover completes.
- Require `ruff check .`, `pytest -q`, and relevant frontend checks to pass before each feature merge.
- Use conventional messages such as `chore(server-py): scaffold FastAPI service`, `feat(ws): add Redis-backed matchmaker`, `feat(moderation): add report and timed ban APIs`, `chore(deploy): add docker compose cutover stack`.

## Success Criteria
- The new backend handles anonymous chat, queueing, matching, typing, disconnects, reports, and timed bans without Bun runtime dependency.
- The React client remains the primary UI and connects only to the new backend.
- The system is launch-ready on a single instance with Redis/PostgreSQL and documented expansion seams.
- Delivery quality is enforced through automated tests, CI, and reproducible local/dev deployment.
