import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, CollectionStatus } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function isProviderStale(s: CollectionStatus): boolean {
  if (!s.lastAttemptedFetch) return false; // never attempted — not a staleness issue
  if (!s.lastSuccessfulFetch) return true; // attempted but never succeeded
  return Date.now() - new Date(s.lastSuccessfulFetch).getTime() > STALE_THRESHOLD_MS;
}

export function useCollectionStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.collection.status,
    queryFn: () =>
      apiFetch<ApiResponse<CollectionStatus[]>>('/api/collect/status'),
    staleTime: STALE_THRESHOLD_MS, // 24 hours — matches the staleness threshold
    select: (res) => ({
      statuses: res.data,
      staleProviders: res.data.filter(isProviderStale),
    }),
  });
}
