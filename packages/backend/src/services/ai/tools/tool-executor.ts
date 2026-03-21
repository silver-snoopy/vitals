import type pg from 'pg';
import { queryDailyNutritionSummary, queryMeasurementsByMetrics } from '../../../db/queries/measurements.js';
import { queryWorkoutSessions, queryExerciseProgress } from '../../../db/queries/workouts.js';
import { getLatestReport } from '../../../db/queries/reports.js';

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  result: string;
}

function parseDate(value: unknown): Date {
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  throw new Error(`Invalid date: ${String(value)}`);
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
        const rows = await queryDailyNutritionSummary(db, userId, start, end);
        return JSON.stringify(rows);
      }

      case 'query_workouts': {
        const start = parseDate(input.startDate);
        const end = parseDate(input.endDate);
        const sessions = await queryWorkoutSessions(db, userId, start, end);
        return JSON.stringify(sessions);
      }

      case 'query_biometrics': {
        const metrics = Array.isArray(input.metrics)
          ? (input.metrics as string[])
          : [String(input.metrics)];
        const start = parseDate(input.startDate);
        const end = parseDate(input.endDate);
        const readings = await queryMeasurementsByMetrics(db, userId, metrics, start, end);
        return JSON.stringify(readings);
      }

      case 'query_exercise_progress': {
        const exerciseName = String(input.exerciseName);
        const start = input.startDate ? parseDate(input.startDate) : undefined;
        const end = input.endDate ? parseDate(input.endDate) : undefined;
        const progress = await queryExerciseProgress(db, userId, exerciseName, start, end);
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

      case 'list_available_metrics': {
        const { rows } = await db.query(
          `SELECT DISTINCT metric FROM measurements WHERE user_id = $1 ORDER BY metric`,
          [userId],
        );
        const metrics = rows.map((r: { metric: string }) => r.metric);
        return JSON.stringify({ metrics });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: message });
  }
}
