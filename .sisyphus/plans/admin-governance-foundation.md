# Minimal Admin Governance Foundation

## TL;DR
> **Summary**: Build the first admin-capable governance layer on top of the existing SKLinkChat stack by reusing the current `client/` app and adding protected `/admin` routes, backend moderation APIs, account restriction enforcement, and audit browsing.
> **Deliverables**:
> - Admin identity and session contract
> - Governance schema updates for report review + account restriction
> - Protected admin HTTP APIs
> - `/admin/reports` and `/admin/audit` UI inside the existing client
> - Updated docs, env contract, and verification flow
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 6 → 7/8 → 9

## Context
### Original Request
- Assess whether the current project still needs optimization.
- Decide whether the repo is ready for the next construction phase.
- Decide whether backend management can begin now.
- Constraint: do not execute with other models/agents; only organize and write the plan.

### Interview Summary
- Current repo is already a real working stack: `client/` React + Vite, `server-py/` FastAPI + PostgreSQL + Redis, Alembic migrations, Docker compose, and active tests.
- The next phase is confirmed as **minimum admin governance**, not a full operations platform.
- Admin UI must **reuse the existing `client/` application** and live under a protected `/admin` route tree.
- This planning session must not delegate to other models/agents.

### Metis Review (user-constrained substitute)
- No secondary planning agent was invoked because the user explicitly prohibited other-model execution.
- Guardrails applied manually in this plan:
  - do not split into a separate admin frontend
  - do not introduce full RBAC / ACL framework
  - do not expand into analytics dashboards, CMS, or queue workers
  - keep admin bootstrap deterministic and executable without manual DB edits

## Work Objectives
### Core Objective
Ship a minimum viable admin governance layer that allows an authenticated admin to review chat reports, browse audit events, and restrict or restore chat access for accounts, all within the existing monorepo and current auth/session model.

### Deliverables
- Backend admin capability contract (`is_admin`, restricted-account visibility)
- Config-driven initial admin bootstrap via server settings
- Governance schema for report review metadata and account restriction metadata
- Admin repositories/services/routes for reports, audit events, and account restriction
- Client-side admin route guard and admin shell
- Admin reports list/detail review flow
- Admin audit log list with filters
- Updated README / `.env.example` / architecture contract / verification commands

### Definition of Done (verifiable conditions with commands)
- `cd server-py && ./.venv/bin/pytest tests/ -q`
- `cd server-py && ./.venv/bin/ruff check app tests`
- `cd server-py && python -m compileall app tests`
- `cd server-py && alembic upgrade head`
- `cd client && npm run test -- --run`
- `cd client && npm run build`
- `docker compose config`

### Must Have
- Admin capability derived from a deterministic server-side allowlist setting: `SERVER_PY_ADMIN_EMAILS`
- Existing auth cookie reused; no second login system
- Existing `client/` reused; no separate admin app
- Restricted accounts blocked from creating or using chat sessions
- Report review records reviewer, review time, and mandatory review note
- Admin endpoints reject non-admin authenticated users with 403
- Admin UI shows report queue and audit log from live APIs

### Must NOT Have
- No new standalone admin repository or frontend app
- No generic RBAC framework, permissions matrix, or role editor UI
- No analytics dashboard, charts, cohort metrics, or forum moderation scope
- No manual SQL step as the required bootstrap path for the first admin
- No human-only verification steps in acceptance criteria

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: **tests-after** using existing `pytest` + `vitest` + build checks
- QA policy: Every task below includes agent-executed happy-path and failure-path scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
Wave 1: identity + schema + repository/service foundations
- T1 Admin capability contract and bootstrap setting
- T2 Governance schema migration
- T3 Repository and service primitives

Wave 2: protected backend and gated app shell
- T4 Admin HTTP routes and backend tests
- T5 Restricted-account enforcement and blocked-user UX
- T6 Client routing, admin guard, and shell

Wave 3: admin feature UIs and docs
- T7 Admin reports review UI
- T8 Admin audit log UI and account action integration
- T9 Contracts, env docs, and verification updates

