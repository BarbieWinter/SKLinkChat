# Frontend Chat Runtime Consolidation

## TL;DR
> **Summary**: Consolidate the frontend into one active structure centered on `app / pages / features / shared`, shrink the chat runtime into explicit responsibilities, remove legacy page/provider shells in one cut, and add integration coverage for the auth-to-chat critical path. Keep scope narrow: no new product features, no unrelated visual redesign, no backend re-architecture.
> **Deliverables**:
> - One active frontend structure with no parallel legacy directories
> - Chat runtime split into bootstrap / transport / state-sync / UI orchestration responsibilities
> - Login, unverified-email, bootstrap, reconnect, and report-feedback UX made consistent
> - Legacy `providers/` and `components/pages/` shells removed after migration
> - Frontend integration tests covering the critical auth/chat flows
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 5 → 6

## Context
### Current Project State
- Backend auth foundation and post-auth hardening are already implemented and verified against PostgreSQL.
- The active frontend entrypoint already uses the new provider composition in `client/src/app/providers.tsx`.
- The active router already uses `client/src/pages/home-page.tsx` and `client/src/pages/not-found-page.tsx`.
- Legacy frontend structure still coexists:
  - `client/src/providers/chat-provider.tsx`
  - `client/src/components/pages/home.tsx`
  - `client/src/components/pages/welcome.tsx`
  - `client/src/components/pages/not-found.tsx`
  - old `hooks / lib / types` style remnants still exist beside `shared/`
- The current chat runtime is better than the old provider, but responsibilities are still spread across:
  - `client/src/features/chat/chat-provider.tsx`
  - `client/src/features/chat/hooks/use-session-bootstrap.ts`
  - `client/src/features/chat/hooks/use-chat-socket.ts`
  - `client/src/pages/home-page.tsx`

### User Decisions Locked In
- Next round goal: do not expand product scope.
- Refactor and fix directly related chat-page interaction issues together.
- Delete old frontend directories in one cut after new structure fully owns the behavior.
- Do not keep compatibility layers long-term.
- Focus areas:
  - `app / pages / features / shared` boundaries
  - chat runtime responsibility split
  - delete legacy shells and old directories
  - add frontend integration tests
- Allowed UX fixes only when directly related to this consolidation:
  - login state transition consistency
  - unverified email interception / redirect
  - bootstrap loading / failure / retry
  - websocket reconnect presentation
  - report dialog feedback loop

## Work Objectives
### Core Objective
Turn the frontend into a single-track, maintainable runtime where route pages stay route-level, features own business behavior, shared contains true cross-feature utilities, and chat runtime no longer hides too much orchestration inside one provider or one page.

### Deliverables
- Single active frontend directory taxonomy
- Chat runtime broken into explicit modules with clear ownership
- Home page and auth/chat state transitions made deterministic
- Legacy frontend shells physically deleted
- Integration tests for the critical auth/chat lifecycle

### Definition of Done
- `cd client && npm run test -- --run`
- `cd client && npm run build`
- Repository no longer contains active runtime files under:
  - `client/src/providers/`
  - `client/src/components/pages/`
- App entrypoints import only from the new structure
- Chat/auth critical flows are covered by automated frontend integration tests

## Scope Boundaries
### Must Have
- `client/src/app/` owns app composition only:
  - router root
  - global providers
  - app shell
- `client/src/pages/` owns route-level pages only
- `client/src/features/` owns business behavior and feature UI
- `client/src/shared/` owns reusable cross-feature utilities and base UI
- Chat runtime split into explicit concerns:
  - session bootstrap
  - websocket transport
  - store synchronization
  - UI-side effects and user feedback
- Legacy page/provider shells removed in the same round
- Integration tests added for auth-to-chat critical paths

### Must NOT Have
- No forum, moderation console, or new matching strategy
- No design-system rewrite or unrelated visual overhaul
- No backend feature work beyond what is strictly required for frontend contract consumption
- No long-lived dual-track structure
- No keeping dead pages/providers “for reference”
- No giant replacement provider that simply moves complexity without reducing it

## Target Structure
### `app/`
- Root application composition only
- Expected owners:
  - router assembly
  - global providers
  - top-level layout shell
  - store bootstrap

### `pages/`
- Route-level containers only
- Expected owners:
  - home route container
  - not-found page
- Pages may compose feature UIs, but should not own chat transport details

### `features/`
- Business modules:
  - `auth`
  - `chat`
  - `presence`
  - `settings`
- `features/chat` should be reorganized toward:
  - `bootstrap/`
  - `transport/`
  - `state/`
  - `ui/`
  - `api/`

### `shared/`
- Cross-feature runtime helpers only
- Expected owners:
  - runtime config
  - shared API wrappers
  - shared base UI
  - reusable types
  - shared utility hooks only when truly cross-feature

## Problem Statement
### Current Gaps To Fix
- The app already routes through `pages/`, but old page shells still exist in `components/pages/`.
- The app already uses `app/providers.tsx`, but the old `providers/chat-provider.tsx` still exists and can confuse future changes.
- `home-page.tsx` still carries too much auth/chat state coordination.
- `features/chat/chat-provider.tsx` is thinner than the legacy provider, but still mixes:
  - transport actions
  - toast/error handling
  - bootstrap availability logic
  - store write orchestration
