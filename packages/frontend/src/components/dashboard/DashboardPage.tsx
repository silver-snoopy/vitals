import { useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { useDashboard } from '@/api/hooks/useDashboard';
import type { DashboardData } from '@/api/hooks/useDashboard';
import { Button } from '@/components/ui/button';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { useWidgetOrderStore } from '@/store/useWidgetOrderStore';
import type { WidgetId } from '@/store/useWidgetOrderStore';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import { NutritionChart } from './NutritionChart';
import { WorkoutVolumeChart } from './WorkoutVolumeChart';
import { WeightChart } from './WeightChart';
import { ReportPanel } from './ReportPanel';
import { WidgetOrderSettings } from './WidgetOrderSettings';

/** Widgets that appear in the right column (charts). */
interface WidgetDef {
  id: WidgetId;
  halfWidth?: boolean;
  render: (dashboard: DashboardData) => ReactNode;
}

const CHART_WIDGETS: WidgetDef[] = [
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
];

const CHART_IDS = new Set<WidgetId>(['nutrition-chart', 'workout-volume-chart', 'weight-chart']);
const CHART_MAP = new Map(CHART_WIDGETS.map((w) => [w.id, w]));

/**
 * On the two-column layout, only chart widgets are reorderable in the right column.
 * On single-column, all widgets render in stored order with the left-column widgets
 * (summary + report) placed at the top.
 */
function renderChartWidgets(order: WidgetId[], dashboard: DashboardData) {
  const chartOrder = order.filter((id) => CHART_IDS.has(id));
  const ordered = chartOrder.map((id) => CHART_MAP.get(id)).filter(Boolean) as WidgetDef[];

  const elements: ReactNode[] = [];
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
        <div className="grid grid-cols-1 gap-6 min-[1440px]:grid-cols-[380px_1fr] min-[1440px]:items-start min-[1700px]:grid-cols-[440px_1fr]">
          {/* Left column: summary + report (sticky on large screens) */}
          <div className="space-y-5 min-[1440px]:sticky min-[1440px]:top-6 min-[1440px]:max-h-[calc(100vh-3rem)] min-[1440px]:overflow-y-auto min-[1440px]:scrollbar-thin">
            <WeeklySummaryCard
              nutrition={dashboard.nutrition}
              sessions={dashboard.workouts}
              biometrics={dashboard.biometrics}
            />
            <ReportPanel />
          </div>

          {/* Right column: charts */}
          <div className="space-y-6">{renderChartWidgets(order, dashboard)}</div>
        </div>
      )}
    </div>
  );
}
