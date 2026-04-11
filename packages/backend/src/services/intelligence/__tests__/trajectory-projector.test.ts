import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { runTrajectoryProjections } from '../trajectory-projector.js';

// Mock the projections DB query
vi.mock('../../../db/queries/projections.js', () => ({
  upsertProjections: vi.fn().mockResolvedValue(undefined),
}));

/** Generates `n` daily rows with a linear trend + deterministic noise for use as pool.query results */
function linearDailyRows(
  n: number,
  baseValue: number,
  slope: number,
): Array<{ day: string; avg_value: string }> {
  const rows = [];
  const start = new Date('2026-01-01');
  // Noise pattern: alternates +0.3 / -0.3 so residualStdDev > 0 (needed for non-zero CI bands)
  const noise = [0.3, -0.3, 0.2, -0.2, 0.4, -0.4, 0.1, -0.1];
  for (let i = 0; i < n; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const value = baseValue + slope * i + noise[i % noise.length];
    rows.push({
      day: date.toISOString().split('T')[0],
      avg_value: String(value),
    });
  }
  return rows;
}

/** Creates a mock pool that handles both queryDistinctMetrics and queryDailyValues */
function makeMockPool(
  distinctMetrics: string[],
  dailyValueRows: Array<{ day: string; avg_value: string }>,
) {
  return {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT metric')) {
        return Promise.resolve({ rows: distinctMetrics.map((m) => ({ metric: m })) });
      }
      // queryDailyValues
      return Promise.resolve({ rows: dailyValueRows });
    }),
  } as unknown as Pool;
}

describe('runTrajectoryProjections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates 30-day projections with widening confidence bands (AC4)', async () => {
    const { upsertProjections } = await import('../../../db/queries/projections.js');

    // 30 days of linearly decreasing weight: 80.0 → ~78.5 kg
    const dailyRows = linearDailyRows(30, 80.0, -0.05);

    const pool = makeMockPool(['weight_kg'], dailyRows);

    await runTrajectoryProjections(pool, 'test-user', ['weight_kg']);

    expect(upsertProjections).toHaveBeenCalledOnce();

    const batch = (upsertProjections as ReturnType<typeof vi.fn>).mock.calls[0][2] as Array<{
      method: string;
      confidenceLow: number;
      confidenceHigh: number;
    }>;

    expect(batch).toHaveLength(30);

    for (const entry of batch) {
      expect(entry.method).toBe('linear_regression');
      expect(typeof entry.confidenceLow).toBe('number');
      expect(typeof entry.confidenceHigh).toBe('number');
    }

    // Confidence bands must widen over the projection horizon
    const bandWidth = (entry: { confidenceLow: number; confidenceHigh: number }) =>
      entry.confidenceHigh - entry.confidenceLow;
    expect(bandWidth(batch[29])).toBeGreaterThan(bandWidth(batch[0]));
  });

  it('skips metrics with fewer than MIN_DATA_POINTS', async () => {
    const { upsertProjections } = await import('../../../db/queries/projections.js');

    // Only 5 days — below MIN_DATA_POINTS (7)
    const dailyRows = linearDailyRows(5, 80.0, -0.05);
    const pool = makeMockPool(['weight_kg'], dailyRows);

    await runTrajectoryProjections(pool, 'test-user', ['weight_kg']);

    expect(upsertProjections).not.toHaveBeenCalled();
  });

  it('returns early when user has no matching default biometric metrics', async () => {
    const { upsertProjections } = await import('../../../db/queries/projections.js');

    // queryDistinctMetrics returns a metric outside the DEFAULT_BIOMETRIC_METRICS set
    const pool = makeMockPool(['exotic_metric_123'], []);

    await runTrajectoryProjections(pool, 'test-user');

    expect(upsertProjections).not.toHaveBeenCalled();
    // pool.query should only have been called once (for queryDistinctMetrics), not for queryDailyValues
    const queryCalls = (pool.query as ReturnType<typeof vi.fn>).mock.calls as string[][];
    const dailyValueCalls = queryCalls.filter((args) => String(args[0]).includes('AVG(value)'));
    expect(dailyValueCalls).toHaveLength(0);
  });
});
