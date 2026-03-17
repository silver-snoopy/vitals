-- Add workout title, exercise type, and pre-calculated volume columns to workout_sets.
-- title: the workout title from the source (e.g., "Upper", "Push", "Legs")
-- exercise_type: the exercise type from the source (e.g., "weight_reps", "weighted_bodyweight")
-- volume_kg: pre-calculated volume for the set (weight_kg + bodyweight for weighted_bodyweight) * reps
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS exercise_type TEXT;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS volume_kg DOUBLE PRECISION;
