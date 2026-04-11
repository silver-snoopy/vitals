import type pg from 'pg';
import type {
  Correlation,
  ConfidenceLevel,
  CorrelationCategory,
  CorrelationStatus,
} from '@vitals/shared';

function rowToCorrelation(r: Record<string, unknown>): Correlation {
  return {
    id: String(r['id']),
    userId: String(r['user_id']),
    factorMetric: String(r['factor_metric']),
    factorCondition: String(r['factor_condition']),
    factorLabel: String(r['factor_label']),
    outcomeMetric: String(r['outcome_metric']),
    outcomeEffect: String(r['outcome_effect']),
    outcomeLabel: String(r['outcome_label']),
    correlationCoefficient: Number(r['correlation_coefficient']),
    confidenceLevel: String(r['confidence_level']) as ConfidenceLevel,
    dataPoints: Number(r['data_points']),
    pValue: r['p_value'] != null ? Number(r['p_value']) : null,
    firstDetectedAt:
      r['first_detected_at'] instanceof Date
        ? r['first_detected_at'].toISOString()
        : String(r['first_detected_at']),
    lastConfirmedAt:
      r['last_confirmed_at'] instanceof Date
        ? r['last_confirmed_at'].toISOString()
        : String(r['last_confirmed_at']),
    timesConfirmed: Number(r['times_confirmed']),
    status: String(r['status']) as CorrelationStatus,
    summary: String(r['summary']),
    category: String(r['category']) as CorrelationCategory,
    createdAt:
      r['created_at'] instanceof Date ? r['created_at'].toISOString() : String(r['created_at']),
    updatedAt:
      r['updated_at'] instanceof Date ? r['updated_at'].toISOString() : String(r['updated_at']),
  };
}

export async function upsertCorrelation(
  pool: pg.Pool,
  correlation: Omit<Correlation, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO correlations (
       user_id, factor_metric, factor_condition, factor_label,
       outcome_metric, outcome_effect, outcome_label,
       correlation_coefficient, confidence_level, data_points, p_value,
       first_detected_at, last_confirmed_at, times_confirmed,
       status, summary, category
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (user_id, factor_metric, factor_condition, outcome_metric) DO UPDATE SET
       factor_label         = EXCLUDED.factor_label,
       outcome_effect       = EXCLUDED.outcome_effect,
       outcome_label        = EXCLUDED.outcome_label,
       correlation_coefficient = EXCLUDED.correlation_coefficient,
       confidence_level     = EXCLUDED.confidence_level,
       data_points          = EXCLUDED.data_points,
       p_value              = EXCLUDED.p_value,
       last_confirmed_at    = EXCLUDED.last_confirmed_at,
       times_confirmed      = correlations.times_confirmed + 1,
       status               = EXCLUDED.status,
       summary              = EXCLUDED.summary,
       category             = EXCLUDED.category,
       updated_at           = now()
       -- first_detected_at is intentionally excluded: preserve the original detection timestamp
     RETURNING id`,
    [
      correlation.userId,
      correlation.factorMetric,
      correlation.factorCondition,
      correlation.factorLabel,
      correlation.outcomeMetric,
      correlation.outcomeEffect,
      correlation.outcomeLabel,
      correlation.correlationCoefficient,
      correlation.confidenceLevel,
      correlation.dataPoints,
      correlation.pValue,
      correlation.firstDetectedAt,
      correlation.lastConfirmedAt,
      correlation.timesConfirmed,
      correlation.status,
      correlation.summary,
      correlation.category,
    ],
  );

  return String(rows[0]['id']);
}

export async function listCorrelations(
  pool: pg.Pool,
  userId: string,
  filters?: {
    category?: CorrelationCategory | string;
    confidenceLevel?: ConfidenceLevel | string;
    status?: CorrelationStatus | string;
    metric?: string;
    minConfidence?: string;
  },
): Promise<Correlation[]> {
  const conditions: string[] = ['user_id = $1'];
  const params: unknown[] = [userId];
  let idx = 2;

  if (filters?.category) {
    conditions.push(`category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters?.confidenceLevel) {
    conditions.push(`confidence_level = $${idx++}`);
    params.push(filters.confidenceLevel);
  }
  if (filters?.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters?.metric) {
    conditions.push(`(factor_metric = $${idx} OR outcome_metric = $${idx})`);
    params.push(filters.metric);
    idx++;
  }
  if (filters?.minConfidence) {
    conditions.push(`ABS(correlation_coefficient) >= $${idx++}`);
    params.push(Number(filters.minConfidence));
  }

  const sql = `
    SELECT id, user_id, factor_metric, factor_condition, factor_label,
           outcome_metric, outcome_effect, outcome_label,
           correlation_coefficient, confidence_level, data_points, p_value,
           first_detected_at, last_confirmed_at, times_confirmed,
           status, summary, category, created_at, updated_at
    FROM correlations
    WHERE ${conditions.join(' AND ')}
    ORDER BY ABS(correlation_coefficient) DESC, last_confirmed_at DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map(rowToCorrelation);
}

export async function getTopCorrelations(
  pool: pg.Pool,
  userId: string,
  limit = 10,
): Promise<Correlation[]> {
  const { rows } = await pool.query(
    `SELECT id, user_id, factor_metric, factor_condition, factor_label,
            outcome_metric, outcome_effect, outcome_label,
            correlation_coefficient, confidence_level, data_points, p_value,
            first_detected_at, last_confirmed_at, times_confirmed,
            status, summary, category, created_at, updated_at
     FROM correlations
     WHERE user_id = $1
     ORDER BY ABS(correlation_coefficient) DESC, times_confirmed DESC
     LIMIT $2`,
    [userId, limit],
  );

  return rows.map(rowToCorrelation);
}

export async function markWeakening(pool: pg.Pool, id: string): Promise<void> {
  await pool.query(
    `UPDATE correlations SET status = 'weakening', updated_at = now() WHERE id = $1`,
    [id],
  );
}
