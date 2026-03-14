import type pg from 'pg';
import type { AIProvider, WeeklyReport, ActionItem } from '@vitals/shared';
import {
  queryDailyNutritionSummary,
  queryMeasurementsByMetric,
} from '../../db/queries/measurements.js';
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
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Weekly health summary.',
      insights: typeof parsed.insights === 'string' ? parsed.insights : '',
      actionItems: Array.isArray(parsed.actionItems) ? (parsed.actionItems as ActionItem[]) : [],
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
