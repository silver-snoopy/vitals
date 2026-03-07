import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, DailyNutritionSummary, WorkoutSession, BiometricReading } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export interface DashboardData {
  nutrition: DailyNutritionSummary[];
  workouts: WorkoutSession[];
  biometrics: BiometricReading[];
}

export function useDashboard() {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: QUERY_KEYS.dashboard.weekly(startDate, endDate),
    queryFn: () =>
      apiFetch<ApiResponse<DashboardData>>(
        `/api/dashboard/weekly?startDate=${startDate}&endDate=${endDate}`
      ),
  });
}
