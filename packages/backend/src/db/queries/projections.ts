import type pg from 'pg';
import type { Projection } from '@vitals/shared';

function rowToProjection(r: Record<string, unknown>): Projection {
  return {
    id: String(r['id']),
    userId: String(r['user_id']),
    metric: String(r['metric']),
    projectionDate:
      r['projection_date'] instanceof Date
        ? r['projection_date'].toISOString().split('T')[0]
        : String(r['projection_date']),
    projectedValue: Number(r['projected_value']),
    confidenceLow: r['confidence_low'] != null ? Number(r['confidence_low']) : null,
    confidenceHigh: r['confidence_high'] != null ? Number(r['confidence_high']) : null,
    method: String(r['method']) as Projection['method'],
    dataPoints: Number(r['data_points']),
    generatedAt:
      r['generated_at'] instanceof Date
        ? r['generated_at'].toISOString()
        : String(r['generated_at']),
  };
}

export async function upsertProjections(
  pool: pg.Pool,
  userId: string,
  projections: Omit<Projection, 'id' | 'generatedAt'>[],
): Promise<void> {
  if (projections.length === 0) return;

  // Build a batch INSERT with individual ON CONFLICT clauses per row
  const values: unknown[] = [];
  const valuePlaceholders: string[] = [];
  let idx = 1;

  for (const p of projections) {
    valuePlaceholders.push(
      `($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`,
    );
    values.push(
      userId,
      p.metric,
      p.projectionDate,
      p.projectedValue,
      p.confidenceLow ?? null,
      p.confidenceHigh ?? null,
      p.method,
      p.dataPoints,
    );
  }

  await pool.query(
    `INSERT INTO projections (
       user_id, metric, projection_date,
       projected_value, confidence_low, confidence_high,
       method, data_points
     ) VALUES ${valuePlaceholders.join(', ')}
     ON CONFLICT (user_id, metric, projection_date) DO UPDATE SET
       projected_value = EXCLUDED.projected_value,
       confidence_low  = EXCLUDED.confidence_low,
       confidence_high = EXCLUDED.confidence_high,
       method          = EXCLUDED.method,
       data_points     = EXCLUDED.data_points,
       generated_at    = now()`,
    values,
  );
}

export async function getProjections(
  pool: pg.Pool,
  userId: string,
  metric: string,
  _daysForward?: number,
): Promise<Projection[]> {
  const { rows } = await pool.query(
    `SELECT id, user_id, metric, projection_date,
            projected_value, confidence_low, confidence_high,
            method, data_points, generated_at
     FROM projections
     WHERE user_id = $1 AND metric = $2
     ORDER BY projection_date`,
    [userId, metric],
  );

  return rows.map(rowToProjection);
}

export async function getLatestProjections(pool: pg.Pool, userId: string): Promise<Projection[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (metric)
            id, user_id, metric, projection_date,
            projected_value, confidence_low, confidence_high,
            method, data_points, generated_at
     FROM projections
     WHERE user_id = $1
     ORDER BY metric, generated_at DESC`,
    [userId],
  );

  return rows.map(rowToProjection);
}
