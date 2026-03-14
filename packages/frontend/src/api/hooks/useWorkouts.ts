import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, WorkoutSession, ExerciseProgress } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function useWorkoutSessions() {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: QUERY_KEYS.workouts.sessions(startDate, endDate),
    queryFn: () =>
      apiFetch<ApiResponse<WorkoutSession[]>>(
        `/api/workouts?startDate=${startDate}&endDate=${endDate}`,
      ),
  });
}

export function useExerciseProgress(exerciseName: string | null) {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: [...QUERY_KEYS.workouts.progress(exerciseName ?? ''), startDate, endDate],
    queryFn: () =>
      apiFetch<ApiResponse<ExerciseProgress>>(
        `/api/workouts/progress/${encodeURIComponent(exerciseName!)}?startDate=${startDate}&endDate=${endDate}`,
      ),
    enabled: !!exerciseName,
  });
}
