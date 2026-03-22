import type pg from 'pg';
import type { ActionItem, TrackedActionItem, ActionItemStatus } from '@vitals/shared';

const COLUMNS = `
  id, user_id, report_id, category, priority, text, status,
  target_metric, target_direction, baseline_value, outcome_value,
  outcome_confidence, outcome_measured_at,
  created_at, due_by, completed_at, status_changed_at
`;

// Valid status transitions: key = current status, value = allowed next statuses
const VALID_TRANSITIONS: Record<ActionItemStatus, ActionItemStatus[]> = {
  pending: ['active', 'rejected', 'deferred'],
  active: ['completed', 'deferred', 'expired'],
  deferred: ['active', 'expired'],
  completed: [],
  expired: [],
  rejected: [],
  superseded: [],
};

function mapRow(r: Record<string, unknown>): TrackedActionItem {
  return {
    id: String(r.id),
    reportId: String(r.report_id),
    category: r.category as TrackedActionItem['category'],
    priority: r.priority as TrackedActionItem['priority'],
    text: String(r.text),
    status: r.status as ActionItemStatus,
    targetMetric: r.target_metric ? String(r.target_metric) : undefined,
    targetDirection: r.target_direction
      ? (r.target_direction as TrackedActionItem['targetDirection'])
      : undefined,
    baselineValue: r.baseline_value != null ? Number(r.baseline_value) : undefined,
    outcomeValue: r.outcome_value != null ? Number(r.outcome_value) : undefined,
    outcomeConfidence: r.outcome_confidence
      ? (r.outcome_confidence as TrackedActionItem['outcomeConfidence'])
      : undefined,
    outcomeMeasuredAt:
      r.outcome_measured_at instanceof Date
        ? r.outcome_measured_at.toISOString()
        : r.outcome_measured_at
          ? String(r.outcome_measured_at)
          : undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    dueBy:
      r.due_by instanceof Date
        ? r.due_by.toISOString().split('T')[0]
        : r.due_by
          ? String(r.due_by).split('T')[0]
          : undefined,
    completedAt:
      r.completed_at instanceof Date
        ? r.completed_at.toISOString()
        : r.completed_at
          ? String(r.completed_at)
          : undefined,
    statusChangedAt:
      r.status_changed_at instanceof Date
        ? r.status_changed_at.toISOString()
        : String(r.status_changed_at),
  };
}

export interface ActionItemFilters {
  status?: ActionItemStatus | ActionItemStatus[];
  category?: string;
  reportId?: string;
  limit?: number;
}

export async function promoteActionItems(
  pool: pg.Pool,
  userId: string,
  reportId: string,
  items: ActionItem[],
): Promise<void> {
  if (items.length === 0) return;

  // Idempotent: skip if items from this report already exist
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM action_items WHERE report_id = $1 LIMIT 1`,
    [reportId],
  );
  if (existing.length > 0) return;

  const values: unknown[] = [];
  const placeholders = items.map((item, i) => {
    const base = i * 5;
    values.push(userId, reportId, item.category, item.priority, item.text);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, now() + INTERVAL '7 days')`;
  });

  await pool.query(
    `INSERT INTO action_items (user_id, report_id, category, priority, text, due_by)
     VALUES ${placeholders.join(', ')}`,
    values,
  );
}

export async function listActionItems(
  pool: pg.Pool,
  userId: string,
  filters: ActionItemFilters = {},
): Promise<TrackedActionItem[]> {
  const params: unknown[] = [userId];
  const conditions: string[] = ['user_id = $1'];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    params.push(statuses);
    conditions.push(`status = ANY($${params.length})`);
  }

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`category = $${params.length}`);
  }

  if (filters.reportId) {
    params.push(filters.reportId);
    conditions.push(`report_id = $${params.length}`);
  }

  const limit = filters.limit ?? 100;
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM action_items
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
       CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT ${limit}`,
    params,
  );
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getActionItem(
  pool: pg.Pool,
  id: string,
  userId: string,
): Promise<TrackedActionItem | null> {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM action_items WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return rows.length === 0 ? null : mapRow(rows[0] as Record<string, unknown>);
}

export async function updateActionItemStatus(
  pool: pg.Pool,
  id: string,
  userId: string,
  newStatus: ActionItemStatus,
  dueBy?: string,
): Promise<TrackedActionItem | null> {
  // Fetch current status first to validate transition
  const { rows: current } = await pool.query(
    `SELECT status FROM action_items WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (current.length === 0) return null;

  const currentStatus = current[0].status as ActionItemStatus;
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`);
  }

  const params: unknown[] = [newStatus, id, userId];
  const completedAt = newStatus === 'completed' ? 'now()' : 'completed_at';
  const dueBySql = dueBy ? `$${params.push(dueBy)}` : 'due_by';

  const { rows } = await pool.query(
    `UPDATE action_items
     SET status = $1, status_changed_at = now(),
         completed_at = ${completedAt},
         due_by = ${dueBySql}
     WHERE id = $2 AND user_id = $3
     RETURNING ${COLUMNS}`,
    params,
  );
  return rows.length === 0 ? null : mapRow(rows[0] as Record<string, unknown>);
}

export interface ActionItemSummary {
  pending: number;
  active: number;
  completed: number;
  deferred: number;
  expired: number;
  total: number;
}

export async function getActionItemsWithOutcomes(
  pool: pg.Pool,
  userId: string,
  periodDays = 30,
): Promise<TrackedActionItem[]> {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM action_items
     WHERE user_id = $1
       AND status = 'completed'
       AND outcome_measured_at IS NOT NULL
       AND completed_at >= now() - ($2 || ' days')::interval
     ORDER BY completed_at DESC`,
    [userId, String(periodDays)],
  );
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export interface AttributionSummaryRow {
  period: string;
  totalItems: number;
  completedItems: number;
  completionRate: number;
  measuredItems: number;
  improvedItems: number;
  stableItems: number;
  declinedItems: number;
  improvementRate: number;
  topImprovements: Array<{
    text: string;
    category: string;
    metric: string;
    change: string;
  }>;
}

