import type pg from 'pg';
import type { Projection } from '@vitals/shared';

export async function upsertProjections(
  pool: pg.Pool,
  userId: string,
  projections: Omit<Projection, 'id' | 'generatedAt'>[],
): Promise<void> {
  // TODO: Batch INSERT ... ON CONFLICT (user_id, metric, projection_date) DO UPDATE
  void pool;
  void userId;
  void projections;
  throw new Error('Not implemented');
}

export async function getProjections(
  pool: pg.Pool,
  userId: string,
  metric: string,
): Promise<Projection[]> {
  // TODO: SELECT WHERE user_id = $1 AND metric = $2 ORDER BY projection_date
  void pool;
  void userId;
  void metric;
  throw new Error('Not implemented');
}

export async function getLatestProjections(
  pool: pg.Pool,
  userId: string,
): Promise<Projection[]> {
  // TODO: SELECT DISTINCT ON (metric) latest projection per metric, ORDER BY metric, generated_at DESC
  void pool;
  void userId;
  throw new Error('Not implemented');
}
