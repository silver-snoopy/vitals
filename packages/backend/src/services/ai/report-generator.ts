import type pg from 'pg';
import type {
  AIProvider,
  WeeklyReport,
  ActionItem,
  ReportSections,
  ScorecardEntry,
} from '@vitals/shared';
import {
  queryDailyNutritionSummary,
  queryMeasurementsByMetrics,
} from '../../db/queries/measurements.js';
import { queryWorkoutSessions } from '../../db/queries/workouts.js';
import { getLatestReport, saveReport, logAiGeneration } from '../../db/queries/reports.js';
import { buildReportPrompt } from './prompt-builder.js';

const BIOMETRIC_METRICS = [
  'weight_kg',
  'body_fat_pct',
  'resting_heart_rate_bpm',
  'hrv_ms',
  'spo2_pct',
  'respiration_rate_brpm',
  'sleep_hours',
  'active_calories',
  'steps',
];

interface ParsedAIReport {
  summary: string;
  insights: string;
  actionItems: ActionItem[];
  sections?: ReportSections;
}

function isValidScorecard(obj: unknown): obj is Record<string, ScorecardEntry> {
  if (typeof obj !== 'object' || obj === null) return false;
  for (const val of Object.values(obj)) {
    if (
      typeof val !== 'object' ||
      val === null ||
      typeof (val as ScorecardEntry).score !== 'number' ||
      typeof (val as ScorecardEntry).notes !== 'string'
    )
      return false;
  }
  return true;
}

function parseAIResponse(content: string): ParsedAIReport {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Weekly health summary.';
    const actionItems = Array.isArray(parsed.actionItems)
      ? (parsed.actionItems as ActionItem[])
      : [];

    // Build sections from parsed response
    const sectionFields = [
      'biometricsOverview',
      'nutritionAnalysis',
      'trainingLoad',
      'crossDomainCorrelation',
      'whatsWorking',
      'hazards',
      'recommendations',
    ] as const;

    const hasSections = sectionFields.some((f) => typeof parsed[f] === 'string');

    let sections: ReportSections | undefined;
    if (hasSections) {
      sections = {
        biometricsOverview: String(parsed.biometricsOverview ?? ''),
        nutritionAnalysis: String(parsed.nutritionAnalysis ?? ''),
        trainingLoad: String(parsed.trainingLoad ?? ''),
        crossDomainCorrelation: String(parsed.crossDomainCorrelation ?? ''),
        whatsWorking: String(parsed.whatsWorking ?? ''),
        hazards: String(parsed.hazards ?? ''),
        recommendations: String(parsed.recommendations ?? ''),
        scorecard: isValidScorecard(parsed.scorecard) ? parsed.scorecard : {},
      };
    }

    // Build insights as concatenated markdown for backward compat
    const insights = sections
      ? [
          sections.biometricsOverview && `## Biometrics Overview\n${sections.biometricsOverview}`,
          sections.nutritionAnalysis && `## Nutrition Analysis\n${sections.nutritionAnalysis}`,
          sections.trainingLoad && `## Training Load\n${sections.trainingLoad}`,
          sections.crossDomainCorrelation &&
            `## Cross-Domain Correlation\n${sections.crossDomainCorrelation}`,
          sections.whatsWorking && `## What's Working\n${sections.whatsWorking}`,
          sections.hazards && `## Hazards & Red Flags\n${sections.hazards}`,
          sections.recommendations && `## Recommendations\n${sections.recommendations}`,
        ]
          .filter(Boolean)
          .join('\n\n')
      : typeof parsed.insights === 'string'
        ? parsed.insights
        : '';

    return { summary, insights, actionItems, sections };
  } catch {
    return {
      summary: 'AI-generated weekly summary.',
      insights: content,
      actionItems: [],
    };
  }
}

function countDistinctDays(dates: string[]): number {
  return new Set(dates.map((d) => d.split('T')[0])).size;
}

async function completeWithRetry(
  aiProvider: AIProvider,
  messages: Parameters<AIProvider['complete']>[0],
  maxRetries = 3,
): ReturnType<AIProvider['complete']> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await aiProvider.complete(messages);
    } catch (err: unknown) {
      const isRateLimit =
        (err instanceof Error && /429|rate.limit|too many requests/i.test(err.message)) ||
        (typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          (err as { status: number }).status === 429);

      if (!isRateLimit || attempt === maxRetries) throw err;

      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

export async function generateWeeklyReport(
  pool: pg.Pool,
  aiProvider: AIProvider,
  userId: string,
  startDate: Date,
  endDate: Date,
  userNotes?: string,
  workoutPlan?: string,
): Promise<WeeklyReport> {
  // Compute previous week date range
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);

  // 1. Fetch all data in parallel (current + previous week)
  const [
    nutrition,
    workouts,
    biometrics,
    previousWeekNutrition,
    previousWeekWorkouts,
    previousWeekBiometrics,
    previousReport,
  ] = await Promise.all([
    queryDailyNutritionSummary(pool, userId, startDate, endDate),
    queryWorkoutSessions(pool, userId, startDate, endDate),
    queryMeasurementsByMetrics(pool, userId, BIOMETRIC_METRICS, startDate, endDate),
    queryDailyNutritionSummary(pool, userId, prevStart, prevEnd),
    queryWorkoutSessions(pool, userId, prevStart, prevEnd),
    queryMeasurementsByMetrics(pool, userId, BIOMETRIC_METRICS, prevStart, prevEnd),
    getLatestReport(pool, userId),
  ]);

  // 2. Calculate data coverage
  const dataCoverage = {
    nutritionDays: nutrition.length,
    workoutDays: new Set(workouts.map((w) => w.date)).size,
    biometricDays: countDistinctDays(biometrics.map((b) => b.date)),
  };

  // 3. Build and send prompt
  const messages = buildReportPrompt({
    nutrition,
    workouts,
    biometrics,
    previousReport,
    previousWeekNutrition,
    previousWeekWorkouts,
    previousWeekBiometrics,
    userNotes,
    workoutPlan,
  });
  const result = await completeWithRetry(aiProvider, messages);

  // 4. Parse response
  const parsed = parseAIResponse(result.content);

  // 5. Save report and log usage
  const periodStart = startDate.toISOString().split('T')[0];
  const periodEnd = endDate.toISOString().split('T')[0];

  const reportId = await saveReport(pool, {
    userId,
    periodStart,
    periodEnd,
    summary: parsed.summary,
    insights: parsed.insights,
    actionItems: parsed.actionItems,
    dataCoverage,
    sections: parsed.sections,
    aiProvider: aiProvider.name(),
    aiModel: result.model,
  });

  await logAiGeneration(pool, {
    userId,
    provider: aiProvider.name(),
    model: result.model,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    totalTokens: result.usage.totalTokens,
    purpose: 'weekly_report',
  });

  return {
    id: reportId,
    userId,
    periodStart,
    periodEnd,
    summary: parsed.summary,
    insights: parsed.insights,
    actionItems: parsed.actionItems,
    dataCoverage,
    sections: parsed.sections,
    aiProvider: aiProvider.name(),
    aiModel: result.model,
    createdAt: new Date().toISOString(),
  };
}
