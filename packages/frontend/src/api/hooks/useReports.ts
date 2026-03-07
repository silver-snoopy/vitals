import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, WeeklyReport } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
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