### Dependency Matrix (full)
| Task | Depends On | Blocks |
|---|---|---|
| T1 | none | T4, T6 |
| T2 | none | T3, T4, T5 |
| T3 | T2 | T4, T8 |
| T4 | T1, T2, T3 | T7, T8 |
| T5 | T1, T2 | T6 |
| T6 | T1, T4, T5 | T7, T8 |
| T7 | T4, T6 | T9 |
| T8 | T3, T4, T6 | T9 |
| T9 | T7, T8 | Final Verification |

### Agent Dispatch Summary
- Wave 1 → 3 tasks → `unspecified-high`, `deep`
- Wave 2 → 3 tasks → `unspecified-high`, `visual-engineering`
- Wave 3 → 3 tasks → `visual-engineering`, `writing`

## TODOs
> Implementation + Test = ONE task. Never separate.

- [ ] 1. Establish admin capability contract and bootstrap path

  **What to do**: Add a config-driven admin bootstrap based on normalized email allowlist rather than DB-managed roles. Introduce `SERVER_PY_ADMIN_EMAILS` in settings, normalize the configured emails, and expose `is_admin` plus `chat_access_restricted` in every auth/session response shape returned by register/login/verify/session/resend flows. Add a dedicated admin dependency that rejects authenticated non-admin users with 403.
  **Must NOT do**: Do not add a role table, multi-role assignment UI, or a second admin login system.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: backend contract change touching settings, auth responses, and dependencies
  - Skills: []
  - Omitted: [`git-master`] — no git operation required during implementation itself

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: T4, T6 | Blocked By: none

  **References**:
  - Pattern: `server-py/app/shared/config.py:22-99` — existing settings model and env parsing live here
  - Pattern: `server-py/app/presentation/http/routes/auth.py:54-153` — all auth/session JSON response shapes are assembled here
  - Pattern: `server-py/app/presentation/http/dependencies.py:18-33` — existing authenticated-account dependency pattern
  - Pattern: `client/src/features/auth/api/auth-client.ts:3-99` — current frontend auth payload contract
  - Pattern: `client/src/features/auth/auth-provider.tsx:18-185` — auth context consumes and persists auth session shape

  **Acceptance Criteria**:
  - [ ] `SERVER_PY_ADMIN_EMAILS` is defined, documented, and parsed deterministically
  - [ ] `/api/auth/session` returns `is_admin` and `chat_access_restricted` for authenticated and unauthenticated states without breaking current cookie flow
  - [ ] New admin-only dependency returns 403 for non-admin authenticated users and 401 for unauthenticated users
  - [ ] `cd server-py && ./.venv/bin/pytest tests/ -q -k "auth or admin"`

  **QA Scenarios**:
  ```
  Scenario: Admin email receives admin capability in session payload
    Tool: Bash
    Steps: Run backend tests that register an allowlisted email, call /api/auth/session, and assert is_admin=true.
    Expected: Test passes and session payload contains is_admin=true plus chat_access_restricted=false.
    Evidence: .sisyphus/evidence/task-1-admin-capability.txt

  Scenario: Non-admin is denied admin dependency
    Tool: Bash
    Steps: Run backend tests that authenticate a normal user and call an admin route.
    Expected: Response is 403 with stable admin-forbidden error code.
    Evidence: .sisyphus/evidence/task-1-admin-capability-error.txt
  ```

  **Commit**: NO | Message: `feat(admin): add admin capability contract` | Files: `server-py/app/shared/config.py`, `server-py/app/presentation/http/routes/auth.py`, `server-py/app/presentation/http/dependencies.py`, `client/src/features/auth/*`

