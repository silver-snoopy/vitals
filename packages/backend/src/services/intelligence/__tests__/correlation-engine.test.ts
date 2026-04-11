import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { runCorrelationAnalysis } from '../correlation-engine.js';

// Mock the correlations DB queries
vi.mock('../../../db/queries/correlations.js', () => ({
  upsertCorrelation: vi.fn().mockResolvedValue('correlation-id'),
  listCorrelations: vi.fn().mockResolvedValue([]),
  markWeakening: vi.fn().mockResolvedValue(undefined),
}));

// Helper: build a mock pool whose query resolves with rows
function makeMockPool(queryFn: (sql: string, params: unknown[]) => { rows: unknown[] }) {
  return {
    query: vi
      .fn()
      .mockImplementation((sql: string, params: unknown[]) =>
        Promise.resolve(queryFn(sql, params)),
      ),
  } as unknown as Pool;
}

/** Generates `n` daily rows for a given metric with a linear trend + tiny noise */
function linearRows(
  metric: string,
  n: number,
  baseValue: number,
  slope: number,
): Array<{ metric: string; day: string; avg_value: string }> {
  const rows = [];
  const start = new Date('2026-01-01');
  for (let i = 0; i < n; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const day = date.toISOString().split('T')[0];
    // tiny deterministic noise: +/- 0.001 per step
    const value = baseValue + slope * i + (i % 2 === 0 ? 0.001 : -0.001);
    rows.push({ metric, day, avg_value: String(value) });
  }
  return rows;
}

describe('runCorrelationAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces at least 1 correlation with 14+ days of aligned data (AC3)', async () => {
    const { upsertCorrelation } = await import('../../../db/queries/correlations.js');
    const { listCorrelations } = await import('../../../db/queries/correlations.js');

    // protein_g (factor) and weight_kg (outcome): both increase linearly over 20 days — strong r
    const proteinRows = linearRows('protein_g', 20, 150, 1.0);
    const weightRows = linearRows('weight_kg', 20, 80.0, 0.1);

    const pool = makeMockPool((_sql, _params) => {
      // loadDailyAverages does a single GROUP BY query for all metrics
      return { rows: [...proteinRows, ...weightRows] };
    });

    (listCorrelations as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await runCorrelationAnalysis(pool, 'test-user');

    expect(upsertCorrelation).toHaveBeenCalled();

    // Verify the first call has a strong correlation coefficient
    const firstCall = (upsertCorrelation as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      correlationCoefficient: number;
    };
    expect(Math.abs(firstCall.correlationCoefficient)).toBeGreaterThan(0.5);
  });

  it('does not produce a correlation with fewer than MIN_DATA_POINTS', async () => {
    const { upsertCorrelation } = await import('../../../db/queries/correlations.js');
    const { listCorrelations } = await import('../../../db/queries/correlations.js');

    // Only 5 days — below the MIN_DATA_POINTS threshold of 7
    const proteinRows = linearRows('protein_g', 5, 150, 1.0);
    const weightRows = linearRows('weight_kg', 5, 80.0, 0.1);

    const pool = makeMockPool((_sql, _params) => ({
      rows: [...proteinRows, ...weightRows],
    }));

    (listCorrelations as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await runCorrelationAnalysis(pool, 'test-user');

    expect(upsertCorrelation).not.toHaveBeenCalled();
  });

  it('handles zero-data gracefully — no throw, no upsert', async () => {
    const { upsertCorrelation } = await import('../../../db/queries/correlations.js');
    const { listCorrelations } = await import('../../../db/queries/correlations.js');

    const pool = makeMockPool((_sql, _params) => ({ rows: [] }));

    (listCorrelations as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(runCorrelationAnalysis(pool, 'test-user')).resolves.toBeUndefined();
    expect(upsertCorrelation).not.toHaveBeenCalled();
  });
});
