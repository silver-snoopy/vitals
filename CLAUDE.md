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
- **Update `docs/architecture.md`** when adding or modifying: services, routes/endpoints, database tables, or `@vitals/shared` interfaces. The file tree, API endpoints table, and data model table must stay in sync with the code.
- Feature spec template: `.claude/skills/dev-pipeline/templates/feature-spec.md`

## Development Pipeline
- **Full pipeline:** `/dev-pipeline <spec-file-or-description>` — orchestrated 9-phase workflow
- **Phases:** Read Spec → QA Verify (bugs) → Research → User Gate → Analyze & Plan → Implement → Code Review → QA Test → Update Docs → Commit & PR
- **Skill location:** `.claude/skills/dev-pipeline/` with phase reference docs in `phases/`
- **Hooks:** `.claude/settings.json` — auto-format with Prettier on every Edit/Write (PostToolUse hook)
- **User gate:** Agent MUST stop after Phase 3 (Research) to get user approval before writing code
- **Plan gate:** Phase 4 writes implementation plan to `docs/plans/` before any code is written
- **Documentation gate:** Phase 8 requires updating `docs/product-capabilities.md` for all user-facing changes

## ADE — Agentic Development Environment (v4)

### Workflow

When asked to implement a feature or fix a bug using the ADE workflow
(triggered by /ade-full or when the user says "use ADE"):

**Phase 0 — INTENT**: Extract structured requirements from the task:
- Type: feature | bugfix | refactor
- Goal: one-sentence summary
- Acceptance criteria: bullet list of what "done" looks like
- Affected areas: which packages/features are likely impacted
- Estimated scope: S (< 3 files) | M (3-10 files) | L (> 10 files)
- Save to `.ade/tasks/<task-id>/intent.md`

**Phase 1 — RESEARCH**: Launch up to 3 Explore agents in parallel:
1. Existing implementation — files, functions, execution paths involved
2. Related patterns — how similar features work elsewhere in the codebase
3. Reusable utilities — shared helpers, hooks, components that can be reused

**◆ USER GATE ◆**: STOP. Present research findings and proposed approach.
Get explicit approval before proceeding.

**Phase 2 — PLAN**: Write implementation plan to `.ade/tasks/<task-id>/plan.md`
with 6 mandatory sections: Context, Ordered task list, Files to create/modify,
Dependencies, Test strategy, Risk areas.

**◆ PLAN GATE ◆**: Verify plan completeness before proceeding.

**Phase 3 — DESIGN CHECK**: Dispatch a Sonnet subagent in a worktree to
create file stubs. Review for plan alignment (max 2 iterations).

**Phase 4 — IMPLEMENT**: Dispatch 1-3 Sonnet subagents in the worktree.
Each agent owns specific files — no overlap.
Enforce build order: shared types → backend → frontend.

**Phase 5 — QUALITY GATE**: Dispatch Haiku subagent to run build + tests.
If failures, dispatch Sonnet fixer subagent (max 3 attempts).

**Phase 6 — REVIEW**: Launch 3 parallel Sonnet review subagents:
- Logic: errors, edge cases, null handling, race conditions
- Conventions: project patterns, naming, structure
- Security: OWASP top 10, injection, auth bypass, secrets
Fix all HIGH and MEDIUM findings before proceeding.

**Phase 7 — VERIFY**: Run full test suite. Capture evidence for each
acceptance criterion from Phase 0.

**Phase 8 — DOCUMENTATION**: Update affected project documentation.
Check each trigger: (1) new/changed services or file tree → update `docs/architecture.md` tree,
(2) new/changed routes → update `docs/architecture.md` API endpoints table,
(3) new/changed tables → update `docs/architecture.md` data model table,
(4) user-facing feature → update `docs/product-capabilities.md`.

**Phase 9 — COMMIT & PR**: Stage, commit, push, open PR.

**◆ MERGE GATE ◆**: Present PR to user for review and merge decision.

**Phase 10 — RETROSPECTIVE**: Record metrics and learnings.
Save to `.ade/tasks/<task-id>/retro.json`. Clean up worktree.

### Circuit Breaker
- Design check: max 2 iterations
- Code→review loop: max 3 cycles
- QA fix: max 3 iterations
- Verify→review reject: max 2 cycles
After any limit, escalate to user. Do NOT retry silently.

### Orchestrator Rules
- The orchestrator NEVER writes application code — only dispatches subagents
- All code changes flow through subagents (Sonnet for coding/review, Haiku for tests)
- Verify subagent output independently — don't trust self-reports
- Update `.ade/tasks/<task-id>/status.md` at each phase transition

### Models
- Orchestration, planning, review, verification: Claude Opus (this session)
- Coding, fixing, design review: Claude Sonnet (subagents)
- Test execution: Claude Haiku (subagents)
