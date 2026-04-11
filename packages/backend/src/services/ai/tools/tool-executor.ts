import type pg from 'pg';
import type { ActionItemStatus } from '@vitals/shared';
import {
  queryDailyNutritionSummary,
  queryMeasurementsByMetrics,
} from '../../../db/queries/measurements.js';
import { queryWorkoutSessions, queryExerciseProgress } from '../../../db/queries/workouts.js';
import { getLatestReport } from '../../../db/queries/reports.js';
import {
  listActionItems,
  getActionItem,
  getAttributionSummary,
} from '../../../db/queries/action-items.js';
import { measureOutcomes } from '../../action-items/outcome-measurer.js';
import { listCorrelations } from '../../../db/queries/correlations.js';
import { getProjections } from '../../../db/queries/projections.js';

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  result: string;
}

const MAX_DATE_SPAN_DAYS = 730;
const MAX_LIMIT = 100;
const MAX_EXERCISE_NAME_LENGTH = 200;
const MAX_METRICS_COUNT = 20;

function parseDate(value: unknown): Date {
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  throw new Error(`Invalid date: ${String(value)}`);
}

function validateDateSpan(start: Date, end: Date): string | null {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 'Start date must be before end date';
  if (diffMs > MAX_DATE_SPAN_DAYS * 86_400_000)
    return `Date range cannot exceed ${MAX_DATE_SPAN_DAYS} days`;
  return null;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  db: pg.Pool,
  userId: string,
): Promise<string> {
  try {
    switch (toolName) {
      case 'query_nutrition': {
        const start = parseDate(input.startDate);
        const end = parseDate(input.endDate);
        const spanErr = validateDateSpan(start, end);
        if (spanErr) return JSON.stringify({ error: spanErr });
        const rows = await queryDailyNutritionSummary(db, userId, start, end);
        return JSON.stringify(rows);
      }

      case 'query_workouts': {
        const start = parseDate(input.startDate);
        const end = parseDate(input.endDate);
        const spanErr = validateDateSpan(start, end);
        if (spanErr) return JSON.stringify({ error: spanErr });
        const sessions = await queryWorkoutSessions(db, userId, start, end);
        return JSON.stringify(
          sessions.map(({ date, title, durationSeconds, sets, source }) => ({
            date,
            title,
            durationSeconds,
            source,
            sets: sets.map(
              ({ exerciseName, setIndex, setType, weightKg, reps, volumeKg, rpe }) => ({
                exerciseName,
                setIndex,
                setType,
                weightKg,
                reps,
                volumeKg,
                rpe,
              }),
            ),
          })),
        );
      }

      case 'query_biometrics': {
        const metrics = Array.isArray(input.metrics)
          ? (input.metrics as string[])
          : [String(input.metrics)];
        if (metrics.length > MAX_METRICS_COUNT) {
          return JSON.stringify({ error: `Too many metrics (max ${MAX_METRICS_COUNT})` });
        }
        const start = parseDate(input.startDate);
        const end = parseDate(input.endDate);
        const spanErr = validateDateSpan(start, end);
        if (spanErr) return JSON.stringify({ error: spanErr });
        const readings = await queryMeasurementsByMetrics(db, userId, metrics, start, end);
        return JSON.stringify(
          readings.map(({ date, metric, value, unit }) => ({ date, metric, value, unit })),
        );
      }

      case 'query_exercise_progress': {
        const exerciseName = String(input.exerciseName);
        if (exerciseName.length > MAX_EXERCISE_NAME_LENGTH) {
          return JSON.stringify({
            error: `Exercise name too long (max ${MAX_EXERCISE_NAME_LENGTH} chars)`,
          });
        }
        const start = input.startDate ? parseDate(input.startDate) : undefined;
        const end = input.endDate ? parseDate(input.endDate) : undefined;
        if (start && end) {
          const spanErr = validateDateSpan(start, end);
          if (spanErr) return JSON.stringify({ error: spanErr });
        }
        // Default missing bound to prevent unbounded table scans
        const boundedStart =
          start ?? (end ? new Date(end.getTime() - MAX_DATE_SPAN_DAYS * 86_400_000) : undefined);
        const boundedEnd =
          end ??
          (start
            ? new Date(Math.min(start.getTime() + MAX_DATE_SPAN_DAYS * 86_400_000, Date.now()))
            : undefined);
        const progress = await queryExerciseProgress(
          db,
          userId,
          exerciseName,
          boundedStart,
          boundedEnd,
        );
        return JSON.stringify(progress);
      }

      case 'get_latest_report': {
        const report = await getLatestReport(db, userId);
        if (!report) return JSON.stringify({ message: 'No reports found.' });
        return JSON.stringify({
          id: report.id,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          summary: report.summary,
          insights: report.insights,
          actionItems: report.actionItems,
        });
      }

      case 'query_action_items': {
        const status = input.status as ActionItemStatus | 'all' | undefined;
        const category = input.category as string | undefined;
        const limit = Math.min(typeof input.limit === 'number' ? input.limit : 20, MAX_LIMIT);
        const filters: {
          status?: ActionItemStatus | ActionItemStatus[];
          category?: string;
          limit: number;
        } = { limit };
        if (status && status !== 'all') filters.status = status;
        if (category) filters.category = category;
        const items = await listActionItems(db, userId, filters);
        return JSON.stringify(items);
      }

      case 'query_action_outcomes': {
        if (input.actionItemId) {
          // On-demand measurement for a specific item
          const item = await getActionItem(db, String(input.actionItemId), userId);
          if (!item) return JSON.stringify({ error: 'Action item not found' });
          if (item.status !== 'completed')
            return JSON.stringify({ error: 'Item must be completed to measure outcome' });
          if (item.targetMetric) {
            const results = await measureOutcomes(db, userId, [item]);
            return JSON.stringify(
              results.length > 0 ? results[0] : { message: 'No measurable data found' },
            );
          }
          return JSON.stringify({ message: 'Item has no target metric' });
        }
        // Attribution summary
        const period = (input.period as 'week' | 'month' | 'all') ?? 'month';
        const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
          week: 'week',
          month: 'month',
          all: 'quarter',
        };
        const summary = await getAttributionSummary(db, userId, periodMap[period] ?? 'month');
        return JSON.stringify(summary);
      }

      case 'list_available_metrics': {
        const { rows } = await db.query(
          `SELECT DISTINCT metric FROM measurements WHERE user_id = $1 ORDER BY metric`,
          [userId],
        );
        const metrics = rows.map((r: { metric: string }) => r.metric);
        return JSON.stringify({ metrics });
      }

      case 'query_correlations': {
        const filters: {
          metric?: string;
          category?: string;
          minConfidence?: string;
        } = {};
        if (input.metric) filters.metric = String(input.metric);
        if (input.category) filters.category = String(input.category);
        if (input.minConfidence) filters.minConfidence = String(input.minConfidence);
        const correlations = await listCorrelations(db, userId, filters);
        return JSON.stringify(correlations);
      }

      case 'predict_trajectory': {
        if (!input.metric) return JSON.stringify({ error: 'metric is required' });
        const metric = String(input.metric);
        const rawDays = typeof input.daysForward === 'number' ? input.daysForward : 30;
        const daysForward = Math.min(Math.max(1, rawDays), 90);
        const projections = await getProjections(db, userId, metric, daysForward);
        return JSON.stringify(projections);
      }

      case 'simulate_change': {
        if (!input.changeDescription)
          return JSON.stringify({ error: 'changeDescription is required' });
        if (!input.factorMetric) return JSON.stringify({ error: 'factorMetric is required' });
        const factorMetric = String(input.factorMetric);
        const correlations = await listCorrelations(db, userId, { metric: factorMetric });
        const impactEstimates = {
          changeDescription: String(input.changeDescription),
          factorMetric,
          newValue: input.newValue !== undefined ? String(input.newValue) : undefined,
          relatedCorrelations: correlations,
        };
        return JSON.stringify(impactEstimates);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    // Log full error for observability; return sanitized message to avoid leaking internals
    console.error(`[tool-executor] ${toolName} failed:`, err);
    const isValidationError = err instanceof Error && err.message.startsWith('Invalid date');
    return JSON.stringify({
      error: isValidationError
        ? 'Invalid date format. Please use YYYY-MM-DD.'
        : 'An internal error occurred while executing this tool.',
    });
  }
}