export async function getAttributionSummary(
  pool: pg.Pool,
  userId: string,
  period: 'week' | 'month' | 'quarter' = 'month',
): Promise<AttributionSummaryRow> {
  const intervalMap = { week: '7 days', month: '30 days', quarter: '90 days' };
  const interval = intervalMap[period];

  const { rows: statsRows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'completed' AND outcome_measured_at IS NOT NULL)::int AS measured,
       COUNT(*) FILTER (WHERE status = 'completed' AND outcome_value IS NOT NULL AND baseline_value IS NOT NULL
         AND (
           (target_direction = 'increase' AND outcome_value > baseline_value) OR
           (target_direction = 'decrease' AND outcome_value < baseline_value) OR
           (target_direction = 'maintain' AND ABS(outcome_value - baseline_value) / GREATEST(ABS(baseline_value), 0.001) < 0.05)
         ))::int AS improved,
       COUNT(*) FILTER (WHERE status = 'completed' AND outcome_value IS NOT NULL AND baseline_value IS NOT NULL
         AND ABS(outcome_value - baseline_value) / GREATEST(ABS(baseline_value), 0.001) < 0.02)::int AS stable,
       COUNT(*) FILTER (WHERE status = 'completed' AND outcome_value IS NOT NULL AND baseline_value IS NOT NULL
         AND NOT (
           (target_direction = 'increase' AND outcome_value > baseline_value) OR
           (target_direction = 'decrease' AND outcome_value < baseline_value) OR
           (target_direction = 'maintain' AND ABS(outcome_value - baseline_value) / GREATEST(ABS(baseline_value), 0.001) < 0.05)
         )
         AND ABS(outcome_value - baseline_value) / GREATEST(ABS(baseline_value), 0.001) >= 0.02)::int AS declined
     FROM action_items
     WHERE user_id = $1 AND created_at >= now() - $2::interval`,
    [userId, interval],
  );

  const stats = statsRows[0] ?? {
    total: 0,
    completed: 0,
    measured: 0,
    improved: 0,
    stable: 0,
    declined: 0,
  };

  // Top improvements: completed items with best outcome vs baseline
  const { rows: topRows } = await pool.query(
    `SELECT text, category, target_metric, target_direction, baseline_value, outcome_value
     FROM action_items
     WHERE user_id = $1
       AND status = 'completed'
       AND outcome_measured_at IS NOT NULL
       AND baseline_value IS NOT NULL
       AND outcome_value IS NOT NULL
       AND created_at >= now() - $2::interval
       AND (
         (target_direction = 'increase' AND outcome_value > baseline_value) OR
         (target_direction = 'decrease' AND outcome_value < baseline_value) OR
         (target_direction = 'maintain' AND ABS(outcome_value - baseline_value) / GREATEST(ABS(baseline_value), 0.001) < 0.05)
       )
     ORDER BY ABS(outcome_value - baseline_value) DESC
     LIMIT 3`,
    [userId, interval],
  );

  const topImprovements = topRows.map((r) => {
    const diff = Number(r.outcome_value) - Number(r.baseline_value);
    const sign = diff >= 0 ? '+' : '';
    return {
      text: String(r.text),
      category: String(r.category),
      metric: String(r.target_metric),
      change: `${sign}${diff.toFixed(1)}`,
    };
  });

  const total = Number(stats.total);
  const completed = Number(stats.completed);
  const measured = Number(stats.measured);

  return {
    period,
    totalItems: total,
    completedItems: completed,
    completionRate: total > 0 ? completed / total : 0,
    measuredItems: measured,
    improvedItems: Number(stats.improved),
    stableItems: Number(stats.stable),
    declinedItems: Number(stats.declined),
    improvementRate: measured > 0 ? Number(stats.improved) / measured : 0,
    topImprovements,
  };
}

export async function getActionItemSummary(
  pool: pg.Pool,
  userId: string,
): Promise<ActionItemSummary> {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM action_items
     WHERE user_id = $1
     GROUP BY status`,
    [userId],
  );

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[String(row.status)] = Number(row.count);
  }

  return {
    pending: counts['pending'] ?? 0,
    active: counts['active'] ?? 0,
    completed: counts['completed'] ?? 0,
    deferred: counts['deferred'] ?? 0,
    expired: counts['expired'] ?? 0,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}
