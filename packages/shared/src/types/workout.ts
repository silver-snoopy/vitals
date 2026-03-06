export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseName: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
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

export interface ExerciseProgress {
  exerciseName: string;
  dataPoints: {
    date: string;
    maxWeight: number;
    totalVolume: number;
    totalSets: number;
  }[];
}