- [ ] 2. Add governance schema for report review metadata and account restriction state

  **What to do**: Create a new Alembic migration that adds account-level chat restriction metadata and report review metadata. Use `accounts.chat_access_restricted_at` and `accounts.chat_access_restriction_reason` as the minimal restriction model. Add `chat_reports.reviewed_by_account_id` and `chat_reports.review_note`; require `review_note` for every non-open report transition and preserve the existing report statuses (`open`, `reviewed`, `dismissed`, `actioned`). Update SQLAlchemy models to match exactly.
  **Must NOT do**: Do not add generic moderation event tables, role tables, or soft-delete account semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: migration + ORM constraints must stay precise
  - Skills: []
  - Omitted: [`frontend-dev`] — no frontend work in this task

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: T3, T4, T5 | Blocked By: none

  **References**:
  - Pattern: `server-py/alembic/versions/0002_post_auth_hardening.py:20-258` — current migration style for backfill, constraints, and indexes
  - API/Type: `server-py/app/infrastructure/postgres/models.py:37-45` — current `Account` model shape
  - API/Type: `server-py/app/infrastructure/postgres/models.py:266-309` — current `ChatReport` fields and constraints
  - Test: `server-py/tests/test_migrations.py` — migration verification pattern already exists in repo

  **Acceptance Criteria**:
  - [ ] A new migration upgrades and downgrades cleanly
  - [ ] ORM models exactly match new columns and constraints
  - [ ] Report review note becomes required for reviewed/dismissed/actioned states
  - [ ] `cd server-py && alembic upgrade head`

  **QA Scenarios**:
  ```
  Scenario: Migration adds governance columns and constraints
    Tool: Bash
    Steps: Run alembic upgrade head and migration-focused pytest assertions against reflected schema.
    Expected: New account restriction columns and chat_report review columns exist with expected constraints.
    Evidence: .sisyphus/evidence/task-2-governance-schema.txt

  Scenario: Invalid reviewed report without note is rejected
    Tool: Bash
    Steps: Run backend tests that attempt to persist a non-open report status without review_note.
    Expected: Persistence fails with deterministic validation or DB constraint failure captured by the test.
    Evidence: .sisyphus/evidence/task-2-governance-schema-error.txt
  ```

  **Commit**: NO | Message: `feat(admin): add governance schema` | Files: `server-py/alembic/versions/*`, `server-py/app/infrastructure/postgres/models.py`

- [ ] 3. Add repository and service primitives for admin governance

  **What to do**: Extend repository/service layers to support admin report listing, report detail hydration, report review mutation, audit event listing, and account restriction mutation. Resolve reported-account identity via joins from `chat_reports -> chat_sessions -> accounts`. Standardize list pagination as page-size limited cursorless pagination (`limit` + `offset`) for v1, with `limit` hard-capped at 50. Return service DTOs shaped for direct API serialization.
  **Must NOT do**: Do not implement async background queues, aggregate dashboards, or free-form query builders.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this task defines the internal admin data contract and query behavior
  - Skills: []
  - Omitted: [`visual-engineering`] — backend-only foundation

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: T4, T8 | Blocked By: T2

  **References**:
  - Pattern: `server-py/app/bootstrap/container.py:96-210` — existing service/repository wiring pattern
  - Pattern: `server-py/app/application/chat/report_service.py:36-77` — current report submission service shape
  - Pattern: `server-py/app/infrastructure/postgres/repositories.py` — repository implementation location for durable data access
  - Test: `server-py/tests/test_reporting.py:50-124` — current reporting behavior and DB assertion style
  - API/Type: `server-py/app/infrastructure/postgres/models.py:266-332` — chat report and audit event data structures

  **Acceptance Criteria**:
  - [ ] Service layer can list reports by status/reason/date and fetch a single hydrated report detail
  - [ ] Service layer can list audit events with filters for event_type, account_id, chat_session_id, and time window
  - [ ] Service layer can restrict and restore chat access by account id with required reason text
  - [ ] `cd server-py && ./.venv/bin/pytest tests/ -q -k "report or audit or restriction"`

  **QA Scenarios**:
  ```
  Scenario: Admin service returns hydrated report detail
    Tool: Bash
    Steps: Run backend tests that seed a report and assert the detail DTO includes reporter account, reported account, and review metadata.
    Expected: DTO contains IDs, emails, display names, status, timestamps, and current restriction state.
    Evidence: .sisyphus/evidence/task-3-admin-services.txt

  Scenario: Audit list rejects oversized page size
    Tool: Bash
    Steps: Run backend tests that request limit > 50 through the service or API layer.
    Expected: Request is clamped or rejected according to the chosen contract; for this plan, reject with validation failure.
    Evidence: .sisyphus/evidence/task-3-admin-services-error.txt
  ```

  **Commit**: NO | Message: `feat(admin): add governance services` | Files: `server-py/app/application/**`, `server-py/app/infrastructure/postgres/repositories.py`, `server-py/app/bootstrap/container.py`

