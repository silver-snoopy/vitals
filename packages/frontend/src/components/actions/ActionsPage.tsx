import { useState } from 'react';
import type { ActionItemStatus } from '@vitals/shared';
import { Card } from '@/components/ui/card';
import {
  useActionItems,
  useActionItemSummary,
  useAttributionSummary,
} from '@/api/hooks/useActionItems';
import { ActionItemsList } from './ActionItemsList';
import { AttributionCard } from './AttributionCard';

type FilterTab = 'all' | ActionItemStatus;

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Deferred', value: 'deferred' },
];

const ACTIVE_STATUSES: ActionItemStatus[] = ['pending', 'active', 'deferred'];

export function ActionsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filterStatus = activeTab === 'all' ? ACTIVE_STATUSES : ([activeTab] as ActionItemStatus[]);

  const { data: itemsData, isLoading } = useActionItems({ status: filterStatus });
  const { data: summaryData } = useActionItemSummary();
  const { data: attributionData } = useAttributionSummary();

  const items = itemsData?.data ?? [];
  const summary = summaryData?.data;

  const completedCount = summary?.completed ?? 0;
  const activeCount = (summary?.active ?? 0) + (summary?.pending ?? 0);
  const totalActionable = activeCount + completedCount;
  const progressPct =
    totalActionable > 0 ? Math.round((completedCount / totalActionable) * 100) : 0;

  const pending = items.filter((i) => i.status === 'pending');
  const active = items.filter((i) => i.status === 'active');
  const deferred = items.filter((i) => i.status === 'deferred');

  // For completed tab, fetch separately
  const { data: completedData } = useActionItems({
    status: 'completed',
    limit: 20,
  });
  const completed = activeTab === 'completed' ? (completedData?.data ?? []) : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Actions</h1>

      {/* Attribution summary */}
      {attributionData?.data && attributionData.data.totalItems > 0 && (
        <AttributionCard data={attributionData.data} />
      )}

      {/* Progress summary */}
      {summary && (
        <Card className="px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium">
              {completedCount} of {totalActionable} completed
            </span>
            <span className="text-xs text-muted-foreground">
              {summary.pending} pending · {summary.active} active
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            data-testid={`tab-${tab.value}`}
          >
            {tab.label}
            {tab.value === 'pending' && summary?.pending
              ? ` (${summary.pending})`
              : tab.value === 'active' && summary?.active
                ? ` (${summary.active})`
                : ''}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading&hellip;</p>}

      {/* Grouped sections */}
      {!isLoading && activeTab !== 'completed' && (
        <div className="space-y-6">
          {(activeTab === 'all' || activeTab === 'pending') && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pending ({pending.length})
              </h2>
              <ActionItemsList items={pending} emptyMessage="No pending items" />
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'active') && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active ({active.length})
              </h2>
              <ActionItemsList items={active} emptyMessage="No active items" />
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'deferred') && deferred.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deferred ({deferred.length})
              </h2>
              <ActionItemsList items={deferred} emptyMessage="No deferred items" />
            </section>
          )}
        </div>
      )}

      {!isLoading && activeTab === 'completed' && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Completed ({completed.length})
          </h2>
          <ActionItemsList items={completed} emptyMessage="No completed items yet" />
        </section>
      )}
    </div>
  );
}
