import type pg from 'pg';

export interface CollectionMetadata {
  userId: string;
  providerName: string;
  lastSuccessfulFetch: Date | null;
  lastAttemptedFetch: Date | null;
  recordCount: number;
  status: string;
  errorMessage: string | null;
}

export async function loadCollectionMetadata(
  pool: pg.Pool,
  userId: string,
  providerName: string,
): Promise<CollectionMetadata | null> {
  const { rows } = await pool.query(
    `SELECT user_id, provider_name, last_successful_fetch, last_attempted_fetch,
            record_count, status, error_message
     FROM collection_metadata
     WHERE user_id = $1 AND provider_name = $2`,
    [userId, providerName],
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    userId: r.user_id,
    providerName: r.provider_name,
    lastSuccessfulFetch: r.last_successful_fetch,
    lastAttemptedFetch: r.last_attempted_fetch,
    recordCount: r.record_count,
    status: r.status,
    errorMessage: r.error_message,
  };
}

export async function saveCollectionMetadata(
  pool: pg.Pool,
  meta: CollectionMetadata,
): Promise<void> {
  await pool.query(
    `INSERT INTO collection_metadata
       (user_id, provider_name, last_successful_fetch, last_attempted_fetch,
        record_count, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, provider_name) DO UPDATE SET
       last_successful_fetch = EXCLUDED.last_successful_fetch,
       last_attempted_fetch = EXCLUDED.last_attempted_fetch,
       record_count = EXCLUDED.record_count,
       status = EXCLUDED.status,
       error_message = EXCLUDED.error_message`,
    [
      meta.userId,
      meta.providerName,
      meta.lastSuccessfulFetch,
      meta.lastAttemptedFetch,
      meta.recordCount,
      meta.status,
      meta.errorMessage,
    ],
  );
}

export async function refreshDailyAggregates(pool: pg.Pool): Promise<void> {
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_aggregates');
}