- [ ] 4. Implement protected admin HTTP routes and backend coverage

  **What to do**: Add a dedicated admin route module mounted from `app_factory` with these endpoints only:
  - `GET /api/admin/reports?status=&reason=&limit=&offset=`
  - `GET /api/admin/reports/{report_id}`
  - `POST /api/admin/reports/{report_id}/review`
  - `GET /api/admin/audit-events?event_type=&account_id=&chat_session_id=&limit=&offset=`
  - `POST /api/admin/accounts/{account_id}/restrict`
  - `POST /api/admin/accounts/{account_id}/restore`
  Require the new admin dependency for all of them. Review payload must require `status` in `reviewed|dismissed|actioned` and non-empty `review_note`.
  **Must NOT do**: Do not expose edit/delete APIs for audit events; do not add generic CRUD endpoints.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: public contract work with validation and auth boundaries
  - Skills: []
  - Omitted: [`frontend-dev`] — this is HTTP contract work

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: T7, T8 | Blocked By: T1, T2, T3

  **References**:
  - Pattern: `server-py/app/presentation/http/routes/auth.py:54-153` — existing route/request-model/JSON-response style
  - Pattern: `server-py/app/presentation/http/routes/account.py:11-33` — compact route module structure
  - Pattern: `server-py/app/bootstrap/app_factory.py:24-93` — router registration point
  - Test: `server-py/tests/test_health.py:63-72` — CORS/auth session route assertion style
  - Test: `server-py/tests/test_reporting.py:50-124` — report API test setup pattern

  **Acceptance Criteria**:
  - [ ] All admin routes return 401 unauthenticated, 403 authenticated non-admin, and success for admin
  - [ ] Review endpoint persists reviewer id, reviewed_at, review_note, and new status
  - [ ] Restrict/restore endpoints mutate account restriction state and write corresponding audit events
  - [ ] `cd server-py && ./.venv/bin/pytest tests/ -q -k "admin"`

  **QA Scenarios**:
  ```
  Scenario: Admin reviews an open report successfully
    Tool: Bash
    Steps: Run backend API tests that authenticate an allowlisted admin, fetch a seeded report, POST review status=actioned with review_note, then assert persisted review fields.
    Expected: 200 response, report status changes to actioned, reviewed_by_account_id and reviewed_at are populated.
    Evidence: .sisyphus/evidence/task-4-admin-routes.txt

  Scenario: Normal user cannot call admin routes
    Tool: Bash
    Steps: Run backend API tests that authenticate a non-admin account and call /api/admin/reports.
    Expected: 403 response with stable admin-forbidden error payload.
    Evidence: .sisyphus/evidence/task-4-admin-routes-error.txt
  ```

  **Commit**: NO | Message: `feat(admin): add admin routes` | Files: `server-py/app/presentation/http/routes/*`, `server-py/tests/*admin*`

