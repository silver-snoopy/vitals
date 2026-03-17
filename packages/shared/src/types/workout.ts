export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseName: string;
  exerciseType: string | null;
  setIndex: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  volumeKg: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  date: string;
  title: string;
  durationSeconds: number;
  sets: WorkoutSet[];
  source: string;
  collectedAt: string;
}

/**
 * Calculate total volume for a session using pre-calculated volumeKg per set.
 * Falls back to weight_kg * reps if volumeKg is not available (legacy data).
 */
export function calcSessionVolume(
  sets: Pick<WorkoutSet, 'volumeKg' | 'weightKg' | 'reps'>[],
): number {
  return sets.reduce((sum, s) => {
    if (s.volumeKg != null) return sum + s.volumeKg;
    return sum + (s.weightKg ?? 0) * (s.reps ?? 0);
  }, 0);
}

export interface ExerciseProgress {
  exerciseName: string;
  dataPoints: {
    date: string;
    maxWeight: number;
    totalVolume: number;
    totalSets: number;
  }[];
}
