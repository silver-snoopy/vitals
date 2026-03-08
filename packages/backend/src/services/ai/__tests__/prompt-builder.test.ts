import { describe, it, expect } from 'vitest';
import { buildReportPrompt } from '../prompt-builder.js';
import type {
  WeeklyDataBundle,
  WeeklyReport,
  DailyNutritionSummary,
  WorkoutSession,
  BiometricReading,
} from '@vitals/shared';

const emptyBundle: WeeklyDataBundle = {
  nutrition: [],
  workouts: [],
  biometrics: [],
  previousReport: null,
};

const nutritionDay: DailyNutritionSummary = {
  date: '2026-03-01',
  calories: 2200,
  protein: 155,
  carbs: 230,
  fat: 72,
  fiber: 28,
};

const workoutSession: WorkoutSession = {
  id: 'session-1',
  userId: 'user-1',
  date: '2026-03-01',
  title: 'Hevy Workout',
  durationSeconds: 3600,
  sets: [
    {
      id: 'set-1',
      sessionId: 'session-1',
      exerciseName: 'Bench Press',
      setIndex: 0,
      weightKg: 100,
      reps: 5,
      durationSeconds: null,
      distanceMeters: null,
      rpe: 8,
    },
  ],
  source: 'hevy',
  collectedAt: '2026-03-01T12:00:00.000Z',
};

const biometricReading: BiometricReading = {
  id: 'bio-1',
  userId: 'user-1',
  date: '2026-03-01T08:00:00.000Z',
  metric: 'weight_kg',
  value: 80.5,
  unit: 'kg',
  source: 'cronometer',
  collectedAt: '2026-03-01T06:00:00.000Z',
};

describe('buildReportPrompt', () => {
  it('returns exactly two messages: system and user', () => {
    const messages = buildReportPrompt(emptyBundle);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('system message instructs JSON output format', () => {
    const messages = buildReportPrompt(emptyBundle);
    const system = messages[0].content;
    expect(system).toContain('JSON');
    expect(system).toContain('summary');
    expect(system).toContain('insights');
    expect(system).toContain('actionItems');
  });

  it('user message includes nutrition data', () => {
    const messages = buildReportPrompt({ ...emptyBundle, nutrition: [nutritionDay] });
    const user = messages[1].content;
    expect(user).toContain('2200');
    expect(user).toContain('155');
  });

  it('user message includes workout data', () => {
    const messages = buildReportPrompt({ ...emptyBundle, workouts: [workoutSession] });
    const user = messages[1].content;
    expect(user).toContain('1 sessions');
    expect(user).toContain('sets');
  });

  it('user message includes biometric data', () => {
    const messages = buildReportPrompt({ ...emptyBundle, biometrics: [biometricReading] });
    const user = messages[1].content;
    expect(user).toContain('weight_kg');
    expect(user).toContain('80.5');
  });

  it('user message includes previous report context when available', () => {
    const previousReport: WeeklyReport = {
      id: 'report-1',
      userId: 'user-1',
      periodStart: '2026-02-23',
      periodEnd: '2026-03-01',
      summary: 'Strong week overall.',
      insights: '- Good progress',
      actionItems: [],
      dataCoverage: { nutritionDays: 7, workoutDays: 4, biometricDays: 7 },
      aiProvider: 'claude' as const,
      aiModel: 'claude-sonnet-4-20250514',
      createdAt: '2026-03-01T08:00:00.000Z',
    };
    const messages = buildReportPrompt({ ...emptyBundle, previousReport });
    const user = messages[1].content;
    expect(user).toContain('Strong week overall.');
  });

  it('user message notes when no previous report', () => {
    const messages = buildReportPrompt(emptyBundle);
    const user = messages[1].content;
    expect(user).toContain('No previous report');
  });

  it('user message notes when no nutrition data', () => {
    const messages = buildReportPrompt(emptyBundle);
    const user = messages[1].content;
    expect(user).toContain('No nutrition data');
  });
});
