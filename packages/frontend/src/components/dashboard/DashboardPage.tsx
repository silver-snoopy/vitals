import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useDashboard } from '@/api/hooks/useDashboard';
import type { DashboardData } from '@/api/hooks/useDashboard';
import { Button } from '@/components/ui/button';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { useWidgetOrderStore } from '@/store/useWidgetOrderStore';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import { NutritionChart } from './NutritionChart';
import { WorkoutVolumeChart } from './WorkoutVolumeChart';
import { WeightChart } from './WeightChart';
import { LatestReportPreview } from './LatestReportPreview';
import { WidgetOrderSettings } from './WidgetOrderSettings';

interface WidgetDef {
  id: string;
  halfWidth?: boolean;
  render: (dashboard: DashboardData) => React.ReactNode;
}

const WIDGETS: WidgetDef[] = [
  {
    id: 'nutrition-chart',
    halfWidth: true,
    render: (d) => <NutritionChart data={d.nutrition} />,
  },
  {
    id: 'workout-volume-chart',
    halfWidth: true,
    render: (d) => <WorkoutVolumeChart sessions={d.workouts} />,
  },
  {
    id: 'weight-chart',
    render: (d) => <WeightChart biometrics={d.biometrics} />,
  },
  {
    id: 'weekly-summary',
    render: (d) => (
      <WeeklySummaryCard nutrition={d.nutrition} sessions={d.workouts} biometrics={d.biometrics} />
    ),
  },
  {
    id: 'latest-report',
    render: () => <LatestReportPreview />,
  },
];

function renderOrderedWidgets(order: string[], dashboard: DashboardData) {
  const widgetMap = new Map(WIDGETS.map((w) => [w.id, w]));
  const ordered = order.map((id) => widgetMap.get(id)).filter(Boolean) as WidgetDef[];

  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < ordered.length) {
    const current = ordered[i];
    const next = i + 1 < ordered.length ? ordered[i + 1] : undefined;

    if (current.halfWidth && next?.halfWidth) {
      elements.push(
        <div key={`${current.id}-${next.id}`} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {current.render(dashboard)}
          {next.render(dashboard)}
        </div>,
      );
      i += 2;
    } else {
      elements.push(<div key={current.id}>{current.render(dashboard)}</div>);
      i += 1;
    }
  }

  return elements;
}

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const dashboard = data?.data;
  const order = useWidgetOrderStore((s) => s.order);
  const [showSettings, setShowSettings] = useState(false);

  if (error) return <p className="text-sm text-destructive">Failed to load dashboard data.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Widget settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {showSettings && <WidgetOrderSettings />}

      {isLoading || !dashboard ? (
        <div className="space-y-6">
          <ChartSkeleton />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <ChartSkeleton />
        </div>
      ) : (
        <div className="space-y-6">{renderOrderedWidgets(order, dashboard)}</div>
      )}
    </div>
  );
}
