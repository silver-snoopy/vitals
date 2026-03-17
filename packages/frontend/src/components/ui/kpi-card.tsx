import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Card } from './card';

interface KpiCardProps {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'stable'; delta: string };
  sparkline?: ReactNode;
  className?: string;
}

const trendConfig = {
  up: { arrow: '▲', className: 'text-success' },
  down: { arrow: '▼', className: 'text-destructive' },
  stable: { arrow: '→', className: 'text-muted-foreground' },
} as const;

function KpiCard({ label, value, trend, sparkline, className }: KpiCardProps) {
  return (
    <Card className={cn('p-3 gap-1', className)}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {trend && (
        <div className={cn('text-xs font-medium', trendConfig[trend.direction].className)}>
          {trendConfig[trend.direction].arrow} {trend.delta}
        </div>
      )}
      {sparkline && <div className="mt-1">{sparkline}</div>}
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

export { KpiCard };
export type { KpiCardProps };
