import { BarChart3, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLatestReport } from '@/api/hooks/useReports';
import { useReportGenerationStore } from '@/store/useReportGenerationStore';

export function ReportAlertBar() {
  const { data: report, isLoading } = useLatestReport();
  const status = useReportGenerationStore((s) => s.status);

  if (isLoading) return null;

  const isGenerating =
    status === 'pending' || status === 'collecting_data' || status === 'generating';

  if (isGenerating) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Generating report…</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">No report yet</span>
        </div>
        <Link to="/reports" className="text-sm font-medium text-primary hover:underline">
          Generate →
        </Link>
      </div>
    );
  }

  const rawSummary = report.summary ?? '';
  const summary = rawSummary.length > 60 ? rawSummary.slice(0, 57) + '…' : rawSummary;
  const score = report.sections?.scorecard?.overall?.score;
  const actionCount = report.actionItems?.length ?? 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <BarChart3 className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-sm">&ldquo;{summary}&rdquo;</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {score != null && (
          <span className="text-xs font-medium text-muted-foreground">Score: {score}/10</span>
        )}
        {actionCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {actionCount} action item{actionCount !== 1 ? 's' : ''}
          </span>
        )}
        <Link to="/reports" className="text-sm font-medium text-primary hover:underline">
          View →
        </Link>
      </div>
    </div>
  );
}
