import type pg from 'pg';
import type {
  AIProvider,
  WeeklyReport,
  ActionItem,
  ActionItemFollowUp,
  ReportSections,
  ScorecardEntry,
} from '@vitals/shared';
import {
  queryDailyNutritionSummary,
  queryMeasurementsByMetrics,
} from '../../db/queries/measurements.js';
import { queryWorkoutSessions } from '../../db/queries/workouts.js';
import { getLatestReport, saveReport, logAiGeneration } from '../../db/queries/reports.js';
import { promoteActionItems, listActionItems } from '../../db/queries/action-items.js';
import { buildReportPrompt } from './prompt-builder.js';
import { measureOutcomes, determineOutcome } from '../action-items/outcome-measurer.js';
import { expireStaleItems, supersedeItems } from '../action-items/lifecycle-manager.js';

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

/**
 * Extract the first complete JSON object from a string using brace-matching.
 * Handles cases where AI responses contain multiple concatenated JSON objects
 * or trailing text after the JSON.
 */
function extractFirstJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.substring(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseAIResponse(content: string): ParsedAIReport {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // Try direct parse first, fall back to brace-matching extraction
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const extracted = extractFirstJson(cleaned);
      if (!extracted) throw new Error('No valid JSON found');
      parsed = extracted;
    }

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

export interface GatherAndGenerateResult {
  summary: string;
  insights: string;
  actionItems: ActionItem[];
  dataCoverage: WeeklyReport['dataCoverage'];
  sections?: ReportSections;
  providerName: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * Gathers data and calls the AI provider to generate report content.
 * Does NOT write to the database — caller is responsible for persistence.
 */
/**
 * Build action item follow-up context by running lifecycle management
 * and outcome measurement before generating a new report.
 */
async function buildActionItemFollowUp(
  pool: pg.Pool,
  userId: string,
): Promise<ActionItemFollowUp | undefined> {
  // 1. Expire stale items
  await expireStaleItems(pool, userId);

  // 2. Measure outcomes for completed items without measurements
  const completedItems = await listActionItems(pool, userId, {
    status: 'completed',
    limit: 50,
  });
  const unmeasured = completedItems.filter((i) => !i.outcomeMeasuredAt && i.targetMetric);
  if (unmeasured.length > 0) {
    await measureOutcomes(pool, userId, unmeasured);
  }

  // 3. Refresh completed items to get outcome data
  const refreshedCompleted = await listActionItems(pool, userId, {
    status: 'completed',
    limit: 50,
  });

  // 4. Gather deferred and expired items
  const [deferredItems, expiredItems, allItems] = await Promise.all([
    listActionItems(pool, userId, { status: 'deferred', limit: 20 }),
    listActionItems(pool, userId, { status: 'expired', limit: 20 }),
    listActionItems(pool, userId, { limit: 200 }),
  ]);

  const totalActionable =
    refreshedCompleted.length +
    deferredItems.length +
    expiredItems.length +
    allItems.filter((i) => i.status === 'active' || i.status === 'pending').length;

  if (totalActionable === 0) return undefined;

  const completionRate = totalActionable > 0 ? refreshedCompleted.length / totalActionable : 0;

  return {
    completed: refreshedCompleted.map((i) => ({
      text: i.text,
      category: i.category,
      targetMetric: i.targetMetric,
      outcome:
        i.outcomeValue != null && i.baselineValue != null && i.targetDirection
          ? determineOutcome(i.baselineValue, i.outcomeValue, i.targetDirection)
          : undefined,
      outcomeConfidence: i.outcomeConfidence,
    })),
    deferred: deferredItems.map((i) => ({
      text: i.text,
      category: i.category,
    })),
    expired: expiredItems.map((i) => ({
      text: i.text,
      category: i.category,
    })),
    completionRate,
  };
}

export async function gatherAndGenerate(
  pool: pg.Pool,
  aiProvider: AIProvider,
  userId: string,
  startDate: Date,
  endDate: Date,
  userNotes?: string,
  workoutPlan?: string,
): Promise<GatherAndGenerateResult> {
  // Compute previous week date range
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);

  // 0. Run action item lifecycle management before generating
  const actionItemFollowUp = await buildActionItemFollowUp(pool, userId);

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
    actionItemFollowUp,
  });
  const result = await completeWithRetry(aiProvider, messages);

  // 4. Parse response
  const parsed = parseAIResponse(result.content);

  return {
    summary: parsed.summary,
    insights: parsed.insights,
    actionItems: parsed.actionItems,
    dataCoverage,
    sections: parsed.sections,
    providerName: aiProvider.name(),
    model: result.model,
    usage: result.usage,
  };
}

/**
 * Convenience wrapper: gathers data, generates report, saves to DB, and logs usage.
 * Used by the synchronous (?sync=true) code path.
 */
export async function generateWeeklyReport(
  pool: pg.Pool,
  aiProvider: AIProvider,
  userId: string,
  startDate: Date,
  endDate: Date,
  userNotes?: string,
  workoutPlan?: string,
): Promise<WeeklyReport> {
  const gen = await gatherAndGenerate(
    pool,
    aiProvider,
    userId,
    startDate,
    endDate,
    userNotes,
    workoutPlan,
  );

  const periodStart = startDate.toISOString().split('T')[0];
  const periodEnd = endDate.toISOString().split('T')[0];

  const reportId = await saveReport(pool, {
    userId,
    periodStart,
    periodEnd,
    summary: gen.summary,
    insights: gen.insights,
    actionItems: gen.actionItems,
    dataCoverage: gen.dataCoverage,
    sections: gen.sections,
    aiProvider: gen.providerName,
    aiModel: gen.model,
  });

  await logAiGeneration(pool, {
    userId,
    provider: gen.providerName,
    model: gen.model,
    promptTokens: gen.usage.promptTokens,
    completionTokens: gen.usage.completionTokens,
    totalTokens: gen.usage.totalTokens,
    purpose: 'weekly_report',
  });

  // Promote action items to persistent tracked entities
  if (gen.actionItems.length > 0) {
    await promoteActionItems(pool, userId, reportId, gen.actionItems);
    // Supersede old pending items that are replaced by new report items
    await supersedeItems(pool, userId, reportId, gen.actionItems);
  }

  return {
    id: reportId,
    userId,
    periodStart,
    periodEnd,
    summary: gen.summary,
    insights: gen.insights,
    actionItems: gen.actionItems,
    dataCoverage: gen.dataCoverage,
    sections: gen.sections,
    aiProvider: gen.providerName,
    aiModel: gen.model,
    createdAt: new Date().toISOString(),
  };
}
