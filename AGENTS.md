# AI Agent Instructions

Cross-tool instructions for AI coding agents (Claude Code, Gemini CLI, Codex, Cursor, Copilot, etc.).

## Project Overview

Personal health data management monorepo (npm workspaces).

| Package | Stack | Port |
|---------|-------|------|
| `packages/shared` | TypeScript types/interfaces | — |
| `packages/backend` | Fastify 5 + TypeScript | 3001 |
| `packages/frontend` | React 19 + Vite + Tailwind 4 | 3000 |
| `packages/workflows` | n8n workflow definitions | — |

## Quick Start

```bash
npm install
docker compose up -d          # PostgreSQL 16 on port 5432
npm run build -w @vitals/shared
npm run dev -w @vitals/backend
npm run dev -w @vitals/frontend
```

## Build Order

`@vitals/shared` must build first — other packages depend on it.

```
shared → backend → frontend
```

## Code Conventions

- **TypeScript:** 2-space indent, `interface` over `type` for object shapes, `import type` for type-only imports
- **Formatting:** Prettier — single quotes, semicolons, 100-char print width, trailing commas
- **Linting:** ESLint flat config with typescript-eslint
- **Unused variables:** Prefix with `_` (e.g., `_unused`)
- **No ORM:** Direct parameterized SQL via pg Pool
- **Backend routes:** Fastify plugin pattern with `EnvConfig` options
- **Frontend state:** Zustand stores + TanStack Query for server state

## Testing

```bash
npm run test                                    # all unit tests (Vitest)
npm run test:integration -w @vitals/backend     # integration tests
npm run test:e2e                                # Playwright E2E
```

- Unit tests: Vitest across all packages
- Integration tests: `*.integration.test.ts` (excluded from default run)
- E2E: Playwright with Page Object Model pattern
- New interactive features require E2E tests

## Git Workflow

- Commit messages: imperative mood, max 72 chars first line
- Feature branches: `feature/<name>`, merge to `master`
- Before committing: `npm run lint && npm run format:check` must pass

## Documentation

- Architecture: `docs/architecture.md`
- Product capabilities: `docs/product-capabilities.md`
- Implementation plans: `docs/plans/`
- Decision records: `docs/research/`
- New features must be added to `docs/product-capabilities.md`

## Environment Variables

Copy `.env.example` and fill in values. Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `AI_PROVIDER` — `claude` or `gemini`
- `AI_API_KEY` — API key for the selected provider
- `X_API_KEY` — API key for protected routes
