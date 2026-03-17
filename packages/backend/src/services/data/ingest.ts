import type pg from 'pg';
import type { MeasurementRow, WorkoutSetRow } from './normalizers.js';

export interface IngestResult {
  inserted: number;
  errors: string[];
}

const BATCH_SIZE = 500;

/** Remove duplicate rows within an array, keeping the last occurrence (latest wins). */
function dedup<T>(rows: T[], keyFn: (r: T) => string): T[] {
  const map = new Map<string, T>();
  for (const r of rows) map.set(keyFn(r), r);
  return Array.from(map.values());
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Build a parameterized multi-row INSERT placeholder string.
 * E.g. for 2 rows of 3 cols: "($1,$2,$3),($4,$5,$6)"
 */
function buildPlaceholders(rowCount: number, colCount: number): string {
  return Array.from({ length: rowCount }, (_, r) => {
    const cols = Array.from({ length: colCount }, (__, c) => `$${r * colCount + c + 1}`);
    return `(${cols.join(',')})`;
  }).join(',');
}

export async function ingestMeasurements(
  pool: pg.Pool,
  rows: MeasurementRow[],
): Promise<IngestResult> {
  if (rows.length === 0) return { inserted: 0, errors: [] };

  const unique = dedup(rows, (r) => `${r.userId}|${r.source}|${r.metric}|${r.measuredAt}`);
  const COL_COUNT = 9;
  let inserted = 0;
  const errors: string[] = [];

  for (const batch of chunk(unique, BATCH_SIZE)) {
    const values: unknown[] = [];
    for (const r of batch) {
      values.push(
        r.userId,
        r.source,
        r.category,
        r.metric,
        r.value,
        r.unit,
        r.measuredAt,
        r.tags,
        new Date(),
      );
    }

    const sql = `
      INSERT INTO measurements
        (user_id, source, category, metric, value, unit, measured_at, tags, collected_at)
      VALUES ${buildPlaceholders(batch.length, COL_COUNT)}
      ON CONFLICT (user_id, source, metric, measured_at)
      DO UPDATE SET
        value = EXCLUDED.value,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        tags = EXCLUDED.tags,
        collected_at = EXCLUDED.collected_at
    `;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql, values);
      await client.query('COMMIT');
      inserted += result.rowCount ?? 0;
    } catch (err) {
      await client.query('ROLLBACK');
      errors.push(`Batch failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      client.release();
    }
  }

  return { inserted, errors };
}

/**
 * Compute pre-calculated volume for a set.
 * For weighted_bodyweight exercises, adds bodyweightKg to the set weight.
 */
function computeVolumeKg(r: WorkoutSetRow, bodyweightKg: number | null): number | null {
  const weight = r.weightKg;
  const reps = r.reps;
  if (weight == null && reps == null) return null;
  const bwAdjust =
    r.exerciseType === 'weighted_bodyweight' && bodyweightKg != null ? bodyweightKg : 0;
  return ((weight ?? 0) + bwAdjust) * (reps ?? 0);
}

export interface IngestWorkoutOpts {
  bodyweightKg?: number | null;
}

export async function ingestWorkoutSets(
  pool: pg.Pool,
  rows: WorkoutSetRow[],
  opts: IngestWorkoutOpts = {},
): Promise<IngestResult> {
  if (rows.length === 0) return { inserted: 0, errors: [] };

  const bodyweightKg = opts.bodyweightKg ?? null;

  const unique = dedup(
    rows,
    (r) => `${r.userId}|${r.source}|${r.exerciseName}|${r.setIndex}|${r.startedAt ?? ''}`,
  );
  const COL_COUNT = 17;
  let inserted = 0;
  const errors: string[] = [];

  for (const batch of chunk(unique, BATCH_SIZE)) {
    const values: unknown[] = [];
    for (const r of batch) {
      values.push(
        r.userId,
        r.source,
        r.title,
        r.exerciseName,
        r.exerciseType,
        r.setIndex,
        r.setType,
        r.weightKg,
        r.reps,
        computeVolumeKg(r, bodyweightKg),
        r.durationSeconds,
        r.distanceMeters,
        r.rpe,
        r.startedAt,
        r.endedAt,
        r.tags,
        new Date(),
      );
    }

    const sql = `
      INSERT INTO workout_sets
        (user_id, source, title, exercise_name, exercise_type, set_index, set_type,
         weight_kg, reps, volume_kg, duration_seconds, distance_meters,
         rpe, started_at, ended_at, tags, collected_at)
      VALUES ${buildPlaceholders(batch.length, COL_COUNT)}
      ON CONFLICT (user_id, source, exercise_name, set_index,
                   COALESCE(started_at, '1970-01-01'::timestamptz))
      DO UPDATE SET
        title = EXCLUDED.title,
        exercise_type = EXCLUDED.exercise_type,
        set_type = EXCLUDED.set_type,
        weight_kg = EXCLUDED.weight_kg,
        reps = EXCLUDED.reps,
        volume_kg = EXCLUDED.volume_kg,
        duration_seconds = EXCLUDED.duration_seconds,
        distance_meters = EXCLUDED.distance_meters,
        rpe = EXCLUDED.rpe,
        ended_at = EXCLUDED.ended_at,
        tags = EXCLUDED.tags,
        collected_at = EXCLUDED.collected_at
    `;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql, values);
      await client.query('COMMIT');
      inserted += result.rowCount ?? 0;
    } catch (err) {
      await client.query('ROLLBACK');
      errors.push(`Batch failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      client.release();
    }
  }

  return { inserted, errors };
}
