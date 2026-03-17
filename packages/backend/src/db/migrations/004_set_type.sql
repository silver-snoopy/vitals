-- Add set_type column to workout_sets for distinguishing warmup/normal/dropset/failure sets
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS set_type TEXT NOT NULL DEFAULT 'normal';
