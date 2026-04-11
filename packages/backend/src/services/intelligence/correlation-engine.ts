import type pg from 'pg';
import type { CorrelationCategory } from '@vitals/shared';
import { pearsonCorrelation, calculatePValue, classifyConfidence } from './stats.js';
import {
  upsertCorrelation,
  listCorrelations,
  markWeakening,
} from '../../db/queries/correlations.js';

/** Candidate pair: a factor metric and an outcome metric to test for correlation. */
interface CandidatePair {
  factorMetric: string;
  outcomeMetric: string;
  category: CorrelationCategory;
}

/**
 * Candidate factor/outcome pairs to test for correlations.
 * Factor: leading indicator (nutrition, activity)
 * Outcome: lagging biometric result
 */
const CANDIDATE_PAIRS: CandidatePair[] = [
  // Nutrition → biometrics
  { factorMetric: 'calories', outcomeMetric: 'weight_kg', category: 'nutrition' },
  { factorMetric: 'protein_g', outcomeMetric: 'weight_kg', category: 'nutrition' },
  { factorMetric: 'fat_g', outcomeMetric: 'weight_kg', category: 'nutrition' },
  { factorMetric: 'carbs_g', outcomeMetric: 'weight_kg', category: 'nutrition' },
  { factorMetric: 'sodium_mg', outcomeMetric: 'weight_kg', category: 'nutrition' },
  { factorMetric: 'calories', outcomeMetric: 'body_fat_pct', category: 'nutrition' },
  { factorMetric: 'protein_g', outcomeMetric: 'body_fat_pct', category: 'nutrition' },
  // Activity → biometrics
  { factorMetric: 'steps', outcomeMetric: 'weight_kg', category: 'cross-domain' },
  { factorMetric: 'steps', outcomeMetric: 'resting_hr', category: 'cross-domain' },
  { factorMetric: 'steps', outcomeMetric: 'sleep_hours', category: 'cross-domain' },
  // Sleep → performance/biometrics
  { factorMetric: 'sleep_hours', outcomeMetric: 'resting_hr', category: 'recovery' },
  { factorMetric: 'sleep_hours', outcomeMetric: 'steps', category: 'recovery' },
  // Training indicators
  { factorMetric: 'workout_volume', outcomeMetric: 'weight_kg', category: 'training' },
  { factorMetric: 'workout_volume', outcomeMetric: 'resting_hr', category: 'training' },
];

const MIN_DATA_POINTS = 7;

/**
 * Loads daily averaged measurements for a set of metrics within a lookback window.
 * Returns a map of metric → Map<date-string, avg-value>.
 */
async function loadDailyAverages(
  pool: pg.Pool,
  userId: string,
  metrics: string[],
  startDate: Date,
  endDate: Date,
): Promise<Map<string, Map<string, number>>> {
  if (metrics.length === 0) return new Map();

  const { rows } = await pool.query(
    `SELECT metric,
            DATE(measured_at) AS day,
            AVG(value) AS avg_value
     FROM measurements
     WHERE user_id = $1
       AND metric = ANY($2::text[])
       AND measured_at BETWEEN $3 AND $4
     GROUP BY metric, DATE(measured_at)
     ORDER BY metric, day`,
    [userId, metrics, startDate, endDate],
  );

  const result = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const metric = String(row['metric']);
    const day =
      row['day'] instanceof Date ? row['day'].toISOString().split('T')[0] : String(row['day']);
    const value = Number(row['avg_value']);

    if (!result.has(metric)) result.set(metric, new Map());
    result.get(metric)!.set(day, value);
  }
  return result;
}

/**
 * Aligns two metric time-series by shared dates and returns parallel arrays.
 */
function alignSeries(
  factorSeries: Map<string, number>,
  outcomeSeries: Map<string, number>,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const [date, xVal] of factorSeries) {
    if (outcomeSeries.has(date)) {
      xs.push(xVal);
      ys.push(outcomeSeries.get(date)!);
    }
  }

  return { xs, ys };
}

