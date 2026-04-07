# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a clean workspace with no committed source tree yet. Keep the layout simple as the project grows:

- `src/` for application code
- `assets/` for static files such as images or fixtures
- `docs/` for design notes, API contracts, or architecture decisions

Group code by feature or domain instead of dumping unrelated files at the root. Example: `src/chat/`, `src/auth/`, `docs/api/`.

## AI Navigation
Before making changes, read `docs/CODEBASE_MAP.md`.
Use it as the primary locator for entry points, feature ownership, and "change X -> edit Y" mappings.

## Build, Test, and Development Commands
Document active commands in `DEVELOPMENT.md`. Do not spread command references across extra markdown files.

Expected baseline:

- `make setup` or equivalent: install dependencies and local tooling
- `make test`: run the full automated test suite
- `make lint`: run formatting and static checks
- `make dev`: start the local development entry point

Prefer a single task runner entry point over many undocumented ad hoc commands.

## Coding Style & Naming Conventions
Use 4 spaces for indentation unless the selected language standard requires otherwise. Name files and directories consistently and predictably:

- `snake_case` for folders and non-class modules
- `PascalCase` for class or component files when the language ecosystem expects it
- `UPPER_SNAKE_CASE` for environment variables and constants

Adopt an autoformatter and linter as soon as tooling exists. Do not merge code that requires manual reformatting to read cleanly.

## Testing Guidelines
This repository currently does not keep automated test files in-tree. If tests are reintroduced later, place them under `tests/` and mirror the source layout.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so use a conventional, imperative style now: `feat: add chat session model`, `fix: handle empty payload`. Keep commits focused and reviewable.

Pull requests should include a short summary, testing notes, linked issue or task ID when available, and screenshots or logs for UI or behavior changes.
