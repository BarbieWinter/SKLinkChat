# SKLinkChat Chat Platform Architecture Refactor

## TL;DR
> **Summary**: Replace the current mixed repo structure with a single active runtime (`client/ + server-py/ + redis`), remove all Bun legacy code, and reorganize both frontend and backend into explicit, scalable module boundaries. The backend must adopt a Spring-Boot-like layered architecture; the frontend must move from component-granularity folders to feature-first boundaries.
> **Deliverables**:
> - Legacy `server/` removed completely
> - `server-py/` refactored into `presentation / application / domain / infrastructure / shared`
> - `client/` refactored into `app / pages / features / shared`
> - Deprecated runtime artifacts removed (`/users` compat route, `welcome` placeholder, legacy payload remnants, old storage key)
> - Frontend test setup added; backend tests updated to new boundaries
> - README / ARCHITECTURE / env docs rewritten to match the new truth
> **Effort**: XL
> **Parallel**: YES - 4 waves
> **Critical Path**: 1 → 3 → 5 → 8 → 10 → 12

## Context
### Original Request
- Redesign the project architecture for future business growth.
- The current project feels messy and hard to continue.
- Remove useless / abandoned parts.
- Produce a document the user can distribute to implementation AIs.

### Interview Summary
- Refactor intensity: **aggressive**
- Legacy Bun backend handling: **delete directly**
- Product direction: **stabilize chat product first**
- Backend design preference: **Spring Boot-like clarity and layering**
- Migration style: **one-shot cutover**
- Future-readiness: **strong prebuild** for auth, RBAC, moderation, audit, feature flags, eventing, background jobs, and observability extension points without implementing those product capabilities now
- Constraint: this planning pass must not modify production code; implementation will be delegated later

### Metis Review (gaps addressed)
- Guardrail added: do **not** keep dual active architectures after the cutover; old and new structures must not coexist beyond the same implementation wave.
- Guardrail added: keep runtime contracts stable where they are already correct (`POST /api/session`, `/ws?sessionId=...`, `/healthz`, `/readyz`, `/api/users/count`) unless the plan explicitly removes a deprecated compatibility path.
- Guardrail added: remove only artifacts proven to be legacy or placeholder; do **not** delete active chat behaviors.
- Acceptance gap addressed: every architecture task below includes executable verification and QA scenarios.
- Scope creep addressed: prebuild extension points only; do not implement auth, RBAC, moderation workflows, or event-driven business features in this refactor.

## Work Objectives
### Core Objective
Produce a clean, future-ready codebase where the active chat product has one obvious frontend path, one obvious backend path, explicit module ownership, no legacy Bun ambiguity, and no business logic hidden inside entrypoints or god-components.

### Deliverables
- New backend module layout in `server-py/app/`:
  - `presentation/`
  - `application/`
  - `domain/`
  - `infrastructure/`
  - `shared/`
- New frontend module layout in `client/src/`:
  - `app/`
  - `pages/`
  - `features/`
  - `shared/`
- Deleted `server/` legacy Bun backend
- Deleted or replaced obsolete compatibility artifacts
- Updated tests, docs, and runtime verification commands

### Definition of Done (verifiable conditions with commands)
- Backend test suite passes: `python -m pytest -q` (run in `server-py/`)
- Backend static checks pass: `ruff check .` (run in `server-py/`)
- Backend bytecode compile passes: `python -m compileall app tests` (run in `server-py/`)
- Frontend tests pass: `npm run test -- --run` (run in `client/`)
- Frontend production build passes: `npm run build` (run in `client/`)
- Compose configuration is valid: `docker compose config` (run at repo root)
- Root docs match runtime truth: README and ARCHITECTURE mention only `client/ + server-py/ + redis` as active runtime
- Repository no longer contains `server/`
- Repository no longer contains `client/src/components/pages/welcome.tsx`
- Repository no longer exposes `/users` compatibility route

### Must Have
- One active backend only: Python FastAPI backend
- One active frontend architecture only: feature-first React frontend
- Stable chat behavior preserved:
  - anonymous session bootstrap
  - queue / match
  - message send / receive
  - typing indicator
  - disconnect handling
  - reconnect window behavior
  - online count display
- Future extension points defined in backend interfaces only:
  - auth
  - RBAC / permission gate
  - moderation gateway
  - audit sink
  - feature flag evaluator
  - event bus
  - background job dispatcher
  - observability hooks

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT keep `server/` in any form after cutover
- Must NOT keep both old and new frontend folder taxonomies active at the same time
- Must NOT leave business logic in `server-py/app/main.py`
- Must NOT leave WebSocket protocol orchestration inside a giant React provider
- Must NOT access Redis directly from presentation or domain layers
- Must NOT introduce placeholder enterprise modules that are wired but unused in runtime behavior
- Must NOT silently change active HTTP/WS contracts except explicit removal of deprecated `/users`
- Must NOT implement auth, moderation, event workflows, or RBAC features in this refactor
- Must NOT preserve dead template docs (`client/README.md`) or placeholder routes/pages

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **tests-after**
  - Backend: existing `pytest + pytest-asyncio + ruff`
  - Frontend: add `vitest + @testing-library/react + jsdom`
