# Fix Volume Calculation and Workout Title

**Date:** 2026-03-17
**Type:** Bugfix
**Status:** Planned

## Context

Production volume numbers don't match Hevy (source of truth). Two root causes:
1. **Volume excludes warmup sets** — Hevy includes ALL sets in total volume. Our app filters `setType !== 'warmup'`, underreporting by ~7%.
2. **Workout title lost** — DB has no `title` column; `groupIntoSessions` hardcodes "Hevy Workout" instead of the actual title (e.g., "Upper", "Push", "Legs").
3. **Possible secondary volume gap** — Even with warmups included, calculated volume (9,127.5) is still ~1,824 kg short of Hevy's 10,951.5 for Mar 15. May relate to bodyweight inclusion for weighted bodyweight exercises or bilateral doubling for iso-lateral machines.

## Tasks

1. Remove `setType !== 'warmup'` filter from all volume calculations
2. Add `title` column to `workout_sets` table (migration 006)
3. Capture workout title in Hevy normalizer and ingest pipeline
4. Use stored title in `groupIntoSessions` instead of hardcoded string
5. Investigate remaining volume gap after warmup fix
6. Run tests, lint, build
7. Live local UI verification with Playwright screenshots

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/frontend/src/components/dashboard/WorkoutVolumeChart.tsx` | Modify | Remove warmup filter from `sessionVolume()` |
| `packages/frontend/src/components/workouts/WorkoutSessionCard.tsx` | Modify | Remove warmup filter from volume calc |
| `packages/backend/src/services/ai/prompt-builder.ts` | Modify | Remove warmup filter from volume calcs |
| `packages/backend/src/db/queries/workouts.ts` | Modify | Remove warmup filter from `queryExerciseProgress` SQL; use title from DB |
| `packages/backend/src/db/migrations/006_add_workout_title.sql` | Create | `ALTER TABLE workout_sets ADD COLUMN title TEXT` |
| `packages/backend/src/services/data/normalizers.ts` | Modify | Add `title` to `WorkoutSetRow` and `normalizeHevyRow` |
| `packages/backend/src/services/data/ingest.ts` | Modify | Add `title` to INSERT columns |

## Dependencies

None.

## Test Strategy

- Update existing unit tests to remove warmup filter expectations
- Live local UI verification comparing volume numbers
- Compare against Hevy reference: Mar 15 = 10,951.5 kg

## Risks

- Removing warmup filter changes historical volume numbers (intentional — matches Hevy)
- Title column nullable (existing rows will have NULL; display fallback needed)
- Remaining volume gap may require further investigation after initial fix
