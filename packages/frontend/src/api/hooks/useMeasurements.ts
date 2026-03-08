import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, BiometricReading } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function useMeasurements(metric: string) {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: [...QUERY_KEYS.measurements.byMetric(metric), startDate, endDate],
    queryFn: () =>
      apiFetch<ApiResponse<BiometricReading[]>>(
        `/api/measurements?metric=${metric}&startDate=${startDate}&endDate=${endDate}`,
      ),
  });
}
