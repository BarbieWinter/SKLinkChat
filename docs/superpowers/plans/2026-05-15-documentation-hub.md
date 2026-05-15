# Documentation Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize SKLinkChat documentation into a bilingual hub-and-spoke structure with clear reader paths.

**Architecture:** Keep GitHub-recognized community files in the repository root. Move long-form docs into topic directories under `docs/`, add `docs/README.md` as the documentation hub, and reduce `README.md` to a high-signal project front door.

**Tech Stack:** Markdown, GitHub repository community files, existing SKLinkChat docs.

---

### Task 1: Create Topic Directories and Move Existing Docs

**Files:**
- Move: `docs/ARCHITECTURE.md` -> `docs/architecture/overview.md`
- Move: `docs/CODEBASE_MAP.md` -> `docs/architecture/codebase-map.md`
- Move: `docs/DEPLOYMENT.md` -> `docs/deployment/deployment.md`
- Move: `DEVELOPMENT.md` -> `docs/development/development.md`
- Move: `docs/OPEN_SOURCE_SETUP.md` -> `docs/community/open-source.md`
- Move: `docs/ROADMAP.md` -> `docs/product/roadmap.md`
- Move: `docs/SCREENSHOTS.md` -> `docs/product/screenshots.md`
- Move: `docs/LANDING_PAGE_PLAN.md` -> `docs/maintenance/landing-page-plan.md`

- [ ] **Step 1: Create directories**

Run:

```bash
mkdir -p docs/architecture docs/deployment docs/development docs/community docs/product docs/maintenance
```

- [ ] **Step 2: Move files with git**

Run:

```bash
git mv docs/ARCHITECTURE.md docs/architecture/overview.md
git mv docs/CODEBASE_MAP.md docs/architecture/codebase-map.md
git mv docs/DEPLOYMENT.md docs/deployment/deployment.md
git mv DEVELOPMENT.md docs/development/development.md
git mv docs/OPEN_SOURCE_SETUP.md docs/community/open-source.md
git mv docs/ROADMAP.md docs/product/roadmap.md
git mv docs/SCREENSHOTS.md docs/product/screenshots.md
git mv docs/LANDING_PAGE_PLAN.md docs/maintenance/landing-page-plan.md
```

Expected: `git status --short` shows renames or delete/add pairs for these files.

### Task 2: Rewrite Project Front Door and Docs Hub

**Files:**
- Modify: `README.md`
- Create: `docs/README.md`

- [ ] **Step 1: Rewrite `README.md`**

Keep badges, screenshots, short bilingual summary, feature highlights, 5-minute Docker quick start, and links to the new docs hub.

- [ ] **Step 2: Create `docs/README.md`**

Add reader-oriented sections:

- Start here
- Develop
- Deploy
- Understand the system
- Contribute
- Product and maintenance

Expected: readers can navigate without relying on README as the only index.

### Task 3: Rewrite Topic Docs

**Files:**
- Modify: `docs/getting-started/quick-start.md`
- Modify: `docs/development/development.md`
- Modify: `docs/deployment/deployment.md`
- Modify: `docs/community/open-source.md`
- Modify: moved architecture and product docs as needed

- [ ] **Step 1: Create quick start guide**

Extract Docker preview flow, default URLs, prerequisites, and first-run checks from existing docs.

- [ ] **Step 2: Clean development guide**

Remove personal machine paths and keep generic development setup, commands, migrations, frontend/backend split startup, and verification commands.

- [ ] **Step 3: Clean deployment guide**

Keep environment variables, Docker Compose behavior, production notes, reverse proxy checklist, admin access, database migrations, and verification.

- [ ] **Step 4: Clean open-source handoff**

Keep license, repository hygiene, database schema export, safe publishing checklist, and troubleshooting references.

### Task 4: Update Cross-Links

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/**/*.md`

- [ ] **Step 1: Replace old doc paths**

Replace links to:

```text
docs/DEPLOYMENT.md
docs/ARCHITECTURE.md
docs/CODEBASE_MAP.md
docs/OPEN_SOURCE_SETUP.md
docs/ROADMAP.md
docs/SCREENSHOTS.md
DEVELOPMENT.md
docs/LANDING_PAGE_PLAN.md
```

with the new topic paths.

- [ ] **Step 2: Fix relative image links**

Ensure screenshots under `docs/product/screenshots.md` link to `../../image/English.png` and `../../image/China.png`.

### Task 5: Verify

**Files:**
- Inspect: whole repository

- [ ] **Step 1: Search for stale paths**

Run:

```bash
rg -n "docs/(DEPLOYMENT|ARCHITECTURE|CODEBASE_MAP|OPEN_SOURCE_SETUP|ROADMAP|SCREENSHOTS|LANDING_PAGE_PLAN)\\.md|DEVELOPMENT\\.md"
```

Expected: no references except the implementation plan or historical design docs.

- [ ] **Step 2: Inspect markdown file list**

Run:

```bash
find . -maxdepth 4 -type f \( -name '*.md' -o -name 'LICENSE*' \) | sort
```

Expected: topic docs are under the new directories.

- [ ] **Step 3: Review diff**

Run:

```bash
git diff --stat
git diff -- README.md docs/README.md CONTRIBUTING.md
```

Expected: README is shorter, docs hub exists, and community links point to new paths.
