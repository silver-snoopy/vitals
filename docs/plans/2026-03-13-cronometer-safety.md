# Cronometer Safety Improvements

**Date:** 2026-03-13
**Goal:** Prevent Cronometer rate-limit lockouts by backporting missing error detection from the legacy project and adding a standalone smoke-test script.

## Context

- Cronometer has no official API — vitals scrapes via GWT-RPC + cookie auth
- Failed login attempts trigger a 15-minute lockout after too many tries
- The legacy project (`c:/projects/health`) has battle-tested auth code with rate-limit detection
- Vitals' `client.ts` is missing two critical checks present in the legacy version
- The n8n Daily Collection workflow calls `POST /api/collect` which triggers Cronometer auth — we must validate locally before activating

## Part A — Backport rate-limit detection into `client.ts`

**File:** `packages/backend/src/services/collectors/cronometer/client.ts`

### A1. Add `parseLoginResponse()` function

Port from legacy `cronometer_auth.ts:308-323`. Parses JSON error bodies from the login endpoint.

```typescript
function parseLoginResponse(
  contentType: string | null,
  body: string,
): { success?: boolean; error?: string } | null {
  const isJson = (contentType ?? '').toLowerCase().includes('application/json');
  const trimmed = body.trim();
  if (!isJson && !trimmed.startsWith('{')) return null;
  try {
    return JSON.parse(trimmed) as { success?: boolean; error?: string };
  } catch {
    return null;
  }
}
```

### A2. Update `looksLikeLoginFailure()` to detect rate limiting

Add the two missing patterns from legacy `cronometer_auth.ts:325-336`:

```typescript
function looksLikeLoginFailure(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('invalid') ||
    lower.includes('incorrect') ||
    lower.includes('authentication failed') ||
    lower.includes('too many attempts') ||    // NEW
    lower.includes('try again later') ||      // NEW
    lower.includes('two-factor') ||
    lower.includes('mfa')
  );
}
```

### A3. Update `ensureLogin()` to use `parseLoginResponse()`

In the `response.status === 200` branch of `ensureLogin()` (around line 130), read the response body and check for JSON errors before falling through to `looksLikeLoginFailure()`:

**Current code (lines 130-134):**
```typescript
} else if (response.status === 200) {
  const text = await response.text();
  if (looksLikeLoginFailure(text)) {
    throw new Error('Cronometer login failed (invalid credentials or MFA required)');
  }
}
```

**Replace with:**
```typescript
} else if (response.status === 200) {
  const text = await response.text();
  const loginResponse = parseLoginResponse(response.headers.get('content-type'), text);
  if (loginResponse?.error) {
    throw new Error(`Cronometer login failed: ${loginResponse.error}`);
  }
  if (loginResponse && loginResponse.success === false) {
    throw new Error('Cronometer login failed: unknown response');
  }
  if (looksLikeLoginFailure(text)) {
    throw new Error('Cronometer login failed (invalid credentials or MFA required)');
  }
}
```

### A4. Add unit tests

**File:** `packages/backend/src/services/collectors/cronometer/__tests__/client.test.ts` (new file)

Tests to add (all use mocked `globalThis.fetch`, no real HTTP calls):

1. **`parseLoginResponse` returns error from JSON body** — mock login endpoint returning `{"error":"Too Many Attempts..."}`, verify `ensureLogin` throws with that message
2. **`looksLikeLoginFailure` catches rate-limit text** — mock login returning `"too many attempts"` in body, verify throw
3. **Happy path still works** — mock full 5-request flow (CSRF → login → GWT auth → GWT token → export), verify CSV returned
4. **Missing credentials throws immediately** — no fetch calls made

Reference: legacy test at `c:/projects/health/tests/cronometer_auth.test.ts` for mock patterns (create sequential `Response` objects, override `globalThis.fetch`).

## Part B — Standalone smoke-test script

**File:** `packages/backend/scripts/test-cronometer.ts`

### B1. Script behavior

