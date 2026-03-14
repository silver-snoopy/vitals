import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, WeeklyReport } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { format, subDays } from 'date-fns';
import { apiFetch } from '../client';

export function useReports() {
  return useQuery({
    queryKey: QUERY_KEYS.reports.all,
    queryFn: () => apiFetch<ApiResponse<WeeklyReport[]>>('/api/reports'),
  });
}

export function useLatestReport() {
  return useQuery({
    queryKey: QUERY_KEYS.reports.latest,
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<WeeklyReport[]>>('/api/reports');
      return res.data[0] ?? null;
    },
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.byId(id),
    queryFn: () => apiFetch<ApiResponse<WeeklyReport>>(`/api/reports/${id}`),
    enabled: !!id,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const today = new Date();
      const startDate = format(subDays(today, 6), 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');

      return apiFetch<ApiResponse<WeeklyReport>>('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_X_API_KEY ?? '',
        },
        body: JSON.stringify({ startDate, endDate }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reports.all });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reports.latest });
    },
  });
}
