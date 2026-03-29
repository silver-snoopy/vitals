# Plan: Server-Side Report Date Window Calculation

**Date:** 2026-03-29
**Type:** Refactor
**Scope:** Small

## Context

Currently, when a report is generated via POST `/api/reports/generate`, the 7-day date window is
calculated client-side in `useGenerateReport()` and sent in the request body. This means the window
is subject to client timezone differences and `endDate` includes today.

**Desired behavior:** The server always calculates the window as the 7 days ending yesterday:
- `endDate = yesterday` (today − 1 day)
- `startDate = endDate − 6 days` (7-day inclusive window)

If `startDate`/`endDate` are present in the request body, they act as optional overrides (admin/testing).

## Tasks

1. Add `getDefaultDateRange()` to `packages/backend/src/utils/validate-dates.ts`
2. Update `packages/backend/src/routes/reports.ts` — make dates optional, fall back to server-calculated window
3. Update `packages/frontend/src/api/hooks/useReports.ts` — remove client-side date calculation; stop sending dates in body
4. Update `packages/backend/src/routes/__tests__/reports.test.ts` — reflect that dates are now optional/server-calculated
5. Run build, lint, format, tests
6. Live Playwright verification
7. Update `docs/product-capabilities.md`

## Files to Create/Modify

| File | Change |
|------|--------|
| `packages/backend/src/utils/validate-dates.ts` | Add `getDefaultDateRange(): ValidDateRange` |
| `packages/backend/src/routes/reports.ts` | Make `startDate`/`endDate` optional; use `getDefaultDateRange()` as fallback |
| `packages/frontend/src/api/hooks/useReports.ts` | Remove `startDate`/`endDate` from mutation body |
| `packages/backend/src/routes/__tests__/reports.test.ts` | Update tests — no longer need to pass dates, or pass them as optional overrides |

## Dependencies

None — no new packages required.

## Test Strategy

- Unit: Update existing route tests to omit dates and verify server-calculated window is used
- Unit: Add test to `validate-dates.test.ts` for `getDefaultDateRange()` — verify it returns yesterday as end
- E2E: Live Playwright screenshot of report generation confirming it succeeds

## Risks

- `getDefaultDateRange()` uses `new Date()` on the server — this uses the server's timezone. Since
  the server runs in UTC (Railway), `yesterday` will be UTC-yesterday. Acceptable for this use case.
- The `validateDateRange` function currently requires both params. Making them optional is a
  non-breaking change since the route will call `getDefaultDateRange()` before validation.
