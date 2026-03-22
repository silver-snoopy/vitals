import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '../tool-executor.js';
import type pg from 'pg';

vi.mock('../../../../db/queries/measurements.js', () => ({
  queryDailyNutritionSummary: vi.fn().mockResolvedValue([
    { date: '2026-03-01', calories: 2100, protein: 150, carbs: 220, fat: 70 },
  ]),
  queryMeasurementsByMetrics: vi.fn().mockResolvedValue([
    { date: '2026-03-01', metric: 'body_weight_kg', value: 82.5, unit: 'kg' },
  ]),
}));

vi.mock('../../../../db/queries/workouts.js', () => ({
  queryWorkoutSessions: vi.fn().mockResolvedValue([]),
  queryExerciseProgress: vi.fn().mockResolvedValue({ sets: [] }),
}));

vi.mock('../../../../db/queries/reports.js', () => ({
  getLatestReport: vi.fn().mockResolvedValue(null),
}));

const mockDb = {
  query: vi.fn().mockResolvedValue({ rows: [{ metric: 'body_weight_kg' }] }),
} as unknown as pg.Pool;

describe('executeTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('query_nutrition returns JSON string', async () => {
    const result = await executeTool(
      'query_nutrition',
      { startDate: '2026-03-01', endDate: '2026-03-07' },
      mockDb,
      'default',
    );
    const parsed = JSON.parse(result) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toMatchObject({ calories: 2100 });
  });

  it('query_biometrics passes metrics array', async () => {
    const result = await executeTool(
      'query_biometrics',
      { metrics: ['body_weight_kg'], startDate: '2026-03-01', endDate: '2026-03-07' },
      mockDb,
      'default',
    );
    const parsed = JSON.parse(result) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('list_available_metrics queries DB and returns metrics array', async () => {
    const result = await executeTool('list_available_metrics', {}, mockDb, 'default');
    const parsed = JSON.parse(result) as { metrics: string[] };
    expect(parsed.metrics).toContain('body_weight_kg');
  });

  it('get_latest_report returns no-report message when null', async () => {
    const result = await executeTool('get_latest_report', {}, mockDb, 'default');
    const parsed = JSON.parse(result) as { message: string };
    expect(parsed.message).toMatch(/no reports/i);
  });

  it('unknown tool returns error JSON without throwing', async () => {
    const result = await executeTool('nonexistent_tool', {}, mockDb, 'default');
    const parsed = JSON.parse(result) as { error: string };
    expect(parsed.error).toMatch(/unknown tool/i);
  });

  it('query_workouts returns JSON string', async () => {
    const result = await executeTool(
      'query_workouts',
      { startDate: '2026-03-01', endDate: '2026-03-07' },
      mockDb,
      'default',
    );
    const parsed = JSON.parse(result) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('query_exercise_progress with optional dates omitted', async () => {
    const result = await executeTool(
      'query_exercise_progress',
      { exerciseName: 'Squat' },
      mockDb,
      'default',
    );
    const parsed = JSON.parse(result) as { sets: unknown[] };
    expect(parsed.sets).toBeDefined();
  });

  it('query_exercise_progress with explicit date range', async () => {
    const result = await executeTool(
      'query_exercise_progress',
      { exerciseName: 'Bench Press', startDate: '2026-03-01', endDate: '2026-03-07' },
      mockDb,
      'default',
    );
    const parsed = JSON.parse(result) as { sets: unknown[] };
    expect(parsed.sets).toBeDefined();
  });

  it('invalid date returns error JSON without throwing', async () => {
    const result = await executeTool(
      'query_nutrition',
      { startDate: 'not-a-date', endDate: '2026-03-07' },
      mockDb,
      'default',
    );
    const parsed = JSON.parse(result) as { error: string };
    expect(parsed.error).toBeDefined();
  });
});
