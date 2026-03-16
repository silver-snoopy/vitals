import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, Database, Brain, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { ReportStatus, ReportStatusUpdate } from '@vitals/shared';
import { useGenerateReport, useInvalidateReports } from '@/api/hooks/useReports';
import { useReportWebSocket } from '@/api/hooks/useReportWebSocket';
import { useReportGenerationStore } from '@/store/useReportGenerationStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const NOTES_LABEL = 'Notes for AI (optional)';
export const NOTES_PLACEHOLDER =
  "Add any context for your report — goals you're tracking, injuries, diet changes, or anything the AI should consider when analyzing your data.";

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasExistingReport: boolean;
  /** Custom error handler. If not provided, shows a generic toast. */
  onError?: (err: unknown) => void;
}

const STATUS_STEPS: { key: ReportStatus; label: string; icon: typeof Clock }[] = [
  { key: 'pending', label: 'Request accepted', icon: Clock },
  { key: 'collecting_data', label: 'Collecting health data...', icon: Database },
  { key: 'generating', label: 'Generating AI insights...', icon: Brain },
];

const STATUS_ORDER: ReportStatus[] = ['pending', 'collecting_data', 'generating', 'completed'];

function getStepIndex(status: ReportStatus | null): number {
  if (!status) return -1;
  return STATUS_ORDER.indexOf(status);
}

export function GenerateReportDialog({
  open,
  onOpenChange,
  hasExistingReport,
  onError,
}: GenerateReportDialogProps) {
  const generateReport = useGenerateReport();
  const invalidateReports = useInvalidateReports();
  const [userNotes, setUserNotes] = useState('');

  const { pendingReportId, status, statusMessage, startGeneration, updateStatus, reset } =
    useReportGenerationStore();

  const isGenerating = pendingReportId !== null && status !== 'completed' && status !== 'failed';

  // WebSocket updates the store; store is the single source of truth
  const handleWsUpdate = useCallback(
    (update: ReportStatusUpdate) => {
      updateStatus(update.status, update.message);
    },
    [updateStatus],
  );

  useReportWebSocket(pendingReportId, handleWsUpdate);

  // React to terminal status changes (works for both WS and E2E store injection)
  const prevStatusRef = useRef<ReportStatus | null>(null);
  useEffect(() => {
    if (status === prevStatusRef.current) return;
    prevStatusRef.current = status;

    if (status === 'completed') {
      invalidateReports();
      toast.success('Report generated successfully');
      setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 800);
    }

    if (status === 'failed') {
      if (onError) {
        onError(new Error(statusMessage ?? 'Report generation failed'));
      } else {
        toast.error(statusMessage ?? 'Report generation failed.');
      }
    }
  }, [status, statusMessage, invalidateReports, onOpenChange, reset, onError]);

  const handleOpenChange = (nextOpen: boolean) => {
    // Prevent closing while generating
    if (!nextOpen && isGenerating) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setUserNotes('');
      if (status === 'failed') reset();
    }
  };

  const handleGenerate = () => {
    const notes = userNotes.trim();
    generateReport.mutate(notes ? { userNotes: notes } : undefined, {
      onSuccess: (response) => {
        const reportId = response.data.reportId;
        startGeneration(reportId);
      },
      onError: (err: unknown) => {
        if (onError) {
          onError(err);
        } else {
          toast.error('Failed to start report generation.');
        }
        handleOpenChange(false);
      },
    });
  };

  const handleRetry = () => {
    reset();
    handleGenerate();
  };

  const title = hasExistingReport ? 'Re-Generate Report?' : 'Generate Report';
  const description = hasExistingReport
    ? 'This will generate a new report for the last 7 days, replacing the most recent one.'
    : 'Generate a new report analyzing your health data from the last 7 days.';
  const confirmLabel = hasExistingReport ? 'Re-Generate' : 'Generate';

  const currentStepIndex = getStepIndex(status);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isGenerating
              ? 'Generating Report...'
              : status === 'failed'
                ? 'Generation Failed'
                : title}
          </DialogTitle>
          <DialogDescription>
            {isGenerating
              ? 'Your report is being generated. This usually takes 15-30 seconds.'
              : status === 'failed'
                ? (statusMessage ?? 'Something went wrong during report generation.')
                : description}
          </DialogDescription>
        </DialogHeader>

        {isGenerating || status === 'completed' ? (
          <div className="space-y-3 py-2">
            {STATUS_STEPS.map((step) => {
              const stepIndex = STATUS_ORDER.indexOf(step.key);
              const isActive = stepIndex === currentStepIndex;
              const isDone = stepIndex < currentStepIndex || status === 'completed';
              const Icon = step.icon;

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : isDone
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span>{step.label}</span>
                </div>
              );
            })}
            {status === 'completed' && (
              <div className="flex items-center gap-3 rounded-md bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Report ready!</span>
              </div>
            )}
          </div>
        ) : status === 'failed' ? (
          <div className="flex items-center gap-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            <span>{statusMessage ?? 'Generation failed'}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="user-notes" className="text-sm font-medium">
              {NOTES_LABEL}
            </label>
            <Textarea
              id="user-notes"
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder={NOTES_PLACEHOLDER}
              rows={4}
            />
          </div>
        )}

        <DialogFooter>
          {status === 'failed' ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  handleOpenChange(false);
                }}
              >
                Close
              </Button>
              <Button onClick={handleRetry}>Retry</Button>
            </>
          ) : isGenerating ? null : status === 'completed' ? null : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generateReport.isPending}>
                {generateReport.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting&hellip;
                  </>
                ) : (
                  confirmLabel
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
