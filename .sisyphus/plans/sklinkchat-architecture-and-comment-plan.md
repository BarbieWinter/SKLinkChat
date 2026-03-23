# SKLinkChat 中文架构文档与代码注释计划

## TL;DR
> **Summary**: 在仓库根目录产出一份全中文的 `ARCHITECTURE.md`，完整解释项目结构、模块职责、运行流程与每个一方文件；随后为全部源码补充中文注释，且不改变任何行为。
> **Deliverables**:
> - Root `ARCHITECTURE.md` with Mermaid diagrams and file-by-file explanations
> - Chinese comment pass for all files under `client/src/` and `server/src/`
> - Verification evidence for inventory completeness, builds, and no-logic-change review
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: Inventory baseline → architecture doc → comment passes → verification

## Context
### Original Request
用户希望对 SKLinkChat 做一次完整梳理：在仓库根目录输出一份全中文 Markdown 架构文档，解释每个板块和每个文件的作用，附带可视化图示，并为源码补充中文注释，方便后续继续改进。用户明确要求不改动代码逻辑。

### Interview Summary
- 注释范围：全部源码文件，而非仅核心文件
- 图示形式：使用 `Mermaid`
- 文档文件名：`ARCHITECTURE.md`
- 文档语言：中文
- 注释语言：中文
- 目标：提升项目可维护性，便于后续继续改进

### Planning Notes (Prometheus-only)
- This plan is generated using Prometheus / `gpt-5.4` only, per user instruction
- Standard Metis review step is intentionally skipped due to the user’s “no other model” constraint
- Current repo contains real application code: React + TypeScript + Vite client, Bun + TypeScript server
- No automated test framework or CI exists; verification must rely on inventory checks, lint/build, and static review

## Work Objectives
### Core Objective
生成一份决策完备的执行路径，用中文完整梳理 SKLinkChat 的架构，并以中文注释补充源码说明，同时保证运行行为不变。

### Deliverables
- 仓库根目录的全中文 `ARCHITECTURE.md`
- File inventory covering root files plus first-party files in `client/` and `server/`
- 展示整体系统、前端结构、后端消息流的 Mermaid 中文图示
- 为 `client/src/` 与 `server/src/` 下每个源码文件补充中文块级/函数级注释
- Validation records under `.sisyphus/evidence/`

### Definition of Done (verifiable conditions with commands)
- `ARCHITECTURE.md` 位于仓库根目录，且全文使用中文，包含根目录、`client`、`server`、运行流程与逐文件说明
- `ARCHITECTURE.md` contains at least one Mermaid graph and one directory tree
- Every first-party file in root, `client/`, `client/src/`, `server/`, and `server/src/` is represented in the document except explicitly excluded generated/vendor paths
- All files in `client/src/` and `server/src/` contain Chinese explanatory comments added without changing exported API or runtime logic
- `npm run build` succeeds in `client/`
- `npm run lint` succeeds in `client/`
- `bun run start` type/runtime entry remains loadable in `server/` or equivalent static diagnostics show no new TypeScript/ESLint errors if server lint is absent

### Must Have
- 文档中用中文解释每个一方文件的用途
- Separate “system architecture” from “file inventory” to keep the doc readable
- 使用 Mermaid 输出中文可视化图示
- 使用中文注释解释模块职责、数据流与关键函数/组件
- Preserve code formatting/style already present in repo

### Must NOT Have
- No logic changes, API changes, dependency upgrades, or refactors
- No comments in `node_modules/`, `dist/`, `.git/`, or generated lock/build artifacts
- No line-by-line noise comments for trivial JSX/TS syntax
- No undocumented scope expansion into adding tests/CI as part of this task

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: none (repo has no test framework)
- Build verification: `client` build + lint, `server` static entry sanity and diagnostics
- QA policy: every task includes agent-executed artifact or command-based verification
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
Wave 1: inventory + architecture extraction + doc outline foundation
Wave 2: client/server documentation population + client comment pass + server comment pass
Wave 3: completeness audit + build/lint verification + final consistency fixes

