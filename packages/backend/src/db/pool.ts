import pg from 'pg';

// Return DATE columns as plain strings (YYYY-MM-DD) instead of Date objects.
// pg constructs Date at midnight local time, so toISOString() shifts the date
// back by the UTC offset — causing off-by-one day bugs in non-UTC timezones.
pg.types.setTypeParser(1082, (val) => val);

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function initPool(databaseUrl: string): pg.Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initPool() first.');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
