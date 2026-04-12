import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { PlanAdjustmentBatch, PlanAdjustment, ChangeType } from '@vitals/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDecideAdjustments } from '@/api/hooks/useWorkoutPlan';

interface AdjustmentReviewModalProps {
  batch: PlanAdjustmentBatch;
  open: boolean;
  onClose: () => void;
}

type Decision = 'accepted' | 'rejected';

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  hold: 'Hold',
  progress_load: 'Progress load',
  progress_reps: 'Progress reps',
  deload: 'Deload',
  swap: 'Swap',
  remove: 'Remove',
  add: 'Add',
};

const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  hold: 'bg-muted text-muted-foreground',
  progress_load: 'bg-green-500/15 text-green-700 dark:text-green-400',
  progress_reps: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  deload: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  swap: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  remove: 'bg-destructive/15 text-destructive',
  add: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

function formatSets(sets: Record<string, unknown>[]): string {
  const s = sets[0];
  const reps = Array.isArray(s['targetReps'])
    ? `${s['targetReps'][0]}–${s['targetReps'][1]}`
    : String(s['targetReps'] ?? '?');
  const load = s['targetWeightKg'] !== undefined ? `${s['targetWeightKg']} kg` : 'BW';
  return `${sets.length}×${reps} @ ${load}`;
}

function formatValue(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value ?? '—');
  // PlanSet[] — direct array from tuner oldValue/newValue
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
    return formatSets(value as Record<string, unknown>[]);
  }
  // Legacy { sets: [...] } wrapper (defensive)
  const v = value as Record<string, unknown>;
  if (Array.isArray(v['sets']) && v['sets'].length > 0) {
    return formatSets(v['sets'] as Record<string, unknown>[]);
  }
  return JSON.stringify(value);
}

function ConfidenceDots({ score }: { score: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`Confidence: ${score} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-2 w-2 rounded-full ${i < score ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
    </span>
  );
}

interface AdjustmentRowProps {
  adjustment: PlanAdjustment;
  decision: Decision;
  onDecide: (id: string, d: Decision) => void;
}

function AdjustmentRow({ adjustment, decision, onDecide }: AdjustmentRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            Exercise {adjustment.exerciseRef.exerciseOrder}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              CHANGE_TYPE_COLORS[adjustment.changeType]
            }`}
          >
            {CHANGE_TYPE_LABELS[adjustment.changeType]}
          </span>
          <ConfidenceDots score={adjustment.confidence} />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={decision === 'accepted' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDecide(adjustment.id, 'accepted')}
            data-testid={`accept-${adjustment.id}`}
          >
            Accept
          </Button>
          <Button
            variant={decision === 'rejected' ? 'destructive' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDecide(adjustment.id, 'rejected')}
            data-testid={`reject-${adjustment.id}`}
          >
            Reject
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="line-through">{formatValue(adjustment.oldValue)}</span>
        {' → '}
        <span className="text-foreground font-medium">{formatValue(adjustment.newValue)}</span>
      </p>

      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Rationale &amp; evidence
      </button>

      {expanded && (
        <div className="space-y-2 text-sm border-t pt-2">
          <p className="text-muted-foreground">{adjustment.rationale}</p>
          {adjustment.evidence.length > 0 && (
            <ul className="space-y-1">
              {adjustment.evidence.map((ev, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {ev.kind}
                  </Badge>
                  <span className="text-muted-foreground">{ev.excerpt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Modal for reviewing AI-proposed plan adjustments.
 * Grouped by day, per-row accept/reject, batch commit.
 */
export function AdjustmentReviewModal({ batch, open, onClose }: AdjustmentReviewModalProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => {
    const initial: Record<string, Decision> = {};
    for (const adj of batch.adjustments) {
      initial[adj.id] = 'accepted';
    }
    return initial;
  });
  const [commitError, setCommitError] = useState<string | null>(null);

  const decide = useDecideAdjustments(batch.id);

  const handleDecide = useCallback((id: string, d: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: d }));
  }, []);

  const handleAcceptAll = () => {
    const next: Record<string, Decision> = {};
    for (const adj of batch.adjustments) next[adj.id] = 'accepted';
    setDecisions(next);
  };

  const handleRejectAll = () => {
    const next: Record<string, Decision> = {};
    for (const adj of batch.adjustments) next[adj.id] = 'rejected';
    setDecisions(next);
  };

  const acceptedCount = Object.values(decisions).filter((d) => d === 'accepted').length;

  const handleCommit = () => {
    setCommitError(null);
    decide.mutate(
      { decisions },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { message?: string })?.message ?? 'Failed to apply changes. Please try again.';
          setCommitError(msg);
        },
      },
    );
  };

  // Group adjustments by dayIndex
  const byDay = batch.adjustments.reduce<Record<number, PlanAdjustment[]>>((acc, adj) => {
    const day = adj.exerciseRef.dayIndex;
    if (!acc[day]) acc[day] = [];
    acc[day].push(adj);
    return acc;
  }, {});

  const dayIndexes = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b);

  const totalChanges = batch.adjustments.length;
  const dayCount = dayIndexes.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !decide.isPending) onClose();
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        showCloseButton={!decide.isPending}
      >
        <DialogHeader>
          <DialogTitle>Review plan adjustments for next week</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {totalChanges} change{totalChanges !== 1 ? 's' : ''} across {dayCount} day
            {dayCount !== 1 ? 's' : ''} — review and accept.
          </p>
        </DialogHeader>

        {/* Triage row */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleAcceptAll}>
            Accept all
          </Button>
          <Button variant="outline" size="sm" onClick={handleRejectAll}>
            Reject all
          </Button>
        </div>

        {/* Overall rationale */}
        {batch.rationale && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            {batch.rationale}
          </p>
        )}

        {/* Day-grouped diff list */}
        <div className="space-y-4">
          {dayIndexes.map((dayIndex) => (
            <div key={dayIndex}>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Day {dayIndex + 1}
              </h3>
              <div className="space-y-2">
                {byDay[dayIndex].map((adj) => (
                  <AdjustmentRow
                    key={adj.id}
                    adjustment={adj}
                    decision={decisions[adj.id] ?? 'accepted'}
                    onDecide={handleDecide}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {commitError && (
          <p className="text-sm text-destructive" role="alert">
            {commitError}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={decide.isPending}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={decide.isPending}>
            {decide.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              `Commit changes (${acceptedCount} accepted)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
