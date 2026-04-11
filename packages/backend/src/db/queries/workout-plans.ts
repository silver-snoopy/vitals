import type pg from 'pg';
import type {
  WorkoutPlan,
  PlanVersion,
  PlanAdjustmentBatch,
  PlanAdjustment,
  PlanData,
  AdjustmentStatus,
  ExerciseRef,
  PlanEvidence,
} from '@vitals/shared';

// ---------------------------------------------------------------------------
// Column lists
// ---------------------------------------------------------------------------

const PLAN_COLUMNS = `
  id, user_id, name, split_type, notes, active_version_id, created_at, updated_at
`;

const VERSION_COLUMNS = `
  id, plan_id, version_number, source, parent_version_id, data,
  created_at, accepted_at, notes
`;

const BATCH_COLUMNS = `
  id, plan_id, source_version_id, report_id, ai_provider, ai_model, rationale, created_at
`;

const ADJUSTMENT_COLUMNS = `
  id, batch_id, exercise_ref, change_type, old_value, new_value,
  evidence, confidence, rationale, status, decided_at
`;

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

/** Maps a raw DB row to a WorkoutPlan. */
export function mapPlanRow(r: Record<string, unknown>): WorkoutPlan {
  return {
    id: String(r['id']),
    userId: String(r['user_id']),
    name: String(r['name']),
    splitType: String(r['split_type']),
    notes: r['notes'] ? String(r['notes']) : undefined,
    activeVersionId: r['active_version_id'] ? String(r['active_version_id']) : null,
    createdAt:
      r['created_at'] instanceof Date ? r['created_at'].toISOString() : String(r['created_at']),
    updatedAt:
      r['updated_at'] instanceof Date ? r['updated_at'].toISOString() : String(r['updated_at']),
  };
}

/** Maps a raw DB row to a PlanVersion (including JSONB data round-trip). */
export function mapVersionRow(r: Record<string, unknown>): PlanVersion {
  return {
    id: String(r['id']),
    planId: String(r['plan_id']),
    versionNumber: Number(r['version_number']),
    source: r['source'] as PlanVersion['source'],
    parentVersionId: r['parent_version_id'] ? String(r['parent_version_id']) : null,
    data: (typeof r['data'] === 'object' && r['data'] !== null
      ? r['data']
      : JSON.parse(String(r['data']))) as PlanData,
    createdAt:
      r['created_at'] instanceof Date ? r['created_at'].toISOString() : String(r['created_at']),
    acceptedAt:
      r['accepted_at'] instanceof Date
        ? r['accepted_at'].toISOString()
        : r['accepted_at']
          ? String(r['accepted_at'])
          : null,
    notes: r['notes'] ? String(r['notes']) : undefined,
  };
}

