# Decision Record: Data Model Design

**Date:** 2026-03-07
**Status:** Decided

## Context

The Vitals backend stores health data from multiple sources (Cronometer nutrition, Cronometer biometrics, Hevy workouts, Apple Health) and needs to support flexible querying, idempotent re-ingestion, and dashboard aggregation.

## Key Decisions

### 1. EAV Pattern for Measurements

**Decision:** Use Entity-Attribute-Value (single `measurements` table) for both nutrition macros and biometric readings.

**Schema:**
```sql
measurements (user_id, source, category, metric, value, unit, measured_at, tags)
```

**Why EAV over separate tables:**
- New metrics from new data sources (Apple Health, wearables) require no schema changes
- Nutrition has 7+ macros that vary by source; biometrics have open-ended metric types
- Single table simplifies the ingest pipeline (one `ingestMeasurements` function)
- `category` column (`'nutrition'` / `'biometric'`) enables scoped queries

**Trade-off:** Pivot queries needed for `DailyNutritionSummary`:
```sql
SELECT DATE(measured_at) AS day,
  SUM(CASE WHEN metric='calories' THEN value END) AS calories,
  SUM(CASE WHEN metric='protein_g' THEN value END) AS protein, ...
```
This is acceptable for a single-user app with moderate data volume.

### 2. Flat Workout Sets (No Session Table)

**Decision:** Store individual sets in `workout_sets` table with no separate `workout_sessions` table.

**Why:** Hevy API returns nested workout/exercise/set structures that get flattened during normalization. A session ID would need to be synthesized from (date, source, title) anyway. Grouping at query time by `(DATE(started_at), source)` is simpler and avoids a join.

**Trade-off:** Session metadata (title, notes) must be derived or stored in `tags` JSONB.

### 3. Idempotent Upserts

**Decision:** All ingestion uses `INSERT ... ON CONFLICT DO UPDATE` with unique indexes.

**Unique constraints:**
- `measurements`: `(user_id, source, metric, measured_at)` — same metric from same source at same time = same record
- `workout_sets`: `(user_id, source, exercise_name, set_index, COALESCE(started_at, epoch))` — `COALESCE` handles NULL timestamps

**Why:** Safe re-ingestion. The collection pipeline can re-fetch overlapping date ranges without creating duplicates. This is critical for incremental fetch (where `last_successful_fetch` may overlap with new data).

### 4. Materialized View for Aggregates

**Decision:** `daily_aggregates` materialized view for dashboard performance.

```sql
CREATE MATERIALIZED VIEW daily_aggregates AS
SELECT user_id, metric, unit, DATE(measured_at) AS day,
  AVG(value), MIN(value), MAX(value), SUM(value), COUNT(*)
FROM measurements GROUP BY user_id, metric, unit, DATE(measured_at);
```

**Refresh strategy:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` after each successful collection run. Non-blocking, allows reads during refresh.

**Why not real-time aggregation:** The measurements table can grow large with Apple Health data (step counts every minute). Pre-aggregated daily values make dashboard queries instant.

### 5. Batch Ingest Size: 500 Rows

**Decision:** Insert in batches of 500 rows per transaction.

**Why 500:**
- PostgreSQL parameter limit is 65535; with 9-13 columns per row, 500 rows = 4500-6500 params (well within limit)
- Large enough to be efficient (fewer round trips than row-by-row)
- Small enough that a failed batch loses at most 500 rows (errors collected, pipeline continues)
- Matches the legacy codebase's proven batch size

### 6. Single-User with UUID

**Decision:** All tables use `user_id UUID` even though this is a single-user app.

**Why:** Future-proofing at minimal cost. The `DB_DEFAULT_USER_ID` env var provides the single user's UUID. If multi-user support is ever needed, the schema is ready.
