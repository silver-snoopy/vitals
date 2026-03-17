# Dashboard Refresh After Report Generation

**Date:** 2026-03-17
**Type:** Bugfix
**Scope:** Small

## Context

When a report is generated, the backend collects fresh health data (`runCollection` in `report-runner.ts`) before AI generation. However, the frontend's `useInvalidateReports()` only invalidates report queries — dashboard, nutrition, workout, and measurement data remain stale until manual refresh.

## Tasks

1. Expand `useInvalidateReports()` in `packages/frontend/src/api/hooks/useReports.ts` to also invalidate `nutrition`, `workouts`, `measurements`, and `dashboard` query key prefixes
2. Update existing unit tests to verify the broader invalidation
3. Verify E2E tests still pass

## Files to Modify

- `packages/frontend/src/api/hooks/useReports.ts` — add invalidation calls for all data query keys

## Dependencies

None — no new packages needed.

## Test Strategy

- Update/add unit test for `useInvalidateReports` verifying all query keys are invalidated
- Run existing E2E tests to confirm no regressions

## Risks

- Low risk. Pattern already used in `useUpload.ts`. TanStack Query invalidation triggers silent background refetch — no UX disruption.
