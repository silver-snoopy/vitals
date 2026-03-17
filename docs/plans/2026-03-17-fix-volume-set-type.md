# Fix Volume Calculation: Add set_type Support

**Date:** 2026-03-17
**Type:** Bugfix
**Status:** Complete

## Context

Hevy API provides a `set_type` field on each set (`"normal"`, `"warmup"`, `"dropset"`, `"failure"`).
Our pipeline drops this field. Volume is calculated as `weight × reps` for ALL sets with weight+reps,
but Hevy only counts `set_type = "normal"` sets in its volume. This inflates our reported volumes
(e.g., Mar 14: 17,119 vs 13,680 kg; Mar 15: 12,613 vs 10,952 kg).

## Tasks

1. **Add `set_type` column to DB** — new migration `004_set_type.sql`
2. **Add `setType` to shared WorkoutSet and WorkoutSetRow types**
3. **Capture `set_type` in Hevy client flattenWorkouts**
4. **Map `set_type` in normalizeHevyRow**
5. **Add `set_type` to ingest SQL** (INSERT + ON CONFLICT UPDATE)
6. **Add `set_type` to workout queries** (SELECT, pass through to WorkoutSet)
7. **Filter volume calc in prompt-builder** — only `set_type = 'normal'` (or null for backwards compat)
8. **Filter volume calc in frontend components** — WorkoutVolumeChart + WorkoutSessionCard
9. **Filter volume calc in SQL** — queryExerciseProgress
10. **Update tests**

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/db/migrations/004_set_type.sql` | Create | `ALTER TABLE workout_sets ADD COLUMN set_type TEXT DEFAULT 'normal'` |
| `packages/shared/src/types/workout.ts` | Modify | Add `setType` to `WorkoutSet` |
| `packages/backend/src/services/data/normalizers.ts` | Modify | Add `setType` to `WorkoutSetRow`, map in `normalizeHevyRow` |
| `packages/backend/src/services/collectors/hevy/client.ts` | Modify | Capture `set.set_type` in flatten |
| `packages/backend/src/services/data/ingest.ts` | Modify | Add `set_type` to INSERT (14 cols) |
| `packages/backend/src/db/queries/workouts.ts` | Modify | SELECT set_type, pass to WorkoutSet, filter in queryExerciseProgress |
| `packages/backend/src/services/ai/prompt-builder.ts` | Modify | Filter volume to normal/dropset/failure sets only |
| `packages/frontend/src/components/dashboard/WorkoutVolumeChart.tsx` | Modify | Filter warmup from volume |
| `packages/frontend/src/components/workouts/WorkoutSessionCard.tsx` | Modify | Filter warmup from volume |

## Dependencies

None — no new packages.

## Test Strategy

- Unit: normalizer maps set_type correctly
- Unit: prompt-builder excludes warmup sets from volume
- Unit: frontend volume helpers exclude warmup
- After deploy: re-collect and verify volumes match Hevy

## Risks

- Existing DB rows have no set_type — migration DEFAULT 'normal' treats them all as working sets.
  Must re-collect from Hevy after deploy to get correct set_type values.
- `set_type` values from Hevy not in our enum → store as-is (TEXT column, no constraint)
