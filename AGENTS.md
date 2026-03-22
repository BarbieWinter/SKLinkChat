# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a clean workspace with no committed source tree yet. Keep the layout simple as the project grows:

- `src/` for application code
- `tests/` for automated tests
- `assets/` for static files such as images or fixtures
- `docs/` for design notes, API contracts, or architecture decisions

Group code by feature or domain instead of dumping unrelated files at the root. Example: `src/chat/`, `src/auth/`, `tests/chat/`.

## Build, Test, and Development Commands
No build system is configured yet. When the first runtime is introduced, add the project manifest and document the exact commands here and in the main README.

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
Place tests under `tests/` and mirror the source layout. Use descriptive names such as `tests/chat/test_message_delivery.*` or `message_delivery.test.*`, depending on the framework. Add unit tests for new logic and integration tests for workflow boundaries. Treat missing tests for new behavior as a gap, not an optional follow-up.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so use a conventional, imperative style now: `feat: add chat session model`, `fix: handle empty payload`. Keep commits focused and reviewable.

Pull requests should include a short summary, testing notes, linked issue or task ID when available, and screenshots or logs for UI or behavior changes.
