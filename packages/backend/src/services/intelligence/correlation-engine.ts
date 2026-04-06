import type pg from 'pg';

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
  // TODO:
  // 1. Query measurements for userId over the lookback window
  // 2. Build candidate factor/outcome metric pairs
  // 3. For each pair: align daily values, call pearsonCorrelation + calculatePValue + classifyConfidence
  // 4. Filter pairs below minimum data points or confidence threshold
  // 5. Upsertcorrelation for each passing pair
  // 6. Mark previously-active correlations that no longer pass as 'weakening'
  void pool;
  void userId;
  void lookbackDays;
  throw new Error('Not implemented');
}
