import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { RefreshCw, Loader2 } from 'lucide-react';
import type { WeeklyReport } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLatestReport, useGenerateReport } from '@/api/hooks/useReports';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';

const priorityVariant: Record<'high' | 'medium' | 'low', 'destructive' | 'secondary' | 'outline'> =
  {
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  };

export function LatestReportPreview() {
  const { data, isLoading } = useLatestReport();
  const generateReport = useGenerateReport();
  const report: WeeklyReport | null | undefined = data;
  const hasReport = !!report;

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return <CardSkeleton />;

  return (
    <>
      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <p>No reports yet. Generate your first weekly insights.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating&hellip;
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate Latest Insights
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Latest AI Report — {format(parseISO(report.periodStart), 'MMM d')} to{' '}
                {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirmOpen(true)}
                disabled={generateReport.isPending}
                title="Re-Generate Latest Insights"
              >
                {generateReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{report.summary}</p>
            <div className="space-y-1">
              {report.actionItems.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={priorityVariant[item.priority]}
                    className="mt-0.5 shrink-0 text-xs"
                  >
                    {item.priority}
                  </Badge>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <GenerateReportDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        hasExistingReport={hasReport}
      />
    </>
  );
}
