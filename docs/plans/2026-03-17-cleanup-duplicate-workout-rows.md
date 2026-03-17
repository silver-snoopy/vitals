# Cleanup Duplicate Workout Rows

**Date:** 2026-03-17
**Type:** Bugfix
**Status:** Planned

## Context

After fixing the exercise name fallback chain (PR #29), re-collection from Hevy created correct rows
alongside old rows that used workout titles as exercise names. The upsert key includes `exercise_name`,
so old rows (`"Legs"`, `"Push"`, `"Pull"`, `"Upper"`) don't conflict with new correct rows — both exist,
inflating volumes by ~25%.

## Tasks

1. Add migration 005 to delete rows where `exercise_name` is a known workout title
2. Verify locally with live UI screenshots
3. Deploy and verify on production

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/db/migrations/005_cleanup_workout_title_rows.sql` | Create | DELETE stale rows |

## Dependencies

None.

## Test Strategy

- Live local UI verification with Playwright screenshots
- Compare volume numbers before/after cleanup against Hevy evidence

## Risks

- Migration is destructive (DELETE) — but these rows are confirmed duplicates
- Only targets `source = 'hevy'` rows with exact workout title matches
