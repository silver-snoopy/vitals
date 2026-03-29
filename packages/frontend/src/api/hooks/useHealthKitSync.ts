import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  isHealthKitAvailable,
  requestHealthAuthorization,
  queryHealthData,
  HEALTH_TYPES,
} from '@/native/health';
import { apiFetch } from '@/api/client';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Automatically syncs HealthKit data when running in native iOS.
 * Syncs on mount, on app resume, and every 15 minutes while foregrounded.
 *
 * No-op on web — the manual XML upload flow remains available.
 * Returns { syncHealthData, isAvailable } where syncHealthData returns true on success.
 */
export function useHealthKitSync() {
  const queryClient = useQueryClient();
  const isSyncing = useRef(false);

  const syncHealthData = useCallback(async (): Promise<boolean> => {
    if (!isHealthKitAvailable() || isSyncing.current) return false;

    isSyncing.current = true;
    try {
      // Request authorization (idempotent — iOS only shows prompt once)
      const authorized = await requestHealthAuthorization(
        Object.values(HEALTH_TYPES) as Parameters<typeof requestHealthAuthorization>[0],
      );
      if (!authorized) return false;

      // Query last 7 days of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // Query all health types in parallel
      const queries = Object.values(HEALTH_TYPES).map((dataType) =>
        queryHealthData({ dataType, startDate, endDate }),
      );
      const results = await Promise.all(queries);

      // Flatten results
      const allData = results.flat();
      if (allData.length === 0) return false;

      // Send to backend
      await apiFetch('/api/health/native-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'healthkit',
          data: allData,
          syncedAt: new Date().toISOString(),
        }),
      });

      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      return true;
    } catch (error) {
      console.error('HealthKit sync failed:', error);
      toast.error('Health data sync failed. Will retry automatically.');
      return false;
    } finally {
      isSyncing.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!isHealthKitAvailable()) return;

    // Sync on mount
    syncHealthData();

    // Sync periodically
    const interval = setInterval(syncHealthData, SYNC_INTERVAL_MS);

    // Sync on app resume — guard against unmount-before-import race
    let appListener: { remove: () => void } | undefined;
    let cancelled = false;

    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) syncHealthData();
      }).then((listener) => {
        if (cancelled) {
          listener.remove();
        } else {
          appListener = listener;
        }
      });
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      appListener?.remove();
    };
  }, [syncHealthData]);

  return { syncHealthData, isAvailable: isHealthKitAvailable() };
}
