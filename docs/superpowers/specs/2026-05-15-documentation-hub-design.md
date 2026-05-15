# SKLinkChat Documentation Hub Design

## Goal / 目标

Reorganize SKLinkChat documentation into a bilingual hub-and-spoke structure that is easy for first-time visitors, contributors, deployers, and maintainers to navigate.

将 SKLinkChat 文档整理成中英双语的中心导航结构，让首次访问者、贡献者、部署者和维护者都能快速找到对应入口。

## Current Problems / 当前问题

- `README.md`, `docs/DEPLOYMENT.md`, `docs/OPEN_SOURCE_SETUP.md`, and `DEVELOPMENT.md` repeat quick-start, environment, and development instructions.
- `DEVELOPMENT.md` includes machine-specific PostgreSQL paths, which are useful locally but not appropriate as public community documentation.
- `docs/` is flat, so product, deployment, architecture, and community materials are mixed at the same level.
- There is no central documentation index under `docs/`, so README has to carry too much navigation weight.

## Selected Approach / 选定方案

Use a hub-and-spoke documentation layout:

- `README.md` stays as the project front door.
- `docs/README.md` becomes the documentation hub.
- Topic documents move into focused subdirectories.
- Root community files remain in the root because GitHub recognizes them there.

This follows common open-source repository patterns while keeping bilingual content practical to maintain.

## Target Structure / 目标结构

```text
README.md
CONTRIBUTING.md
SECURITY.md
CHANGELOG.md
LICENSE
docs/
  README.md
  getting-started/
    quick-start.md
  development/
    development.md
  deployment/
    deployment.md
  architecture/
    overview.md
    codebase-map.md
  community/
    open-source.md
  product/
    roadmap.md
    screenshots.md
  maintenance/
    landing-page-plan.md
```

## File Responsibilities / 文件职责

### `README.md`

The README should be concise and high-signal:

- bilingual project summary
- badges
- screenshots
- feature highlights
- 5-minute Docker quick start
- main documentation links
- community and license links

It should not contain full deployment, environment-variable, database, or manual development instructions.

### `docs/README.md`

The documentation hub should route readers by intent:

- new users: quick start and screenshots
- developers: development guide and codebase map
- deployers: deployment guide
- contributors: contributing, security, roadmap
- maintainers: open-source handoff and maintenance notes

### Getting Started

`docs/getting-started/quick-start.md` should contain the fastest local preview path, URLs, prerequisites, and common first-run checks.

### Development

`docs/development/development.md` should contain reusable development setup and commands. Remove personal machine paths and keep any local-only notes generic.

### Deployment

`docs/deployment/deployment.md` should contain environment variables, Docker Compose behavior, production topology, reverse proxy notes, database migrations, admin access, and verification.

### Architecture

`docs/architecture/overview.md` should explain the system shape and core runtime boundaries.

`docs/architecture/codebase-map.md` should remain a practical file map for humans and AI agents.

### Community

`docs/community/open-source.md` should preserve open-source handoff details, database schema export instructions, and repository hygiene guidance.

### Product

`docs/product/roadmap.md` and `docs/product/screenshots.md` should keep roadmap and visual preview content separate from setup material.

### Maintenance

`docs/maintenance/landing-page-plan.md` should hold the existing landing-page implementation notes because they are internal planning material, not first-run user documentation.

## Link Compatibility / 链接兼容

After moving documents, update all repository links that point to old paths:

- README navigation
- CONTRIBUTING references
- moved docs cross-links
- any issue or PR template references if present

No redirect stubs are required unless external consumers need the old doc URLs. For this cleanup, direct link updates are sufficient.

## Testing / 验证

Documentation verification should include:

- scan Markdown links for stale old paths
- run `make lint`, `make test`, and `make build` only if code or config changes occur
- at minimum, run a repository-wide search for old doc paths after the move

## Out of Scope / 不做范围

- rewriting product functionality
- changing Docker, Python, or frontend behavior
- creating a hosted demo site
- splitting the repository into English and Chinese documentation trees
