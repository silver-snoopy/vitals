import type pg from 'pg';
import type { BiometricReading, DailyNutritionSummary } from '@vitals/shared';

export async function queryMeasurementsByMetric(
  pool: pg.Pool,
  userId: string,
  metric: string,
  startDate: Date,
  endDate: Date,
): Promise<BiometricReading[]> {
  const { rows } = await pool.query(
    `SELECT id, user_id, measured_at, metric, value, unit, source, collected_at
     FROM measurements
     WHERE user_id = $1 AND metric = $2 AND measured_at BETWEEN $3 AND $4
     ORDER BY measured_at`,
    [userId, metric, startDate, endDate],
  );

  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    date: r.measured_at instanceof Date ? r.measured_at.toISOString() : String(r.measured_at),
    metric: String(r.metric),
    value: Number(r.value),
    unit: String(r.unit),
    source: String(r.source),
    collectedAt:
      r.collected_at instanceof Date ? r.collected_at.toISOString() : String(r.collected_at),
  }));
}

export async function queryDailyNutritionSummary(
  pool: pg.Pool,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<DailyNutritionSummary[]> {
  const { rows } = await pool.query(
    `SELECT DATE(measured_at) AS day,
       COALESCE(SUM(CASE WHEN metric = 'calories' THEN value END), 0) AS calories,
       COALESCE(SUM(CASE WHEN metric = 'protein_g' THEN value END), 0) AS protein,
       COALESCE(SUM(CASE WHEN metric = 'carbs_g' THEN value END), 0) AS carbs,
       COALESCE(SUM(CASE WHEN metric = 'fat_g' THEN value END), 0) AS fat,
       COALESCE(SUM(CASE WHEN metric = 'fiber_g' THEN value END), 0) AS fiber
     FROM measurements
     WHERE user_id = $1 AND category = 'nutrition' AND measured_at BETWEEN $2 AND $3
     GROUP BY DATE(measured_at)
     ORDER BY day`,
    [userId, startDate, endDate],
  );

  return rows.map((r) => ({
    date: r.day instanceof Date ? r.day.toISOString().split('T')[0] : String(r.day),
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
    fiber: Number(r.fiber),
  }));
}