- [ ] 5. Enforce restricted-account behavior and add blocked-user UX

  **What to do**: Extend the chat-access gate so restricted accounts cannot create chat sessions or use websocket chat even if authenticated and email-verified. Extend auth session payload and frontend auth state to surface `chat_access_restricted`. Update `HomePage` gating to render a dedicated restriction card instead of `ChatWorkspace` when the account is restricted. The restriction card should explain that chat access is unavailable and direct the user to support/contact text only; it must not expose admin internals.
  **Must NOT do**: Do not log the user out automatically and do not delete their account/session.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: coordinated backend + frontend gating change
  - Skills: []
  - Omitted: [`fullstack-dev`] — the scope is narrow enough without broader architecture guidance

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: T6 | Blocked By: T1, T2

  **References**:
  - Pattern: `server-py/app/application/chat/access_service.py:26-56` — current chat session gating logic
  - Pattern: `server-py/app/infrastructure/permission_gate.py:6-11` — current websocket permission gate
  - Pattern: `client/src/pages/home-page.tsx:7-29` — current auth/verification/chat gate ordering
  - Test: `client/src/pages/home-page.test.tsx:31-75` — current page gate test pattern
  - Test: `server-py/tests/test_session.py` and `server-py/tests/test_websocket.py:97-188` — existing create-session and websocket boundary patterns

  **Acceptance Criteria**:
  - [ ] Restricted account receives deterministic 403 on create-session and websocket authorization paths
  - [ ] Auth session payload exposes `chat_access_restricted=true`
  - [ ] `HomePage` renders restriction UI before `ChatWorkspace`
  - [ ] `cd server-py && ./.venv/bin/pytest tests/ -q -k "session or websocket or restriction" && cd ../client && npm run test -- --run`

  **QA Scenarios**:
  ```
  Scenario: Restricted account sees blocked state in client
    Tool: Bash
    Steps: Run client tests that mock authSession.authenticated=true, email_verified=true, chat_access_restricted=true, then render HomePage.
    Expected: Restriction card is visible and chat workspace is not rendered.
    Evidence: .sisyphus/evidence/task-5-restricted-ux.txt

  Scenario: Restricted account cannot enter chat runtime
    Tool: Bash
    Steps: Run backend tests that restrict an account and call POST /api/session plus websocket connect.
    Expected: HTTP returns 403 and websocket handshake/authorization is denied.
    Evidence: .sisyphus/evidence/task-5-restricted-ux-error.txt
  ```

  **Commit**: NO | Message: `feat(admin): enforce restricted chat access` | Files: `server-py/app/application/chat/*`, `client/src/pages/home-page.tsx`, `client/src/pages/home-page.test.tsx`

- [ ] 6. Add `/admin` route tree, route guard, and admin shell inside the existing client

  **What to do**: Extend the current router instead of creating a new app. Add `/admin` shell, `/admin/reports`, and `/admin/audit` routes. Implement a client-side admin route guard using `useAuth()` and the new `is_admin` field. Guard behavior must be:
  - unauthenticated → redirect to `/`
  - authenticated non-admin → render a 403-style in-app denial state
  - authenticated admin → render admin shell
  Add stable selectors: `data-testid="admin-layout"`, `data-testid="admin-nav-reports"`, `data-testid="admin-nav-audit"`, `data-testid="admin-forbidden"`.
  **Must NOT do**: Do not duplicate provider trees or create a second `BrowserRouter`.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: route composition + shell UX in existing frontend
  - Skills: []
  - Omitted: [`frontend-dev`] — not a marketing/animation task

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: T7, T8 | Blocked By: T1, T4, T5

  **References**:
  - Pattern: `client/src/app/App.tsx:1-20` — current route tree entrypoint
  - Pattern: `client/src/app/layout.tsx:4-18` — current app shell with provider composition
  - Pattern: `client/src/app/providers.tsx:13-30` — provider stack must remain shared
  - Pattern: `client/src/features/auth/auth-provider.tsx:18-185` — route guard should consume this auth context
  - Test: `client/src/pages/home-page.test.tsx:31-75` — basic route-state rendering pattern

  **Acceptance Criteria**:
  - [ ] Existing `/` flow keeps working unchanged for non-admin users
  - [ ] `/admin/reports` and `/admin/audit` are reachable only for `is_admin=true`
  - [ ] Admin shell exposes stable data-testid selectors listed above
  - [ ] `cd client && npm run test -- --run && npm run build`

  **QA Scenarios**:
  ```
  Scenario: Admin user enters reports route
    Tool: Playwright
    Steps: Open the app with mocked admin session, navigate to /admin/reports, wait for [data-testid="admin-layout"] and [data-testid="admin-nav-reports"].
    Expected: Admin shell renders and reports nav item is visible/active.
    Evidence: .sisyphus/evidence/task-6-admin-shell.png

  Scenario: Non-admin is blocked from admin route
    Tool: Playwright
    Steps: Open /admin/reports with mocked authenticated non-admin session, wait for [data-testid="admin-forbidden"].
    Expected: Forbidden state renders and admin list UI does not render.
    Evidence: .sisyphus/evidence/task-6-admin-shell-error.png
  ```

  **Commit**: NO | Message: `feat(admin): add client admin shell` | Files: `client/src/app/*`, `client/src/pages/*`, `client/src/features/auth/*`

