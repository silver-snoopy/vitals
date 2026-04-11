import type pg from 'pg';
import { projectForward } from './stats.js';
import { upsertProjections } from '../../db/queries/projections.js';

const DEFAULT_BIOMETRIC_METRICS = [
  'weight_kg',
  'body_fat_pct',
  'resting_hr',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'sleep_hours',
  'steps',
];

const PROJECTION_DAYS = 30;
const MIN_DATA_POINTS = 7;

/**
 * Queries the distinct metrics available for a user in the measurements table.
 */
async function queryDistinctMetrics(pool: pg.Pool, userId: string): Promise<string[]> {
  const { rows } = await pool.query(`SELECT DISTINCT metric FROM measurements WHERE user_id = $1`, [
    userId,
  ]);
  return rows.map((r) => String(r['metric']));
}

/**
 * Queries daily averaged values for a single metric over the past lookbackDays.
 * Returns an array sorted by date ascending.
 */
async function queryDailyValues(
  pool: pg.Pool,
  userId: string,
  metric: string,
  lookbackDays = 90,
): Promise<Array<{ date: string; value: number }>> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - lookbackDays);

  const { rows } = await pool.query(
    `SELECT DATE(measured_at) AS day, AVG(value) AS avg_value
     FROM measurements
     WHERE user_id = $1 AND metric = $2 AND measured_at BETWEEN $3 AND $4
     GROUP BY DATE(measured_at)
     ORDER BY day`,
    [userId, metric, startDate, endDate],
  );

  return rows.map((r) => ({
    date: r['day'] instanceof Date ? r['day'].toISOString().split('T')[0] : String(r['day']),
    value: Number(r['avg_value']),
  }));
}

/**
 * Runs trajectory projections for a user's metrics.
 * Loads recent measurement history, fits trend models, and upserts
 * projected values into the projections table.
 *
 * @param pool - pg connection pool
 * @param userId - user to run projections for
 * @param metrics - specific metrics to project (default: all available biometric metrics)
 */
export async function runTrajectoryProjections(
  pool: pg.Pool,
  userId: string,
  metrics?: string[],
): Promise<void> {
  // Resolve metrics: use provided list, or query distinct metrics filtered by the biometric set.
  // If the user has no matching metrics, return early — no point firing DB queries per metric.
  let targetMetrics: string[];
  if (metrics && metrics.length > 0) {
    targetMetrics = metrics;
  } else {
    const available = await queryDistinctMetrics(pool, userId);
    targetMetrics = available.filter((m) => DEFAULT_BIOMETRIC_METRICS.includes(m));
    if (targetMetrics.length === 0) {
      return;
    }
  }

  for (const metric of targetMetrics) {
    const dailyValues = await queryDailyValues(pool, userId, metric);

    if (dailyValues.length < MIN_DATA_POINTS) continue;

    const projected = projectForward(dailyValues, PROJECTION_DAYS);

    if (projected.length === 0) continue;

    const projectionRows = projected.map((p) => ({
      userId,
      metric,
      projectionDate: p.date,
      projectedValue: p.value,
      confidenceLow: p.low,
      confidenceHigh: p.high,
      method: 'linear_regression' as const,
      dataPoints: dailyValues.length,
    }));

    await upsertProjections(pool, userId, projectionRows);
  }
}