- The current UX edge states are not yet organized as first-class frontend runtime states.

## Execution Strategy
### Wave 1: Freeze Boundaries and Introduce Final Runtime Ownership
- 1. Freeze frontend directory boundaries and active entrypoints
- 2. Refactor chat runtime module boundaries inside `features/chat`

### Wave 2: Migrate Runtime and UX State Handling
- 3. Move auth/chat gating and bootstrap UX into the right page/feature layers
- 4. Refine reconnect and report-feedback behavior while migrating imports and providers

### Wave 3: Delete Legacy Frontend Shells and Backfill Tests
- 5. Delete obsolete directories and route/provider shells in one cut
- 6. Add integration coverage and final docs cleanup

## TODOs
- [ ] 1. Freeze frontend active structure and import boundaries

  **What to do**:
  - Establish `app / pages / features / shared` as the only active frontend taxonomy.
  - Audit and rewrite imports so route entrypoints and provider composition reference only the final structure.
  - Identify every legacy frontend shell that will be deleted later in the same round.
  - Keep runtime behavior unchanged in this task unless required for import-path migration.

  **Must NOT do**:
  - Do not delete legacy files before the new ownership graph is complete.
  - Do not let `pages/` import old `providers/` or `components/pages/`.

  **References**:
  - `client/src/app/App.tsx`
  - `client/src/app/providers.tsx`
  - `client/src/pages/home-page.tsx`
  - `client/src/pages/not-found-page.tsx`
  - `client/src/providers/chat-provider.tsx`
  - `client/src/components/pages/*`

  **Acceptance Criteria**:
  - Active router and provider composition reference only the final structure.
  - A deletion list for legacy frontend files is explicit and complete.

  **QA Scenarios**:
  ```
  Scenario: Active app entrypoints no longer depend on legacy page/provider shells
    Tool: Bash
    Steps: grep imports from app/pages/features/shared in App, layout, and providers; search for imports from providers/ and components/pages/.
    Expected: active entrypoints rely only on the final structure.

  Scenario: Legacy shell inventory is complete before deletion
    Tool: Bash
    Steps: enumerate files under client/src/providers and client/src/components/pages and verify each has a replacement path in app/pages/features/shared.
    Expected: no legacy shell is deleted without a clear replacement owner.
  ```

- [ ] 2. Split chat runtime into explicit modules inside `features/chat`

  **What to do**:
  - Refactor `features/chat` so responsibilities are explicit:
    - bootstrap: session creation, ownership claim, retry
    - transport: websocket connection and protocol handling
    - state: mapping protocol events into app store updates
    - ui: user feedback and chat-facing UI composition
  - Keep the public chat context surface small and intention-revealing.
  - Reduce hidden orchestration inside `chat-provider.tsx`.

  **Must NOT do**:
  - Do not create a new god-hook or god-provider.
  - Do not move route-level auth flow into transport code.

  **References**:
  - `client/src/features/chat/chat-provider.tsx`
  - `client/src/features/chat/hooks/use-session-bootstrap.ts`
  - `client/src/features/chat/hooks/use-chat-socket.ts`
  - `client/src/features/chat/services/protocol.ts`
  - `client/src/app/store.ts`

  **Acceptance Criteria**:
  - Chat provider becomes a thin composition root.
  - Bootstrap, socket transport, state sync, and feedback logic live in separate modules.
  - Message send / queue / typing / match behavior remains intact.

  **QA Scenarios**:
  ```
  Scenario: Chat runtime still supports queue, match, message, and typing after split
    Tool: Vitest
    Steps: run chat integration and feature tests after refactor.
    Expected: existing chat behavior remains green.

  Scenario: Provider no longer owns hidden transport complexity
    Tool: Code inspection + tests
    Steps: inspect provider responsibilities and verify transport and bootstrap logic are delegated to dedicated modules.
    Expected: provider composes; dedicated modules execute.
  ```

- [ ] 3. Normalize auth/chat page-state transitions

  **What to do**:
  - Move page-facing auth/chat state orchestration to the right layer so these states are deterministic:
    - unauthenticated
    - authenticated but unverified
    - bootstrap loading
    - bootstrap failed with retry
    - verified and ready
  - Ensure logout/login switching resets or rebuilds chat-related frontend state correctly.
  - Ensure unverified users never land in a half-usable chat state.

  **Must NOT do**:
  - Do not introduce extra routes unless strictly necessary.
  - Do not rely on incidental store leftovers across auth transitions.

  **References**:
  - `client/src/pages/home-page.tsx`
  - `client/src/features/auth/auth-provider.tsx`
  - `client/src/features/chat/hooks/use-session-bootstrap.ts`
  - `client/src/features/chat/api/create-session.ts`

  **Acceptance Criteria**:
  - Login/logout transitions produce deterministic page and chat state.
  - Unverified users see stable interception behavior.
  - Bootstrap loading/error/retry is explicit in UI state.

  **QA Scenarios**:
  ```
  Scenario: Login then logout then login does not leave stale chat state behind
    Tool: Vitest + Testing Library
    Steps: simulate auth transitions around the home page and inspect chat state/UI.
    Expected: stale session or peer state is cleared and rebuilt correctly.

  Scenario: Unverified user cannot drift into a half-ready chat state
    Tool: Vitest + Testing Library
    Steps: mock authenticated but unverified session and render home page.
    Expected: user is blocked consistently and shown the intended verification state.
  ```

