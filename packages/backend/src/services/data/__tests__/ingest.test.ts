import { describe, it, expect, vi } from 'vitest';
import { ingestMeasurements, ingestWorkoutSets } from '../ingest.js';
import type { MeasurementRow, WorkoutSetRow } from '../normalizers.js';
import type pg from 'pg';

const userId = '00000000-0000-0000-0000-000000000001';

function makeMeasurementRow(overrides: Partial<MeasurementRow> = {}): MeasurementRow {
  return {
    userId,
    source: 'cronometer',
    category: 'nutrition',
    metric: 'calories',
    value: 2000,
    unit: 'kcal',
    measuredAt: new Date('2026-03-01'),
    tags: {},
    ...overrides,
  };
}

function makeWorkoutSetRow(overrides: Partial<WorkoutSetRow> = {}): WorkoutSetRow {
  return {
    userId,
    source: 'hevy',
    title: null,
    exerciseName: 'Squat',
    exerciseType: null,
    setIndex: 0,
    setType: 'normal',
    weightKg: 100,
    reps: 5,
    volumeKg: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: 8,
    startedAt: new Date('2026-03-01T10:00:00Z'),
    endedAt: new Date('2026-03-01T10:01:00Z'),
    tags: {},
    ...overrides,
  };
}

function makePool(rowCount = 1): pg.Pool {
  const client = {
    query: vi.fn().mockResolvedValue({ rowCount }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as pg.Pool;
}

describe('ingestMeasurements', () => {
  it('returns zero inserted for empty rows', async () => {
    const pool = makePool();
    const result = await ingestMeasurements(pool, []);
    expect(result).toEqual({ inserted: 0, errors: [] });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('inserts a single batch and returns row count', async () => {
    const pool = makePool(3);
    const rows = [
      makeMeasurementRow({ metric: 'calories' }),
      makeMeasurementRow({ metric: 'protein' }),
      makeMeasurementRow({ metric: 'fat' }),
    ];
    const result = await ingestMeasurements(pool, rows);
    expect(result.inserted).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('passes correct number of parameters for batch', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const client = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('INSERT')) {
          capturedSql = sql;
          capturedParams = params ?? [];
        }
        return Promise.resolve({ rowCount: 1 });
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as pg.Pool;

    await ingestMeasurements(pool, [makeMeasurementRow()]);
    // 1 row × 9 columns = 9 params
    expect(capturedParams).toHaveLength(9);
    expect(capturedSql).toContain('ON CONFLICT');
    expect(capturedSql).toContain('DO UPDATE SET');
  });

  it('chunks rows into batches of 500', async () => {
    let batchCount = 0;
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('INSERT')) batchCount++;
        return Promise.resolve({ rowCount: 1 });
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as pg.Pool;

    const rows = Array.from({ length: 1050 }, (_, i) =>
      makeMeasurementRow({
        measuredAt: new Date(`2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`),
        metric: `m${i}`,
      }),
    );
    await ingestMeasurements(pool, rows);
    // 1050 rows → 3 batches (500, 500, 50)
    expect(batchCount).toBe(3);
  });

  it('collects errors from failed batches and continues', async () => {
    let call = 0;
    const client = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('INSERT')) {
          call++;
          if (call === 1) throw new Error('DB error on batch 1');
        }
        return Promise.resolve({ rowCount: 1 });
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as pg.Pool;

    const rows = Array.from({ length: 600 }, (_, i) => makeMeasurementRow({ metric: `m${i}` }));
    const result = await ingestMeasurements(pool, rows);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('DB error on batch 1');
  });
});

describe('ingestWorkoutSets', () => {
  it('returns zero inserted for empty rows', async () => {
    const pool = makePool();
    const result = await ingestWorkoutSets(pool, []);
    expect(result).toEqual({ inserted: 0, errors: [] });
  });

  it('inserts workout sets with correct parameter count', async () => {
    let capturedParams: unknown[] = [];
    const client = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('INSERT')) {
          capturedParams = params ?? [];
        }
        return Promise.resolve({ rowCount: 1 });
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as pg.Pool;

    await ingestWorkoutSets(pool, [makeWorkoutSetRow()]);
    // 1 row × 14 columns = 14 params (includes set_type and tags)
    expect(capturedParams).toHaveLength(17);
  });
});
