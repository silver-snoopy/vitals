import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, WeeklyReport, GenerateReportResponse } from '@vitals/shared';
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

export function useGenerateReport() {
  return useMutation({
    mutationFn: (params?: { userNotes?: string }) => {
      const payload: { userNotes?: string } = {};
      const trimmedUserNotes = params?.userNotes?.trim();
      if (trimmedUserNotes) {
        payload.userNotes = trimmedUserNotes;
      }

      return apiFetch<ApiResponse<GenerateReportResponse>>('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    // No onSuccess invalidation — handled by WebSocket 'completed' event
  });
}

export function useInvalidateReports() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reports.all });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reports.latest });
    // Report generation collects fresh data — refresh all dashboard queries
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['nutrition'] });
    queryClient.invalidateQueries({ queryKey: ['workouts'] });
    queryClient.invalidateQueries({ queryKey: ['measurements'] });
  };
}
