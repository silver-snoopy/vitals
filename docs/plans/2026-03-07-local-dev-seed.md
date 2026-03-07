# Local Dev Seed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seed the local dev PostgreSQL database with real exported health CSVs so the frontend has meaningful data during development.

**Architecture:** Copy CSVs to a gitignored `data/` folder at repo root. Fix two silent normalizer bugs (Cronometer `Carbs (g)` mapping and Hevy `distance_km` → metres conversion). Add a standalone `seed-dev.ts` script in `packages/backend/scripts/` that reads all CSVs, runs them through the existing normalizer+ingest pipeline, and refreshes the `daily_aggregates` materialized view.

**Tech Stack:** TypeScript, tsx (already installed), csv-parse/sync (already installed), pg Pool, existing `ingestMeasurements`/`ingestWorkoutSets` + normalizer functions.

---

## Context for the Implementer

### Repo layout

```
packages/
  backend/
    src/
      services/data/normalizers.ts   ← fix bugs here
      services/data/ingest.ts        ← existing, do not change
      db/pool.ts                     ← existing pg.Pool factory
    scripts/
      seed-dev.ts                    ← CREATE this
    package.json                     ← add "seed" script
data/                                ← gitignored, CSVs live here
```

### Default user ID

All seeded rows use `process.env.DB_DEFAULT_USER_ID ?? '00000000-0000-0000-0000-000000000001'`.

### How ingest works

Both `ingestMeasurements` and `ingestWorkoutSets` accept an array of typed rows and
batch-INSERT them 500 at a time with `ON CONFLICT DO UPDATE`. They return
`{ inserted: number; errors: string[] }`. Idempotent — safe to re-run.

### DB pool

`packages/backend/src/db/pool.ts` exports `createPool(databaseUrl: string): pg.Pool`.
The default DB URL is `postgresql://vitals:vitals@localhost:5432/vitals`.

### Running tests

```
npm test -w @vitals/backend
```

All existing tests must continue to pass after every task.

---

## Task 1: Copy data and update .gitignore

**Files:**
- Create: `data/` directory (copy CSVs into it)
- Modify: `.gitignore`

**Step 1: Copy the CSV files**

From a terminal at the repo root:

```bash
mkdir data
cp C:/projects/health/data/*.csv data/
```

Verify:
```bash
ls data/ | wc -l
# Expected: 27
```

**Step 2: Add data/ to .gitignore**

Open `.gitignore` at repo root and add:

```
# Local dev seed data (real health exports — never commit)
data/
```

**Step 3: Verify git does not track the folder**

```bash
git status
# data/ should NOT appear — it should be ignored
```

**Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore data/ folder for local dev seed data"
```

---

## Task 2: Fix normalizer bug — Cronometer `Carbs (g)` mapping

**Files:**
- Modify: `packages/backend/src/services/data/normalizers.ts`
- Test: `packages/backend/src/services/data/__tests__/normalizers.test.ts`

**Background:** `normalizeNutritionRow` maps raw CSV columns to metrics. The key aliases
for `carbs_g` are `['carbs_g', 'Carbohydrates (g)', 'carbs', 'carbohydrates_g']` but the
actual Cronometer CSV header is `Carbs (g)`. Carbs are silently dropped.

**Step 1: Read the existing test file first**

Open `packages/backend/src/services/data/__tests__/normalizers.test.ts` and find the
existing nutrition test to understand the fixture shape.

**Step 2: Add a failing test for `Carbs (g)` key**

In the nutrition test block, add:

```typescript
it('maps Cronometer "Carbs (g)" column to carbs_g metric', () => {
  const raw = {
    Date: '2026-01-10',
    'Energy (kcal)': '1908',
    'Protein (g)': '171',
    'Carbs (g)': '263',      // ← actual Cronometer header
    'Fat (g)': '46',
    'Fiber (g)': '90',
    'Sodium (mg)': '1635',
  };
  const rows = normalizeNutritionRow(raw, 'user-1', 'cronometer');
  const carbs = rows.find(r => r.metric === 'carbs_g');
  expect(carbs).toBeDefined();
  expect(carbs!.value).toBe(263);
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -w @vitals/backend -- --reporter=verbose 2>&1 | grep -A3 'Carbs (g)'
# Expected: FAIL — carbs is undefined
```

**Step 4: Fix the normalizer**

In `packages/backend/src/services/data/normalizers.ts`, find the `macros` array inside
`normalizeNutritionRow`. Change the `carbs_g` entry from:

```typescript
{ metric: 'carbs_g', unit: 'g', keys: ['carbs_g', 'Carbohydrates (g)', 'carbs', 'carbohydrates_g'] },
```

to:

```typescript
{ metric: 'carbs_g', unit: 'g', keys: ['carbs_g', 'Carbs (g)', 'Carbohydrates (g)', 'carbs', 'carbohydrates_g'] },
```

**Step 5: Run all backend tests**

```bash
npm test -w @vitals/backend
# Expected: all pass
```

**Step 6: Commit**

```bash
git add packages/backend/src/services/data/normalizers.ts \
        packages/backend/src/services/data/__tests__/normalizers.test.ts
git commit -m "fix: map Cronometer 'Carbs (g)' column in nutrition normalizer"
```

---

## Task 3: Fix normalizer bug — Hevy `distance_km` → metres

**Files:**
- Modify: `packages/backend/src/services/data/normalizers.ts`
- Test: `packages/backend/src/services/data/__tests__/normalizers.test.ts`

**Background:** `normalizeHevyRow` reads `raw['distance_meters']` but the Hevy CSV
exports `distance_km`. Distance is always `null` for CSV-sourced rows.

**Step 1: Add a failing test**

In the Hevy normalizer test block, add:

```typescript
it('converts distance_km to distance_meters', () => {
  const raw = {
    exercise_title: 'Elliptical Trainer',
    set_index: '0',
    weight_kg: '',
    reps: '',
    distance_km: '0.53',
    duration_seconds: '360',
    rpe: '',
    start_time: '10 Jan 2026, 13:55',
    end_time: '10 Jan 2026, 14:57',
  };
  const row = normalizeHevyRow(raw, 'user-1');
  expect(row.distanceMeters).toBeCloseTo(530, 1);
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -w @vitals/backend -- --reporter=verbose 2>&1 | grep -A3 'distance_km'
# Expected: FAIL — distanceMeters is null
```

**Step 3: Fix the normalizer**

In `packages/backend/src/services/data/normalizers.ts`, inside `normalizeHevyRow`,
change the `distanceMeters` line from:

```typescript
distanceMeters: toNum(raw['distance_meters']),
```

to:

```typescript
distanceMeters: raw['distance_km'] != null && raw['distance_km'] !== ''
  ? (toNum(raw['distance_km']) ?? null) && (toNum(raw['distance_km'])! * 1000)
  : toNum(raw['distance_meters']),
```

Actually, write it more clearly:

```typescript
distanceMeters: (() => {
  const km = toNum(raw['distance_km']);
  if (km !== null) return km * 1000;
  return toNum(raw['distance_meters']);
})(),
```

**Step 4: Run all backend tests**

```bash
npm test -w @vitals/backend
# Expected: all pass
```

**Step 5: Commit**

```bash
git add packages/backend/src/services/data/normalizers.ts \
        packages/backend/src/services/data/__tests__/normalizers.test.ts
git commit -m "fix: convert Hevy distance_km to distance_meters in workout normalizer"
```

---

## Task 4: Create the seed script

**Files:**
- Create: `packages/backend/scripts/seed-dev.ts`

**Step 1: Check that `scripts/` directory exists or create it**

```bash
ls packages/backend/scripts/ 2>/dev/null || mkdir packages/backend/scripts
```

**Step 2: Write the seed script**

Create `packages/backend/scripts/seed-dev.ts` with the following content:

```typescript
import { readFileSync, readdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import { parse } from 'csv-parse/sync';
import { createPool } from '../src/db/pool.js';
import {
  normalizeNutritionRow,
  normalizeBiometricsRow,
  normalizeHevyRow,
} from '../src/services/data/normalizers.js';
import { ingestMeasurements, ingestWorkoutSets } from '../src/services/data/ingest.js';

const DATA_DIR = resolve(
  process.env.SEED_DATA_DIR ?? join(import.meta.dirname, '../../../data'),
);
const USER_ID = process.env.DB_DEFAULT_USER_ID ?? '00000000-0000-0000-0000-000000000001';
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://vitals:vitals@localhost:5432/vitals';

function parseCsv(text: string): Record<string, unknown>[] {
  return parse(text, { columns: true, skip_empty_lines: true }) as Record<string, unknown>[];
}

async function main(): Promise<void> {
  const pool = createPool(DATABASE_URL);
  let totalMeasurements = 0;
  let totalSets = 0;

  try {
    const files = readdirSync(DATA_DIR).sort();

    for (const file of files) {
      const filePath = join(DATA_DIR, file);
      const text = readFileSync(filePath, 'utf-8');
      const rows = parseCsv(text);
      const name = basename(file);

      if (file.startsWith('cronometer_nutrition_')) {
        const measurementRows = rows.flatMap(row =>
          normalizeNutritionRow(row, USER_ID, 'cronometer'),
        );
        const result = await ingestMeasurements(pool, measurementRows);
        totalMeasurements += result.inserted;
        console.log(`[${name}]  nutrition   ${rows.length} rows -> ${result.inserted} inserted`);
        if (result.errors.length) console.warn('  errors:', result.errors);

      } else if (file.startsWith('cronometer_biometrics_')) {
        const measurementRows = rows.flatMap(row => {
          try {
            return [normalizeBiometricsRow(row, USER_ID, 'cronometer')];
          } catch {
            return [];
          }
        });
        const result = await ingestMeasurements(pool, measurementRows);
        totalMeasurements += result.inserted;
        console.log(`[${name}]  biometric   ${rows.length} rows -> ${result.inserted} inserted`);
        if (result.errors.length) console.warn('  errors:', result.errors);

      } else if (file.startsWith('hevy_workout')) {
        const setRows = rows.map(row => normalizeHevyRow(row, USER_ID));
        const result = await ingestWorkoutSets(pool, setRows);
        totalSets += result.inserted;
        console.log(`[${name}]  workout     ${rows.length} rows -> ${result.inserted} inserted`);
        if (result.errors.length) console.warn('  errors:', result.errors);

      } else {
        console.log(`[${name}]  (skipped — unrecognised pattern)`);
      }
    }

    // Refresh materialized view
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_aggregates');
    console.log('\ndaily_aggregates refreshed.');
    console.log(`\nSeed complete. Total inserted: ${totalMeasurements} measurements, ${totalSets} workout sets.`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

**Step 3: Check that `createPool` is exported from `db/pool.ts`**

```bash
grep 'export' packages/backend/src/db/pool.ts
```

If `createPool` is not exported, check `db/pool.ts` — you may need to export the pool
factory or adapt the import to use whatever the file actually exports.

**Step 4: Add the npm script**

Open `packages/backend/package.json`. In the `"scripts"` block, add:

```json
"seed": "tsx scripts/seed-dev.ts"
```

**Step 5: Commit**

```bash
git add packages/backend/scripts/seed-dev.ts packages/backend/package.json
git commit -m "feat: add seed-dev script for local dev database seeding"
```

---

## Task 5: Run the seed and verify

**Step 1: Ensure Docker DB is running**

```bash
docker compose up -d
# Wait a few seconds for Postgres to be ready
```

**Step 2: Run migrations if not already applied**

```bash
npm run migrate -w @vitals/backend 2>/dev/null || true
```

Check what the migrate command is:
```bash
grep '"migrate"' packages/backend/package.json
```

Run accordingly.

**Step 3: Run the seed**

```bash
npm run seed -w @vitals/backend
```

Expected output — something like:

```
[cronometer_biometrics_2026-01-10.csv]  biometric   312 rows -> 312 inserted
...
[hevy_workouts_2026-03-01.csv]  workout     88 rows -> 88 inserted
daily_aggregates refreshed.

Seed complete. Total inserted: XXXX measurements, YYY workout sets.
```

**Step 4: Spot-check the DB**

```bash
docker compose exec db psql -U vitals -d vitals \
  -c "SELECT metric, COUNT(*) FROM measurements GROUP BY metric ORDER BY metric;"
```

Expect rows for `calories`, `carbs_g`, `protein_g`, `fat_g`, `fiber_g`, `sodium_mg`,
plus biometrics like `Heart Rate (Apple Health)`.

```bash
docker compose exec db psql -U vitals -d vitals \
  -c "SELECT exercise_name, COUNT(*) FROM workout_sets GROUP BY exercise_name ORDER BY COUNT(*) DESC LIMIT 10;"
```

**Step 5: Verify re-running is idempotent**

```bash
npm run seed -w @vitals/backend
# All rows should show "0 inserted" (or same count via upsert — no duplicates)
```

**Step 6: Commit (if any fixups were needed)**

```bash
git add -p   # stage only intentional fixups
git commit -m "fix: seed script adjustments after smoke test"
```

---

## Task 6: Update README / docs

**Files:**
- Modify: `README.md` (or `docs/architecture.md` if that's where dev setup lives)

**Step 1: Read existing dev setup docs**

Check `README.md` and `docs/architecture.md` for the existing "local dev setup" section.

**Step 2: Add seed instructions**

Add the following to the dev setup section:

```markdown
### Seed local database (optional)

Place Cronometer and Hevy CSV exports into `data/` at the repo root (gitignored), then:

```bash
npm run seed -w @vitals/backend
```

Re-running is safe — rows are upserted (no duplicates).
```

**Step 3: Commit**

```bash
git add README.md   # or docs/architecture.md
git commit -m "docs: add local dev seed instructions"
```

---

## Done

After all tasks:
- `data/*.csv` present locally, gitignored
- Two normalizer bugs fixed and tested
- `npm run seed -w @vitals/backend` seeds the full Jan–Mar 2026 dataset
- Re-runnable, idempotent
- All existing tests still pass
