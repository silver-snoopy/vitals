# Personal Claude Preferences

## Developer Setup (AI Tooling)

New machine? Run the setup script to install required Claude Code plugins:

```bash
bash scripts/setup-claude.sh
```

Or install manually:

```bash
claude plugin install superpowers
```

### What's included in the repo

| File | Purpose | Shared? |
|------|---------|---------|
| `AGENTS.md` | Cross-tool AI agent instructions | Yes |
| `.github/copilot-instructions.md` | GitHub Copilot instructions | Yes |
| `.claude/settings.json` | Hooks, permissions, enabled plugins | Yes |
| `.claude/settings.local.json` | Machine-specific permissions | No (gitignored) |
| `.claude/skills/` | Project-specific Claude Code skills | Yes |
| `.mcp.json` | Shared MCP server declarations | Yes |

### Required plugins

- **superpowers** (`claude-plugins-official`) — brainstorming, planning, code review, TDD workflows

### MCP servers

Add project-scoped MCP servers via:
```bash
claude mcp add --scope project <name> <command>
```
These are stored in `.mcp.json` and shared with all team members.

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
- Feature branches: `feature/<name>`, merge to `master`

## Project Structure
- npm workspaces monorepo: `packages/shared`, `packages/backend`, `packages/frontend`, `packages/workflows`
- Shared types: `@vitals/shared` — build first, other packages depend on it
- Backend: Fastify + TypeScript on port 3001
- Frontend: React + Vite + Tailwind on port 3000
- Build order: shared → backend → frontend
- Local dev DB: `docker compose up -d` (PostgreSQL 16 on port 5432)
- Tests: `npm run test` (Vitest across all packages)

## Design System
- **Font:** JetBrains Mono Variable (all text — headings, body, data)
- **Color palette:** Healthcare cyan primary (`#0891B2`), analytics blue secondary (`#3B82F6`), orange accent (`#F97316`)
- **CSS variables:** OKLch color space in `src/index.css` — light + dark mode, mapped via `@theme inline`
- **Extra tokens:** `--success` (`#059669`) and `--warning` (`#D97706`) — use `text-success`, `bg-warning` etc.
- **Chart colors:** Centralized in `src/lib/chart-config.ts` — calories(orange), protein(blue), carbs(yellow), fat(red), fiber(green), weight(purple), volume(cyan)
- **KPI component:** `src/components/ui/kpi-card.tsx` — compact card with trend arrows (▲/▼/→)
- **Sparkline component:** `src/components/charts/Sparkline.tsx` — tiny inline Recharts LineChart
- **Design spec:** `docs/research/2026-03-17-ui-ux-transformation-plan.md`

## Backend Conventions
- **Routes:** Fastify plugin pattern — `async function routes(app: FastifyInstance, opts: { env: EnvConfig })`
- **Route registration:** In `app.ts` via `await app.register(routes, { env })`
- **DB access:** `app.db` (pg.Pool decorated via `plugins/database.ts`)
- **DB queries:** Direct parameterized SQL via pg Pool — no ORM
- **Protected routes:** `preHandler: apiKeyMiddleware(opts.env.xApiKey)`
- **Env config:** All env vars in `EnvConfig` interface (`config/env.ts`), loaded via `loadEnv()`
- **Normalizers:** Input `Record<string, unknown>` → output typed Row (`MeasurementRow`, `WorkoutSetRow`)
- **Ingest:** 500-row batch INSERT with `ON CONFLICT DO UPDATE` for idempotent upserts
- **Providers:** Implement `DataProvider` from `@vitals/shared`, registered via `register.ts`

## Linting & Formatting
- **Prettier:** Enforced via `.prettierrc` — single quotes, semicolons, 100-char print width, trailing commas
- **ESLint:** Flat config (`eslint.config.js`) — typescript-eslint recommended + React/React Hooks for frontend
- **Run lint:** `npm run lint` (ESLint), `npm run format:check` (Prettier)
- **Auto-fix:** `npm run lint:fix` (ESLint), `npm run format` (Prettier)
- **Key rules:** `consistent-type-imports` (use `import type`), `no-unused-vars` (prefix unused with `_`), `no-explicit-any` (warn in src, off in tests)
- **React rules:** `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`
- **Before committing:** Run `npm run lint` and `npm run format:check` — both must pass

## Testing Conventions
- Framework: Vitest
- Mock database: `vi.mock('../../plugins/database.js', () => ({ databasePlugin: async (app) => { app.decorate('db', {}); } }))`
- Route tests: Fastify `app.inject()` with `testEnv` object matching `EnvConfig`
- Integration tests: `*.integration.test.ts` — excluded from default run via `vitest.config.ts`
- Run integration tests: `npm run test:integration -w @vitals/backend`
- **E2E tests:** Playwright — `npm run test:e2e` (auto-starts frontend dev server)
- **E2E convention:** New user-facing features that add or change interactive behavior (buttons, forms, flows) must include E2E tests
- **E2E pattern:** Page Object Model — page objects in `e2e/pages/`, fixtures in `e2e/fixtures/`, specs in `e2e/`
- **E2E API mocking:** Route interception with deterministic fixture data — no real backend needed

## Documentation
- Architecture: `docs/architecture.md`
- Product capabilities: `docs/product-capabilities.md` (living document — use-case catalog with E2E traceability)
- Implementation plans: `docs/plans/` (dated, versioned by phase)
- Decision records: `docs/research/` (dated ADR-style documents)
- **New features must be added to `docs/product-capabilities.md`** with a use-case ID (e.g., UC-RPT-05), user story, behavior description, and E2E coverage reference
- Feature spec template: `.claude/skills/dev-pipeline/templates/feature-spec.md`

## Development Pipeline
- **Full pipeline:** `/dev-pipeline <spec-file-or-description>` — orchestrated 9-phase workflow
- **Phases:** Read Spec → QA Verify (bugs) → Research → User Gate → Analyze & Plan → Implement → Code Review → QA Test → Update Docs → Commit & PR
- **Skill location:** `.claude/skills/dev-pipeline/` with phase reference docs in `phases/`
- **Hooks:** `.claude/settings.json` — auto-format with Prettier on every Edit/Write (PostToolUse hook)
- **User gate:** Agent MUST stop after Phase 3 (Research) to get user approval before writing code
- **Plan gate:** Phase 4 writes implementation plan to `docs/plans/` before any code is written
- **Documentation gate:** Phase 8 requires updating `docs/product-capabilities.md` for all user-facing changes
