import type pg from 'pg';
import type { TrackedActionItem, ActionItemOutcome } from '@vitals/shared';

// Metrics that come from daily nutrition summaries
const NUTRITION_METRICS = new Set([
  'protein_g',
  'calories',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'sodium_mg',
  'sugar_g',
]);

// Metrics that come from biometric measurements
const BIOMETRIC_METRICS = new Set([
  'body_weight_kg',
  'body_fat_percent',
  'hrv_rmssd',
  'resting_heart_rate',
  'sleep_hours',
  'spo2_pct',
]);

// Map targetMetric names to actual DB metric names (measurements table)
const BIOMETRIC_METRIC_MAP: Record<string, string> = {
  body_weight_kg: 'weight_kg',
  body_fat_percent: 'body_fat_pct',
  hrv_rmssd: 'hrv_ms',
  resting_heart_rate: 'resting_heart_rate_bpm',
  sleep_hours: 'sleep_hours',
  spo2_pct: 'spo2_pct',
};

// Map targetMetric names to nutrition summary column names
const NUTRITION_FIELD_MAP: Record<string, string> = {
  protein_g: 'protein',
  calories: 'calories',
  carbs_g: 'carbs',
  fat_g: 'fat',
  fiber_g: 'fiber',
  sodium_mg: 'sodium',
  sugar_g: 'sugar',
};

interface MetricValues {
  values: number[];
  average: number;
}

async function queryNutritionMetric(
  pool: pg.Pool,
  userId: string,
  field: string,
  startDate: Date,
  endDate: Date,
): Promise<MetricValues> {
  const column = NUTRITION_FIELD_MAP[field];
  if (!column) return { values: [], average: 0 };

  const { rows } = await pool.query(
    `SELECT SUM(value) AS daily_total
     FROM measurements
     WHERE user_id = $1
       AND measured_at::date BETWEEN $2::date AND $3::date
       AND metric = $4
     GROUP BY measured_at::date
     ORDER BY measured_at::date`,
    [userId, startDate, endDate, column],
  );

  const values = rows.map((r: { daily_total: string }) => Number(r.daily_total));
  const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return { values, average };
}

async function queryBiometricMetric(
  pool: pg.Pool,
  userId: string,
  targetMetric: string,
  startDate: Date,
  endDate: Date,
): Promise<MetricValues> {
  const dbMetric = BIOMETRIC_METRIC_MAP[targetMetric] ?? targetMetric;

  const { rows } = await pool.query(
    `SELECT value FROM measurements
     WHERE user_id = $1 AND metric = $2
       AND measured_at::date BETWEEN $3::date AND $4::date
     ORDER BY measured_at`,
    [userId, dbMetric, startDate, endDate],
  );

  const values = rows.map((r: { value: number }) => Number(r.value));
  const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return { values, average };
}

