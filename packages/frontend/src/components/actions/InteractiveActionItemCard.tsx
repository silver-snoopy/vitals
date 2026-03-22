import { format, parseISO } from 'date-fns';
import { Check, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import type { TrackedActionItem, ActionItemOutcome } from '@vitals/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUpdateActionItemStatus } from '@/api/hooks/useActionItems';
import { useActionItemsStore } from '@/store/useActionItemsStore';
import { priorityColor, priorityVariant } from '@/components/reports/report-utils';
import { cn } from '@/lib/utils';
import { OutcomeBadge } from './OutcomeBadge';

function deriveOutcome(item: TrackedActionItem): ActionItemOutcome {
  const baseline = item.baselineValue ?? 0;
  const outcome = item.outcomeValue ?? 0;
  const direction = item.targetDirection;

  if (baseline === 0) return 'stable';
  const changePct = ((outcome - baseline) / Math.abs(baseline)) * 100;

  if (direction === 'maintain') return Math.abs(changePct) < 5 ? 'improved' : 'declined';
  if (direction === 'increase')
    return changePct > 2 ? 'improved' : changePct < -2 ? 'declined' : 'stable';
  return changePct < -2 ? 'improved' : changePct > 2 ? 'declined' : 'stable';
}

interface Props {
  item: TrackedActionItem;
}

export function InteractiveActionItemCard({ item }: Props) {
  const { mutate: updateStatus, isPending } = useUpdateActionItemStatus();
  const { setOptimisticStatus, clearOptimisticStatus, getEffectiveStatus } = useActionItemsStore();

  const effectiveStatus = getEffectiveStatus(item);

  function handleTransition(newStatus: TrackedActionItem['status'], dueBy?: string) {
    setOptimisticStatus(item.id, newStatus);
    updateStatus(
      { id: item.id, status: newStatus, dueBy },
      {
        onError: () => {
          clearOptimisticStatus(item.id);
          toast.error('Failed to update action item');
        },
        onSuccess: () => {
          clearOptimisticStatus(item.id);
        },
      },
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-l-[3px] rounded-r-md bg-muted/30 px-3 py-2.5',
        priorityColor[item.priority],
        effectiveStatus === 'completed' && 'opacity-60',
      )}
      data-testid="action-item-card"
      data-status={effectiveStatus}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-0.5 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {item.category}
          </span>
          <p className="text-sm leading-relaxed line-clamp-2">{item.text}</p>
        </div>
        <Badge variant={priorityVariant[item.priority]} className="mt-0.5 shrink-0 text-[10px]">
          {item.priority}
        </Badge>
      </div>

      {/* Status footer */}
      {effectiveStatus === 'pending' && (
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => handleTransition('active')}
            data-testid="btn-accept"
          >
            <Check className="mr-1 h-3 w-3" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => handleTransition('deferred')}
            data-testid="btn-defer"
          >
            <Clock className="mr-1 h-3 w-3" />
            Defer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            disabled={isPending}
            onClick={() => handleTransition('rejected')}
            data-testid="btn-reject"
          >
            <X className="mr-1 h-3 w-3" />
            Reject
          </Button>
        </div>
      )}

      {effectiveStatus === 'active' && (
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => handleTransition('completed')}
            data-testid="btn-complete"
          >
            <Check className="mr-1 h-3 w-3" />
            Done
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => handleTransition('deferred')}
            data-testid="btn-defer"
          >
            <Clock className="mr-1 h-3 w-3" />
            Defer
          </Button>
        </div>
      )}

      {effectiveStatus === 'deferred' && (
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => handleTransition('active')}
            data-testid="btn-accept"
          >
            <Check className="mr-1 h-3 w-3" />
            Re-accept
          </Button>
        </div>
      )}

      {effectiveStatus === 'completed' && (
        <div className="flex items-center gap-2 flex-wrap">
          {item.completedAt && (
            <p className="text-[11px] text-muted-foreground">
              ✓ Completed {format(parseISO(item.completedAt), 'MMM d')}
            </p>
          )}
          {item.outcomeValue != null && item.baselineValue != null && item.targetDirection && (
            <OutcomeBadge outcome={deriveOutcome(item)} confidence={item.outcomeConfidence} />
          )}
        </div>
      )}
    </div>
  );
}
