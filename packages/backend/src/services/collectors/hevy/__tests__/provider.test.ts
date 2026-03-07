import { describe, it, expect, vi } from 'vitest';
import { HevyProvider } from '../provider.js';
import { HevyApiClient } from '../client.js';
import type { HevyClient } from '../client.js';
import type pg from 'pg';

const userId = '00000000-0000-0000-0000-000000000001';
const start = new Date('2026-03-01');
const end = new Date('2026-03-07');

const flattenedRows = [
  {
    title: 'Push Day',
    start_time: '01 Mar 2026, 10:00',
    end_time: '01 Mar 2026, 11:00',
    exercise_title: 'Bench Press',
    set_index: 0,
    weight_kg: 80,
    reps: 8,
    duration_seconds: null,
    distance_meters: null,
    rpe: 7,
  },
  {
    title: 'Push Day',
    start_time: '01 Mar 2026, 10:00',
    end_time: '01 Mar 2026, 11:00',
    exercise_title: 'Bench Press',
    set_index: 1,
    weight_kg: 80,
    reps: 7,
    duration_seconds: null,
    distance_meters: null,
    rpe: 8,
  },
];

function makeClient(overrides: Partial<HevyClient> = {}): HevyClient {
  return {
    fetchWorkouts: vi.fn().mockResolvedValue(flattenedRows),
    ...overrides,
  };
}

function makePool(): pg.Pool {
  const client = {
    query: vi.fn().mockResolvedValue({ rowCount: 2 }),
    release: vi.fn(),
  };
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as pg.Pool;
}

describe('HevyProvider', () => {
  it('fetches, normalizes, and ingests workout sets', async () => {
    const client = makeClient();
    const pool = makePool();
    const provider = new HevyProvider(client, pool, userId);

    const result = await provider.collect(start, end);

    expect(client.fetchWorkouts).toHaveBeenCalledWith(start, end);
    expect(result.provider).toBe('hevy');
    expect(result.dateRange).toEqual({ start, end });
    expect(result.errors).toHaveLength(0);
  });

  it('captures errors when client throws', async () => {
    const client = makeClient({
      fetchWorkouts: vi.fn().mockRejectedValue(new Error('API unavailable')),
    });
    const pool = makePool();
    const provider = new HevyProvider(client, pool, userId);

    const result = await provider.collect(start, end);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('API unavailable');
    expect(result.recordCount).toBe(0);
  });

  it('saves collection metadata on success', async () => {
    const client = makeClient();
    const pool = makePool();
    const provider = new HevyProvider(client, pool, userId);

    await provider.collect(start, end);
    expect(pool.query).toHaveBeenCalled();
  });
});

describe('HevyApiClient', () => {
  it('throws when API key is missing', async () => {
    const client = new HevyApiClient('');
    await expect(client.fetchWorkouts(start, end)).rejects.toThrow('Missing HEVY_API_KEY');
  });

  it('builds correct request URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ workouts: [] }), { status: 200 }),
    );
    const client = new HevyApiClient('test-key', 'https://api.hevyapp.com/v1');
    await client.fetchWorkouts(new Date('2026-03-01'), new Date('2026-03-07'));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('workouts?from=2026-03-01&to=2026-03-07'),
      expect.objectContaining({ headers: expect.objectContaining({ 'api-key': 'test-key' }) }),
    );
    fetchSpy.mockRestore();
  });
});
