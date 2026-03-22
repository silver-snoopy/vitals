import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiResponse,
  TrackedActionItem,
  ActionItemStatus,
  AttributionSummary,
} from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';

export interface ActionItemFilters {
  status?: ActionItemStatus | ActionItemStatus[];
  category?: string;
  reportId?: string;
  limit?: number;
}

function buildQueryString(filters: ActionItemFilters): string {
  const params = new URLSearchParams();
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    params.set('status', statuses.join(','));
  }
  if (filters.category) params.set('category', filters.category);
  if (filters.reportId) params.set('reportId', filters.reportId);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface ActionItemSummary {
  pending: number;
  active: number;
  completed: number;
  deferred: number;
  expired: number;
  total: number;
}

export function useActionItems(filters: ActionItemFilters = {}) {
  const filterRecord: Record<string, string> = {};
  if (filters.status) {
    filterRecord.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
  }
  if (filters.category) filterRecord.category = filters.category;
  if (filters.reportId) filterRecord.reportId = filters.reportId;
  if (filters.limit != null) filterRecord.limit = String(filters.limit);

  return useQuery({
    queryKey: QUERY_KEYS.actionItems.list(filterRecord),
    queryFn: () =>
      apiFetch<ApiResponse<TrackedActionItem[]>>(`/api/action-items${buildQueryString(filters)}`),
  });
}

export function useActionItemSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.actionItems.summary,
    queryFn: () => apiFetch<ApiResponse<ActionItemSummary>>('/api/action-items/summary'),
  });
}

export function useUpdateActionItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, dueBy }: { id: string; status: ActionItemStatus; dueBy?: string }) =>
      apiFetch<ApiResponse<TrackedActionItem>>(`/api/action-items/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, dueBy }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.actionItems.all });
    },
  });
}

export function useAttributionSummary(period: 'week' | 'month' | 'quarter' = 'month') {
  return useQuery({
    queryKey: QUERY_KEYS.actionItems.attribution(period),
    queryFn: () =>
      apiFetch<ApiResponse<AttributionSummary>>(`/api/action-items/attribution?period=${period}`),
  });
}

export function useInvalidateActionItems() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.actionItems.all });
  };
}
