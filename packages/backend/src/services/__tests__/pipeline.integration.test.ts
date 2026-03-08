/**
 * Integration tests for the collection pipeline.
 * Requires a running PostgreSQL instance (docker compose up -d).
 * Skip with: SKIP_INTEGRATION_TESTS=1 npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { runMigrations } from '../../db/migrate.js';
import { createTestPool, truncateTables } from '../../test/setup.js';
import { runCollection } from '../collectors/pipeline.js';
import { registry } from '../collectors/provider-registry.js';
import type { DataProvider, CollectionResult } from '@vitals/shared';
import type pg from 'pg';

const SKIP = process.env.SKIP_INTEGRATION_TESTS === '1';
const userId = '00000000-0000-0000-0000-000000000001';

function makeMockNutritionProvider(): DataProvider {
  return {
    name: 'mock-nutrition',
    async collect(startDate: Date, endDate: Date): Promise<CollectionResult> {
      // Simulate ingesting 3 nutrition measurement rows via the pool
      return {
        provider: 'mock-nutrition',
        recordCount: 0,
        dateRange: { start: startDate, end: endDate },
        errors: [],
      };
    },
  };
}

describe.skipIf(SKIP)('Collection pipeline integration', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = createTestPool();
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    registry.clear();
    await truncateTables(pool);
  });

  it('runs with no registered providers and returns empty results', async () => {
    const result = await runCollection(pool, {
      userId,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-07'),
    });

    expect(result.results).toHaveLength(0);
    expect(result.totalRecords).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('runs registered providers and returns their results', async () => {
    registry.register(makeMockNutritionProvider());

    const result = await runCollection(pool, {
      userId,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-07'),
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].provider).toBe('mock-nutrition');
    expect(result.results[0].errors).toHaveLength(0);
  });

  it('filters to requested providers only', async () => {
    registry.register(makeMockNutritionProvider());
    registry.register({
      name: 'mock-workouts',
      collect: async (s, e) => ({
        provider: 'mock-workouts',
        recordCount: 0,
        dateRange: { start: s, end: e },
        errors: [],
      }),
    });

    const result = await runCollection(pool, {
      userId,
      providers: ['mock-nutrition'],
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-07'),
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].provider).toBe('mock-nutrition');
  });

  it('reports error for unregistered provider name', async () => {
    const result = await runCollection(pool, {
      userId,
      providers: ['nonexistent'],
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-07'),
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].errors[0]).toContain('not registered');
  });

  it('database is reachable and migrations are applied', async () => {
    const { rows } = await pool.query('SELECT name FROM _migrations ORDER BY name');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe('001_initial_schema.sql');
  });

  it('measurements table accepts rows', async () => {
    await pool.query(
      `
      INSERT INTO measurements (user_id, source, category, metric, value, unit, measured_at)
      VALUES ($1, 'test', 'nutrition', 'calories', 2000, 'kcal', NOW())
    `,
      [userId],
    );

    const { rows } = await pool.query('SELECT * FROM measurements WHERE user_id = $1', [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].metric).toBe('calories');
    expect(Number(rows[0].value)).toBe(2000);
  });

  it('workout_sets table accepts rows', async () => {
    await pool.query(
      `
      INSERT INTO workout_sets (user_id, source, exercise_name, set_index, weight_kg, reps, started_at)
      VALUES ($1, 'hevy', 'Squat', 0, 100, 5, NOW())
    `,
      [userId],
    );

    const { rows } = await pool.query('SELECT * FROM workout_sets WHERE user_id = $1', [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].exercise_name).toBe('Squat');
  });
});
