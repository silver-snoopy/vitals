import pg from 'pg';

const { Pool } = pg;

export function createTestPool(): pg.Pool {
  const url = process.env.DATABASE_URL || 'postgresql://vitals:vitals@localhost:5432/vitals';
  return new Pool({ connectionString: url, max: 3 });
}

export async function truncateTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE measurements, workout_sets, collection_metadata,
                   weekly_reports, ai_generations, apple_health_imports
    RESTART IDENTITY CASCADE
  `);
  await pool.query('REFRESH MATERIALIZED VIEW daily_aggregates');
}
