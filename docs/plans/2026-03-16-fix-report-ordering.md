# Fix: Report list shows stale reports instead of latest

## 1. Context
- Reports page on prod shows a stale report (1 nutrition day, 0 workouts) even though a newer report with full data (5/5/4) exists for the same period
- Root cause: `listReports` orders by `period_start DESC` without a `created_at` tiebreaker, AND doesn't deduplicate reports for the same period
- `getLatestReport` has the same issue — orders by `period_start DESC` without `created_at`

## 2. Ordered Task List

### Task 1: Fix `listReports` query — deduplicate by period
- **What:** Use `DISTINCT ON (period_start, period_end)` with `ORDER BY period_start DESC, period_end DESC, created_at DESC` to return only the most recent report per period
- **Where:** `packages/backend/src/db/queries/reports.ts` — `listReports` function (line 50-76)
- **How:** Wrap the SELECT with DISTINCT ON. PostgreSQL DISTINCT ON picks the first row per group, so ordering by `created_at DESC` within each period group ensures the newest report wins.

### Task 2: Fix `getLatestReport` query — add `created_at` tiebreaker
- **What:** Add `created_at DESC` as secondary sort
- **Where:** `packages/backend/src/db/queries/reports.ts` — `getLatestReport` function (line 41-48)
- **How:** Change `ORDER BY period_start DESC LIMIT 1` to `ORDER BY period_start DESC, created_at DESC LIMIT 1`

### Task 3: Update existing tests
- **What:** Add test cases that verify deduplication behavior
- **Where:** `packages/backend/src/routes/__tests__/reports.test.ts`
- **How:** Mock `listReports` to return only latest per period; verify ordering

## 3. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/db/queries/reports.ts` | Modify | Add DISTINCT ON to listReports, add created_at tiebreaker to getLatestReport |
| `packages/backend/src/routes/__tests__/reports.test.ts` | Modify | Add deduplication test cases |

## 4. Dependencies
- None — pure SQL change

## 5. Test Strategy
- Unit tests: verify listReports mock returns deduplicated results
- Manual verification: query prod API after deploy to confirm stale report is hidden
- No E2E needed — no interactive behavior change, just data ordering

## 6. Risk Areas
- `DISTINCT ON` is PostgreSQL-specific (not portable to other DBs) — acceptable since we're committed to PostgreSQL
- If date-filtered queries use DISTINCT ON, the filter columns must be compatible with the DISTINCT ON + ORDER BY — need to verify the WHERE clause interaction
