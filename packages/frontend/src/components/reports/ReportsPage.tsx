import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import type { ApiError } from '@vitals/shared';
import { toast } from 'sonner';
import { useReports } from '@/api/hooks/useReports';
import { useReportGenerationStore } from '@/store/useReportGenerationStore';
import { ReportCard } from './ReportCard';
import { GenerateReportDialog } from './GenerateReportDialog';
import { StaleDataWarning } from './StaleDataWarning';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Button } from '@/components/ui/button';

export function ReportsPage() {
  const { data, isLoading, error } = useReports();
  const reports = data?.data ?? [];
  const hasReports = reports.length > 0;

  const { pendingReportId, status } = useReportGenerationStore();
  const isGenerating = pendingReportId !== null && status !== 'completed' && status !== 'failed';

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleError = (err: unknown) => {
    const status = (err as Partial<ApiError>)?.statusCode;
    if (status === 429) {
      toast.error('AI service is rate limited. Please try again in a few minutes.');
    } else if (status === 502) {
      toast.error('AI service is temporarily unavailable. Please try again later.');
    } else if (status === 503) {
      toast.error('AI service is not configured. Set AI_API_KEY and AI_PROVIDER.');
    } else {
      toast.error('Failed to generate report.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirmOpen(true)}
          disabled={isGenerating}
          title={hasReports ? 'Re-Generate Latest Insights' : 'Generate Latest Insights'}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <StaleDataWarning />

      {error && <p className="text-sm text-destructive">Failed to load reports.</p>}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : reports.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No reports yet. Click the button above to generate your first weekly insights.
            </p>
          </div>
        ) : (
          <>
            {isGenerating && <CardSkeleton />}
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </>
        )}
      </div>

      <GenerateReportDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        hasExistingReport={hasReports}
        onError={handleError}
      />
    </div>
  );
}
