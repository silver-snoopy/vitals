import type { AttributionSummary } from '@vitals/shared';
import { Card } from '@/components/ui/card';

interface Props {
  data: AttributionSummary;
}

export function AttributionCard({ data }: Props) {
  const completionPct = Math.round(data.completionRate * 100);
  const hasMeasured = data.measuredItems > 0;

  return (
    <Card className="px-4 py-3" data-testid="attribution-card">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        This{' '}
        {data.period === 'week' ? "Week's" : data.period === 'quarter' ? "Quarter's" : "Month's"}{' '}
        Impact
      </h3>

      {/* Completion rate bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Completion Rate</span>
          <span className="text-sm text-muted-foreground">
            {data.completedItems}/{data.totalItems} items
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Outcome breakdown */}
      {hasMeasured && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">
            Of {data.measuredItems} measured items:
          </p>
          <div className="flex gap-3 text-sm">
            <span className="text-emerald-500 font-medium">↑ {data.improvedItems} improved</span>
            <span className="text-amber-500 font-medium">— {data.stableItems} stable</span>
            <span className="text-red-500 font-medium">↓ {data.declinedItems} declined</span>
          </div>
        </div>
      )}

      {/* Top improvements */}
      {data.topImprovements.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Top wins:</p>
          <ul className="space-y-0.5">
            {data.topImprovements.map((item, i) => (
              <li key={i} className="text-sm">
                <span className="text-muted-foreground mr-1">•</span>
                <span className="capitalize">{item.category}</span>:{' '}
                <span className="font-medium">{item.change}</span>{' '}
                <span className="text-muted-foreground">{item.metric}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasMeasured && data.totalItems === 0 && (
        <p className="text-sm text-muted-foreground">
          No action items tracked yet. Complete some recommendations to see your impact.
        </p>
      )}
    </Card>
  );
}
