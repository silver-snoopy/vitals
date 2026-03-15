import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGenerateReport } from '@/api/hooks/useReports';
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

export function GenerateReportDialog({
  open,
  onOpenChange,
  hasExistingReport,
  onError,
}: GenerateReportDialogProps) {
  const generateReport = useGenerateReport();
  const [userNotes, setUserNotes] = useState('');

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setUserNotes('');
  };

  const handleGenerate = () => {
    const notes = userNotes.trim();
    generateReport.mutate(notes ? { userNotes: notes } : undefined, {
      onSuccess: () => {
        toast.success('Report generated successfully');
        handleOpenChange(false);
      },
      onError: (err: unknown) => {
        if (onError) {
          onError(err);
        } else {
          toast.error('Failed to generate report.');
        }
        handleOpenChange(false);
      },
    });
  };

  const title = hasExistingReport ? 'Re-Generate Report?' : 'Generate Report';
  const description = hasExistingReport
    ? 'This will generate a new report for the last 7 days, replacing the most recent one.'
    : 'Generate a new report analyzing your health data from the last 7 days.';
  const confirmLabel = hasExistingReport ? 'Re-Generate' : 'Generate';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
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
  );
}