- [ ] 7. Build admin reports review UI on top of the new APIs

  **What to do**: Implement `/admin/reports` as the primary moderation queue. The page must default to `status=open`, allow filtering by status and reason, show list rows with report id, created time, reason, reporter identity, reported identity, and current status, and support drill-in to a detail panel or route-level detail view for one report. In the detail experience, include report metadata, review history fields, and a review form with mandatory note. Add stable selectors: `data-testid="admin-reports-page"`, `data-testid="admin-report-row-{id}"`, `data-testid="admin-report-detail"`, `data-testid="admin-review-note"`, `data-testid="admin-review-submit"`.
  **Must NOT do**: Do not add infinite scroll, bulk actions, or moderation analytics.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: admin workflow UI over existing component library
  - Skills: []
  - Omitted: [`playwright`] — browser testing is for QA, not implementation skill injection

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: T9 | Blocked By: T4, T6

  **References**:
  - Pattern: `client/src/features/chat/ui/chat-report-dialog.tsx:18-170` — existing reason-selection and submit interaction pattern
  - Test: `client/src/features/chat/ui/chat-report-dialog.test.tsx:17-87` — fetch mocking and form-state reset testing pattern
  - Pattern: `client/src/app/providers.tsx:13-30` — use existing React Query provider
  - Pattern: `client/src/shared/ui/*` — reuse current shared UI primitives instead of importing a new library

  **Acceptance Criteria**:
  - [ ] Reports page loads open reports by default
  - [ ] Review form requires a non-empty note before submission
  - [ ] Successful review refreshes list/detail state without full-page reload
  - [ ] `cd client && npm run test -- --run`

  **QA Scenarios**:
  ```
  Scenario: Admin reviews a report from the reports page
    Tool: Playwright
    Steps: Open /admin/reports as admin, click [data-testid="admin-report-row-1"], fill [data-testid="admin-review-note"] with "Confirmed harassment", choose status actioned, click [data-testid="admin-review-submit"].
    Expected: Success toast appears, detail view reflects status=actioned, and list row status updates.
    Evidence: .sisyphus/evidence/task-7-admin-reports.png

  Scenario: Empty review note is blocked client-side
    Tool: Playwright
    Steps: Open a report detail, leave [data-testid="admin-review-note"] empty, click [data-testid="admin-review-submit"].
    Expected: Request is not sent and inline validation message appears.
    Evidence: .sisyphus/evidence/task-7-admin-reports-error.png
  ```

  **Commit**: NO | Message: `feat(admin): add report moderation ui` | Files: `client/src/features/admin/**`, `client/src/pages/**`

- [ ] 8. Build admin audit log UI and integrate account restriction actions

  **What to do**: Implement `/admin/audit` as a read-only filterable table using the admin audit API. Filters must include event type, account id, and chat session id. On the report detail experience from T7, add account action controls for `Restrict chat access` and `Restore chat access`; each action requires a note/reason and refreshes both report detail and audit list data. Add stable selectors: `data-testid="admin-audit-page"`, `data-testid="admin-audit-row-{index}"`, `data-testid="admin-restrict-account"`, `data-testid="admin-restore-account"`, `data-testid="admin-account-action-reason"`.
  **Must NOT do**: Do not add editable audit records, CSV export, or cross-page state machines.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: connected admin UI with moderate interaction complexity
  - Skills: []
  - Omitted: [`frontend-dev`] — no marketing/branding scope

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: T9 | Blocked By: T3, T4, T6

  **References**:
  - Pattern: `server-py/app/infrastructure/observability/database_audit_sink.py` — current audit sink writes backend events into DB
  - API/Type: `server-py/app/infrastructure/postgres/models.py:312-332` — audit event structure available to admin UI
  - Pattern: `client/src/features/chat/ui/chat-report-dialog.tsx:60-95` — submit/error/toast handling pattern
  - Pattern: `client/src/features/chat/ui/chat-report-dialog.test.tsx:60-86` — failure-state reset testing pattern

  **Acceptance Criteria**:
  - [ ] Audit page renders filterable event rows from live API data
  - [ ] Restrict/restore account actions require a reason and emit a visible success/failure state
  - [ ] Account action results create audit events visible from `/admin/audit`
  - [ ] `cd client && npm run test -- --run`

  **QA Scenarios**:
  ```
  Scenario: Restricting an account produces visible audit evidence
    Tool: Playwright
    Steps: Open report detail as admin, fill [data-testid="admin-account-action-reason"] with "Repeated abusive reports", click [data-testid="admin-restrict-account"], then navigate to /admin/audit.
    Expected: Success feedback appears and at least one visible audit row reflects the restriction action.
    Evidence: .sisyphus/evidence/task-8-admin-audit.png

  Scenario: Empty restriction reason is blocked
    Tool: Playwright
    Steps: Open report detail, leave [data-testid="admin-account-action-reason"] empty, click [data-testid="admin-restrict-account"].
    Expected: Request is not sent and validation feedback is rendered inline.
    Evidence: .sisyphus/evidence/task-8-admin-audit-error.png
  ```

  **Commit**: NO | Message: `feat(admin): add audit ui and account actions` | Files: `client/src/features/admin/**`, `client/src/shared/ui/**`

