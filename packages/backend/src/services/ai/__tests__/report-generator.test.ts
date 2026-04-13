import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWeeklyReport } from '../report-generator.js';
import type pg from 'pg';
import type { AIProvider } from '@vitals/shared';

vi.mock('../../../db/queries/measurements.js', () => ({
  queryDailyNutritionSummary: vi
    .fn()
    .mockResolvedValue([
      { date: '2026-03-01', calories: 2100, protein: 150, carbs: 220, fat: 70, fiber: 25 },
    ]),
  queryMeasurementsByMetrics: vi.fn().mockResolvedValue([
    {
      id: 'bio-1',
      userId: 'user-uuid',
      date: '2026-03-01T00:00:00.000Z',
      metric: 'weight_kg',
      value: 80,
      unit: 'kg',
      source: 'cronometer',
      collectedAt: '2026-03-01T06:00:00.000Z',
    },
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

vi.mock('../../../db/queries/action-items.js', () => ({
  promoteActionItems: vi.fn().mockResolvedValue(undefined),
  listActionItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../action-items/outcome-measurer.js', () => ({
  measureOutcomes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../action-items/lifecycle-manager.js', () => ({
  expireStaleItems: vi.fn().mockResolvedValue(0),
  supersedeItems: vi.fn().mockResolvedValue(0),
}));

const validAIData = {
  summary: 'A productive week.',
  biometricsOverview: '',
  nutritionAnalysis: '',
  trainingLoad: '',
  crossDomainCorrelation: '',
  whatsWorking: '',
  hazards: '',
  recommendations: '',
  scorecard: {},
  actionItems: [{ category: 'nutrition', priority: 'medium', text: 'Increase protein by 20g.' }],
};

const mockAIProvider: AIProvider = {
  name: () => 'claude',
  complete: vi.fn(),
  completeWithTools: vi.fn(),
  stream: vi.fn(),
  completeStructured: vi.fn().mockResolvedValue({
    data: validAIData,
    content: '',
    model: 'claude-sonnet-4-20250514',
    usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
  }),
};

const mockPool = {} as pg.Pool;

describe('generateWeeklyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockAIProvider.completeStructured as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: validAIData,
      content: '',
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

  it('propagates AI provider error when completeStructured fails', async () => {
    (mockAIProvider.completeStructured as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('AI service error'),
    );

    await expect(
      generateWeeklyReport(
        mockPool,
        mockAIProvider,
        'user-uuid',
        new Date('2026-03-01'),
        new Date('2026-03-07'),
      ),
    ).rejects.toThrow('AI service error');
  });

  it('parses structured sections from AI response', async () => {
    const sectionsData = {
      summary: 'Solid week with HRV concerns.',
      biometricsOverview: '## Body Composition\nWeight stable at 67 kg.',
      nutritionAnalysis: '## Daily Averages\nCalories: 2200 kcal.',
      trainingLoad: '## Sessions\n6 sessions this week.',
      crossDomainCorrelation: 'HRV drop correlates with extra leg day.',
      whatsWorking: '- Protein at 2.4 g/kg',
      hazards: '1. HRV down 17%',
      recommendations: '**Immediate:** Increase to 2350 kcal.',
      scorecard: {
        nutritionConsistency: { score: 9, notes: 'Tight adherence' },
        recovery: { score: 4, notes: 'HRV dropping' },
      },
      actionItems: [{ category: 'nutrition', priority: 'high', text: 'Add 150 kcal' }],
    };

    (mockAIProvider.completeStructured as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: sectionsData,
      content: '',
      model: 'claude-sonnet-4-20250514',
      usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    });

    const result = await generateWeeklyReport(
      mockPool,
      mockAIProvider,
      'user-uuid',
      new Date('2026-03-01'),
      new Date('2026-03-07'),
    );

    expect(result.sections).toBeDefined();
    expect(result.sections!.biometricsOverview).toContain('Weight stable');
    expect(result.sections!.scorecard.recovery.score).toBe(4);
    expect(result.summary).toBe('Solid week with HRV concerns.');
    expect(result.insights).toContain('Body Composition');
    expect(result.insights).toContain('HRV drop');
  });
});
