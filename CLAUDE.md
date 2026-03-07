# Personal Claude Preferences

## Communication Style
- Be concise and direct
- Prefer code examples over lengthy explanations

## Code Preferences
- Use 4-space indentation for Java, 2-space for everything else
- Prefer explicit types over `var` in Java
- In TypeScript, use `interface` over `type` for object shapes

## Git Workflow
- Commit messages: imperative mood, max 72 chars on first line
- Include body for non-trivial changes
- Reference issue numbers when applicable

## Project Structure
- npm workspaces monorepo: `packages/shared`, `packages/backend`, `packages/frontend`, `packages/workflows`
- Shared types: `@vitals/shared` — build first, other packages depend on it
- Backend: Fastify + TypeScript on port 3001
- Frontend: React + Vite + Tailwind on port 3000
- Build order: shared → backend → frontend
- Local dev DB: `docker compose up -d` (PostgreSQL 16 on port 5432)
- Tests: `npm run test` (Vitest across all packages)