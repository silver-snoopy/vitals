import { describe, it, expect, vi } from 'vitest';
import { CronometerNutritionProvider, CronometerBiometricsProvider } from '../provider.js';
import type { CronometerClient } from '../client.js';
import type pg from 'pg';

const userId = '00000000-0000-0000-0000-000000000001';
const start = new Date('2026-03-01');
const end = new Date('2026-03-07');

const nutritionCsv = `Date,Energy (kcal),Protein (g),Carbohydrates (g),Fat (g)
2026-03-01,2000,150,200,80
2026-03-02,1800,130,180,70
`;

const biometricsCsv = `Day,Metric,Amount,Unit
2026-03-01,weight_kg,82.5,kg
2026-03-02,weight_kg,82.3,kg
`;

function makeClient(overrides: Partial<CronometerClient> = {}): CronometerClient {
  return {
    exportDailyNutrition: vi.fn().mockResolvedValue(nutritionCsv),
    exportBiometrics: vi.fn().mockResolvedValue(biometricsCsv),
    ...overrides,
  };
}

function makePool(): pg.Pool {
  const client = {
    query: vi.fn().mockResolvedValue({ rowCount: 1 }),
    release: vi.fn(),
  };
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as pg.Pool;
}

describe('CronometerNutritionProvider', () => {
  it('fetches, normalizes, and ingests nutrition data', async () => {
    const client = makeClient();
    const pool = makePool();
    const provider = new CronometerNutritionProvider(client, pool, userId);

    const result = await provider.collect(start, end);

    expect(client.exportDailyNutrition).toHaveBeenCalledWith(start, end);
    expect(result.provider).toBe('cronometer-nutrition');
    expect(result.dateRange).toEqual({ start, end });
    expect(result.errors).toHaveLength(0);
  });

  it('captures errors and returns them in result when client throws', async () => {
    const client = makeClient({
      exportDailyNutrition: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const pool = makePool();
    const provider = new CronometerNutritionProvider(client, pool, userId);

    const result = await provider.collect(start, end);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Network error');
    expect(result.recordCount).toBe(0);
  });

  it('saves collection metadata on success', async () => {
    const client = makeClient();
    const pool = makePool();
    const provider = new CronometerNutritionProvider(client, pool, userId);

    await provider.collect(start, end);

    // pool.query is called for metadata upserts (saveCollectionMetadata)
    expect(pool.query).toHaveBeenCalled();
  });
});

describe('CronometerBiometricsProvider', () => {
  it('fetches, normalizes, and ingests biometric data', async () => {
    const client = makeClient();
    const pool = makePool();
    const provider = new CronometerBiometricsProvider(client, pool, userId);

    const result = await provider.collect(start, end);

    expect(client.exportBiometrics).toHaveBeenCalledWith(start, end);
    expect(result.provider).toBe('cronometer-biometrics');
    expect(result.errors).toHaveLength(0);
  });

  it('skips rows that fail normalization without crashing', async () => {
    const badCsv = `Day,Metric,Amount,Unit
2026-03-01,weight_kg,,kg
2026-03-02,weight_kg,82.3,kg
`;
    const client = makeClient({ exportBiometrics: vi.fn().mockResolvedValue(badCsv) });
    const pool = makePool();
    const provider = new CronometerBiometricsProvider(client, pool, userId);

    const result = await provider.collect(start, end);
    // Should not throw, bad row is skipped
    expect(result.errors).toHaveLength(0);
  });
});
