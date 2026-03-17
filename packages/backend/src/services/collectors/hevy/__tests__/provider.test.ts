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
    fetchExerciseTemplates: vi.fn().mockResolvedValue({}),
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

  it('preserves lastSuccessfulFetch from previous metadata on error', async () => {
    const previousDate = new Date('2026-02-28T10:00:00.000Z');
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: userId,
              provider_name: 'hevy',
              last_successful_fetch: previousDate,
              last_attempted_fetch: new Date(),
              record_count: 5,
              status: 'success',
              error_message: null,
            },
          ],
        })
        .mockResolvedValue({ rows: [] }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rowCount: 0 }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const client = makeClient({
      fetchWorkouts: vi.fn().mockRejectedValue(new Error('API down')),
    });
    const provider = new HevyProvider(client, pool, userId);
    const result = await provider.collect(start, end);

    expect(result.errors[0]).toContain('API down');

    // The error-path metadata save should include the preserved date, not null
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    const errorSaveCall = calls.find((call) => {
      const params = call[1] as unknown[];
      return Array.isArray(params) && params.includes('error');
    });
    expect(errorSaveCall).toBeDefined();
    expect(errorSaveCall![1]).toContain(previousDate);
  });
});

describe('HevyApiClient', () => {
  it('throws when API key is missing', async () => {
    const client = new HevyApiClient('');
    await expect(client.fetchWorkouts(start, end)).rejects.toThrow('Missing HEVY_API_KEY');
  });

  it('builds correct request URL with pagination params', async () => {
    const emptyTemplates = new Response(JSON.stringify({ exercise_templates: [] }), {
      status: 200,
    });
    const emptyWorkouts = new Response(JSON.stringify({ workouts: [] }), { status: 200 });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(emptyTemplates)
      .mockResolvedValueOnce(emptyWorkouts);
    const client = new HevyApiClient('test-key', 'https://api.hevyapp.com/v1');
    await client.fetchWorkouts(new Date('2026-03-01'), new Date('2026-03-07'));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('workouts?page=1&pageSize=10'),
      expect.objectContaining({ headers: expect.objectContaining({ 'api-key': 'test-key' }) }),
    );
    fetchSpy.mockRestore();
  });

  it('paginates through all pages', async () => {
    const makeWorkout = (title: string, exercise: string) => ({
      title,
      exercises: [{ title: exercise, sets: [{ weight_kg: 100, reps: 5, set_index: 0 }] }],
    });
    // Page 1 must have exactly pageSize (10) items so partial-page check doesn't fire
    const page1 = {
      workouts: Array.from({ length: 10 }, (_, i) =>
        makeWorkout(`Day ${i + 1}`, `Exercise ${i + 1}`),
      ),
      page_count: 2,
    };
    const page2 = {
      workouts: [makeWorkout('Day 11', 'Bench')],
      page_count: 2,
    };
    const emptyTemplates = new Response(JSON.stringify({ exercise_templates: [] }), {
      status: 200,
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(emptyTemplates)
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));

    const client = new HevyApiClient('test-key', 'https://api.hevyapp.com/v1');
    const rows = await client.fetchWorkouts(new Date('2026-03-01'), new Date('2026-03-07'));

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(11);
    expect(rows[0].exercise_title).toBe('Exercise 1');
    expect(rows[10].exercise_title).toBe('Bench');
    fetchSpy.mockRestore();
  });
});
