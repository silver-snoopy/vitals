import type pg from 'pg';
import type {
  AIProvider,
  WeeklyReport,
  ActionItem,
  ActionItemFollowUp,
  ReportSections,
  StructuredOutputConfig,
} from '@vitals/shared';
import {
  queryDailyNutritionSummary,
  queryMeasurementsByMetrics,
} from '../../db/queries/measurements.js';
import { queryWorkoutSessions } from '../../db/queries/workouts.js';
import { getLatestReport, saveReport, logAiGeneration } from '../../db/queries/reports.js';
import { promoteActionItems, listActionItems } from '../../db/queries/action-items.js';
import { buildReportPrompt } from './prompt-builder.js';
import { completeStructuredWithRetry } from './retry-utils.js';
import { measureOutcomes, determineOutcome } from '../action-items/outcome-measurer.js';
import { expireStaleItems, supersedeItems } from '../action-items/lifecycle-manager.js';
import { runCorrelationAnalysis } from '../intelligence/correlation-engine.js';
import { runTrajectoryProjections } from '../intelligence/trajectory-projector.js';

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

const REPORT_SCHEMA: StructuredOutputConfig = {
  name: 'submit_weekly_report',
  description: 'Submit the structured weekly health report analysis',
  schema: {
    type: 'object',
    required: [
      'summary',
      'biometricsOverview',
      'nutritionAnalysis',
      'trainingLoad',
      'crossDomainCorrelation',
      'whatsWorking',
      'hazards',
      'recommendations',
      'scorecard',
      'actionItems',
    ],
    properties: {
      summary: { type: 'string', description: 'One-paragraph executive summary' },
      biometricsOverview: { type: 'string' },
      nutritionAnalysis: { type: 'string' },
      trainingLoad: { type: 'string' },
      crossDomainCorrelation: { type: 'string' },
      whatsWorking: { type: 'string' },
      hazards: { type: 'string' },
      recommendations: { type: 'string' },
      scorecard: {
        type: 'object',
        description: 'Domain scores (1-10) with notes',
        additionalProperties: {
          type: 'object',
          properties: { score: { type: 'number' }, notes: { type: 'string' } },
          required: ['score', 'notes'],
        },
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          required: ['category', 'priority', 'text'],
          properties: {
            category: {
              type: 'string',
              enum: ['nutrition', 'workout', 'recovery', 'general'],
            },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            text: { type: 'string' },
          },
        },
      },
    },
  },
};

interface StructuredReportResponse {
  summary: string;
  biometricsOverview: string;
  nutritionAnalysis: string;
  trainingLoad: string;
  crossDomainCorrelation: string;
  whatsWorking: string;
  hazards: string;
  recommendations: string;
  scorecard: Record<string, { score: number; notes: string }>;
  actionItems: ActionItem[];
}

function countDistinctDays(dates: string[]): number {
  return new Set(dates.map((d) => d.split('T')[0])).size;
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
  const result = await completeStructuredWithRetry<StructuredReportResponse>(
    aiProvider,
    messages,
    REPORT_SCHEMA,
  );

  // 4. Map structured response to report fields
  const { data } = result;

  const sections: ReportSections = {
    biometricsOverview: data.biometricsOverview,
    nutritionAnalysis: data.nutritionAnalysis,
    trainingLoad: data.trainingLoad,
    crossDomainCorrelation: data.crossDomainCorrelation,
    whatsWorking: data.whatsWorking,
    hazards: data.hazards,
    recommendations: data.recommendations,
    scorecard: data.scorecard,
  };

  const insights = [
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
    .join('\n\n');

  return {
    summary: data.summary,
    insights,
    actionItems: data.actionItems,
    dataCoverage,
    sections,
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

  // Run intelligence pipeline (correlations + projections). Non-blocking:
  // failures here must not block the report from being returned.
  try {
    await Promise.all([
      runCorrelationAnalysis(pool, userId),
      runTrajectoryProjections(pool, userId),
    ]);
  } catch (err) {
    console.error('[intelligence] pipeline failed after report generation:', err);
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
