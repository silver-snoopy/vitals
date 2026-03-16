# Fix Hevy Workout Volume Data

**Date:** 2026-03-17
**Type:** Bugfix
**Status:** Planned

## Context

The Training Load section of weekly reports shows incorrect total volumes. Root cause is two bugs in the Hevy data pipeline:

1. **Exercise name mapped to workout title** — `normalizeHevyRow` picks `title` (workout-level) before `exercise_title` (exercise-level), causing all sets in a workout to share the same name. The DB unique constraint then overwrites sets from different exercises that share the same `set_index`.
2. **No pagination** — Hevy API client fetches only page 1, missing workouts beyond the first page.
3. **Unsupported date params** — Hevy API ignores `from`/`to`; only `page` and `limit` are supported.

Expected volume for 2026-03-15: 109,519.5 kg. Actual returned: ~3,485 kg.

## Tasks

1. **Fix exercise name priority in normalizer**
   - File: `packages/backend/src/services/data/normalizers.ts` line 93
   - Change: `exercise_title` → `exercise_name` → `title` (reorder fallback chain)

2. **Add pagination to Hevy API client**
   - File: `packages/backend/src/services/collectors/hevy/client.ts`
   - Change: Loop `fetchWorkouts` through all pages until exhausted
   - Remove unsupported `from`/`to` query params
   - Keep `startDate`/`endDate` in method signature but ignore for now (DB handles filtering)

3. **Update normalizer tests**
   - File: `packages/backend/src/services/data/__tests__/normalizers.test.ts`
   - Add test: row with both `title` and `exercise_title` → `exercise_title` wins

4. **Update client tests**
   - File: `packages/backend/src/services/collectors/hevy/__tests__/provider.test.ts`
   - Add test: multi-page fetch collects all workouts

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/services/data/normalizers.ts` | Modify | Reorder exercise name fallback |
| `packages/backend/src/services/collectors/hevy/client.ts` | Modify | Add pagination loop, remove date params |
| `packages/backend/src/services/data/__tests__/normalizers.test.ts` | Modify | Add exercise_title priority test |
| `packages/backend/src/services/collectors/hevy/__tests__/provider.test.ts` | Modify | Add pagination test |

## Dependencies

None — no new packages needed.

## Test Strategy

- **Unit tests:** Verify normalizer picks `exercise_title` over `title`; verify client paginates
- **Integration:** After deploying, trigger re-collection and verify volume for 2026-03-15 matches 109,519.5 kg
- **No E2E needed:** Bug is backend-only data pipeline; frontend rendering is unchanged

## Risks

- **Production data needs re-collection** after deploy — existing DB rows have wrong exercise names
- **Hevy API rate limits** — pagination fetches multiple pages; should be fine for typical workout counts (<100 total)
- **API response shape** — Hevy docs show `page_count` or empty array as pagination signal; need to handle both
