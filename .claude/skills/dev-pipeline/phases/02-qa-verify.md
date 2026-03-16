# Phase 2: QA Verify (Bugs Only)

**Skip this phase entirely for features and refactors.**

## Purpose
Reproduce the reported bug on the **live local environment** by exercising the feature through the UI.
Mocked tests are NOT sufficient for bug reproduction — you must see the bug happen in the real running system.

## Steps

### 1. Start the Full Local Stack

All three services must be running simultaneously:

```bash
docker compose up -d
```

Start the backend and frontend in separate terminals, tabs, tmux panes, or shell-appropriate background jobs:

```bash
npm run dev -w @vitals/backend
npm run dev -w @vitals/frontend
```

**Verify all services are healthy before proceeding:**
- Database: `docker compose exec -T db pg_isready`
- Backend: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/reports` → 200
- Frontend: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200

**Port conflict check:** If a service fails to start, use your shell or OS-appropriate process inspection tools to find listeners on the relevant port and stop the conflicting process before retrying.

### 2. Reproduce the Bug on the Live UI

Use Playwright (via `node -e 'require("playwright")...'` scripts) to drive the **real running frontend** — no route mocking, no fixture data. The browser must hit the actual backend and database.

**Required for every bug:**
1. Navigate to the affected page in the live UI
2. Perform the user action that triggers the bug
3. Capture a **screenshot** of the broken state
4. Save the screenshot to the project root (e.g., `bug-repro.png`)

```javascript
// Example: Playwright script against live local UI
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Hit the REAL frontend — no mocking
await page.goto('http://localhost:3000/<affected-page>');
await page.waitForSelector('<content-selector>', { timeout: 15000 });

// Perform the action that triggers the bug
// ...

// Capture evidence
await page.screenshot({ path: 'bug-repro.png', fullPage: true });
await browser.close();
```

**Do NOT:**
- Use `page.route()` to mock API responses during reproduction
- Run mocked E2E tests (`npx playwright test`) as a substitute for live verification
- Reproduce via `curl` alone if the bug has any UI component
- Skip the screenshot

**Backend-only bugs (no UI):** If the bug is purely in API response data (wrong values, missing fields), you may reproduce via `curl` to the live backend. But if the user reports seeing the bug in the UI, you MUST reproduce it through the UI.

### 3. Check Existing Test Coverage

After reproducing the live bug, also check whether existing tests catch it:
- `e2e/*.spec.ts` — E2E tests with mocked data
- `packages/backend/src/**/__tests__/` — backend unit tests
- `packages/frontend/src/**/__tests__/` — frontend unit tests

Note: mocked E2E tests may pass while the live system is broken (wrong mock data, missing integration issues). This is expected and is exactly why live reproduction is required.

### 4. Document Reproduction

Report to the user:
- **Reproduced:** yes/no
- **Screenshot:** path to the captured screenshot
- **Steps to reproduce:** exact user actions
- **Expected vs actual behavior**
- **Root cause hypothesis**

### 5. Cleanup

Delete any temporary screenshots (`bug-repro.png`) after the fix is verified.

At the **User Gate** (Phase 3 → 4 boundary), ask the user:
> "Should we add a permanent regression test for this bug to the existing test suite?"

- If yes → write a proper test in the appropriate location during Phase 5 (Implementation)
- If no → the existing test coverage is sufficient

## If Not Reproducible
- Verify all services are actually running and healthy (re-check step 1)
- Check for environment issues: wrong `.env` values, stale database, port conflicts
- Document why reproduction failed (missing data, environment-specific, timing-dependent)
- Ask the user whether to proceed with a best-effort fix or investigate further
