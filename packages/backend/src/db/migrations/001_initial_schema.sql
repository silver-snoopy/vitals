-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Provider collection state per user
CREATE TABLE IF NOT EXISTS collection_metadata (
  user_id       UUID NOT NULL,
  provider_name TEXT NOT NULL,
  last_successful_fetch TIMESTAMPTZ,
  last_attempted_fetch  TIMESTAMPTZ,
  record_count  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'idle',
  error_message TEXT,
  PRIMARY KEY (user_id, provider_name)
);

-- EAV measurements (nutrition macros, biometrics)
CREATE TABLE IF NOT EXISTS measurements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,
  source        TEXT NOT NULL,
  category      TEXT NOT NULL,
  metric        TEXT NOT NULL,
  value         NUMERIC NOT NULL,
  unit          TEXT NOT NULL,
  measured_at   TIMESTAMPTZ NOT NULL,
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_measurements_user_metric
  ON measurements (user_id, metric, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_user_category
  ON measurements (user_id, category, measured_at DESC);

-- Unique constraint for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_upsert
  ON measurements (user_id, source, metric, measured_at);

-- Workout sets
CREATE TABLE IF NOT EXISTS workout_sets (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL,
  source           TEXT NOT NULL,
  exercise_name    TEXT NOT NULL,
  set_index        INTEGER NOT NULL,
  weight_kg        NUMERIC,
  reps             INTEGER,
  duration_seconds NUMERIC,
  distance_meters  NUMERIC,
  rpe              NUMERIC,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  collected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags             JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_user_exercise
  ON workout_sets (user_id, exercise_name, started_at DESC);

-- Unique constraint for idempotent upserts (COALESCE handles NULL started_at)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sets_upsert
  ON workout_sets (user_id, source, exercise_name, set_index, COALESCE(started_at, '1970-01-01'::timestamptz));

-- Weekly AI reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  summary       TEXT NOT NULL,
  insights      JSONB DEFAULT '[]'::jsonb,
  action_items  JSONB DEFAULT '[]'::jsonb,
  data_coverage JSONB DEFAULT '{}'::jsonb,
  ai_provider   TEXT NOT NULL,
  ai_model      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_period
  ON weekly_reports (user_id, period_start DESC);

-- AI generation audit trail
CREATE TABLE IF NOT EXISTS ai_generations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  purpose           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apple Health import tracking
CREATE TABLE IF NOT EXISTS apple_health_imports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,
  filename      TEXT NOT NULL,
  file_size     BIGINT,
  record_count  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- Materialized view for daily aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_aggregates AS
SELECT
  user_id,
  metric,
  unit,
  DATE(measured_at) AS day,
  AVG(value)   AS avg_value,
  MIN(value)   AS min_value,
  MAX(value)   AS max_value,
  SUM(value)   AS sum_value,
  COUNT(*)     AS sample_count
FROM measurements
GROUP BY user_id, metric, unit, DATE(measured_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_agg_unique
  ON daily_aggregates (user_id, metric, day);
