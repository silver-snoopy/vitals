import { describe, it, expect, vi } from 'vitest';
import {
  loadCollectionMetadata,
  saveCollectionMetadata,
  refreshDailyAggregates,
} from '../helpers.js';
import type pg from 'pg';

function mockPool(rows: Record<string, unknown>[] = []): pg.Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as pg.Pool;
}

const userId = '00000000-0000-0000-0000-000000000001';

describe('loadCollectionMetadata', () => {
  it('returns null when no rows found', async () => {
    const pool = mockPool([]);
    const result = await loadCollectionMetadata(pool, userId, 'hevy');
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      [userId, 'hevy'],
    );
  });

  it('returns mapped metadata when row exists', async () => {
    const now = new Date();
    const pool = mockPool([{
      user_id: userId,
      provider_name: 'hevy',
      last_successful_fetch: now,
      last_attempted_fetch: now,
      record_count: 42,
      status: 'success',
      error_message: null,
    }]);

    const result = await loadCollectionMetadata(pool, userId, 'hevy');
    expect(result).toEqual({
      userId,
      providerName: 'hevy',
      lastSuccessfulFetch: now,
      lastAttemptedFetch: now,
      recordCount: 42,
      status: 'success',
      errorMessage: null,
    });
  });
});

describe('saveCollectionMetadata', () => {
  it('executes upsert with correct params', async () => {
    const pool = mockPool();
    const meta = {
      userId,
      providerName: 'cronometer-nutrition',
      lastSuccessfulFetch: new Date('2026-03-01'),
      lastAttemptedFetch: new Date('2026-03-01'),
      recordCount: 100,
      status: 'success',
      errorMessage: null,
    };

    await saveCollectionMetadata(pool, meta);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      [
        userId,
        'cronometer-nutrition',
        meta.lastSuccessfulFetch,
        meta.lastAttemptedFetch,
        100,
        'success',
        null,
      ],
    );
  });
});

describe('refreshDailyAggregates', () => {
  it('calls REFRESH MATERIALIZED VIEW CONCURRENTLY', async () => {
    const pool = mockPool();
    await refreshDailyAggregates(pool);
    expect(pool.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_aggregates',
    );
  });
});