### Dependency Matrix (full, all tasks)
- T1 blocks T2-T9
- T2 blocks T3, T4, T7
- T3 blocks T5, T7
- T4 blocks T6, T7
- T5 and T6 block T8 and T9 only for consistency review, not initial drafting
- T7 blocks T10
- T8 and T9 block T10

### Agent Dispatch Summary
- Wave 1 → 3 tasks → unspecified-high / deep
- Wave 2 → 6 tasks → writing / quick / unspecified-high
- Wave 3 → 1 implementation task + 4 mandatory reviews

## TODOs
- [ ] 1. Establish first-party file inventory baseline

  **What to do**: Enumerate every first-party file that must be explained in `ARCHITECTURE.md`. Include repo root files, client config files, client source files, server config files, and server source files. Explicitly exclude `.git/`, `node_modules/`, `dist/`, build outputs, and lockfile/vendor internals. Save the canonical inventory list into `.sisyphus/evidence/task-1-file-inventory.md` so all later tasks use the same source of truth.
  **Must NOT do**: Do not document third-party dependency files; do not silently skip first-party config files; do not include generated `client/dist/*` assets.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: broad repo inventory with careful boundary control
  - Skills: `[]` — no extra skill required
  - Omitted: `[frontend-dev]` — visual polish is not the main task here

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5, 6, 7, 8, 9, 10 | Blocked By: none

  **References**:
  - Pattern: `README.md` — root-level project identity exists but is minimal
  - Pattern: `AGENTS.md` — repository expectations and documented conventions
  - Pattern: `client/package.json` — frontend manifest and scripts
  - Pattern: `server/package.json` — backend manifest and scripts
  - Pattern: `client/src/` — 41 source files already identified
  - Pattern: `server/src/` — 11 source files already identified

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-1-file-inventory.md` lists every first-party file to be explained
  - [ ] Exclusion rules explicitly mention `node_modules/`, `dist/`, `.git/`, and generated assets
  - [ ] Inventory counts reconcile with actual `client/src` and `server/src` file counts

  **QA Scenarios**:
  ```
  Scenario: Happy path inventory reconciliation
    Tool: Bash
    Steps: Run file-count commands for `client/src` and `server/src`; compare with `.sisyphus/evidence/task-1-file-inventory.md`
    Expected: Counts match and no first-party source file is omitted
    Evidence: .sisyphus/evidence/task-1-file-inventory.txt

  Scenario: Failure guard against vendor file leakage
    Tool: Bash
    Steps: Search the inventory evidence for `node_modules`, `dist/assets`, and `.git/`
    Expected: No excluded vendor/generated paths appear in the canonical inventory
    Evidence: .sisyphus/evidence/task-1-file-inventory-error.txt
  ```

  **Commit**: NO | Message: `docs(architecture): baseline inventory` | Files: `.sisyphus/evidence/task-1-file-inventory.*`

- [ ] 2. Extract repository-level architecture narrative

  **What to do**: 用中文写出 `client/` 与 `server/` 的协作关系、各自运行栈、根目录职责，以及维护者应优先阅读哪些部分。产出可直接复用到 `ARCHITECTURE.md` 的中文叙述和目录树草稿。
  **Must NOT do**: Do not dive into file-by-file UI component explanations yet; do not duplicate the inventory list verbatim in prose.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this task is architecture narrative and maintainability-focused
  - Skills: `[]` — no extra skill required
  - Omitted: `[fullstack-dev]` — planning needs concise documentation, not implementation advice

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3, 4, 7 | Blocked By: 1

  **References**:
  - Pattern: `README.md` — minimal current documentation to replace/augment
  - Pattern: `client/package.json` — frontend stack and command surface
  - Pattern: `server/package.json` — backend runtime and command surface
  - Pattern: `server/Dockerfile` — deployment/containerization clue
  - Pattern: `client/vite.config.ts` — frontend bundling boundary

  **Acceptance Criteria**:
  - [ ] Architecture narrative explains frontend/backend/runtime relationships in Chinese
  - [ ] Root-level responsibilities are documented for `README.md`, `AGENTS.md`, `client/`, and `server/`
  - [ ] A directory tree suitable for `ARCHITECTURE.md` is prepared

  **QA Scenarios**:
  ```
  Scenario: Happy path narrative completeness
    Tool: Read
    Steps: Inspect the draft architecture narrative artifact and verify root/client/server sections all exist
    Expected: Narrative covers repo root, frontend stack, backend stack, and interaction overview
    Evidence: .sisyphus/evidence/task-2-repo-narrative.md

  Scenario: Failure guard against missing root files
    Tool: Bash
    Steps: Search the narrative artifact for `README.md` and `AGENTS.md`
    Expected: Both files are explicitly explained
    Evidence: .sisyphus/evidence/task-2-repo-narrative-error.txt
  ```

  **Commit**: NO | Message: `docs(architecture): add repo narrative` | Files: `.sisyphus/evidence/task-2-repo-narrative.*`

- [ ] 3. Map frontend runtime and state flow

  **What to do**: 梳理前端从 `client/src/main.tsx` 到 `client/src/App.tsx`、providers、hooks、store slices、lib、pages、molecules、template、atoms、UI primitives 的启动与运行流程，并整理成适合维护者阅读的中文说明，再配一张前端渲染/状态/数据流的 Mermaid 图。
  **Must NOT do**: Do not comment files yet; do not flatten all components into one undifferentiated list; do not omit non-UI frontend files such as `vite-env.d.ts`, `lib/config.ts`, `types/index.ts`, or `assets/global.css`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: detailed static analysis of the client codebase
  - Skills: `[]`
  - Omitted: `[frontend-dev]` — executor should explain existing structure, not redesign UI

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 7, 8 | Blocked By: 1, 2

  **References**:
  - Pattern: `client/src/main.tsx` — entry point
  - Pattern: `client/src/App.tsx` — router boundary
  - Pattern: `client/src/providers/chat-provider.tsx` — WebSocket/context integration
  - Pattern: `client/src/providers/theme-provider.tsx` and `client/src/providers/index.tsx` — provider composition
  - Pattern: `client/src/lib/store/index.ts` and `client/src/lib/store/*.ts` — Zustand state slices
  - Pattern: `client/src/lib/api.ts`, `client/src/lib/i18n.ts`, `client/src/lib/config.ts`, `client/src/lib/utils.ts` — supporting infrastructure
  - Pattern: `client/src/components/**` — UI layering to explain by folder and file

  **Acceptance Criteria**:
  - [ ] Frontend narrative covers startup, routing, state, WebSocket handling, UI composition, and utility layers
  - [ ] Every file in `client/src/` is assigned a specific role description
  - [ ] Mermaid client flow diagram is drafted and technically coherent

  **QA Scenarios**:
  ```
  Scenario: Happy path frontend coverage
    Tool: Bash
    Steps: Compare `client/src` inventory against the frontend documentation draft section
    Expected: Every `client/src` file appears exactly once in a file explanation table or list
    Evidence: .sisyphus/evidence/task-3-frontend-coverage.txt

  Scenario: Failure guard against missing infrastructure files
    Tool: Bash
    Steps: Search the frontend draft for `vite-env.d.ts`, `config.ts`, `i18n.ts`, and `global.css`
    Expected: All four are explicitly covered
    Evidence: .sisyphus/evidence/task-3-frontend-coverage-error.txt
  ```

  **Commit**: NO | Message: `docs(client): map runtime and files` | Files: `.sisyphus/evidence/task-3-frontend-*`

- [ ] 4. Map backend runtime and message flow

  **What to do**: 梳理后端从 `server/src/index.ts` 到 `server/src/lib/app.ts`、用户生命周期、队列行为、handlers、响应封装与共享类型的流程，输出中文解释，并配至少一张描述匹配/消息路由的 Mermaid 图。
  **Must NOT do**: Do not add code comments yet; do not describe the backend as framework-based when it uses Bun primitives; do not ignore `.todo`, Docker, or manifest context when explaining future-facing architecture notes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: concentrated analysis of event-driven backend logic
  - Skills: `[]`
  - Omitted: `[fullstack-dev]` — no architecture redesign required

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 7, 9 | Blocked By: 1, 2

  **References**:
  - Pattern: `server/src/index.ts` — backend entry
  - Pattern: `server/src/lib/app.ts` — runtime orchestrator
  - Pattern: `server/src/lib/user.ts` — user model/state machine
  - Pattern: `server/src/lib/queue.ts` — matchmaking queue
  - Pattern: `server/src/lib/handlers/handler.ts` and `server/src/lib/handlers/*.ts` — plugin-style dispatch
  - Pattern: `server/src/lib/response.ts` — outbound payload helper
  - Pattern: `server/src/types.ts` — shared server enums/types
  - Pattern: `server/.todo` and `server/Dockerfile` — operational context

  **Acceptance Criteria**:
  - [ ] Backend narrative covers entry, client registry, matchmaking, message handling, typing/disconnect paths, and type model
  - [ ] Every file in `server/src/` is assigned a specific role description
  - [ ] Mermaid backend flow diagram is drafted and technically coherent

  **QA Scenarios**:
  ```
  Scenario: Happy path backend coverage
    Tool: Bash
    Steps: Compare `server/src` inventory against the backend documentation draft section
    Expected: Every `server/src` file appears exactly once in a file explanation table or list
    Evidence: .sisyphus/evidence/task-4-backend-coverage.txt

  Scenario: Failure guard against handler omission
    Tool: Bash
    Steps: Search the backend draft for `message.ts`, `user.ts`, `queue.ts`, `handler.ts`, and `response.ts`
    Expected: All handler/core files are explicitly described
    Evidence: .sisyphus/evidence/task-4-backend-coverage-error.txt
  ```

  **Commit**: NO | Message: `docs(server): map runtime and files` | Files: `.sisyphus/evidence/task-4-backend-*`

- [ ] 5. Draft `ARCHITECTURE.md` structure and root sections

  **What to do**: 在根目录创建全中文 `ARCHITECTURE.md`，结构固定为：项目概览、技术栈、顶层目录树、前端架构、后端架构、运行/数据流图、逐文件说明、后续改进入口。先写根级结构，并明确说明生成物/第三方目录的排除规则。
  **Must NOT do**: Do not leave placeholder headings without substance; do not hide exclusion rules; do not intermix root-level files with source-file details in a confusing order.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this is the central documentation artifact
  - Skills: `[]`
  - Omitted: `[minimax-pdf]` — final artifact is Markdown, not PDF

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 10 | Blocked By: 1, 2, 3

  **References**:
  - Pattern: `ARCHITECTURE.md` (new file at repo root) — required deliverable
  - Pattern: `README.md` — current gap to address with richer architecture doc
  - Pattern: `AGENTS.md` — repo policy context to cite carefully
  - Pattern: `.sisyphus/evidence/task-1-file-inventory.md` — completeness source of truth

  **Acceptance Criteria**:
  - [ ] `ARCHITECTURE.md` contains complete section structure before per-file details are merged
  - [ ] Root section explains what the project is, how client/server relate, and what is excluded from “every file” coverage
  - [ ] At least one Mermaid block is already present and syntactically valid

  **QA Scenarios**:
  ```
  Scenario: Happy path architecture skeleton
    Tool: Read
    Steps: Inspect `ARCHITECTURE.md` headings and confirm required sections exist in order
    Expected: Overview, stack, tree, frontend, backend, diagrams, file-by-file, and improvement sections all exist
    Evidence: .sisyphus/evidence/task-5-architecture-skeleton.md

  Scenario: Failure guard against ambiguous scope
    Tool: Bash
    Steps: Search `ARCHITECTURE.md` for exclusion policy wording around `node_modules`, `dist`, and `.git`
    Expected: Exclusion scope is explicit and unambiguous
    Evidence: .sisyphus/evidence/task-5-architecture-skeleton-error.txt
  ```

  **Commit**: NO | Message: `docs: scaffold architecture document` | Files: `ARCHITECTURE.md`

- [ ] 6. Populate client and server file-by-file documentation

  **What to do**: 将任务 3 和任务 4 的结果合并进 `ARCHITECTURE.md`，确保每个一方文件都有简洁但具体的中文解释。按职责分组组织内容，保证文档易读：根目录文件、前端配置、前端源码目录、后端配置、后端源码目录。
  **Must NOT do**: Do not collapse all file descriptions into a giant unstructured paragraph; do not omit config files like `.eslintrc.cjs`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `components.json`, `Dockerfile`, `.todo`, or local READMEs.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: high-volume, precision documentation work
  - Skills: `[]`
  - Omitted: `[frontend-dev]` — this is descriptive documentation, not design work

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 1, 3, 4, 5

  **References**:
  - Pattern: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/tailwind.config.js`, `client/postcss.config.js`, `client/components.json`, `client/.eslintrc.cjs`, `client/.prettierrc.cjs`, `client/index.html`, `client/README.md`
  - Pattern: `client/src/**` — full source inventory
  - Pattern: `server/package.json`, `server/tsconfig.json`, `server/Dockerfile`, `server/.eslintrc.cjs`, `server/.prettierrc.cjs`, `server/README.md`, `server/.todo`
  - Pattern: `server/src/**` — full source inventory

  **Acceptance Criteria**:
  - [ ] Every first-party file selected in Task 1 is explained in `ARCHITECTURE.md`
  - [ ] File descriptions are grouped by folder/concern rather than flat dump order
  - [ ] Document makes it clear which files are runtime-critical vs support/config files

  **QA Scenarios**:
  ```
  Scenario: Happy path full inventory match
    Tool: Bash
    Steps: Compare `.sisyphus/evidence/task-1-file-inventory.md` to all path mentions in `ARCHITECTURE.md`
    Expected: Every planned file appears in the final document
    Evidence: .sisyphus/evidence/task-6-file-doc-coverage.txt

  Scenario: Failure guard against config-file omission
    Tool: Bash
    Steps: Search `ARCHITECTURE.md` for `Dockerfile`, `tailwind.config.js`, `postcss.config.js`, `.eslintrc.cjs`, and `.todo`
    Expected: All listed config/support files are documented
    Evidence: .sisyphus/evidence/task-6-file-doc-coverage-error.txt
  ```

  **Commit**: NO | Message: `docs: add file-by-file explanations` | Files: `ARCHITECTURE.md`

- [ ] 7. Add cross-cutting Mermaid diagrams and improvement map

  **What to do**: 完成 `ARCHITECTURE.md` 的可视化层，至少包含：(1) client↔server 总体架构图，(2) 前端渲染/状态/provider 关系图，(3) 后端匹配/消息路由图。最后补充一个“后续可改进板块”章节，但只做定位说明，不提出实现改动。
  **Must NOT do**: Do not produce decorative diagrams detached from actual file structure; do not turn the “future improvements” section into a backlog rewrite.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: documentation clarity and structure
  - Skills: `[]`
  - Omitted: `[artistry]` — practicality and maintainability matter more than visual novelty

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 2, 3, 4, 5

  **References**:
  - Pattern: `client/src/providers/chat-provider.tsx` — client connection flow anchor
  - Pattern: `client/src/lib/store/*.ts` — state-flow anchor
  - Pattern: `server/src/lib/app.ts` — backend orchestration anchor
  - Pattern: `server/src/lib/handlers/*.ts` — message routing anchor
  - Pattern: `server/.todo` — optional context for “improvement hotspots” only

  **Acceptance Criteria**:
  - [ ] `ARCHITECTURE.md` contains 3 Mermaid diagrams with labels matching real modules/files
  - [ ] Improvement map points readers to subsystems, not speculative rewrites
  - [ ] Diagrams and surrounding prose are consistent with file-by-file explanations

  **QA Scenarios**:
  ```
  Scenario: Happy path diagram presence
    Tool: Bash
    Steps: Count Mermaid code fences in `ARCHITECTURE.md`
    Expected: At least 3 Mermaid blocks are present
    Evidence: .sisyphus/evidence/task-7-diagrams.txt

  Scenario: Failure guard against fictional modules
    Tool: Read
    Steps: Review each diagram label against actual repo modules/files
    Expected: No diagram node names invent subsystems absent from the repository
    Evidence: .sisyphus/evidence/task-7-diagrams-error.md
  ```

  **Commit**: NO | Message: `docs: add architecture diagrams` | Files: `ARCHITECTURE.md`

- [ ] 8. Add Chinese comments to frontend source files

  **What to do**: Add concise Chinese comments to every file under `client/src/`. Prefer module header comments and focused function/component/block comments that explain responsibility, data flow, state ownership, provider role, or UI purpose. Ensure comments are value-dense and aligned with existing style.
  **Must NOT do**: Do not change logic, names, imports, JSX structure, hooks order, or state behavior. Do not comment every trivial line. Do not add comments to generated asset files beyond what is meaningful for maintainers.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: repetitive but surgical code annotation across many small files
  - Skills: `[]`
  - Omitted: `[frontend-dev]` — goal is annotation, not UI improvement

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 1, 3

  **References**:
  - Pattern: `client/src/main.tsx`, `client/src/App.tsx` — entry/router comments
  - Pattern: `client/src/providers/*.tsx` — provider responsibility comments
  - Pattern: `client/src/lib/store/*.ts` — state-slice comments
  - Pattern: `client/src/components/**` — component-role comments
  - Pattern: `client/src/hooks/useI18n.ts`, `client/src/types/index.ts`, `client/src/lib/*.ts` — utility/infrastructure comments

  **Acceptance Criteria**:
  - [ ] Every file under `client/src/` receives at least one meaningful Chinese explanatory comment
  - [ ] Core files (`main.tsx`, `App.tsx`, `chat-provider.tsx`, store slices, page components) receive richer responsibility comments
  - [ ] No semantic code changes are introduced

  **QA Scenarios**:
  ```
  Scenario: Happy path frontend comment coverage
    Tool: Bash
    Steps: Enumerate `client/src` files and inspect diffs to confirm each file gained Chinese comments
    Expected: Every targeted frontend source file contains at least one new Chinese comment
    Evidence: .sisyphus/evidence/task-8-frontend-comments.txt

  Scenario: Failure guard against logic drift
    Tool: Bash
    Steps: Run `npm run build` and `npm run lint` in `client/` after the comment pass
    Expected: Build and lint succeed without errors introduced by annotation changes
    Evidence: .sisyphus/evidence/task-8-frontend-comments-error.txt
  ```

  **Commit**: NO | Message: `docs(client): add chinese comments` | Files: `client/src/**`

- [ ] 9. Add Chinese comments to backend source files

  **What to do**: Add concise Chinese comments to every file under `server/src/`. Focus on lifecycle orchestration, queue behavior, handler dispatch, payload typing, user state transitions, and response helpers.
  **Must NOT do**: Do not change payload handling logic, queue semantics, class signatures, or WebSocket behavior. Do not pad trivial comments around obvious type declarations.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: small source set, precision annotation work
  - Skills: `[]`
  - Omitted: `[fullstack-dev]` — no backend feature work required

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 1, 4

  **References**:
  - Pattern: `server/src/index.ts` — entry responsibility comment
  - Pattern: `server/src/lib/app.ts` — orchestration comment anchors
  - Pattern: `server/src/lib/user.ts`, `server/src/lib/queue.ts`, `server/src/lib/response.ts` — domain helper comments
  - Pattern: `server/src/lib/handlers/*.ts` — dispatch/comment anchors
  - Pattern: `server/src/types.ts` — payload/state explanation

  **Acceptance Criteria**:
  - [ ] Every file under `server/src/` receives at least one meaningful Chinese explanatory comment
  - [ ] Core orchestration files receive comments clarifying data flow and state transitions
  - [ ] No semantic code changes are introduced

  **QA Scenarios**:
  ```
  Scenario: Happy path backend comment coverage
    Tool: Bash
    Steps: Enumerate `server/src` files and inspect diffs to confirm each file gained Chinese comments
    Expected: Every targeted backend source file contains at least one new Chinese comment
    Evidence: .sisyphus/evidence/task-9-backend-comments.txt

  Scenario: Failure guard against backend breakage
    Tool: Bash
    Steps: Run server diagnostics available in repo (entry load check, TypeScript diagnostics, and lint if configured)
    Expected: No new syntax/type errors appear after comment-only changes
    Evidence: .sisyphus/evidence/task-9-backend-comments-error.txt
  ```

  **Commit**: NO | Message: `docs(server): add chinese comments` | Files: `server/src/**`

- [ ] 10. Run completeness and consistency audit

  **What to do**: Perform a final audit across the doc and code changes. Confirm `ARCHITECTURE.md` explains all planned files, diagrams align with actual modules, and comment pass coverage is complete across all source files. Reconcile any mismatches before final review.
  **Must NOT do**: Do not introduce new scope such as test setup, refactors, or content outside the agreed artifact set.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: cross-artifact completeness and consistency review
  - Skills: `[]`
  - Omitted: `[artistry]` — correctness matters more than alternative presentation styles

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: F1-F4 | Blocked By: 5, 6, 7, 8, 9

  **References**:
  - Pattern: `.sisyphus/evidence/task-1-file-inventory.md` — canonical inventory baseline
  - Pattern: `ARCHITECTURE.md` — final doc target
  - Pattern: `client/src/**` and `server/src/**` — comment coverage targets
  - Pattern: `client/package.json`, `server/package.json` — final verification commands

  **Acceptance Criteria**:
  - [ ] Canonical inventory and final document match with no missing first-party files
  - [ ] Comment coverage reaches every file in `client/src/` and `server/src/`
  - [ ] Verification artifacts exist for build/lint/static review
  - [ ] Any defaults or exclusions are explicitly documented in `ARCHITECTURE.md`

  **QA Scenarios**:
  ```
  Scenario: Happy path final audit
    Tool: Bash
    Steps: Reconcile inventory file, final document path mentions, source file diffs, and build/lint outputs
    Expected: Coverage is complete and all validation outputs are green
    Evidence: .sisyphus/evidence/task-10-final-audit.txt

  Scenario: Failure guard against hidden omissions
    Tool: Bash
    Steps: Search for first-party file paths absent from `ARCHITECTURE.md` or source files with no added comments
    Expected: Search returns zero missing-file results
    Evidence: .sisyphus/evidence/task-10-final-audit-error.txt
  ```

  **Commit**: NO | Message: `docs: finalize architecture and comments audit` | Files: `ARCHITECTURE.md`, `client/src/**`, `server/src/**`, `.sisyphus/evidence/**`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> Prometheus-only mode: execute 4 sequential audits with the same model/session instead of invoking other review models.
> Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — Prometheus sequential review
- [ ] F2. Code Quality Review — Prometheus sequential review
- [ ] F3. Real Manual QA — Prometheus sequential review (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — Prometheus sequential review

## Commit Strategy
- No commit unless the user explicitly requests it after execution.

## Success Criteria
- Future maintainers can understand repository layers, message flow, and per-file responsibility by reading `ARCHITECTURE.md` alone.
- Source files contain enough Chinese comments to orient a maintainer without obscuring code.
- No behavioral drift is introduced.
- Inventory/documentation excludes only generated/vendor files and explains that exclusion explicitly.