- Reads env vars from `.env` (via dotenv): `CRONOMETER_USERNAME`, `CRONOMETER_PASSWORD`, `CRONOMETER_GWT_HEADER`, `CRONOMETER_GWT_PERMUTATION`
- Instantiates `CronometerGwtClient` (same class used in production)
- Calls `exportDailyNutrition()` for yesterday only (1-day range = minimal API load)
- Prints first 5 lines of CSV output on success
- Prints error message on failure
- Exits with code 0 (success) or 1 (failure)
- **No retries** — if it fails, it fails immediately

### B2. Script template

```typescript
import 'dotenv/config';
import { CronometerGwtClient } from '../src/services/collectors/cronometer/client.js';

async function main() {
  const { CRONOMETER_USERNAME, CRONOMETER_PASSWORD, CRONOMETER_GWT_HEADER, CRONOMETER_GWT_PERMUTATION } = process.env;

  if (!CRONOMETER_USERNAME || !CRONOMETER_PASSWORD) {
    console.error('Missing CRONOMETER_USERNAME or CRONOMETER_PASSWORD in .env');
    process.exit(1);
  }
  if (!CRONOMETER_GWT_HEADER || !CRONOMETER_GWT_PERMUTATION) {
    console.error('Missing CRONOMETER_GWT_HEADER or CRONOMETER_GWT_PERMUTATION in .env');
    process.exit(1);
  }

  const client = new CronometerGwtClient(
    CRONOMETER_USERNAME,
    CRONOMETER_PASSWORD,
    CRONOMETER_GWT_HEADER,
    CRONOMETER_GWT_PERMUTATION,
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  console.log(`Testing Cronometer export for ${yesterday.toISOString().slice(0, 10)}...`);

  try {
    const csv = await client.exportDailyNutrition(yesterday, yesterday);
    const lines = csv.split('\n').filter(Boolean);
    console.log(`Success! Got ${lines.length} lines:`);
    lines.slice(0, 5).forEach((line) => console.log(`  ${line}`));
    if (lines.length > 5) console.log(`  ... and ${lines.length - 5} more`);
  } catch (err) {
    console.error('Cronometer test FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
```

### B3. Run command

```bash
npx tsx packages/backend/scripts/test-cronometer.ts
```

### B4. Add npm script (optional convenience)

In `packages/backend/package.json`:
```json
"test:cronometer": "tsx scripts/test-cronometer.ts"
```

## Implementation Order

1. **A2** — Update `looksLikeLoginFailure()` (1 min, 2 lines)
2. **A1** — Add `parseLoginResponse()` (2 min, copy from legacy)
3. **A3** — Update `ensureLogin()` to use it (2 min)
4. **A4** — Add unit tests for client.ts (10 min)
5. **B1-B3** — Create smoke-test script (5 min)
6. **B4** — Add npm script (1 min)
7. Run `npm run lint && npm run format:check` — fix any issues
8. Run `npm test -w @vitals/backend` — all tests pass
9. Run smoke test locally with real credentials — verify it works
10. If smoke test passes → activate Daily Collection workflow in n8n

## Files Changed

| File | Action |
|------|--------|
| `packages/backend/src/services/collectors/cronometer/client.ts` | Edit — add `parseLoginResponse()`, update `looksLikeLoginFailure()`, update `ensureLogin()` |
| `packages/backend/src/services/collectors/cronometer/__tests__/client.test.ts` | New — unit tests for auth error handling |
| `packages/backend/scripts/test-cronometer.ts` | New — standalone smoke test |
| `packages/backend/package.json` | Edit — add `test:cronometer` script |

## Success Criteria

- [x] `looksLikeLoginFailure()` catches "too many attempts" and "try again later"
- [x] `parseLoginResponse()` extracts JSON error messages from login endpoint
- [x] `ensureLogin()` throws with specific error on rate-limit JSON response
- [x] All new and existing unit tests pass (156 passing)
- [x] Smoke test script runs successfully with real credentials (2026-03-12: 2212 kcal)
- [ ] Daily Collection workflow executes successfully in n8n after local validation

## Implementation Notes

### Trailing-slash CSRF fix (not in original plan)
During smoke-test execution, `GET /login` returned an empty body (`content-length: 0`).
Cronometer's site changed — the login page HTML (and CSRF token) is only served at `GET /login/` (trailing slash).
Fixed `getCsrfToken()` to try both URLs, matching the legacy project's approach.
