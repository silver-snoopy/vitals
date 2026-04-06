import type pg from 'pg';
import type { Correlation, ConfidenceLevel, CorrelationCategory, CorrelationStatus } from '@vitals/shared';

export async function upsertCorrelation(
  pool: pg.Pool,
  correlation: Omit<Correlation, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  // TODO: INSERT ... ON CONFLICT (user_id, factor_metric, factor_condition, outcome_metric) DO UPDATE
  // Return the id of the upserted row
  void pool;
  void correlation;
  throw new Error('Not implemented');
}

export async function listCorrelations(
  pool: pg.Pool,
  userId: string,
  filters?: {
    category?: CorrelationCategory;
    confidenceLevel?: ConfidenceLevel;
    status?: CorrelationStatus;
  },
): Promise<Correlation[]> {
  // TODO: SELECT with optional WHERE clauses for category, confidence_level, status
  void pool;
  void userId;
  void filters;
  throw new Error('Not implemented');
}

export async function getTopCorrelations(
  pool: pg.Pool,
  userId: string,
  limit = 10,
): Promise<Correlation[]> {
  // TODO: SELECT ORDER BY ABS(correlation_coefficient) DESC, times_confirmed DESC LIMIT $3
  void pool;
  void userId;
  void limit;
  throw new Error('Not implemented');
}

export async function markWeakening(pool: pg.Pool, id: string): Promise<void> {
  // TODO: UPDATE correlations SET status = 'weakening', updated_at = now() WHERE id = $1
  void pool;
  void id;
  throw new Error('Not implemented');
}
