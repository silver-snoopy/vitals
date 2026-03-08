import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, DailyNutritionSummary } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function useNutritionDaily() {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: QUERY_KEYS.nutrition.daily(startDate, endDate),
    queryFn: () =>
      apiFetch<ApiResponse<DailyNutritionSummary[]>>(
        `/api/nutrition/daily?startDate=${startDate}&endDate=${endDate}`,
      ),
  });
}
