import type pg from 'pg';

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
  // TODO:
  // 1. Resolve metrics list (use provided or query distinct metrics for userId)
  // 2. For each metric: query recent daily values
  // 3. Skip metrics with insufficient data points (< 7)
  // 4. Call projectForward for the next 30 days using linear_regression method
  // 5. Upsert projections via upsertProjections
  void pool;
  void userId;
  void metrics;
  throw new Error('Not implemented');
}
