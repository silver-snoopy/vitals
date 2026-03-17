import { describe, it, expect, vi } from 'vitest';
import { queryWorkoutSessions, queryExerciseProgress } from '../workouts.js';
import type pg from 'pg';

function makeMockPool(rows: unknown[]): pg.Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as pg.Pool;
}

const baseRow = {
  id: 'set-uuid-1',
  user_id: 'user-uuid',
  source: 'hevy',
  title: 'Upper',
  exercise_name: 'Bench Press',
  exercise_type: 'weight_reps',
  set_index: 0,
  set_type: 'normal',
  weight_kg: '80',
  reps: '8',
  volume_kg: '640',
  duration_seconds: null,
  distance_meters: null,
  rpe: '7',
  started_at: new Date('2026-03-01T10:00:00.000Z'),
  ended_at: new Date('2026-03-01T10:45:00.000Z'),
  collected_at: new Date('2026-03-01T12:00:00.000Z'),
};

describe('queryWorkoutSessions', () => {
  it('groups sets into sessions by date and source', async () => {
    const pool = makeMockPool([
      { ...baseRow, id: 'set-1', set_index: 0 },
      { ...baseRow, id: 'set-2', set_index: 1 },
    ]);

    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result).toHaveLength(1);
    expect(result[0].sets).toHaveLength(2);
    expect(result[0].source).toBe('hevy');
    expect(result[0].date).toBe('2026-03-01');
  });

  it('creates separate sessions for different sources on same day', async () => {
    const pool = makeMockPool([
      { ...baseRow, id: 'set-1', source: 'hevy' },
      { ...baseRow, id: 'set-2', source: 'apple_health' },
    ]);

    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result).toHaveLength(2);
    const sources = result.map((s) => s.source).sort();
    expect(sources).toEqual(['apple_health', 'hevy']);
  });

  it('creates separate sessions for different dates', async () => {
    const pool = makeMockPool([
      {
        ...baseRow,
        id: 'set-1',
        started_at: new Date('2026-03-01T10:00:00Z'),
        ended_at: new Date('2026-03-01T11:00:00Z'),
      },
      {
        ...baseRow,
        id: 'set-2',
        started_at: new Date('2026-03-03T10:00:00Z'),
        ended_at: new Date('2026-03-03T11:00:00Z'),
      },
    ]);

    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-03-01');
    expect(result[1].date).toBe('2026-03-03');
  });

  it('calculates duration from earliest start to latest end', async () => {
    const pool = makeMockPool([
      {
        ...baseRow,
        id: 'set-1',
        started_at: new Date('2026-03-01T10:00:00.000Z'),
        ended_at: new Date('2026-03-01T10:20:00.000Z'),
      },
      {
        ...baseRow,
        id: 'set-2',
        started_at: new Date('2026-03-01T10:05:00.000Z'),
        ended_at: new Date('2026-03-01T10:45:00.000Z'),
      },
    ]);

    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    // 10:00 → 10:45 = 2700 seconds
    expect(result[0].durationSeconds).toBe(2700);
  });

  it('maps set fields to WorkoutSet correctly', async () => {
    const pool = makeMockPool([baseRow]);
    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    const set = result[0].sets[0];
    expect(set.id).toBe('set-uuid-1');
    expect(set.exerciseName).toBe('Bench Press');
    expect(set.weightKg).toBe(80);
    expect(set.reps).toBe(8);
    expect(set.rpe).toBe(7);
    expect(set.durationSeconds).toBeNull();
    expect(set.distanceMeters).toBeNull();
  });

  it('returns empty array when no rows', async () => {
    const pool = makeMockPool([]);
    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );
    expect(result).toEqual([]);
  });

  it('uses stored title when available', async () => {
    const pool = makeMockPool([{ ...baseRow, source: 'hevy', title: 'Upper' }]);
    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );
    expect(result[0].title).toBe('Upper');
  });

  it('falls back to source-based title when no stored title', async () => {
    const pool = makeMockPool([{ ...baseRow, source: 'hevy', title: null }]);
    const result = await queryWorkoutSessions(
      pool,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );
    expect(result[0].title).toBe('Hevy Workout');
  });
});

describe('queryExerciseProgress', () => {
  it('returns exercise progress with data points', async () => {
    const pool = makeMockPool([
      {
        day: new Date('2026-03-01'),
        max_weight: '100',
        total_volume: '2400',
        total_sets: '3',
      },
      {
        day: new Date('2026-03-03'),
        max_weight: '102.5',
        total_volume: '2460',
        total_sets: '3',
      },
    ]);

    const result = await queryExerciseProgress(pool, 'user-uuid', 'Bench Press');

    expect(result.exerciseName).toBe('Bench Press');
    expect(result.dataPoints).toHaveLength(2);
    expect(result.dataPoints[0]).toEqual({
      date: '2026-03-01',
      maxWeight: 100,
      totalVolume: 2400,
      totalSets: 3,
    });
    expect(result.dataPoints[1].maxWeight).toBe(102.5);
  });

  it('returns empty data points when no rows', async () => {
    const pool = makeMockPool([]);
    const result = await queryExerciseProgress(pool, 'user-uuid', 'Deadlift');
    expect(result.exerciseName).toBe('Deadlift');
    expect(result.dataPoints).toEqual([]);
  });

  it('handles null max_weight and total_volume', async () => {
    const pool = makeMockPool([
      {
        day: '2026-03-01',
        max_weight: null,
        total_volume: null,
        total_sets: '5',
      },
    ]);
    const result = await queryExerciseProgress(pool, 'user-uuid', 'Pull-ups');
    expect(result.dataPoints[0].maxWeight).toBe(0);
    expect(result.dataPoints[0].totalVolume).toBe(0);
  });
});
