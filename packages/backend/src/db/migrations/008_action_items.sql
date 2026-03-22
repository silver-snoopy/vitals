CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('nutrition', 'workout', 'recovery', 'general')),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'expired', 'deferred', 'superseded', 'rejected')),
  target_metric TEXT,
  target_direction TEXT CHECK (target_direction IN ('increase', 'decrease', 'maintain')),
  baseline_value DOUBLE PRECISION,
  outcome_value DOUBLE PRECISION,
  outcome_confidence TEXT CHECK (outcome_confidence IN ('high', 'medium', 'low')),
  outcome_measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_by DATE,
  completed_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_items_user_status ON action_items (user_id, status);
CREATE INDEX IF NOT EXISTS idx_action_items_report ON action_items (report_id);
CREATE INDEX IF NOT EXISTS idx_action_items_due ON action_items (user_id, due_by) WHERE status IN ('pending', 'active');
