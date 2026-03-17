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

## Step 5: Live Environment UI Verification (MANDATORY when UI is affected)

**Required when ANY of these apply:**
1. **Frontend UI changes** — new or modified components, dialogs, forms, layout, styling, or interactive behavior
2. **New frontend features** — any feature that introduces new UI elements or pages
3. **Backend changes that affect UI rendering** — extended API response fields, new data shapes, or modified payloads that are consumed and displayed by the frontend

**The key question:** Will a user see something different on screen as a result of this change? If yes → mandatory.

**Not required for:** Backend-only changes with no UI consumer, type-only changes, config changes, CI/CD changes, or refactors with no visible UI impact.

**Why mandatory:** Mocked E2E tests verify behavior against intercepted routes, but cannot catch rendering issues, styling problems, or integration bugs that only surface against a real running environment. Visual evidence provides confidence that the feature actually works as intended.

### Procedure

1. **Start the local environment:**
```bash
docker compose up -d
```

Start the backend and frontend in separate terminals, tabs, tmux panes, or shell-appropriate background jobs:

```bash
npm run dev -w @vitals/backend
npm run dev -w @vitals/frontend
```

2. **Write a temporary Playwright visual test** at `e2e/visual-test-<feature>.spec.ts`:
   - Navigate to the affected page(s) on `http://localhost:3000`
   - Exercise the new/changed UI (open dialogs, fill forms, trigger interactions)
   - Capture screenshots at key states (initial, interaction, result)
   - Assert that critical elements are visible

```typescript
import { test, expect } from '@playwright/test';

test.describe('Visual: <Feature Name>', () => {
  test('<description of what is being verified>', async ({ page }) => {
    await page.goto('http://localhost:3000/<affected-page>');
    await page.waitForLoadState('networkidle');

    // Screenshot 1: initial state
    await page.screenshot({ path: 'e2e/screenshots/01-initial.png', fullPage: true });

    // Interact with the UI
    // ...

    // Screenshot 2: after interaction
    await page.screenshot({ path: 'e2e/screenshots/02-interaction.png', fullPage: true });

    // Assert key elements
    await expect(page.getByRole('...', { name: '...' })).toBeVisible();
  });
});
```

3. **Run the visual test:**
```bash
npx playwright test e2e/visual-test-<feature>.spec.ts --headed
```

Create the screenshots directory first if needed:
```bash
mkdir -p e2e/screenshots
```

4. **Present screenshots to the user** using whatever image or file-sharing mechanism is available in the current environment.

5. **Upload screenshots for PR evidence:**
Upload the verification screenshots to the GitHub repo using `gh` so they can be referenced in the PR body (Phase 9). Use the repo's issue/PR image upload or attach them as PR comment images.

```bash
# Upload each screenshot and capture the returned markdown image URL
gh issue create --title "tmp-upload" --body "![screenshot](screenshot.png)" --repo <owner>/<repo>
# Or attach via PR comment after PR is created
```

**Preferred method:** After the PR is created in Phase 9, add a comment with the screenshots:
```bash
gh pr comment <PR_NUMBER> --body "## Visual Verification\n\n![description](url)"
```

**Alternative:** If `gh` image upload is not feasible, keep screenshots in `e2e/screenshots/` and commit them to the PR branch before pushing. Add `e2e/screenshots/` to `.gitignore` after the PR is merged.

The key requirement is that **verification evidence must be attached to the PR** so reviewers can see it. Screenshots must not be silently deleted.

6. **Clean up after PR attachment:**
Delete the temporary visual test file. Screenshots can be deleted locally after they are uploaded to the PR.

### For bugfixes specifically
Repeat the same user action from Phase 2 that originally triggered the bug. The screenshot should clearly show the corrected behavior.

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
- [ ] **(UI changes)** Live UI verified with Playwright screenshots presented to user
- [ ] **(UI changes)** Temporary visual test and screenshots cleaned up
- [ ] **(Bugfixes)** Same bug action from Phase 2 repeated, screenshot shows fix