- QA policy: Every task includes agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: architecture freeze and scaffolding
- 1. Rewrite runtime architecture docs and target structure map
- 2. Delete Bun legacy backend and root references
- 3. Create backend layered skeleton and extension-point interfaces
- 4. Create frontend feature-first skeleton and testing scaffold

Wave 2: core runtime migration
- 5. Move backend HTTP routes into presentation/application boundaries
- 6. Move backend WebSocket chat flow into layered modules
- 7. Move Redis + connection concerns into infrastructure ports/adapters
- 8. Move frontend chat runtime into feature modules and shrink provider responsibilities

Wave 3: active contract cleanup and page/store cleanup
- 9. Move frontend shared concerns into `shared/` and feature-owned modules
- 10. Remove deprecated runtime artifacts and placeholders
- 11. Add/update automated tests for new seams and preserved chat behaviors

Wave 4: final consistency pass
- 12. Rewrite final docs, scripts, and operational guidance to match the new truth

### Dependency Matrix (full, all tasks)
- 1 blocks 12
- 2 blocks 10 and 12
- 3 blocks 5, 6, 7
- 4 blocks 8, 9, 11
- 5 blocks 12
- 6 blocks 10, 11, 12
- 7 blocks 6 and 11
- 8 blocks 9, 10, 11
- 9 blocks 10, 11, 12
- 10 blocks 12
- 11 blocks Final Verification Wave
- 12 blocks Final Verification Wave

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 4 tasks → `writing`, `unspecified-high`, `quick`, `visual-engineering`
- Wave 2 → 4 tasks → `deep`, `unspecified-high`, `fullstack`, `visual-engineering`
- Wave 3 → 3 tasks → `visual-engineering`, `quick`, `unspecified-high`
- Wave 4 → 1 task → `writing`
- Final Verification → 4 tasks → `oracle`, `unspecified-high`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Freeze the target runtime architecture and repository map

  **What to do**:
  - Rewrite `README.md` and `ARCHITECTURE.md` so they describe only the final active runtime and target directory ownership.
  - Document the final repository map explicitly:
    - `client/` = React application
    - `server-py/` = Python backend
    - `docker-compose.yml` = local orchestration
    - no Bun backend
  - Add a compact “current active contracts” section covering `/api/session`, `/ws?sessionId=...`, `/healthz`, `/readyz`, `/api/users/count`.
  - Add a “target frontend structure” and “target backend structure” section so all later tasks follow one document.

  **Must NOT do**:
  - Must NOT describe `server/` as a rollback path anymore.
  - Must NOT leave architecture docs in a mixed “old plus new” state.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: high-precision architecture documentation rewrite
  - Skills: `[]` — No special skill needed
  - Omitted: `['frontend-dev']` — This is documentation, not implementation design polish

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [12] | Blocked By: []

  **References**:
  - Pattern: `README.md:3-9` — current active runtime statement to replace with final truth
  - Pattern: `README.md:76-86` — current backend behavior section to preserve semantically
  - Pattern: `ARCHITECTURE.md:5-11` — active runtime statement
  - Pattern: `ARCHITECTURE.md:55-91` — directory roles section to rewrite around new ownership
  - Pattern: `ARCHITECTURE.md:93-108` — active protocol list that must stay current-only

  **Acceptance Criteria**:
  - [ ] `README.md` mentions only `client/`, `server-py/`, and `redis` as active runtime pieces.
  - [ ] `ARCHITECTURE.md` includes explicit final frontend and backend directory maps.
  - [ ] No root doc describes `server/` as active or rollback runtime.

  **QA Scenarios**:
  ```
  Scenario: Docs reflect final active runtime
    Tool: Bash
    Steps: run `grep -n "server-py\|client\|redis\|server/" README.md ARCHITECTURE.md`
    Expected: active runtime sections mention only client/server-py/redis as active; any `server/` mention is historical removal only, not runtime guidance
    Evidence: .sisyphus/evidence/task-1-runtime-docs.txt

  Scenario: Contract section still documents active endpoints
    Tool: Bash
    Steps: run `grep -n "/api/session\|/ws\?sessionId\|/healthz\|/readyz\|/api/users/count" README.md ARCHITECTURE.md`
    Expected: all active HTTP/WS contracts are present in docs
    Evidence: .sisyphus/evidence/task-1-contract-docs.txt
  ```

  **Commit**: YES | Message: `docs(architecture): define final active runtime and target structure` | Files: `[README.md, ARCHITECTURE.md]`

