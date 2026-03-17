-- Remove duplicate workout sets where exercise_name was incorrectly set to the workout title.
-- These rows were created before the exercise name fallback fix (PR #29) and coexist
-- alongside correct rows from re-collection, inflating volume calculations.
DELETE FROM workout_sets
WHERE source = 'hevy'
  AND exercise_name IN ('Legs', 'Push', 'Pull', 'Upper');
