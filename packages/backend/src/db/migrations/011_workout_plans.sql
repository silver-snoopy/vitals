-- Migration 011: Workout Plans
-- Creates tables for the Workout Plan Fine Tuner feature.
-- Additive only — no ALTER on existing tables.

CREATE TABLE IF NOT EXISTS workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  split_type TEXT NOT NULL,
  notes TEXT,
  -- FK to the currently active version; NULL until the first version is accepted.
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES workout_plans (id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user', 'tuner', 'imported')),
  -- Self-referencing FK: the version this was derived from.
  parent_version_id UUID REFERENCES plan_versions (id) ON DELETE SET NULL,
  -- Full plan content as JSONB (PlanData shape).
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set when this version is promoted to the active plan.
  accepted_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE (plan_id, version_number)
);

-- Now that plan_versions exists, add the FK from workout_plans.active_version_id.
-- Migration runner skips already-applied migrations (tracked via _migrations), so no IF NOT EXISTS needed.
ALTER TABLE workout_plans
  ADD CONSTRAINT fk_workout_plans_active_version
  FOREIGN KEY (active_version_id) REFERENCES plan_versions (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS plan_adjustment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES workout_plans (id) ON DELETE CASCADE,
  source_version_id UUID NOT NULL REFERENCES plan_versions (id) ON DELETE CASCADE,
  -- The weekly report that triggered this tuning run.
  report_id UUID NOT NULL REFERENCES weekly_reports (id) ON DELETE CASCADE,
  ai_provider TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  -- Top-level narrative explaining overall adjustment direction.
  rationale TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES plan_adjustment_batches (id) ON DELETE CASCADE,
  -- Identifies the exercise by day index + order within the day.
  exercise_ref JSONB NOT NULL,
  change_type TEXT NOT NULL CHECK (
    change_type IN ('hold', 'progress_load', 'progress_reps', 'deload', 'swap', 'remove', 'add')
  ),
  old_value JSONB,
  new_value JSONB,
  -- Array of PlanEvidence objects.
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Confidence score 1–5.
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'rejected', 'superseded')
  ),
  decided_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id ON workout_plans (user_id);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON plan_versions (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_version ON plan_versions (plan_id, version_number);

CREATE INDEX IF NOT EXISTS idx_plan_adj_batches_plan_id ON plan_adjustment_batches (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_adj_batches_report_id ON plan_adjustment_batches (report_id);

CREATE INDEX IF NOT EXISTS idx_plan_adjustments_batch_id ON plan_adjustments (batch_id);
CREATE INDEX IF NOT EXISTS idx_plan_adjustments_status ON plan_adjustments (batch_id, status);
