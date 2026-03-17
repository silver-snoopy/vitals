import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Trend = 'up' | 'down' | 'stable';

interface KpiCardProps {
  label: string;
  value: string;
  trend?: Trend;
  delta?: string;
  children?: ReactNode;
  className?: string;
}

const trendConfig: Record<Trend, { arrow: string; color: string }> = {
  up: { arrow: '▲', color: 'text-success' },
  down: { arrow: '▼', color: 'text-destructive' },
  stable: { arrow: '→', color: 'text-muted-foreground' },
};

export function KpiCard({ label, value, trend, delta, children, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10',
        className,
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {trend && delta && (
        <span className={cn('text-xs font-medium', trendConfig[trend].color)}>
          {trendConfig[trend].arrow} {delta}
        </span>
      )}
      {children}
    </div>
  );
}
