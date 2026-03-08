import type pg from 'pg';
import type { WeeklyReport, ActionItem } from '@vitals/shared';

function mapReportRow(r: Record<string, unknown>): WeeklyReport {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    periodStart:
      r.period_start instanceof Date
        ? r.period_start.toISOString().split('T')[0]
        : String(r.period_start),
    periodEnd:
      r.period_end instanceof Date
        ? r.period_end.toISOString().split('T')[0]
        : String(r.period_end),
    summary: String(r.summary),
    insights: typeof r.insights === 'string' ? r.insights : String(r.insights ?? ''),
    actionItems: Array.isArray(r.action_items) ? (r.action_items as ActionItem[]) : [],
    dataCoverage: (r.data_coverage as WeeklyReport['dataCoverage']) ?? {
      nutritionDays: 0,
      workoutDays: 0,
      biometricDays: 0,
    },
    aiProvider: String(r.ai_provider),
    aiModel: String(r.ai_model),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function getReportById(pool: pg.Pool, id: string): Promise<WeeklyReport | null> {
  const { rows } = await pool.query(
    `SELECT id, user_id, period_start, period_end, summary, insights,
       action_items, data_coverage, ai_provider, ai_model, created_at
     FROM weekly_reports WHERE id = $1`,
    [id],
  );
  return rows.length === 0 ? null : mapReportRow(rows[0] as Record<string, unknown>);
}

export async function getLatestReport(pool: pg.Pool, userId: string): Promise<WeeklyReport | null> {
  const { rows } = await pool.query(
    `SELECT id, user_id, period_start, period_end, summary, insights,
       action_items, data_coverage, ai_provider, ai_model, created_at
     FROM weekly_reports WHERE user_id = $1
     ORDER BY period_start DESC LIMIT 1`,
    [userId],
  );
  return rows.length === 0 ? null : mapReportRow(rows[0] as Record<string, unknown>);
}

export async function listReports(
  pool: pg.Pool,
  userId: string,
  startDate?: string,
  endDate?: string,
): Promise<WeeklyReport[]> {
  const params: unknown[] = [userId];
  const filters: string[] = ['user_id = $1'];

  if (startDate) {
    params.push(startDate);
    filters.push(`period_start >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    filters.push(`period_end <= $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT id, user_id, period_start, period_end, summary, insights,
       action_items, data_coverage, ai_provider, ai_model, created_at
     FROM weekly_reports
     WHERE ${filters.join(' AND ')}
     ORDER BY period_start DESC`,
    params,
  );

  return rows.map((r) => mapReportRow(r as Record<string, unknown>));
}

export async function saveReport(
  pool: pg.Pool,
  report: Omit<WeeklyReport, 'id' | 'createdAt'>,
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO weekly_reports
       (user_id, period_start, period_end, summary, insights,
        action_items, data_coverage, ai_provider, ai_model)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
     RETURNING id`,
    [
      report.userId,
      report.periodStart,
      report.periodEnd,
      report.summary,
      JSON.stringify(report.insights),
      JSON.stringify(report.actionItems),
      JSON.stringify(report.dataCoverage),
      report.aiProvider,
      report.aiModel,
    ],
  );
  return String(rows[0].id);
}

export interface AiGenerationLog {
  userId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  purpose: string;
}

export async function logAiGeneration(pool: pg.Pool, gen: AiGenerationLog): Promise<void> {
  await pool.query(
    `INSERT INTO ai_generations
       (user_id, provider, model, prompt_tokens, completion_tokens, total_tokens, purpose)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      gen.userId,
      gen.provider,
      gen.model,
      gen.promptTokens,
      gen.completionTokens,
      gen.totalTokens,
      gen.purpose,
    ],
  );
}
