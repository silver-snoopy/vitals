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

### 2. Check for Existing Test Coverage

Before writing a new spec, search the existing test suite for tests that already cover the bug area:
- Check `e2e/*.spec.ts` for E2E tests covering the affected UI flow
- Check `packages/backend/src/**/__tests__/` for unit tests covering the affected logic
- Check `packages/frontend/src/**/__tests__/` for frontend unit tests

**If a matching test exists:** Use it to reproduce the bug (modify assertions if needed to confirm broken behavior). Skip creating a temporary spec.

### 3. Reproduce the Bug

**If no matching test exists**, write a temporary Playwright spec:
- Create `e2e/verify-bug.spec.ts`
- For **UI bugs:** Mock API data that triggers the bug condition, assert the broken behavior
- For **backend/API bugs:** Hit the real local backend (no mocking) to observe actual error responses
- Keep the spec focused — test only the bug scenario, not a full feature

```bash
npx playwright test e2e/verify-bug.spec.ts
```

**If the bug is backend-only** (no UI involvement), prefer reproducing via `curl` or direct API calls instead of Playwright.

### 4. Document Reproduction
Report to the user:
- Whether the bug was reproduced (yes/no)
- Steps to reproduce
- Expected vs actual behavior
- Root cause hypothesis

### 5. Cleanup

Delete `e2e/verify-bug.spec.ts` after documenting findings. The temporary spec is **not** kept automatically.

At the **User Gate** (Phase 3 → 4 boundary), ask the user:
> "Should we add a permanent regression test for this bug to the existing test suite?"

- If yes → write a proper test in the appropriate location during Phase 5 (Implementation)
- If no → the existing test coverage is sufficient

## If Not Reproducible
- Document why (missing data, environment-specific, timing-dependent)
- Ask the user whether to proceed with a best-effort fix or investigate further