- [ ] 2. Delete the legacy Bun backend and remove all root-level references to it

  **What to do**:
  - Delete the entire `server/` directory.
  - Remove Bun-specific references from root docs and any developer guidance that still points to `server/`.
  - Remove Bun-specific build/runtime assumptions from the repository narrative.

  **Must NOT do**:
  - Must NOT move `server/` into another legacy folder.
  - Must NOT keep partial Bun files “just in case”.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: deterministic deletion and reference cleanup
  - Skills: `[]`
  - Omitted: `['git-master']` — no git-only analysis required during implementation of this task

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [10, 12] | Blocked By: []

  **References**:
  - Pattern: `server/README.md:1-17` — confirms legacy-only status
  - Pattern: `server/src/index.ts:1-13` — legacy entrypoint to remove
  - Pattern: `server/src/lib/app.ts:12-221` — legacy runtime implementation to remove
  - Pattern: `README.md:84-86` — legacy section to remove or rewrite
  - Pattern: `ARCHITECTURE.md:89-91` — legacy Bun section to remove or rewrite

  **Acceptance Criteria**:
  - [ ] `server/` no longer exists.
  - [ ] Root docs no longer instruct anyone to inspect, run, or keep Bun backend code.

  **QA Scenarios**:
  ```
  Scenario: Legacy backend fully removed
    Tool: Bash
    Steps: run `test ! -d server`
    Expected: command exits successfully because `server/` is gone
    Evidence: .sisyphus/evidence/task-2-server-removed.txt

  Scenario: No runnable Bun references remain
    Tool: Bash
    Steps: run `grep -R -n "bun\|server/README.md\|legacy Bun" README.md ARCHITECTURE.md . || true`
    Expected: no root instruction remains that tells operators or developers to use Bun as runtime
    Evidence: .sisyphus/evidence/task-2-bun-references.txt
  ```

  **Commit**: YES | Message: `chore(repo): remove legacy bun backend` | Files: `[server/**, README.md, ARCHITECTURE.md]`