- [ ] 4. Consolidate reconnect and report-dialog UX within the new runtime boundaries

  **What to do**:
  - Make reconnect visible in the frontend state model instead of being mostly implicit.
  - Ensure report dialog has a complete submission loop:
    - idle
    - submitting
    - success
    - failure
    - reset on close/reopen
  - Keep these fixes within the consolidation scope only.

  **Must NOT do**:
  - Do not add new reporting features or moderation workflows.
  - Do not redesign the whole chat UI.

  **References**:
  - `client/src/features/chat/hooks/use-chat-socket.ts`
  - `client/src/features/chat/ui/chat-panel.tsx`
  - `client/src/features/chat/ui/chat-report-dialog.tsx`
  - `client/src/features/chat/api/create-report.ts`

  **Acceptance Criteria**:
  - Reconnect has a clear frontend-visible state transition.
  - Report dialog submission feedback is deterministic and testable.

  **QA Scenarios**:
  ```
  Scenario: WebSocket reconnect state is visible and recoverable
    Tool: Vitest + Testing Library
    Steps: simulate socket disconnection and reconnection around the chat page.
    Expected: UI reflects transient unavailable/reconnecting state and recovers cleanly.

  Scenario: Report dialog closes the feedback loop
    Tool: Vitest + Testing Library
    Steps: test success and failure submissions, then close/reopen the dialog.
    Expected: submitting state, success/failure feedback, and form reset all behave correctly.
  ```

- [ ] 5. Delete obsolete frontend shells and duplicate structure in one cut

  **What to do**:
  - Delete old frontend runtime shells once replacements are fully wired.
  - Mandatory deletion targets include:
    - `client/src/providers/`
    - `client/src/components/pages/`
  - Delete other obsolete directories only when they are fully superseded by `features/` or `shared/`.

  **Must NOT do**:
  - Do not leave compatibility exports behind.
  - Do not keep dead files for reference.

  **References**:
  - `client/src/providers/*`
  - `client/src/components/pages/*`
  - any migrated files under `client/src/hooks`, `client/src/lib`, `client/src/types`

  **Acceptance Criteria**:
  - Legacy directories are physically removed.
  - No active import path points at deleted shells.

  **QA Scenarios**:
  ```
  Scenario: Legacy directories are gone after migration
    Tool: Bash
    Steps: test for absence of client/src/providers and client/src/components/pages.
    Expected: old directories no longer exist.

  Scenario: No import path still references deleted shells
    Tool: Bash
    Steps: grep for imports targeting removed directories.
    Expected: zero active references remain.
  ```

- [ ] 6. Add frontend integration tests for the critical auth-to-chat lifecycle

  **What to do**:
  - Add integration-style tests for:
    - authenticated to chat bootstrap success
    - bootstrap failure and retry
    - unverified gating
    - login/logout state reset
    - reconnect presentation
    - report dialog feedback loop
  - Keep unit tests where useful, but prioritize real user-visible flow coverage.

  **Must NOT do**:
  - Do not rely on only isolated reducer tests.
  - Do not leave critical UX states covered only by manual testing.

  **References**:
  - `client/src/features/chat/hooks/use-session-bootstrap.test.tsx`
  - `client/src/features/chat/ui/chat-report-dialog.test.tsx`
  - `client/src/app/App.tsx`
  - `client/src/pages/home-page.tsx`

  **Acceptance Criteria**:
  - Critical auth/chat flows are covered by automated frontend tests.
  - `npm run test -- --run` and `npm run build` both pass after the cleanup.

  **QA Scenarios**:
  ```
  Scenario: Auth-to-chat critical path is test-covered
    Tool: Vitest + Testing Library
    Steps: run integration tests for login state, unverified gating, bootstrap success/failure, reconnect, and report feedback.
    Expected: all user-critical transitions are asserted by tests.

  Scenario: Frontend cleanup does not break production build
    Tool: Bash
    Steps: run `npm run build` after deletions and import rewrites.
    Expected: build succeeds with only known non-blocking warnings if any remain.
  ```

## Recommended Implementation Order
1. Freeze entrypoints and import boundaries.
2. Split chat runtime modules while preserving current behavior.
3. Normalize page-state transitions around auth and bootstrap.
4. Fold reconnect/report UX into the new runtime boundaries.
5. Delete legacy shells in one cut.
6. Backfill integration tests and final docs cleanup.

## Out of Scope
- Forum
- Matching strategy upgrades
- Language preferences
- Interests-based hard filtering
- Moderation console
- Backend worker extraction
- Broad visual redesign unrelated to this consolidation
