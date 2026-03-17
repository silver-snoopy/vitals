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
  previousWeekNutrition: [],
  previousWeekWorkouts: [],
  previousWeekBiometrics: [],
};

const nutritionDay: DailyNutritionSummary = {
  date: '2026-03-01',
  calories: 2200,
  protein: 155,
  carbs: 230,
  fat: 72,
  fiber: 28,
  sodium: 2100,
  sugar: 45,
};

const workoutSession: WorkoutSession = {
  id: 'session-1',
  userId: 'user-1',
  date: '2026-03-01',
  title: 'Upper Body',
  durationSeconds: 3600,
  sets: [
    {
      id: 'set-1',
      sessionId: 'session-1',
      exerciseName: 'Bench Press',
      exerciseType: 'weight_reps',
      setIndex: 0,
      setType: 'normal',
      weightKg: 100,
      reps: 5,
      volumeKg: 500,
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

  it('system message contains persona, protocol, and output format', () => {
    const messages = buildReportPrompt(emptyBundle);
    const system = messages[0].content;
    expect(system).toContain('sports-science');
    expect(system).toContain('Analysis Protocol');
    expect(system).toContain('Output Format');
    expect(system).toContain('JSON');
    expect(system).toContain('actionItems');
  });

  it('user message includes daily nutrition data with values', () => {
    const messages = buildReportPrompt({ ...emptyBundle, nutrition: [nutritionDay] });
    const user = messages[1].content;
    expect(user).toContain('2200');
    expect(user).toContain('155');
    expect(user).toContain('2100');
    expect(user).toContain('2026-03-01');
  });

  it('user message includes workout exercise detail', () => {
    const messages = buildReportPrompt({ ...emptyBundle, workouts: [workoutSession] });
    const user = messages[1].content;
    expect(user).toContain('Upper Body');
    expect(user).toContain('Bench Press');
    expect(user).toContain('100kg');
    expect(user).toContain('×5');
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
      aiProvider: 'claude',
      aiModel: 'claude-sonnet-4-20250514',
      createdAt: '2026-03-01T08:00:00.000Z',
    };
    const messages = buildReportPrompt({ ...emptyBundle, previousReport });
    const user = messages[1].content;
    expect(user).toContain('PREVIOUS REPORT');
    expect(user).toContain('Strong week overall.');
  });

  it('user message includes user notes when provided', () => {
    const messages = buildReportPrompt({
      ...emptyBundle,
      userNotes: 'Felt tired all week, minimal sweating during workouts.',
    });
    const user = messages[1].content;
    expect(user).toContain('USER NOTES');
    expect(user).toContain('minimal sweating');
  });

  it('user message includes workout plan when provided', () => {
    const messages = buildReportPrompt({
      ...emptyBundle,
      workoutPlan: 'Upper/Lower split, 4 days per week, 2 RIR target.',
    });
    const user = messages[1].content;
    expect(user).toContain('WORKOUT PLAN');
    expect(user).toContain('Upper/Lower split');
  });

  it('handles empty data gracefully', () => {
    const messages = buildReportPrompt(emptyBundle);
    const user = messages[1].content;
    expect(user).toContain('No nutrition data');
    expect(user).toContain('No biometric data');
    expect(user).toContain('No workout data');
  });

  it('includes previous week comparison data', () => {
    const prevNutrition: DailyNutritionSummary = {
      date: '2026-02-22',
      calories: 2000,
      protein: 140,
      carbs: 210,
      fat: 65,
      fiber: 24,
    };
    const messages = buildReportPrompt({
      ...emptyBundle,
      nutrition: [nutritionDay],
      previousWeekNutrition: [prevNutrition],
    });
    const user = messages[1].content;
    expect(user).toContain('Prev Week Avg');
  });
});
