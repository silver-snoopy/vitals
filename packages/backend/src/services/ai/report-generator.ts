import type pg from 'pg';
import type { AIProvider, WeeklyReport, ActionItem } from '@vitals/shared';
import { queryDailyNutritionSummary, queryMeasurementsByMetric } from '../../db/queries/measurements.js';
import { queryWorkoutSessions } from '../../db/queries/workouts.js';
import { getLatestReport, saveReport, logAiGeneration } from '../../db/queries/reports.js';
import { buildReportPrompt } from './prompt-builder.js';

interface ParsedAIReport {
  summary: string;
  insights: string;
  actionItems: ActionItem[];
}

function parseAIResponse(content: string): ParsedAIReport {
  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Weekly health summary.',
      insights: typeof parsed.insights === 'string' ? parsed.insights : '',
      actionItems: Array.isArray(parsed.actionItems)
        ? (parsed.actionItems as ActionItem[])
        : [],
    };
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

export async function generateWeeklyReport(
  pool: pg.Pool,
  aiProvider: AIProvider,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<WeeklyReport> {
  // 1. Fetch all data in parallel
  const [nutrition, workouts, biometrics, previousReport] = await Promise.all([
    queryDailyNutritionSummary(pool, userId, startDate, endDate),
    queryWorkoutSessions(pool, userId, startDate, endDate),
    queryMeasurementsByMetric(pool, userId, 'weight_kg', startDate, endDate),
    getLatestReport(pool, userId),
  ]);

  // 2. Calculate data coverage
  const dataCoverage = {
    nutritionDays: nutrition.length,
    workoutDays: new Set(workouts.map((w) => w.date)).size,
    biometricDays: countDistinctDays(biometrics.map((b) => b.date)),
  };

  // 3. Build and send prompt
  const messages = buildReportPrompt({ nutrition, workouts, biometrics, previousReport });
  const result = await aiProvider.complete(messages);

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
    aiProvider: aiProvider.name(),
    aiModel: result.model,
    createdAt: new Date().toISOString(),
  };
}