/**
 * Builds human-readable labels for a correlation.
 */
function buildLabels(
  factorMetric: string,
  outcomeMetric: string,
  r: number,
): {
  factorCondition: string;
  factorLabel: string;
  outcomeEffect: string;
  outcomeLabel: string;
  summary: string;
} {
  const direction = r > 0 ? 'higher' : 'lower';
  const strength = Math.abs(r) >= 0.5 ? 'strongly' : 'moderately';

  return {
    factorCondition: `${factorMetric}_high`,
    factorLabel: `Higher ${factorMetric.replace(/_/g, ' ')}`,
    outcomeEffect: r > 0 ? 'increase' : 'decrease',
    outcomeLabel: `${outcomeMetric.replace(/_/g, ' ')} ${direction}`,
    summary: `Higher ${factorMetric.replace(/_/g, ' ')} is ${strength} associated with ${direction} ${outcomeMetric.replace(/_/g, ' ')} (r=${r.toFixed(2)})`,
  };
}

/**
 * Runs the full correlation analysis pipeline for a user.
 * Loads measurement data, tests candidate metric pairs, computes Pearson r,
 * classifies confidence, and upserts results into the correlations table.
 *
 * @param pool - pg connection pool
 * @param userId - user to run analysis for
 * @param lookbackDays - how many days of history to include (default 90)
 */
export async function runCorrelationAnalysis(
  pool: pg.Pool,
  userId: string,
  lookbackDays = 90,
): Promise<void> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - lookbackDays);

  // Collect all unique metrics referenced in candidate pairs
  const allMetrics = Array.from(
    new Set(CANDIDATE_PAIRS.flatMap((p) => [p.factorMetric, p.outcomeMetric])),
  );

  // Load daily averages for all metrics
  const dailyAverages = await loadDailyAverages(pool, userId, allMetrics, startDate, endDate);

  // Track which correlation keys were upserted in this run so we can mark old ones as weakening
  const upsertedKeys = new Set<string>();

  for (const pair of CANDIDATE_PAIRS) {
    const factorSeries = dailyAverages.get(pair.factorMetric);
    const outcomeSeries = dailyAverages.get(pair.outcomeMetric);

    if (!factorSeries || !outcomeSeries) continue;

    const { xs, ys } = alignSeries(factorSeries, outcomeSeries);

    if (xs.length < MIN_DATA_POINTS) continue;

    const r = pearsonCorrelation(xs, ys);
    if (isNaN(r)) continue;

    const pValue = calculatePValue(r, xs.length);
    const confidenceLevel = classifyConfidence(r, xs.length, pValue);

    // Only persist correlations with meaningful strength (filter noise)
    if (Math.abs(r) < 0.1) continue;

    const labels = buildLabels(pair.factorMetric, pair.outcomeMetric, r);
    const now = new Date().toISOString();

    const id = await upsertCorrelation(pool, {
      userId,
      factorMetric: pair.factorMetric,
      factorCondition: labels.factorCondition,
      factorLabel: labels.factorLabel,
      outcomeMetric: pair.outcomeMetric,
      outcomeEffect: labels.outcomeEffect,
      outcomeLabel: labels.outcomeLabel,
      correlationCoefficient: r,
      confidenceLevel,
      dataPoints: xs.length,
      pValue,
      firstDetectedAt: now,
      lastConfirmedAt: now,
      timesConfirmed: 1,
      status: 'active',
      summary: labels.summary,
      category: pair.category,
    });

    upsertedKeys.add(id);
  }

  // Mark previously active correlations that were not refreshed in this run as weakening
  const existingCorrelations = await listCorrelations(pool, userId, { status: 'active' });
  for (const correlation of existingCorrelations) {
    if (!upsertedKeys.has(correlation.id)) {
      await markWeakening(pool, correlation.id);
    }
  }
}
