CREATE TABLE IF NOT EXISTS correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  factor_metric TEXT NOT NULL,
  factor_condition TEXT NOT NULL,
  factor_label TEXT NOT NULL,
  outcome_metric TEXT NOT NULL,
  outcome_effect TEXT NOT NULL,
  outcome_label TEXT NOT NULL,
  correlation_coefficient DOUBLE PRECISION NOT NULL,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'moderate', 'suggestive')),
  data_points INTEGER NOT NULL,
  p_value DOUBLE PRECISION,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_confirmed INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'weakening', 'disproven')),
  summary TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('nutrition', 'training', 'recovery', 'cross-domain')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, factor_metric, factor_condition, outcome_metric)
);

CREATE INDEX IF NOT EXISTS idx_correlations_user_status ON correlations (user_id, status);
CREATE INDEX IF NOT EXISTS idx_correlations_user_category ON correlations (user_id, category);
CREATE INDEX IF NOT EXISTS idx_correlations_user_factor ON correlations (user_id, factor_metric);
CREATE INDEX IF NOT EXISTS idx_correlations_user_outcome ON correlations (user_id, outcome_metric);

CREATE TABLE IF NOT EXISTS projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  metric TEXT NOT NULL,
  projection_date DATE NOT NULL,
  projected_value DOUBLE PRECISION NOT NULL,
  confidence_low DOUBLE PRECISION,
  confidence_high DOUBLE PRECISION,
  method TEXT NOT NULL CHECK (method IN ('linear_regression', 'rolling_average', 'exponential')),
  data_points INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric, projection_date)
);

CREATE INDEX IF NOT EXISTS idx_projections_user_metric ON projections (user_id, metric);