- [ ] 3. Create the final backend layered skeleton and reserved extension-point interfaces

  **What to do**:
  - Reorganize `server-py/app/` into the exact target structure below:
    - `app/bootstrap/`
    - `app/presentation/http/routes/`
    - `app/presentation/ws/`
    - `app/application/chat/`
    - `app/application/platform/`
    - `app/domain/chat/`
    - `app/domain/platform/`
    - `app/infrastructure/redis/`
    - `app/infrastructure/realtime/`
    - `app/infrastructure/observability/`
    - `app/infrastructure/jobs/`
    - `app/shared/`
  - Move app startup logic toward `app/bootstrap/app_factory.py` and `app/bootstrap/lifespan.py`.
  - Define interface/port modules only for:
    - `PermissionGate`
    - `FeatureFlagEvaluator`
    - `ModerationGateway`
    - `AuditSink`
    - `EventBus`
    - `JobDispatcher`
    - `ConnectionHub`
    - `SessionRepository`
    - `PresenceRepository`
  - Provide no-op or in-process adapters only where required to keep current chat runtime working.

  **Must NOT do**:
  - Must NOT implement auth/RBAC/moderation product flows.
  - Must NOT leave final architecture decisions to later tasks.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: large architectural rewrite with strict boundaries
  - Skills: `[]`
  - Omitted: `['fullstack-dev']` — backend architecture is the core concern here

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5, 6, 7] | Blocked By: []

  **References**:
  - Pattern: `server-py/app/main.py:29-350` — current orchestration that must be slimmed down
  - Pattern: `server-py/app/core/config.py:8-32` — settings ownership to relocate into shared/bootstrap boundary
  - Pattern: `server-py/app/core/protocol.py:5-33` — protocol enums still needed but under new ownership
  - Pattern: `server-py/app/services/chat_runtime.py:275-539` — current service seam to split into use cases and repositories

  **Acceptance Criteria**:
  - [ ] Final backend directories exist exactly as defined above.
  - [ ] Startup entrypoint delegates to bootstrap factory/lifespan modules.
  - [ ] Required platform extension-point interfaces exist and are imported only from application/infrastructure layers.

  **QA Scenarios**:
  ```
  Scenario: Layered backend skeleton exists
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
base = Path('server-py/app')
required = [
    'bootstrap', 'presentation/http/routes', 'presentation/ws', 'application/chat',
    'application/platform', 'domain/chat', 'domain/platform', 'infrastructure/redis',
    'infrastructure/realtime', 'infrastructure/observability', 'infrastructure/jobs', 'shared'
]
missing = [p for p in required if not (base / p).exists()]
print(missing)
raise SystemExit(1 if missing else 0)
PY`
    Expected: command exits 0 with no missing directories
    Evidence: .sisyphus/evidence/task-3-backend-skeleton.txt

  Scenario: Entry module is no longer orchestration-heavy
    Tool: Bash
    Steps: run `grep -n "create_app\|app_factory\|lifespan" server-py/app/main.py server-py/app/bootstrap/app_factory.py server-py/app/bootstrap/lifespan.py`
    Expected: `main.py` is a thin wrapper; bootstrap files own startup orchestration
    Evidence: .sisyphus/evidence/task-3-bootstrap-boundary.txt
  ```

  **Commit**: YES | Message: `refactor(server-py): establish layered backend architecture` | Files: `[server-py/app/**]`

- [ ] 4. Create the final frontend feature-first skeleton and test tooling baseline

  **What to do**:
  - Reorganize `client/src/` into the exact target structure below:
    - `src/app/`
    - `src/pages/`
    - `src/features/chat/`
    - `src/features/settings/`
    - `src/features/presence/`
    - `src/shared/api/`
    - `src/shared/config/`
    - `src/shared/i18n/`
    - `src/shared/lib/`
    - `src/shared/ui/`
    - `src/shared/types/`
  - Plan to retire `components/atoms`, `components/molecules`, `components/template`, and most `lib/*` ownership after migrations complete.
  - Add frontend test tooling with exact packages: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
  - Add scripts in `client/package.json`:
    - `test`
    - `test:watch`

  **Must NOT do**:
  - Must NOT keep feature code spread across both `components/*` and `features/*` after migration.
  - Must NOT introduce a second state library.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: frontend structure rewrite with UI ownership decisions
  - Skills: `[]`
  - Omitted: `['frontend-dev']` — motion/media skillset is not the need here

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8, 9, 11] | Blocked By: []

  **References**:
  - Pattern: `client/src/App.tsx:4-21` — current app entry to split into app/pages ownership
  - Pattern: `client/src/providers/index.tsx:10-21` — provider composition to move under `src/app/`
  - Pattern: `client/src/components/template/layout.tsx:8-19` — layout ownership to rehome
  - Pattern: `client/package.json:6-55` — scripts and dependencies to extend for test tooling

  **Acceptance Criteria**:
  - [ ] Final frontend directories exist exactly as defined above.
  - [ ] `client/package.json` contains `test` and `test:watch` scripts.
  - [ ] Test runner is executable with `npm run test -- --run`.

  **QA Scenarios**:
  ```
  Scenario: Feature-first frontend skeleton exists
    Tool: Bash
    Steps: run `python - <<'PY'
from pathlib import Path
base = Path('client/src')
required = [
    'app', 'pages', 'features/chat', 'features/settings', 'features/presence',
    'shared/api', 'shared/config', 'shared/i18n', 'shared/lib', 'shared/ui', 'shared/types'
]
missing = [p for p in required if not (base / p).exists()]
print(missing)
raise SystemExit(1 if missing else 0)
PY`
    Expected: command exits 0 with no missing directories
    Evidence: .sisyphus/evidence/task-4-frontend-skeleton.txt

  Scenario: Frontend test tooling is wired
    Tool: Bash
    Steps: run `npm run test -- --run`
    Expected: command executes from `client/`; no “missing script: test” error occurs
    Evidence: .sisyphus/evidence/task-4-frontend-test-script.txt
  ```

  **Commit**: YES | Message: `refactor(client): establish feature-first frontend structure` | Files: `[client/src/**, client/package.json]`

- [ ] 5. Move HTTP routes into presentation and application boundaries

  **What to do**:
  - Split current HTTP route logic into:
    - presentation route modules under `presentation/http/routes/`
    - application services/use cases under `application/chat/` or `application/platform/`
  - Keep active HTTP endpoints unchanged:
    - `POST /api/session`
    - `GET /healthz`
    - `GET /readyz`
    - `GET /api/users/count`
  - Ensure route functions become thin transport adapters only.

  **Must NOT do**:
  - Must NOT keep Redis calls directly in route modules.
  - Must NOT move route validation or orchestration back into `main.py`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: moderate backend refactor with stable contract preservation
  - Skills: `[]`
  - Omitted: `['git-master']`

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [12] | Blocked By: [3]

  **References**:
  - Pattern: `server-py/app/api/routes/session.py:9-11` — current session bootstrap route
  - Pattern: `server-py/app/api/routes/health.py:15-41` — current health/ready/users-count routes
  - API/Type: `server-py/app/core/config.py:8-32` — current settings access pattern to preserve semantically
  - Test: `server-py/tests/test_session.py:1-25` — expected session contract
  - Test: `server-py/tests/test_health.py:7-77` — expected health/count contracts

  **Acceptance Criteria**:
  - [ ] All active HTTP endpoints continue returning their current payload shapes.
  - [ ] Route modules contain transport concerns only; Redis/service orchestration lives below them.
  - [ ] `server-py/app/main.py` no longer defines route logic inline.

  **QA Scenarios**:
  ```
  Scenario: HTTP routes preserve current behavior
    Tool: Bash
    Steps: run `python -m pytest -q tests/test_session.py tests/test_health.py`
    Expected: all route contract tests pass
    Evidence: .sisyphus/evidence/task-5-http-contracts.txt

  Scenario: Route layer is thin
    Tool: Bash
    Steps: run `grep -R -n "redis\.|PresenceService\|ChatRuntimeService" server-py/app/presentation/http/routes || true`
    Expected: no route module directly instantiates or calls Redis/service internals
    Evidence: .sisyphus/evidence/task-5-thin-routes.txt
  ```

  **Commit**: YES | Message: `refactor(server-py): separate http presentation from application logic` | Files: `[server-py/app/presentation/http/**, server-py/app/application/**, server-py/tests/**]`

- [ ] 6. Move WebSocket chat flow into explicit endpoint, use cases, and domain behavior

  **What to do**:
  - Move WebSocket endpoint code out of `app/main.py` into `presentation/ws/chat_endpoint.py`.
  - Split chat behaviors into application use cases, at minimum:
    - bootstrap connection
    - update profile
    - enter queue
    - try match
    - send message
    - set typing
    - disconnect / expire stale session
  - Move chat domain state definitions into `domain/chat/`.
  - Keep active WebSocket contract unchanged for these payload types only:
    - `message`
    - `user-info`
    - `error`
    - `queue`
    - `match`
    - `disconnect`
    - `typing`

  **Must NOT do**:
  - Must NOT preserve WebSocket orchestration as a monolith.
  - Must NOT reintroduce `call` or `update-name` payload handling.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: protocol-heavy backend decomposition
  - Skills: `[]`
  - Omitted: `['fullstack-dev']`

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10, 11, 12] | Blocked By: [3, 7]

  **References**:
  - Pattern: `server-py/app/main.py:103-346` — current websocket handlers to decompose
  - Pattern: `server-py/app/services/chat_runtime.py:332-538` — current queue/match/message/typing/disconnect logic
  - API/Type: `server-py/app/core/protocol.py:5-33` — active payload contract
  - Test: `server-py/tests/test_websocket.py:222-386` — required websocket behaviors
  - Test: `server-py/tests/test_protocol.py:4-29` — protocol contract expectations

  **Acceptance Criteria**:
  - [ ] WebSocket endpoint code no longer lives inline in `app/main.py`.
  - [ ] Active payload contract remains limited to the 7 active events listed above.
  - [ ] Existing websocket behavior tests pass after module split.

  **QA Scenarios**:
  ```
  Scenario: WebSocket contract still works end-to-end
    Tool: Bash
    Steps: run `python -m pytest -q tests/test_websocket.py tests/test_protocol.py`
    Expected: queue, match, message, typing, disconnect, and reconnect tests pass
    Evidence: .sisyphus/evidence/task-6-websocket-contracts.txt

  Scenario: Main module is no longer a websocket monolith
    Tool: Bash
    Steps: run `grep -n "@app.websocket\|_handle_message\|_handle_typing\|_handle_queue" server-py/app/main.py || true`
    Expected: websocket routing/handler implementations have been moved out of `main.py`
    Evidence: .sisyphus/evidence/task-6-main-thinned.txt
  ```

  **Commit**: YES | Message: `refactor(server-py): layer websocket chat runtime` | Files: `[server-py/app/presentation/ws/**, server-py/app/application/chat/**, server-py/app/domain/chat/**, server-py/tests/**]`

- [ ] 7. Move Redis and realtime concerns behind infrastructure adapters and ports

  **What to do**:
  - Move Redis persistence logic out of monolithic runtime service into repository/adapter modules under `infrastructure/redis/`.
  - Replace direct application dependency on `connection_registry.py` with a `ConnectionHub` port under application/platform.
  - Keep the runtime single-instance for now, but the concrete implementation must live under `infrastructure/realtime/in_memory_connection_hub.py`.
  - Add explicit placeholder adapters/interfaces for future distributed/evented evolution:
    - `RedisEventBus` placeholder (not wired into product logic yet)
    - `NoOpAuditSink`
    - `NoOpFeatureFlagEvaluator`
    - `NoOpPermissionGate`
    - `NoOpModerationGateway`
    - `InlineJobDispatcher`

  **Must NOT do**:
  - Must NOT leave application services importing Redis client classes directly.
  - Must NOT pretend multi-instance scaling is solved; document that distributed connection routing remains future work behind the new port.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: infrastructure boundary extraction with future-proof seams
  - Skills: `[]`
  - Omitted: `['git-master']`

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [6, 11] | Blocked By: [3]

  **References**:
  - Pattern: `server-py/app/services/chat_runtime.py:62-274` — current Redis store internals to extract
  - Pattern: `server-py/app/services/connection_registry.py:4-23` — current in-memory websocket registry to hide behind a port
  - Pattern: `server-py/app/services/presence.py:6-33` — current presence adapter pattern to preserve conceptually
  - Pattern: `server-py/app/deps/redis.py:1-31` — current client provisioning seam

  **Acceptance Criteria**:
  - [ ] Application modules no longer import `redis.asyncio.Redis` directly.
  - [ ] Application modules depend on ports/interfaces for sessions, presence, and connection hub behavior.
  - [ ] Infrastructure contains the only concrete in-memory connection implementation.
  - [ ] Future extension-point adapters exist but remain no-op/inert for product behavior.

  **QA Scenarios**:
  ```
  Scenario: Redis is infrastructure-only
    Tool: Bash
    Steps: run `grep -R -n "redis.asyncio\|from redis" server-py/app/application server-py/app/domain || true`
    Expected: no direct Redis imports appear in application/domain layers
    Evidence: .sisyphus/evidence/task-7-redis-boundary.txt

  Scenario: Connection hub seam exists
    Tool: Bash
    Steps: run `grep -R -n "ConnectionHub\|in_memory_connection_hub" server-py/app`
    Expected: a port/interface exists and the in-memory adapter lives under infrastructure/realtime
    Evidence: .sisyphus/evidence/task-7-connection-hub.txt
  ```

  **Commit**: YES | Message: `refactor(server-py): extract infrastructure adapters and future ports` | Files: `[server-py/app/infrastructure/**, server-py/app/application/**, server-py/app/shared/**]`

- [ ] 8. Refactor frontend chat runtime into feature-owned modules and shrink provider responsibilities

  **What to do**:
  - Decompose `chat-provider.tsx` into feature-owned modules under `features/chat/`, with this exact ownership split:
    - `features/chat/api/` — session bootstrap and transport-specific helpers
    - `features/chat/model/` — chat store/state/types/selectors
    - `features/chat/services/` — websocket transport + protocol translation
    - `features/chat/hooks/` — runtime hooks such as session bootstrap and typing behavior
    - `features/chat/ui/` — chat page widgets/components
  - Keep a provider only if still needed for dependency injection; it must become thin and orchestration-light.
  - Move page-specific layout state out of chat runtime modules.

  **Must NOT do**:
  - Must NOT keep protocol switch logic in a 200+ line provider.
  - Must NOT let feature UI import low-level transport details directly.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: frontend architecture + component ownership rewrite
  - Skills: `[]`
  - Omitted: `['frontend-dev']`

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [9, 10, 11] | Blocked By: [4]

  **References**:
  - Pattern: `client/src/providers/chat-provider.tsx:37-235` — current god-component to split
  - Pattern: `client/src/lib/store/index.ts:12-33` — current store composition and persistence
  - Pattern: `client/src/components/molecules/chat.tsx:70-253` — current chat UI behavior to preserve
  - Pattern: `client/src/components/pages/home.tsx:16-198` — current page/layout logic to separate from feature runtime
  - Pattern: `client/src/types/index.ts:4-30` — current shared types and payload contract

  **Acceptance Criteria**:
  - [ ] No single frontend module owns session bootstrap, socket lifecycle, protocol dispatch, UI updates, and store mutation together.
  - [ ] Chat feature logic lives under `features/chat/` only.
  - [ ] The active chat experience still supports match, send, receive, typing, disconnect, and reconnect behavior.

  **QA Scenarios**:
  ```
  Scenario: Chat flow still works in browser
    Tool: Playwright
    Steps: open two browser contexts on `/`; in each context complete profile setup with names `PlanUserA` and `PlanUserB`; click `Start chatting`; wait for both contexts to show connected partner names; send `hello from A` from context A; verify context B receives `hello from A`; type into context B without sending; verify context A shows typing indicator
    Expected: match, message, and typing flows all work without console/runtime errors
    Evidence: .sisyphus/evidence/task-8-chat-flow.png

  Scenario: Chat runtime is no longer concentrated in provider layer
    Tool: Bash
    Steps: run `grep -R -n "useWebSocket\|switch (data.type)\|createSession\|sessionStorage" client/src/providers client/src/features/chat || true`
    Expected: provider layer is thin; transport/protocol logic lives under `features/chat/services` or `features/chat/hooks`
    Evidence: .sisyphus/evidence/task-8-chat-boundaries.txt
  ```

  **Commit**: YES | Message: `refactor(client): move chat runtime into feature modules` | Files: `[client/src/features/chat/**, client/src/app/**, client/src/pages/**]`

- [ ] 9. Move shared frontend concerns into `shared/` and convert page/layout ownership cleanly

  **What to do**:
  - Move these concerns into `shared/` with exact ownership:
    - HTTP helpers → `shared/api/`
    - environment/runtime config → `shared/config/`
    - i18n resources/hooks → `shared/i18n/`
    - utility helpers like `cn` → `shared/lib/`
    - reusable UI primitives → `shared/ui/`
    - app-wide scalar types → `shared/types/`
  - Move route/bootstrap/provider composition into `app/`.
  - Keep page containers in `pages/` and feature UIs in `features/*/ui/`.
  - Rename persisted storage key from `msn-storage` to `sklinkchat-storage`.

  **Must NOT do**:
  - Must NOT leave active imports pointing back to retired `components/*` or `lib/*` paths.
  - Must NOT keep app bootstrap mixed with page layout.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: frontend ownership cleanup and import normalization
  - Skills: `[]`
  - Omitted: `['frontend-dev']`

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [10, 11, 12] | Blocked By: [4, 8]

  **References**:
  - Pattern: `client/src/lib/api.ts:1-26` — API helper ownership
  - Pattern: `client/src/lib/config.ts:1-76` — environment/config ownership
  - Pattern: `client/src/lib/i18n.ts:6-191` — i18n ownership and split target
  - Pattern: `client/src/lib/utils.ts:1-5` — shared lib helper
  - Pattern: `client/src/components/ui/*` — shared UI primitives to preserve
  - Pattern: `client/src/lib/store/index.ts:21-29` — old `msn-storage` key to rename

  **Acceptance Criteria**:
  - [ ] Active imports point only to `app/`, `pages/`, `features/`, or `shared/` frontend roots.
  - [ ] `msn-storage` is fully replaced by `sklinkchat-storage`.
  - [ ] `components/*`, `lib/*`, and `providers/*` are either deleted or reduced to redirect-free final ownership only where still appropriate.

  **QA Scenarios**:
  ```
  Scenario: Frontend import graph uses final ownership roots
    Tool: Bash
    Steps: run `grep -R -n "from '@/components\|from '@/lib\|from '@/providers" client/src || true`
    Expected: no active imports remain to retired ownership roots
    Evidence: .sisyphus/evidence/task-9-import-roots.txt

  Scenario: Frontend still builds after ownership cleanup
    Tool: Bash
    Steps: run `npm run build`
    Expected: production build passes with the final import graph
    Evidence: .sisyphus/evidence/task-9-build.txt
  ```

  **Commit**: YES | Message: `refactor(client): normalize shared and app ownership` | Files: `[client/src/app/**, client/src/pages/**, client/src/shared/**, client/src/features/**]`

- [ ] 10. Remove deprecated runtime artifacts, placeholders, and compatibility paths

  **What to do**:
  - Delete `client/src/components/pages/welcome.tsx` and remove the `/welcome` route from the app.
  - Remove the `/users` compatibility route from the Python backend.
  - Switch online count frontend code to use `/api/users/count` instead of `/users`.
  - Remove deprecated payload remnants from frontend/backend protocol definitions:
    - `call`
    - `update-name`
    - `LEGACY_PAYLOAD_TYPES`
  - Delete `client/README.md` template documentation.

  **Must NOT do**:
  - Must NOT break the live online-count display.
  - Must NOT leave dead routes or unused enum values in active protocol code.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: deterministic cleanup of proven dead paths
  - Skills: `[]`
  - Omitted: `['git-master']`

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [12] | Blocked By: [2, 6, 8, 9]

  **References**:
  - Pattern: `client/src/App.tsx:14-19` — current `/welcome` route to remove
  - Pattern: `client/src/components/pages/welcome.tsx:1-12` — placeholder page to delete
  - Pattern: `client/src/components/molecules/user-count.tsx:11-22` — online-count code to retarget
  - Pattern: `client/src/lib/api.ts:18-25` — current `/users` fetch helper to replace
  - Pattern: `server-py/app/api/routes/health.py:31-41` — current `/api/users/count` and `/users` compat routes
  - Pattern: `client/src/types/index.ts:22-30` — frontend payload remnants
  - Pattern: `server-py/app/core/protocol.py:11-22` — backend legacy marker to remove

  **Acceptance Criteria**:
  - [ ] `/welcome` route and page are gone.
  - [ ] `/users` compatibility route is gone.
  - [ ] Online user count still displays correctly via `/api/users/count`.
  - [ ] Active protocol enums contain only 7 active payload types.
  - [ ] `client/README.md` no longer exists.

  **QA Scenarios**:
  ```
  Scenario: Deprecated files and routes are removed
    Tool: Bash
    Steps: run `test ! -f client/src/components/pages/welcome.tsx && test ! -f client/README.md && grep -R -n "@router.get(\"/users\"\|path=\"welcome\"\|Call = 'call'\|LEGACY_PAYLOAD_TYPES" client server-py || true`
    Expected: deleted files are absent and no deprecated route/enum remnants remain
    Evidence: .sisyphus/evidence/task-10-cleanup.txt

  Scenario: Online count still works through active endpoint
    Tool: Playwright
    Steps: start app stack; open `/`; wait for header online-count badge; confirm badge shows a numeric value; inspect network calls and verify request path contains `/api/users/count`
    Expected: the badge renders successfully and uses the active count endpoint
    Evidence: .sisyphus/evidence/task-10-online-count.png
  ```

  **Commit**: YES | Message: `chore(runtime): remove deprecated routes, pages, and protocol remnants` | Files: `[client/src/**, server-py/app/**, client/README.md]`

- [ ] 11. Add and update automated tests for the new seams and preserved chat behavior

  **What to do**:
  - Preserve and update backend tests to target the new module boundaries without weakening behavior checks.
  - Add frontend tests for at minimum:
    - session bootstrap hook/service
    - online count API integration layer
    - settings save behavior
    - chat runtime reducer/store behavior
  - Add one browser-level smoke path for the active chat workflow if Playwright is already available; otherwise document that browser smoke remains in agent QA only and keep Vitest coverage mandatory.

  **Must NOT do**:
  - Must NOT reduce websocket coverage versus current backend suite.
  - Must NOT add purely snapshot-only frontend tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: mixed backend/frontend verification work
  - Skills: `[]`
  - Omitted: `['playwright']` — browser QA is already specified separately in task verification

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [Final Verification Wave] | Blocked By: [4, 6, 7, 8, 9]

  **References**:
  - Test: `server-py/tests/test_websocket.py:222-386` — backend behavior floor to preserve
  - Test: `server-py/tests/test_health.py:7-77` — route contract floor to preserve
  - Test: `server-py/tests/test_presence.py:34-73` — presence behavior floor to preserve
  - Pattern: `client/src/components/molecules/settings-dialog.tsx:47-60` — settings save path to cover
  - Pattern: `client/src/components/molecules/user-count.tsx:11-22` — online count behavior to cover

  **Acceptance Criteria**:
  - [ ] Backend tests still cover websocket, health, presence, session, protocol, and error behavior.
  - [ ] Frontend test suite executes via Vitest.
  - [ ] At least one frontend test exists for each mandatory seam listed above.

  **QA Scenarios**:
  ```
  Scenario: Backend regression suite passes
    Tool: Bash
    Steps: run `python -m pytest -q`
    Expected: full backend test suite passes
    Evidence: .sisyphus/evidence/task-11-backend-tests.txt

  Scenario: Frontend seam tests pass
    Tool: Bash
    Steps: run `npm run test -- --run`
    Expected: Vitest passes with coverage over chat runtime, settings, and online-count seams
    Evidence: .sisyphus/evidence/task-11-frontend-tests.txt
  ```

  **Commit**: YES | Message: `test(platform): cover refactored chat seams and contracts` | Files: `[server-py/tests/**, client/src/**/*.test.*, client/package.json]`

- [ ] 12. Rewrite final operational docs and repository guidance to match the cutover

  **What to do**:
  - Update root README, ARCHITECTURE, and any setup instructions so they describe only the final structure and commands.
  - Ensure `.env.example` still matches active backend/frontend contracts.
  - Ensure `docker-compose.yml` still matches the final active services and ports.
  - Update developer guidance to reference the new frontend and backend ownership boundaries.

  **Must NOT do**:
  - Must NOT leave outdated directory names, removed routes, or old storage keys in docs.
  - Must NOT leave commands pointing to deleted files.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: final high-accuracy operational documentation pass
  - Skills: `[]`
  - Omitted: `['frontend-dev']`

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [Final Verification Wave] | Blocked By: [1, 2, 5, 6, 9, 10]

  **References**:
  - Pattern: `docker-compose.yml:12-42` — active services and env values to keep current
  - Pattern: `.env.example:1-8` — active environment variable set
  - Pattern: `README.md:11-60` — local development and verification commands to rewrite against final structure
  - Pattern: `ARCHITECTURE.md:13-129` — topology and flow sections to update against final module ownership

  **Acceptance Criteria**:
  - [ ] Docs, env examples, and compose config all agree on ports, routes, and service names.
  - [ ] No final doc mentions deleted files, deleted routes, or deleted Bun code.

  **QA Scenarios**:
  ```
  Scenario: Compose and env docs are internally consistent
    Tool: Bash
    Steps: run `docker compose config`
    Expected: compose configuration validates successfully against the final service topology
    Evidence: .sisyphus/evidence/task-12-compose-config.txt

  Scenario: Final docs contain no deleted artifacts
    Tool: Bash
    Steps: run `grep -R -n "server/\|/users\|welcome\|msn-storage\|call\|update-name" README.md ARCHITECTURE.md .env.example || true`
    Expected: no deleted runtime artifact remains documented as active
    Evidence: .sisyphus/evidence/task-12-doc-cleanliness.txt
  ```

  **Commit**: YES | Message: `docs(repo): align operations with refactored architecture` | Files: `[README.md, ARCHITECTURE.md, .env.example, docker-compose.yml]`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit after each numbered task; do not batch unrelated waves together.
- Preserve these commit scopes:
  - `docs(architecture)`
  - `chore(repo)`
  - `refactor(server-py)`
  - `refactor(client)`
  - `chore(runtime)`
  - `test(platform)`
- No amend-based cleanup plan; create follow-up commits if hooks or fixes are needed.

## Success Criteria
- There is exactly one active backend implementation in the repository.
- A new engineer can identify the active runtime by reading only `README.md` and `ARCHITECTURE.md`.
- Frontend chat logic is feature-owned and no longer concentrated in a monolithic provider.
- Backend runtime logic is layered and no longer concentrated in `main.py` plus one giant service.
- Redis usage is infrastructure-owned and hidden behind explicit ports/adapters.
- Future platform capabilities have reserved extension points without contaminating current chat behavior.
- The repository no longer contains legacy, placeholder, or compatibility artifacts that obscure the active path.
