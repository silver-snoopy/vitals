import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWeeklyReport } from '../report-generator.js';
import type pg from 'pg';
import type { AIProvider, AICompletionResult } from '@vitals/shared';

vi.mock('../../../db/queries/measurements.js', () => ({
  queryDailyNutritionSummary: vi.fn().mockResolvedValue([
    { date: '2026-03-01', calories: 2100, protein: 150, carbs: 220, fat: 70, fiber: 25 },
  ]),
  queryMeasurementsByMetric: vi.fn().mockResolvedValue([
    { id: 'bio-1', userId: 'user-uuid', date: '2026-03-01T00:00:00.000Z', metric: 'weight_kg', value: 80, unit: 'kg', source: 'cronometer', collectedAt: '2026-03-01T06:00:00.000Z' },
  ]),
}));

vi.mock('../../../db/queries/workouts.js', () => ({
  queryWorkoutSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../db/queries/reports.js', () => ({
  getLatestReport: vi.fn().mockResolvedValue(null),
  saveReport: vi.fn().mockResolvedValue('new-report-uuid'),
  logAiGeneration: vi.fn().mockResolvedValue(undefined),
}));

const validAIResponse = JSON.stringify({
  summary: 'A productive week.',
  insights: '- Calories on target\n- Protein slightly low',
  actionItems: [
    { category: 'nutrition', priority: 'medium', text: 'Increase protein by 20g.' },
  ],
});

const mockAIProvider: AIProvider = {
  name: () => 'claude',
  complete: vi.fn().mockResolvedValue({
    content: validAIResponse,
    model: 'claude-sonnet-4-20250514',
    usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
  } satisfies AICompletionResult),
};

const mockPool = {} as pg.Pool;

describe('generateWeeklyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockAIProvider.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: validAIResponse,
      model: 'claude-sonnet-4-20250514',
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    });
  });

  it('returns a WeeklyReport with correct structure', async () => {
    const result = await generateWeeklyReport(
      mockPool,
      mockAIProvider,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result.id).toBe('new-report-uuid');
    expect(result.userId).toBe('user-uuid');
    expect(result.summary).toBe('A productive week.');
    expect(result.actionItems).toHaveLength(1);
    expect(result.aiProvider).toBe('claude');
    expect(result.aiModel).toBe('claude-sonnet-4-20250514');
  });

  it('sets period start and end from date params', async () => {
    const result = await generateWeeklyReport(
      mockPool,
      mockAIProvider,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result.periodStart).toBe('2026-03-01');
    expect(result.periodEnd).toBe('2026-03-07');
  });

  it('calculates data coverage', async () => {
    const result = await generateWeeklyReport(
      mockPool,
      mockAIProvider,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result.dataCoverage.nutritionDays).toBe(1);
    expect(result.dataCoverage.workoutDays).toBe(0);
    expect(result.dataCoverage.biometricDays).toBe(1);
  });

  it('calls saveReport and logAiGeneration', async () => {
    const { saveReport, logAiGeneration } = await import('../../../db/queries/reports.js');

    await generateWeeklyReport(
      mockPool,
      mockAIProvider,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(saveReport).toHaveBeenCalledOnce();
    expect(logAiGeneration).toHaveBeenCalledOnce();
  });

  it('handles malformed AI JSON with fallback', async () => {
    (mockAIProvider.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: 'This is not JSON at all.',
      model: 'claude-sonnet-4-20250514',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const result = await generateWeeklyReport(
      mockPool,
      mockAIProvider,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result.summary).toBeTruthy();
    expect(result.actionItems).toEqual([]);
  });

  it('strips markdown code fences from AI response', async () => {
    (mockAIProvider.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: '```json\n' + validAIResponse + '\n```',
      model: 'claude-sonnet-4-20250514',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const result = await generateWeeklyReport(
      mockPool,
      mockAIProvider,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result.summary).toBe('A productive week.');
  });
});
