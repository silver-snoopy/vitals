import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import type { ApiError } from '@vitals/shared';
import { toast } from 'sonner';
import { useReports, useGenerateReport } from '@/api/hooks/useReports';
import { ReportCard } from './ReportCard';
import { GenerateReportDialog } from './GenerateReportDialog';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Button } from '@/components/ui/button';

export function ReportsPage() {
  const { data, isLoading, error } = useReports();
  const generateReport = useGenerateReport();
  const reports = data?.data ?? [];
  const hasReports = reports.length > 0;

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
          disabled={generateReport.isPending}
          title={hasReports ? 'Re-Generate Latest Insights' : 'Generate Latest Insights'}
        >
          {generateReport.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Failed to load reports.</p>}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No reports yet. Click the button above to generate your first weekly insights.
            </p>
            {generateReport.isPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating report&hellip; this may take a moment.
              </p>
            )}
          </div>
        ) : (
          reports.map((r) => <ReportCard key={r.id} report={r} />)
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
