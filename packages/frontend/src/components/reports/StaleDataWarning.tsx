import { AlertTriangle } from 'lucide-react';
import { useCollectionStatus } from '@/api/hooks/useCollectionStatus';

export function StaleDataWarning() {
  const { data } = useCollectionStatus();
  const staleProviders = data?.staleProviders ?? [];

  if (staleProviders.length === 0) return null;

  const names = staleProviders.map((s) => s.providerName).join(', ');

  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Data may be stale for: <strong>{names}</strong>. Last sync was over 24 hours ago. Reports
        will attempt to collect fresh data before generating.
      </span>
    </div>
  );
}