async function resolveMetricValues(
  pool: pg.Pool,
  userId: string,
  targetMetric: string,
  startDate: Date,
  endDate: Date,
): Promise<MetricValues> {
  if (NUTRITION_METRICS.has(targetMetric)) {
    return queryNutritionMetric(pool, userId, targetMetric, startDate, endDate);
  }
  if (BIOMETRIC_METRICS.has(targetMetric)) {
    return queryBiometricMetric(pool, userId, targetMetric, startDate, endDate);
  }
  // Training metrics: query workout sets and aggregate
  if (targetMetric === 'training_volume') {
    const { rows } = await pool.query(
      `SELECT performed_at::date AS date,
              SUM(weight_kg * reps) AS daily_volume
       FROM workout_sets
       WHERE user_id = $1
         AND performed_at::date BETWEEN $2::date AND $3::date
       GROUP BY performed_at::date`,
      [userId, startDate, endDate],
    );
    const values = rows.map((r: { daily_volume: string }) => Number(r.daily_volume));
    const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { values, average };
  }
  if (targetMetric === 'training_frequency') {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT performed_at::date)::int AS training_days
       FROM workout_sets
       WHERE user_id = $1
         AND performed_at::date BETWEEN $2::date AND $3::date`,
      [userId, startDate, endDate],
    );
    const days = rows[0]?.training_days ?? 0;
    return { values: [Number(days)], average: Number(days) };
  }
  return { values: [], average: 0 };
}

function determineOutcome(
  baseline: number,
  outcome: number,
  direction: 'increase' | 'decrease' | 'maintain',
): ActionItemOutcome {
  if (baseline === 0) return 'stable';

  const changePct = ((outcome - baseline) / Math.abs(baseline)) * 100;

  if (direction === 'maintain') {
    return Math.abs(changePct) < 5 ? 'improved' : 'declined';
  }

  if (direction === 'increase') {
    if (changePct > 2) return 'improved';
    if (changePct < -2) return 'declined';
    return 'stable';
  }

  // decrease
  if (changePct < -2) return 'improved';
  if (changePct > 2) return 'declined';
  return 'stable';
}

function determineConfidence(
  baseline: number,
  outcome: number,
  dataPoints: number,
): 'high' | 'medium' | 'low' {
  if (dataPoints < 3) return 'low';

  const changePct = baseline !== 0 ? Math.abs(((outcome - baseline) / baseline) * 100) : 0;

  if (changePct > 10 && dataPoints >= 5) return 'high';
  if (changePct >= 2 || dataPoints >= 3) return 'medium';
  return 'low';
}

export interface MeasureOutcomeResult {
  itemId: string;
  outcome: ActionItemOutcome;
  outcomeValue: number;
  baselineValue: number;
  confidence: 'high' | 'medium' | 'low';
}

export async function measureOutcomes(
  pool: pg.Pool,
  userId: string,
  items: TrackedActionItem[],
): Promise<MeasureOutcomeResult[]> {
  const results: MeasureOutcomeResult[] = [];

  for (const item of items) {
    if (!item.targetMetric || !item.targetDirection) continue;
    if (item.outcomeMeasuredAt) continue; // already measured

    const createdAt = new Date(item.createdAt);
    const completedAt = item.completedAt ? new Date(item.completedAt) : new Date();

    // Baseline: 7 days before item creation
    const baselineEnd = new Date(createdAt);
    baselineEnd.setDate(baselineEnd.getDate() - 1);
    const baselineStart = new Date(baselineEnd);
    baselineStart.setDate(baselineStart.getDate() - 6);

    // Outcome: 7 days after completion
    const outcomeStart = new Date(completedAt);
    const outcomeEnd = new Date(completedAt);
    outcomeEnd.setDate(outcomeEnd.getDate() + 7);

    const [baselineData, outcomeData] = await Promise.all([
      item.baselineValue != null
        ? Promise.resolve({ values: [], average: item.baselineValue })
        : resolveMetricValues(pool, userId, item.targetMetric, baselineStart, baselineEnd),
      resolveMetricValues(pool, userId, item.targetMetric, outcomeStart, outcomeEnd),
    ]);

    if (outcomeData.values.length === 0 && baselineData.average === 0) continue;

    const baseline = baselineData.average;
    const outcomeAvg = outcomeData.average;
    const outcome = determineOutcome(baseline, outcomeAvg, item.targetDirection);
    const confidence = determineConfidence(baseline, outcomeAvg, outcomeData.values.length);

    // Update DB
    await pool.query(
      `UPDATE action_items
       SET baseline_value = $1, outcome_value = $2,
           outcome_confidence = $3, outcome_measured_at = now()
       WHERE id = $4 AND user_id = $5`,
      [baseline, outcomeAvg, confidence, item.id, userId],
    );

    results.push({
      itemId: item.id,
      outcome,
      outcomeValue: outcomeAvg,
      baselineValue: baseline,
      confidence,
    });
  }

  return results;
}

// Exported for testing
export { determineOutcome, determineConfidence, resolveMetricValues };
