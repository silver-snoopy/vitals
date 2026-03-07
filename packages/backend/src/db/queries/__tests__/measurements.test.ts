import { describe, it, expect, vi } from 'vitest';
import { queryMeasurementsByMetric, queryDailyNutritionSummary } from '../measurements.js';
import type pg from 'pg';

function makeMockPool(rows: unknown[]): pg.Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as pg.Pool;
}

describe('queryMeasurementsByMetric', () => {
  it('maps DB rows to BiometricReading', async () => {
    const pool = makeMockPool([
      {
        id: 'uuid-1',
        user_id: 'user-uuid',
        measured_at: new Date('2026-03-01T00:00:00.000Z'),
        metric: 'weight_kg',
        value: '72.5',
        unit: 'kg',
        source: 'cronometer',
        collected_at: new Date('2026-03-01T06:00:00.000Z'),
      },
    ]);

    const result = await queryMeasurementsByMetric(
      pool,
      'user-uuid',
      'weight_kg',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'uuid-1',
      userId: 'user-uuid',
      date: '2026-03-01T00:00:00.000Z',
      metric: 'weight_kg',
      value: 72.5,
      unit: 'kg',
      source: 'cronometer',
      collectedAt: '2026-03-01T06:00:00.000Z',
    });
  });

  it('returns empty array when no rows', async () => {
    const pool = makeMockPool([]);
    const result = await queryMeasurementsByMetric(
      pool,
      'user',
      'weight_kg',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );
    expect(result).toEqual([]);
  });

  it('passes correct query parameters', async () => {
    const pool = makeMockPool([]);
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-07');
    await queryMeasurementsByMetric(pool, 'user-id', 'steps', start, end);
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['user-id', 'steps', start, end],
    );
  });

  it('converts numeric string values to numbers', async () => {
    const pool = makeMockPool([
      {
        id: 'uuid-2',
        user_id: 'user-uuid',
        measured_at: new Date('2026-03-02T00:00:00.000Z'),
        metric: 'steps',
        value: '8500',
        unit: 'count',
        source: 'apple_health',
        collected_at: new Date('2026-03-02T07:00:00.000Z'),
      },
    ]);
    const result = await queryMeasurementsByMetric(
      pool,
      'user-uuid',
      'steps',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );
    expect(result[0].value).toBe(8500);
    expect(typeof result[0].value).toBe('number');
  });
});

describe('queryDailyNutritionSummary', () => {
  it('maps pivot rows to DailyNutritionSummary', async () => {
    const pool = makeMockPool([
      {
        day: new Date('2026-03-01T00:00:00.000Z'),
        calories: '2100',
        protein: '150',
        carbs: '220',
        fat: '70',
        fiber: '25',
      },
    ]);

    const result = await queryDailyNutritionSummary(
      pool,
      'user',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2026-03-01',
      calories: 2100,
      protein: 150,
      carbs: 220,
      fat: 70,
      fiber: 25,
    });
  });

  it('returns empty array when no rows', async () => {
    const pool = makeMockPool([]);
    const result = await queryDailyNutritionSummary(
      pool,
      'user',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );
    expect(result).toEqual([]);
  });

  it('passes correct query parameters with category filter', async () => {
    const pool = makeMockPool([]);
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-07');
    await queryDailyNutritionSummary(pool, 'user-id', start, end);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("category = 'nutrition'");
    expect(call[1]).toEqual(['user-id', start, end]);
  });

  it('handles string day values (pg DATE type)', async () => {
    const pool = makeMockPool([
      {
        day: '2026-03-03',
        calories: '1800',
        protein: '120',
        carbs: '180',
        fat: '60',
        fiber: '20',
      },
    ]);
    const result = await queryDailyNutritionSummary(
      pool,
      'user',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );
    expect(result[0].date).toBe('2026-03-03');
  });
});
