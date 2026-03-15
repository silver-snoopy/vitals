# Phase 7: QA Test

## Purpose
Verify all changes work correctly through automated tests and, when applicable, live environment verification.

## Step 1: Lint & Format
```bash
npm run lint
npm run format:check
```
- Fix any errors in files YOU changed
- Pre-existing warnings in untouched files are acceptable

## Step 2: Unit Tests
```bash
npm test
```
- ALL existing tests must pass
- If your changes break existing tests, fix them

## Step 3: E2E Tests
```bash
npx playwright test
```
- ALL existing E2E tests must pass

## Step 4: Write New E2E Tests

**Required when:** New interactive UI behavior was added (buttons, forms, modals, navigation flows).

**Not required for:** Backend-only changes, type changes, style-only changes, refactors with no behavior change.

Follow the project's E2E conventions:
- **Page Object Model:** Create page object in `e2e/pages/<feature>.page.ts`
- **Fixtures:** Create API mock fixtures in `e2e/fixtures/<feature>.fixture.ts`
- **Spec:** Create test spec in `e2e/<feature>.spec.ts`
- **Naming:** Use UC IDs from product-capabilities.md in test descriptions
- **API Mocking:** Route interception with deterministic fixture data (no real backend)
- **Selectors:** Prefer `getByRole()`, `getByText()`, then `[data-slot="..."]` attributes

Run new tests:
```bash
npx playwright test e2e/<feature>.spec.ts
```

## Step 5: Live Environment Verification (Bugfixes: REQUIRED / Features: Optional)

**Required for bugfixes:** You MUST verify the fix on the live local environment by repeating the same user action from Phase 2 and capturing a **"fix verified" screenshot** showing the corrected behavior.

**Optional for features:** UI changes that benefit from visual verification beyond mocked E2E tests.

```bash
# Ensure local environment is running
docker compose up -d
npm run dev -w @vitals/backend &
npm run dev -w @vitals/frontend &
```

Use Playwright to drive the real UI (no mocking) and capture evidence:

```javascript
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000/<affected-page>');
// Perform the same action that triggered the bug in Phase 2
// ...
await page.screenshot({ path: 'fix-verified.png', fullPage: true });
await browser.close();
```

**The screenshot (`fix-verified.png`) is temporary** — it will be referenced in the PR body (Phase 9) and deleted after the PR is created.

## Step 6: Bug Regression (Bugfixes Only)

If `e2e/verify-bug.spec.ts` was created in Phase 2:
1. Rename it to a permanent test file with a descriptive name
2. Update it to assert the FIXED behavior (not the broken behavior)
3. Run it to confirm the fix:
```bash
npx playwright test e2e/<renamed-file>.spec.ts
```

## Checklist
- [ ] `npm run lint` — 0 errors
- [ ] `npm run format:check` — changed files pass
- [ ] `npm test` — all unit tests pass
- [ ] `npx playwright test` — all E2E tests pass
- [ ] New E2E tests written (if applicable)
- [ ] New E2E tests pass
- [ ] **(Bugfixes)** Fix verified on live UI with screenshot saved as `fix-verified.png`
