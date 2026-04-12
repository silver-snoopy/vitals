/**
 * Workout Plan Fine Tuner — shared domain types.
 *
 * These types represent the full lifecycle of a user's workout plan:
 * creation, versioning, AI-generated adjustment batches, and per-adjustment
 * accept/reject decisions.
 */

// ---------------------------------------------------------------------------
// Core plan structure
// ---------------------------------------------------------------------------

/**
 * SFR tier rating for an exercise (Stimulus-to-Fatigue Ratio).
 * S = best, C = worst.
 */
export type SfrTier = 'S' | 'A' | 'B' | 'C';

/** Progression strategy applied to an exercise. */
export type ProgressionRule = 'double' | 'linear' | 'rpe_stop' | 'manual';

/** Type of a set within an exercise. */
export type SetType = 'warmup' | 'normal' | 'drop' | 'failure' | 'amrap';

/**
 * A single set within a plan exercise.
 * Target reps can be an exact number or a [min, max] range for double progression.
 */
export interface PlanSet {
  type: SetType;
  /** Exact reps or [min, max] range for double progression. */
  targetReps: number | [number, number];
  targetWeightKg?: number;
  targetRpe?: number;
  /** Rest period in seconds. */
  restSec?: number;
}

/**
 * A single exercise within a plan day.
 * Includes metadata used by the rules engine (SFR tier, muscle groups, etc.).
 */
export interface PlanExercise {
  /** Stable ID for referencing across versions. */
  id: string;
  exerciseName: string;
  /** Order of this exercise within its day (1-based). */
  orderInDay: number;
  /** Optional superset group index — exercises sharing a group are supersetted. */
  supersetGroup?: number;
  sets: PlanSet[];
  progressionRule: ProgressionRule;
  primaryMuscle: string;
  secondaryMuscles: string[];
  /** Movement pattern (e.g. 'push', 'pull', 'hinge', 'squat', 'carry'). */
  pattern: string;
  /** Equipment required (e.g. 'barbell', 'dumbbell', 'cable', 'bodyweight'). */
  equipment: string;
  sfrTier: SfrTier;
  notes?: string;
}

/**
 * A single training day within a plan.
 */
export interface PlanDay {
  /** Day name, e.g. 'Push A', 'Monday', 'Leg Day'. */
  name: string;
  /** Primary muscle groups targeted this day. */
  targetMuscles: string[];
  exercises: PlanExercise[];
}

/**
 * The JSONB payload stored in plan_versions.data.
 * This is the canonical representation of what a trainee should do.
 */
export interface PlanData {
  /** How the training week is structured (e.g. 'PPL', 'Upper/Lower', 'Full Body'). */
  splitType: string;
  /** Current week within a mesocycle (1-based). */
  mesocycleWeek?: number;
  /** Total weeks in the mesocycle. */
  totalWeeks?: number;
  /**
   * Progression personality preset.
   * v1 ships with 'balanced' only — additional presets deferred.
   */
  progressionPersonality: 'balanced';
  days: PlanDay[];
}

// ---------------------------------------------------------------------------
// Plan + version records
// ---------------------------------------------------------------------------

/**
 * Top-level workout plan record. A user has at most one plan.
 * The plan itself is a thin container; the actual training content lives in
 * plan versions (immutable snapshots).
 */
export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  /** High-level split label mirrored from the active version for quick display. */
  splitType: string;
  notes?: string;
  /** FK to the version currently treated as "live". Null if no version accepted yet. */
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Who/what created a plan version. */
export type PlanVersionSource = 'user' | 'tuner' | 'imported';

/**
 * An immutable snapshot of a plan at a point in time.
 * Versions are never mutated; each edit or tuner run creates a new version.
 */
export interface PlanVersion {
  id: string;
  planId: string;
  /** Auto-incrementing version number within the plan. */
  versionNumber: number;
  /** What created this version. */
  source: PlanVersionSource;
  /** Parent version this was derived from (null for the first version). */
  parentVersionId: string | null;
  /** Full plan content stored as JSONB. */
  data: PlanData;
  createdAt: string;
  /** When this version was accepted as the active plan. Null if never activated. */
  acceptedAt: string | null;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Adjustment batch + individual adjustments
// ---------------------------------------------------------------------------

/** Kinds of evidence that support an adjustment recommendation. */
export type EvidenceKind =
  | 'correlation'
  | 'metric'
  | 'hazard'
  | 'report_section'
  | 'exercise_progress';

/**
 * A single piece of supporting evidence for an adjustment.
 * Linked to PHIE correlations, report sections, or raw metric data.
 */
export interface PlanEvidence {
  kind: EvidenceKind;
  /** Optional FK into correlations / projections / report tables. */
  refId?: string;
  /** Human-readable excerpt of why this supports the change. */
  excerpt: string;
}

/** Type of change being proposed. */
export type ChangeType =
  | 'hold'
  | 'progress_load'
  | 'progress_reps'
  | 'deload'
  | 'swap'
  | 'remove'
  | 'add';

/** Lifecycle status of an individual adjustment decision. */
export type AdjustmentStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';

/** Confidence score from 1 (low) to 5 (high). */
export type ConfidenceScore = 1 | 2 | 3 | 4 | 5;

/**
 * References an exercise within a plan day by position.
 * Stable as long as day index and exercise order don't change.
 */
export interface ExerciseRef {
  dayIndex: number;
  exerciseOrder: number;
}

/**
 * A single proposed change to one exercise.
 * Each adjustment has its own accept/reject decision.
 */
export interface PlanAdjustment {
  id: string;
  batchId: string;
  exerciseRef: ExerciseRef;
  changeType: ChangeType;
  /** Previous value before the change (typed per changeType). */
  oldValue: unknown;
  /** Proposed new value (typed per changeType). */
  newValue: unknown;
  evidence: PlanEvidence[];
  /** AI confidence in this specific recommendation. */
  confidence: ConfidenceScore;
  rationale: string;
  status: AdjustmentStatus;
  decidedAt?: string;
}

/**
 * A complete set of proposed adjustments generated in a single tuner run.
 * Linked to the source plan version and the weekly report that triggered it.
 */
export interface PlanAdjustmentBatch {
  id: string;
  /** Plan this batch targets. */
  planId: string;
  /** Plan version the tuner read as input. */
  sourceVersionId: string;
  /** Weekly report that triggered this tuning run. */
  reportId: string;
  createdAt: string;
  /** Top-level narrative explaining the overall adjustment direction. */
  rationale: string;
  adjustments: PlanAdjustment[];
}

// ---------------------------------------------------------------------------
// Request / response body types
// ---------------------------------------------------------------------------

/** Body for POST /api/workout-plans — create a new plan from text or structured data. */
export interface CreatePlanRequest {
  /** Raw free-text plan (e.g. pasted from a note). Parsed by the LLM. */
  rawText?: string;
  /** Pre-structured plan data (skips parser). */
  plan?: WorkoutPlan;
}

/** Body for POST /api/workout-plans/:id/tune */
export interface TunePlanRequest {
  reportId: string;
}

/** A single adjustment decision with optional user-overridden value. */
export interface AdjustmentDecision {
  status: 'accepted' | 'rejected';
  overrideValue?: unknown;
}

/** Body for PATCH /api/workout-plans/adjustments/:batchId */
export interface DecideAdjustmentsRequest {
  /** Map of adjustmentId → decision. */
  decisions: Record<string, AdjustmentDecision>;
}
