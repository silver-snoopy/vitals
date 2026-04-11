import type { SfrTier } from '@vitals/shared';

/** Static per-exercise metadata used by the rules engine and swap candidates. */
export interface ExerciseMeta {
  primaryMuscle: string;
  secondaryMuscles: string[];
  /** Movement pattern: push | pull | hinge | squat | carry | isolation | other */
  pattern: string;
  /** Primary equipment required */
  equipment: string;
  sfrTier: SfrTier;
}

/**
 * Curated static metadata table for ~50 common exercises covering all major
 * muscle groups and common commercial/home gym equipment.
 * Keys are lowercase exercise names (matched case-insensitively at runtime).
 */
export const EXERCISE_METADATA: Record<string, ExerciseMeta> = {
  // ── CHEST (push) ──────────────────────────────────────────────────────────
  'bench press': {
    primaryMuscle: 'chest',
    secondaryMuscles: ['front deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'barbell bench press': {
    primaryMuscle: 'chest',
    secondaryMuscles: ['front deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'incline bench press': {
    primaryMuscle: 'upper chest',
    secondaryMuscles: ['front deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'dumbbell bench press': {
    primaryMuscle: 'chest',
    secondaryMuscles: ['front deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'incline dumbbell press': {
    primaryMuscle: 'upper chest',
    secondaryMuscles: ['front deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'dumbbell fly': {
    primaryMuscle: 'chest',
    secondaryMuscles: ['front deltoid'],
    pattern: 'isolation',
    equipment: 'dumbbell',
    sfrTier: 'B',
  },
  'cable fly': {
    primaryMuscle: 'chest',
    secondaryMuscles: ['front deltoid'],
    pattern: 'isolation',
    equipment: 'cable',
    sfrTier: 'A',
  },
  'chest press machine': {
    primaryMuscle: 'chest',
    secondaryMuscles: ['front deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'machine',
    sfrTier: 'B',
  },
  // ── SHOULDERS (push) ──────────────────────────────────────────────────────
  'overhead press': {
    primaryMuscle: 'front deltoid',
    secondaryMuscles: ['lateral deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  ohp: {
    primaryMuscle: 'front deltoid',
    secondaryMuscles: ['lateral deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'barbell overhead press': {
    primaryMuscle: 'front deltoid',
    secondaryMuscles: ['lateral deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'dumbbell overhead press': {
    primaryMuscle: 'front deltoid',
    secondaryMuscles: ['lateral deltoid', 'triceps'],
    pattern: 'push',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'lateral raise': {
    primaryMuscle: 'lateral deltoid',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'cable lateral raise': {
    primaryMuscle: 'lateral deltoid',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'cable',
    sfrTier: 'S',
  },
  'face pull': {
    primaryMuscle: 'rear deltoid',
    secondaryMuscles: ['rotator cuff'],
    pattern: 'pull',
    equipment: 'cable',
    sfrTier: 'A',
  },
  'reverse fly': {
    primaryMuscle: 'rear deltoid',
    secondaryMuscles: ['upper back'],
    pattern: 'isolation',
    equipment: 'dumbbell',
    sfrTier: 'B',
  },
  // ── BACK (pull) ───────────────────────────────────────────────────────────
  'pull up': {
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps', 'rear deltoid'],
    pattern: 'pull',
    equipment: 'bodyweight',
    sfrTier: 'S',
  },
  'pull-up': {
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps', 'rear deltoid'],
    pattern: 'pull',
    equipment: 'bodyweight',
    sfrTier: 'S',
  },
  'chin up': {
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps'],
    pattern: 'pull',
    equipment: 'bodyweight',
    sfrTier: 'S',
  },
  'chin-up': {
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps'],
    pattern: 'pull',
    equipment: 'bodyweight',
    sfrTier: 'S',
  },
  'lat pulldown': {
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps', 'rear deltoid'],
    pattern: 'pull',
    equipment: 'cable',
    sfrTier: 'A',
  },
  'barbell row': {
    primaryMuscle: 'upper back',
    secondaryMuscles: ['lats', 'biceps', 'rear deltoid'],
    pattern: 'pull',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'bent over row': {
    primaryMuscle: 'upper back',
    secondaryMuscles: ['lats', 'biceps', 'rear deltoid'],
    pattern: 'pull',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'dumbbell row': {
    primaryMuscle: 'upper back',
    secondaryMuscles: ['lats', 'biceps'],
    pattern: 'pull',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'cable row': {
    primaryMuscle: 'upper back',
    secondaryMuscles: ['lats', 'biceps'],
    pattern: 'pull',
    equipment: 'cable',
    sfrTier: 'A',
  },
  'seated cable row': {
    primaryMuscle: 'upper back',
    secondaryMuscles: ['lats', 'biceps'],
    pattern: 'pull',
    equipment: 'cable',
    sfrTier: 'A',
  },
  // ── BICEPS (isolation) ────────────────────────────────────────────────────
  'bicep curl': {
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'barbell curl': {
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'dumbbell curl': {
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'cable curl': {
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'cable',
    sfrTier: 'S',
  },
  'hammer curl': {
    primaryMuscle: 'biceps',
    secondaryMuscles: ['brachialis'],
    pattern: 'isolation',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  // ── TRICEPS (isolation / push) ────────────────────────────────────────────
  'tricep pushdown': {
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'cable',
    sfrTier: 'A',
  },
  'cable pushdown': {
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'cable',
    sfrTier: 'A',
  },
  'skull crusher': {
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'overhead tricep extension': {
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  'close grip bench press': {
    primaryMuscle: 'triceps',
    secondaryMuscles: ['chest', 'front deltoid'],
    pattern: 'push',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  // ── QUADS / LEGS (squat) ──────────────────────────────────────────────────
  'barbell squat': {
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    pattern: 'squat',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'back squat': {
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    pattern: 'squat',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'front squat': {
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'core'],
    pattern: 'squat',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'hack squat': {
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    pattern: 'squat',
    equipment: 'machine',
    sfrTier: 'A',
  },
  'leg press': {
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    pattern: 'squat',
    equipment: 'machine',
    sfrTier: 'B',
  },
  'leg extension': {
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'machine',
    sfrTier: 'A',
  },
  'bulgarian split squat': {
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    pattern: 'squat',
    equipment: 'dumbbell',
    sfrTier: 'S',
  },
  'goblet squat': {
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'core'],
    pattern: 'squat',
    equipment: 'dumbbell',
    sfrTier: 'A',
  },
  // ── HAMSTRINGS / GLUTES (hinge) ───────────────────────────────────────────
  deadlift: {
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower back', 'quads', 'core'],
    pattern: 'hinge',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'conventional deadlift': {
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower back', 'quads', 'core'],
    pattern: 'hinge',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'sumo deadlift': {
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings', 'lower back', 'quads'],
    pattern: 'hinge',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'romanian deadlift': {
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower back'],
    pattern: 'hinge',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  rdl: {
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower back'],
    pattern: 'hinge',
    equipment: 'barbell',
    sfrTier: 'S',
  },
  'leg curl': {
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'machine',
    sfrTier: 'A',
  },
  'lying leg curl': {
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'machine',
    sfrTier: 'A',
  },
  'hip thrust': {
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    pattern: 'hinge',
    equipment: 'barbell',
    sfrTier: 'A',
  },
  'glute bridge': {
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    pattern: 'hinge',
    equipment: 'bodyweight',
    sfrTier: 'B',
  },
  // ── CALVES ────────────────────────────────────────────────────────────────
  'calf raise': {
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'machine',
    sfrTier: 'B',
  },
  'standing calf raise': {
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'machine',
    sfrTier: 'B',
  },
  'seated calf raise': {
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'machine',
    sfrTier: 'B',
  },
  // ── CORE ──────────────────────────────────────────────────────────────────
  plank: {
    primaryMuscle: 'core',
    secondaryMuscles: [],
    pattern: 'carry',
    equipment: 'bodyweight',
    sfrTier: 'B',
  },
  'ab rollout': {
    primaryMuscle: 'core',
    secondaryMuscles: ['lats'],
    pattern: 'isolation',
    equipment: 'other',
    sfrTier: 'A',
  },
  'cable crunch': {
    primaryMuscle: 'core',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: 'cable',
    sfrTier: 'A',
  },
};

/**
 * Returns metadata for an exercise by name (case-insensitive lookup).
 * Falls back to a generic unknown entry if the exercise is not in the table.
 */
export function getExerciseMeta(exerciseName: string): ExerciseMeta {
  const key = exerciseName.toLowerCase().trim();
  return (
    EXERCISE_METADATA[key] ?? {
      primaryMuscle: 'unknown',
      secondaryMuscles: [],
      pattern: 'other',
      equipment: 'unknown',
      sfrTier: 'B',
    }
  );
}
