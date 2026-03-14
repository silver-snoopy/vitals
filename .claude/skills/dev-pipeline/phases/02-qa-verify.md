# Phase 2: QA Verify (Bugs Only)

**Skip this phase entirely for features and refactors.**

## Purpose
Reproduce the reported bug in the local environment before writing any fix.
This ensures we understand the root cause and can verify the fix later.

## Steps

### 1. Start Local Environment
```bash
# Start database
docker compose up -d

# Wait for DB to be ready
until docker compose exec -T db pg_isready; do sleep 1; done

# Start backend (background)
npm run dev -w @vitals/backend &

# Start frontend (background)
npm run dev -w @vitals/frontend &

# Wait for servers
sleep 5
```

### 2. Reproduce with Playwright
Write a temporary Playwright test that reproduces the bug:
- Create `e2e/verify-bug.spec.ts`
- Mock API data that triggers the bug condition
- Assert the broken behavior exists

```bash
npx playwright test e2e/verify-bug.spec.ts
```

### 3. Document Reproduction
Report to the user:
- Whether the bug was reproduced (yes/no)
- Steps to reproduce
- Expected vs actual behavior
- Root cause hypothesis

### 4. Cleanup
- Keep `verify-bug.spec.ts` — it becomes the regression test in Phase 6
- Stop background dev servers if they were started

## If Not Reproducible
- Document why (missing data, environment-specific, timing-dependent)
- Ask the user whether to proceed with a best-effort fix or investigate further
