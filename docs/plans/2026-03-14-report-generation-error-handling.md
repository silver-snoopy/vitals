# Report Generation Error Handling

**Date:** 2026-03-14
**Type:** bugfix
**Scope:** small

## Problem

Report generation (`POST /api/reports/generate`) has no error handling around the
`generateWeeklyReport()` call. When the AI provider fails (rate limit, quota, network),
the raw SDK error leaks to the client (information disclosure). The frontend shows a
generic toast for all error types.

## Bugs Found

1. **No try-catch** around `generateWeeklyReport()` in the route — unhandled errors leak raw SDK messages
2. **Information disclosure** — Gemini API URLs, quota details, internal error structure exposed to client
3. **Generic frontend error toast** — same message for rate limit, config error, and server error
4. **Missing frontend `.env.example`** — `VITE_X_API_KEY` not documented for local dev

## Implementation Plan

### Task 1: Backend — Error handling in report route
**File:** `packages/backend/src/routes/reports.ts`

- Wrap `generateWeeklyReport()` call in try-catch
- Classify errors:
  - Rate limit (429 from provider) → return 429 with safe message
  - Other AI errors → return 502 with safe message (bad gateway — upstream AI failed)
  - DB errors → return 500 with safe message
- Never expose raw error messages to the client

### Task 2: Frontend — Specific error states in ReportsPage
**File:** `packages/frontend/src/components/reports/ReportsPage.tsx`

- Parse error response status in `onError` callback
- Show specific toast messages:
  - 429: "AI service rate limited. Please try again in a few minutes."
  - 502: "AI service is temporarily unavailable. Please try again later."
  - 503: "AI service is not configured."
  - Default: "Failed to generate report."

### Task 3: Frontend .env.example
**File:** `packages/frontend/.env.example` (new)

- Document `VITE_API_URL` and `VITE_X_API_KEY`

### Task 4: Unit tests
**File:** `packages/backend/src/routes/__tests__/reports.test.ts`

- Test: generate route returns 429 with safe message on rate limit error
- Test: generate route returns 502 with safe message on AI provider error
- Test: generate route returns 500 with safe message on DB error
- Verify no raw error messages leak in any response

## Test Strategy

- Unit tests for the new error classification in the route
- Existing mocked E2E tests still pass (no UI changes to the flow, only toast messages)
- No new E2E tests needed (toast messages are transient, hard to assert reliably)

## Risk Areas

- Must not break existing successful generation flow
- Error classification regex must match both Claude and Gemini SDK error formats