- [ ] 9. Update contracts, env docs, and verification instructions

  **What to do**: Synchronize top-level docs with the implemented admin-governance contract. Update root `README.md`, `ARCHITECTURE.md`, `server-py/README.md`, `.env.example`, and `DEVELOPMENT.md` to document new admin endpoints, `SERVER_PY_ADMIN_EMAILS`, restricted-account behavior, and the already-existing password-reset endpoints that are currently missing from the top-level contract summary. Keep all verification commands aligned with real repo commands.
  **Must NOT do**: Do not create new documentation trees outside the existing docs footprint.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: contract synchronization and concise technical docs
  - Skills: []
  - Omitted: [`fullstack-dev`] — implementation guidance is already defined elsewhere

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final Verification | Blocked By: T7, T8

  **References**:
  - Pattern: `README.md` — top-level runtime and active contract summary
  - Pattern: `ARCHITECTURE.md:52-125` — behavior, privacy, retention, and extension boundary documentation style
  - Pattern: `DEVELOPMENT.md:74-203` — dev/run/verification command documentation style
  - Pattern: `.env.example:1-31` — current env contract location
  - Pattern: `server-py/app/presentation/http/routes/auth.py:135-153` — password reset endpoints already exist and must be reflected in docs

  **Acceptance Criteria**:
  - [ ] Top-level docs list admin endpoints and password-reset endpoints accurately
  - [ ] `.env.example` includes `SERVER_PY_ADMIN_EMAILS`
  - [ ] Verification section reflects actual backend/frontend commands already used in repo
  - [ ] `cd client && npm run build && cd ../server-py && ./.venv/bin/pytest tests/ -q`

  **QA Scenarios**:
  ```
  Scenario: Documentation matches implemented API surface
    Tool: Bash
    Steps: Compare documented endpoints against route modules and run the documented verification commands.
    Expected: No documented endpoint is missing from code and all documented verification commands execute successfully.
    Evidence: .sisyphus/evidence/task-9-doc-sync.txt

  Scenario: Missing admin env contract is caught
    Tool: Bash
    Steps: Validate that .env.example contains SERVER_PY_ADMIN_EMAILS after the task; fail the doc test if absent.
    Expected: Doc verification fails before fix and passes after update.
    Evidence: .sisyphus/evidence/task-9-doc-sync-error.txt
  ```

  **Commit**: NO | Message: `docs(admin): sync governance contracts` | Files: `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `.env.example`, `server-py/README.md`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: backend governance foundation (`settings`, migration, services, routes, tests)
- Commit 2: client admin shell + reports + audit + blocked-user UX
- Commit 3: docs/env/contract synchronization

## Success Criteria
- Admin access works inside the existing `client/` app without a separate frontend
- Non-admin users cannot access `/api/admin/*` or `/admin/*`
- Admin can review reports and supply mandatory notes
- Admin can restrict and restore chat access for accounts
- Restricted accounts are blocked from chat runtime and see a clear non-admin-facing message
- Audit events are browsable in the admin UI
- Docs and env contract accurately describe the implemented system
