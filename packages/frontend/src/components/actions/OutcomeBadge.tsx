import type { ActionItemOutcome } from '@vitals/shared';
import { cn } from '@/lib/utils';

interface Props {
  outcome: ActionItemOutcome;
  confidence?: 'high' | 'medium' | 'low';
  className?: string;
}

const outcomeConfig: Record<ActionItemOutcome, { label: string; color: string; icon: string }> = {
  improved: {
    label: 'Improved',
    color: 'text-emerald-500 bg-emerald-500/10',
    icon: '↑',
  },
  stable: {
    label: 'Stable',
    color: 'text-amber-500 bg-amber-500/10',
    icon: '—',
  },
  declined: {
    label: 'Declined',
    color: 'text-red-500 bg-red-500/10',
    icon: '↓',
  },
};

export function OutcomeBadge({ outcome, confidence, className }: Props) {
  const config = outcomeConfig[outcome];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        config.color,
        className,
      )}
      data-testid="outcome-badge"
      data-outcome={outcome}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {confidence && <span className="opacity-60">({confidence})</span>}
    </span>
  );
}
