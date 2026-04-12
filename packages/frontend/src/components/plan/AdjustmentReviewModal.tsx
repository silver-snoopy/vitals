import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Loader2, Pencil } from 'lucide-react';
import type {
  AdjustmentDecision,
  PlanAdjustmentBatch,
  PlanAdjustment,
  PlanSet,
  ChangeType,
} from '@vitals/shared';
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

function SetEditor({
  sets,
  onEditSet,
  onSetCount,
}: {
  sets: PlanSet[];
  onEditSet: (idx: number, field: string, value: number | [number, number]) => void;
  onSetCount: (count: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Sets:</span>
        <input
          type="number"
          min={1}
          max={10}
          value={sets.length}
          onChange={(e) => onSetCount(Math.max(1, Math.min(10, Number(e.target.value))))}
          className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
        />
      </div>
      {sets.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-8 text-muted-foreground">#{i + 1}</span>
          <label className="flex items-center gap-1">
            Reps:
            <input
              type="number"
              min={1}
              max={100}
              value={Array.isArray(s.targetReps) ? s.targetReps[0] : s.targetReps}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Array.isArray(s.targetReps)) {
                  onEditSet(i, 'targetReps', [v, s.targetReps[1]]);
                } else {
                  onEditSet(i, 'targetReps', v);
                }
              }}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-foreground"
            />
            {Array.isArray(s.targetReps) && (
              <>
                –
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={s.targetReps[1]}
                  onChange={(e) =>
                    onEditSet(i, 'targetReps', [
                      (s.targetReps as [number, number])[0],
                      Number(e.target.value),
                    ])
                  }
                  className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-foreground"
                />
              </>
            )}
          </label>
          {s.targetWeightKg !== undefined && (
            <label className="flex items-center gap-1">
              kg:
              <input
                type="number"
                min={0}
                max={500}
                step={2.5}
                value={s.targetWeightKg}
                onChange={(e) => onEditSet(i, 'targetWeightKg', Number(e.target.value))}
                className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-foreground"
              />
            </label>
          )}
          {s.targetRpe !== undefined && (
            <label className="flex items-center gap-1">
              RPE:
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={s.targetRpe}
                onChange={(e) => onEditSet(i, 'targetRpe', Number(e.target.value))}
                className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-foreground"
              />
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

interface AdjustmentRowProps {
  adjustment: PlanAdjustment;
  decision: AdjustmentDecision;
  onDecide: (id: string, status: 'accepted' | 'rejected') => void;
  editingId: string | null;
  editSets: PlanSet[];
  onStartEdit: (adjId: string, currentNewValue: unknown) => void;
  onCancelEdit: () => void;
  onConfirmEdit: (adjId: string) => void;
  onEditSet: (setIndex: number, field: string, value: number | [number, number]) => void;
  onSetCount: (count: number) => void;
}

function AdjustmentRow({
  adjustment,
  decision,
  onDecide,
  editingId,
  editSets,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  onEditSet,
  onSetCount,
}: AdjustmentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isEditing = editingId === adjustment.id;

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
            variant={decision.status === 'accepted' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDecide(adjustment.id, 'accepted')}
            data-testid={`accept-${adjustment.id}`}
          >
            Accept
          </Button>
          <Button
            variant={decision.status === 'rejected' ? 'destructive' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDecide(adjustment.id, 'rejected')}
            data-testid={`reject-${adjustment.id}`}
          >
            Reject
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
        <span className="line-through">{formatValue(adjustment.oldValue)}</span>
        <span>→</span>
        {isEditing ? (
          <div className="flex-1 space-y-2">
            <SetEditor sets={editSets} onEditSet={onEditSet} onSetCount={onSetCount} />
            <div className="flex gap-1">
              <button
                onClick={() => onConfirmEdit(adjustment.id)}
                className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-500"
              >
                Apply
              </button>
              <button
                onClick={onCancelEdit}
                className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <span className="flex items-center gap-1 text-foreground font-medium">
            {decision.overrideValue
              ? formatSets(decision.overrideValue as Record<string, unknown>[])
              : formatValue(adjustment.newValue)}
            {decision.overrideValue ? (
              <span className="rounded bg-blue-500/20 px-1 py-0.5 text-[10px] text-blue-400">
                modified
              </span>
            ) : null}
            {decision.status === 'accepted' && adjustment.changeType !== 'hold' && (
              <button
                onClick={() =>
                  onStartEdit(adjustment.id, decision.overrideValue ?? adjustment.newValue)
                }
                className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Modify values"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </span>
        )}
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
 * Grouped by day, per-row accept/reject/modify, batch commit.
 */
export function AdjustmentReviewModal({ batch, open, onClose }: AdjustmentReviewModalProps) {
  const initDecisions = (): Record<string, AdjustmentDecision> => {
    const d: Record<string, AdjustmentDecision> = {};
    for (const adj of batch.adjustments) d[adj.id] = { status: 'accepted' };
    return d;
  };
  const [decisions, setDecisions] = useState<Record<string, AdjustmentDecision>>(initDecisions);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState<PlanSet[]>([]);

  const decide = useDecideAdjustments(batch.id);

  const handleDecide = useCallback((id: string, status: 'accepted' | 'rejected') => {
    setDecisions((prev) => ({
      ...prev,
      [id]: { ...prev[id], status },
    }));
  }, []);

  const handleAcceptAll = () => {
    const next: Record<string, AdjustmentDecision> = {};
    for (const adj of batch.adjustments) {
      next[adj.id] = decisions[adj.id]?.overrideValue
        ? { status: 'accepted', overrideValue: decisions[adj.id].overrideValue }
        : { status: 'accepted' };
    }
    setDecisions(next);
  };

  const handleRejectAll = () => {
    const next: Record<string, AdjustmentDecision> = {};
    for (const adj of batch.adjustments) next[adj.id] = { status: 'rejected' };
    setDecisions(next);
  };

  const handleStartEdit = (adjId: string, currentNewValue: unknown) => {
    setEditingId(adjId);
    setEditSets(
      Array.isArray(currentNewValue) ? (currentNewValue as PlanSet[]).map((s) => ({ ...s })) : [],
    );
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditSets([]);
  };

  const handleConfirmEdit = (adjId: string) => {
    setDecisions((prev) => ({
      ...prev,
      [adjId]: { status: 'accepted', overrideValue: editSets },
    }));
    setEditingId(null);
    setEditSets([]);
  };

  const handleEditSet = (setIndex: number, field: string, value: number | [number, number]) => {
    setEditSets((prev) => {
      const next = [...prev];
      next[setIndex] = { ...next[setIndex], [field]: value };
      return next;
    });
  };

  const handleSetCount = (count: number) => {
    setEditSets((prev) => {
      if (count > prev.length) {
        const template = prev[prev.length - 1] ?? { type: 'normal' as const, targetReps: 10 };
        return [
          ...prev,
          ...Array(count - prev.length)
            .fill(null)
            .map(() => ({ ...template })),
        ];
      }
      return prev.slice(0, count);
    });
  };

  const acceptedCount = Object.values(decisions).filter((d) => d.status === 'accepted').length;

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
                    decision={decisions[adj.id] ?? { status: 'accepted' }}
                    onDecide={handleDecide}
                    editingId={editingId}
                    editSets={editSets}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onConfirmEdit={handleConfirmEdit}
                    onEditSet={handleEditSet}
                    onSetCount={handleSetCount}
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
