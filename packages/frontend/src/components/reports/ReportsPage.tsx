import { useReports } from '@/api/hooks/useReports';
import { ReportCard }  from './ReportCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

export function ReportsPage() {
  const { data, isLoading, error } = useReports();
  const reports = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      {error && <p className="text-sm text-destructive">Failed to load reports.</p>}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reports yet. Generate one via POST /api/reports/generate.
          </p>
        ) : (
          reports.map((r) => <ReportCard key={r.id} report={r} />)
        )}
      </div>
    </div>
  );
}
