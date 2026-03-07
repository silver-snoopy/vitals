# Local Dev Seed — Design

**Date:** 2026-03-07
**Status:** Approved

## Goal

Populate the local development PostgreSQL database with real exported health data so the
frontend has meaningful data to display during development.

## Data Source

Real exported CSVs currently at `C:\projects\health\data`. They will be copied into
`data/` at the project root for convenience. The `data/` folder is added to `.gitignore`
so it never lands in version control.

### File inventory (27 files, Jan–Mar 2026)

| Pattern | Format | Count |
|---|---|---|
| `cronometer_nutrition_*.csv` | One row per day, wide columns (Energy, Protein, Carbs, Fat, Fiber, Sodium, …) | 9 |
| `cronometer_biometrics_*.csv` | EAV rows: Day, Time, Metric, Unit, Amount | 9 |
| `hevy_workouts_*.csv` (and one `hevy_workout_*.csv`) | One row per set: title, exercise_title, set_index, weight_kg, reps, distance_km, duration_seconds, rpe, start_time, end_time | 9 |

## Architecture

### Data flow

```
data/*.csv
  └─ seed-dev.ts
       ├─ glob files by pattern
       ├─ csv-parse/sync
       ├─ normalizeNutritionRow / normalizeBiometricsRow / normalizeHevyRow
       ├─ ingestMeasurements / ingestWorkoutSets  (500-row batches, ON CONFLICT DO UPDATE)
       └─ REFRESH MATERIALIZED VIEW CONCURRENTLY daily_aggregates
```

### Script location

`packages/backend/scripts/seed-dev.ts`

Runs with `tsx` (already a dev dependency via Vitest's ts-node usage).

### npm script

Add to `packages/backend/package.json`:

```json
"seed": "tsx scripts/seed-dev.ts"
```

Run via:

```
npm run seed -w @vitals/backend
```

### Configuration

`SEED_DATA_DIR` env var — defaults to `../../data` (relative to the backend package,
resolving to the repo-root `data/` folder). Override to point at any other directory.

The default user ID (`DB_DEFAULT_USER_ID`, `00000000-0000-0000-0000-000000000001`) is
used for all seeded rows, consistent with the rest of the app.

## Known Bugs to Fix During Implementation

### 1. Cronometer nutrition — `Carbs (g)` not mapped

`normalizeNutritionRow` checks for `['carbs_g', 'Carbohydrates (g)', 'carbs', 'carbohydrates_g']`
but the actual CSV column header is `Carbs (g)`. Carbs are silently dropped for every
nutrition row. Add `'Carbs (g)'` to the keys array.

File: `packages/backend/src/services/data/normalizers.ts`, `normalizeNutritionRow`,
`carbs_g` entry.

### 2. Hevy workouts — `distance_km` not converted to metres

`normalizeHevyRow` reads `raw['distance_meters']` but the CSV exports `distance_km`.
The normalizer returns `null` for distance on every set.

Fix: read `raw['distance_km']` and multiply by 1000, falling back to
`raw['distance_meters']` for API-sourced rows.

File: `packages/backend/src/services/data/normalizers.ts`, `normalizeHevyRow`,
`distanceMeters` field.

## Output / Observability

The script prints a per-file summary:

```
[cronometer_nutrition_2026-01-10.csv]  nutrition    7 rows -> 7 inserted
[cronometer_biometrics_2026-01-10.csv] biometric  312 rows -> 310 inserted, 2 skipped
[hevy_workouts_2026-01-10.csv]         workout     45 rows -> 45 inserted
...
Seed complete. Total inserted: 2841 measurements, 389 workout sets.
```

Errors are printed inline but do not abort the full run (consistent with existing
`ingest*` behaviour which collects errors and continues).

## Files Changed / Created

| File | Change |
|---|---|
| `data/` | New directory (gitignored), contains copied CSVs |
| `.gitignore` | Add `data/` |
| `packages/backend/scripts/seed-dev.ts` | New seed script |
| `packages/backend/package.json` | Add `"seed"` npm script |
| `packages/backend/src/services/data/normalizers.ts` | Fix `Carbs (g)` key alias and `distance_km` conversion |

## Non-Goals

- No test coverage for the seed script itself (it is a dev utility)
- No anonymisation (data stays local, never in version control)
- No Docker init wiring (run manually)
