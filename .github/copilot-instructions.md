# GitHub Copilot Instructions

## Project

npm workspaces monorepo: `packages/shared`, `packages/backend`, `packages/frontend`, `packages/workflows`.

## Code Style

- TypeScript with 2-space indentation
- `interface` over `type` for object shapes
- `import type` for type-only imports
- Prettier: single quotes, semicolons, 100-char print width, trailing commas
- Prefix unused variables with `_`

## Backend (Fastify)

- Route pattern: Fastify plugin with `EnvConfig` options
- Database: parameterized SQL via pg Pool — no ORM
- Protected routes: `preHandler: apiKeyMiddleware(opts.env.xApiKey)`
- Batch inserts with `ON CONFLICT DO UPDATE` for idempotency

## Frontend (React)

- State: Zustand stores + TanStack Query
- Styling: Tailwind 4 + shadcn/ui (Base UI, not Radix)
- No `asChild` prop — use `render` prop pattern instead

## Testing

- Vitest for unit tests
- Playwright for E2E (Page Object Model pattern)
- New interactive features require E2E tests
- Mock database plugin in route tests, not `app.db` directly

## Git

- Imperative mood commit messages, max 72 chars
- Feature branches: `feature/<name>` → `master`
- Run `npm run lint && npm run format:check` before committing
