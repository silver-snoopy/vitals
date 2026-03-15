import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WeeklyReport } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLatestReport, useGenerateReport } from '@/api/hooks/useReports';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [userNotes, setUserNotes] = useState('');

  const handleGenerate = () => {
    const notes = userNotes.trim();
    generateReport.mutate(notes ? { userNotes: notes } : undefined, {
      onSuccess: () => {
        toast.success('Report generated successfully');
        handleOpenChange(false);
      },
      onError: () => {
        toast.error('Failed to generate report. Check that the AI service is configured.');
        handleOpenChange(false);
      },
    });
  };

  const handleClick = () => {
    setConfirmOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setConfirmOpen(open);
    if (!open) setUserNotes('');
  };

  if (isLoading) return <CardSkeleton />;

  const dialogTitle = hasReport ? 'Re-Generate Report?' : 'Generate Report';
  const dialogDescription = hasReport
    ? 'This will generate a new report for the last 7 days, replacing the most recent one.'
    : 'Generate a new report analyzing your health data from the last 7 days.';
  const confirmLabel = hasReport ? 'Re-Generate' : 'Generate';

  return (
    <>
      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <p>No reports yet. Generate your first weekly insights.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClick}
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
                onClick={handleClick}
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

      <Dialog open={confirmOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="dashboard-user-notes" className="text-sm font-medium">
              Notes for AI (optional)
            </label>
            <Textarea
              id="dashboard-user-notes"
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Add any context for your report — goals you're tracking, injuries, diet changes, or anything the AI should consider when analyzing your data."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generateReport.isPending}>
              {generateReport.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating&hellip;
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