/** Maps a raw DB row to a PlanAdjustment (including JSONB evidence round-trip). */
export function mapAdjustmentRow(r: Record<string, unknown>): PlanAdjustment {
  const exerciseRef =
    typeof r['exercise_ref'] === 'object' && r['exercise_ref'] !== null
      ? (r['exercise_ref'] as ExerciseRef)
      : (JSON.parse(String(r['exercise_ref'])) as ExerciseRef);

  const evidence = Array.isArray(r['evidence'])
    ? (r['evidence'] as PlanEvidence[])
    : r['evidence']
      ? (JSON.parse(String(r['evidence'])) as PlanEvidence[])
      : [];

  return {
    id: String(r['id']),
    batchId: String(r['batch_id']),
    exerciseRef,
    changeType: r['change_type'] as PlanAdjustment['changeType'],
    oldValue:
      typeof r['old_value'] === 'object' || Array.isArray(r['old_value'])
        ? r['old_value']
        : r['old_value'] != null
          ? JSON.parse(String(r['old_value']))
          : null,
    newValue:
      typeof r['new_value'] === 'object' || Array.isArray(r['new_value'])
        ? r['new_value']
        : r['new_value'] != null
          ? JSON.parse(String(r['new_value']))
          : null,
    evidence,
    confidence: Number(r['confidence']) as PlanAdjustment['confidence'],
    rationale: String(r['rationale']),
    status: r['status'] as AdjustmentStatus,
    decidedAt:
      r['decided_at'] instanceof Date
        ? r['decided_at'].toISOString()
        : r['decided_at']
          ? String(r['decided_at'])
          : undefined,
  };
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Returns the single current plan for a user along with its latest version,
 * or null if the user has no plan yet.
 */
export async function getCurrentPlan(
  pool: pg.Pool,
  userId: string,
): Promise<(WorkoutPlan & { latestVersion: PlanVersion }) | null> {
  // Get the most recent plan for the user
  const { rows: planRows } = await pool.query(
    `SELECT ${PLAN_COLUMNS} FROM workout_plans WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  if (planRows.length === 0) return null;

  const plan = mapPlanRow(planRows[0] as Record<string, unknown>);

  // Get the latest version for this plan
  const { rows: versionRows } = await pool.query(
    `SELECT ${VERSION_COLUMNS} FROM plan_versions WHERE plan_id = $1
     ORDER BY version_number DESC LIMIT 1`,
    [plan.id],
  );
  if (versionRows.length === 0) return null;

  const latestVersion = mapVersionRow(versionRows[0] as Record<string, unknown>);
  return { ...plan, latestVersion };
}

/** Returns a plan by ID, or null if not found. */
export async function getPlanById(pool: pg.Pool, planId: string): Promise<WorkoutPlan | null> {
  const { rows } = await pool.query(`SELECT ${PLAN_COLUMNS} FROM workout_plans WHERE id = $1`, [
    planId,
  ]);
  return rows.length === 0 ? null : mapPlanRow(rows[0] as Record<string, unknown>);
}

/** Returns a specific plan version by ID, or null if not found. */
export async function getPlanVersion(
  pool: pg.Pool,
  versionId: string,
): Promise<PlanVersion | null> {
  const { rows } = await pool.query(`SELECT ${VERSION_COLUMNS} FROM plan_versions WHERE id = $1`, [
    versionId,
  ]);
  return rows.length === 0 ? null : mapVersionRow(rows[0] as Record<string, unknown>);
}

/**
 * Creates a new plan if none exists for the user, or updates the existing plan's
 * name/splitType/notes. Returns the upserted plan row (without version).
 */
export async function upsertPlan(
  pool: pg.Pool,
  userId: string,
  fields: { name: string; splitType: string; notes?: string },
): Promise<WorkoutPlan> {
  const { rows } = await pool.query(
    `INSERT INTO workout_plans (user_id, name, split_type, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING ${PLAN_COLUMNS}`,
    [userId, fields.name, fields.splitType, fields.notes ?? null],
  );

  if (rows.length > 0) {
    return mapPlanRow(rows[0] as Record<string, unknown>);
  }

  // Plan already exists for this user — update it
  const { rows: updateRows } = await pool.query(
    `UPDATE workout_plans
     SET name = $2, split_type = $3, notes = $4, updated_at = now()
     WHERE user_id = $1
     RETURNING ${PLAN_COLUMNS}`,
    [userId, fields.name, fields.splitType, fields.notes ?? null],
  );
  return mapPlanRow(updateRows[0] as Record<string, unknown>);
}

/**
 * Inserts a new immutable plan version and bumps plan.updated_at.
 * Sets workout_plans.active_version_id to the new version.
 * Returns the newly created version.
 */
export async function insertPlanVersion(
  pool: pg.Pool,
  planId: string,
  fields: {
    source: PlanVersion['source'];
    parentVersionId: string | null;
    data: PlanData;
    notes?: string;
  },
): Promise<PlanVersion> {
  // Auto-increment version_number
  const { rows } = await pool.query(
    `INSERT INTO plan_versions (plan_id, version_number, source, parent_version_id, data, notes)
     VALUES (
       $1,
       (SELECT COALESCE(MAX(version_number), 0) + 1 FROM plan_versions WHERE plan_id = $1),
       $2, $3, $4::jsonb, $5
     )
     RETURNING ${VERSION_COLUMNS}`,
    [
      planId,
      fields.source,
      fields.parentVersionId ?? null,
      JSON.stringify(fields.data),
      fields.notes ?? null,
    ],
  );

  const newVersion = mapVersionRow(rows[0] as Record<string, unknown>);

  // Update the plan's active_version_id and updated_at
  await pool.query(
    `UPDATE workout_plans SET active_version_id = $1, updated_at = now() WHERE id = $2`,
    [newVersion.id, planId],
  );

  return newVersion;
}

/** Lists all versions for a plan, newest first. */
export async function listPlanVersions(pool: pg.Pool, planId: string): Promise<PlanVersion[]> {
  const { rows } = await pool.query(
    `SELECT ${VERSION_COLUMNS} FROM plan_versions WHERE plan_id = $1
     ORDER BY version_number DESC`,
    [planId],
  );
  return rows.map((r) => mapVersionRow(r as Record<string, unknown>));
}

/**
 * Inserts an adjustment batch (without individual adjustments).
 * Returns the batch ID.
 */
export async function insertAdjustmentBatch(
  pool: pg.Pool,
  fields: {
    planId: string;
    sourceVersionId: string;
    reportId: string;
    aiProvider: string;
    aiModel: string;
    rationale: string;
  },
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO plan_adjustment_batches
       (plan_id, source_version_id, report_id, ai_provider, ai_model, rationale)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      fields.planId,
      fields.sourceVersionId,
      fields.reportId,
      fields.aiProvider,
      fields.aiModel,
      fields.rationale,
    ],
  );
  return String(rows[0]['id']);
}

/** Returns all adjustments for a batch, ordered by exercise_ref position. */
export async function listAdjustmentsForBatch(
  pool: pg.Pool,
  batchId: string,
): Promise<PlanAdjustment[]> {
  const { rows } = await pool.query(
    `SELECT ${ADJUSTMENT_COLUMNS} FROM plan_adjustments WHERE batch_id = $1
     ORDER BY (exercise_ref->>'dayIndex')::int, (exercise_ref->>'exerciseOrder')::int`,
    [batchId],
  );
  return rows.map((r) => mapAdjustmentRow(r as Record<string, unknown>));
}

/** Returns a batch by ID along with its adjustments, or null if not found. */
export async function getAdjustmentBatch(
  pool: pg.Pool,
  batchId: string,
): Promise<(PlanAdjustmentBatch & { adjustments: PlanAdjustment[] }) | null> {
  const { rows: batchRows } = await pool.query(
    `SELECT ${BATCH_COLUMNS} FROM plan_adjustment_batches WHERE id = $1`,
    [batchId],
  );
  if (batchRows.length === 0) return null;

  const r = batchRows[0] as Record<string, unknown>;
  const adjustments = await listAdjustmentsForBatch(pool, batchId);

  return {
    id: String(r['id']),
    planId: String(r['plan_id']),
    sourceVersionId: String(r['source_version_id']),
    reportId: String(r['report_id']),
    createdAt:
      r['created_at'] instanceof Date ? r['created_at'].toISOString() : String(r['created_at']),
    rationale: String(r['rationale']),
    adjustments,
  };
}

/**
 * Updates the status of a single adjustment.
 * Sets decided_at to now() when transitioning to accepted or rejected.
 */
export async function updateAdjustmentStatus(
  pool: pg.Pool,
  adjustmentId: string,
  status: AdjustmentStatus,
): Promise<void> {
  const setDecidedAt = status === 'accepted' || status === 'rejected' ? ', decided_at = now()' : '';
  await pool.query(`UPDATE plan_adjustments SET status = $1${setDecidedAt} WHERE id = $2`, [
    status,
    adjustmentId,
  ]);
}

/**
 * Bulk-updates adjustment statuses within a single transaction.
 * decisions is a map of adjustmentId → 'accepted' | 'rejected'.
 */
export async function bulkUpdateAdjustmentStatus(
  pool: pg.Pool,
  decisions: Record<string, 'accepted' | 'rejected'>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [adjustmentId, status] of Object.entries(decisions)) {
      await client.query(
        `UPDATE plan_adjustments SET status = $1, decided_at = now() WHERE id = $2`,
        [status, adjustmentId],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Inserts a single plan adjustment row.
 * Returns the inserted adjustment.
 */
export async function insertAdjustment(
  pool: pg.Pool,
  fields: {
    batchId: string;
    exerciseRef: ExerciseRef;
    changeType: PlanAdjustment['changeType'];
    oldValue: unknown;
    newValue: unknown;
    evidence: PlanAdjustment['evidence'];
    confidence: PlanAdjustment['confidence'];
    rationale: string;
  },
): Promise<PlanAdjustment> {
  const { rows } = await pool.query(
    `INSERT INTO plan_adjustments
       (batch_id, exercise_ref, change_type, old_value, new_value, evidence, confidence, rationale)
     VALUES ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
     RETURNING ${ADJUSTMENT_COLUMNS}`,
    [
      fields.batchId,
      JSON.stringify(fields.exerciseRef),
      fields.changeType,
      JSON.stringify(fields.oldValue),
      JSON.stringify(fields.newValue),
      JSON.stringify(fields.evidence),
      fields.confidence,
      fields.rationale,
    ],
  );
  return mapAdjustmentRow(rows[0] as Record<string, unknown>);
}
