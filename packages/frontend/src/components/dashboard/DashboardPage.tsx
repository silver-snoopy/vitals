import { useDashboard } from '@/api/hooks/useDashboard';
import { useLatestReport } from '@/api/hooks/useReports';
import { KpiCard } from '@/components/ui/kpi-card';
import { Sparkline } from '@/components/charts/Sparkline';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { computeKpiData } from './kpi-helpers';
import { ReportAlertBar } from './ReportAlertBar';
import { NutritionChart } from './NutritionChart';
import { WorkoutVolumeChart } from './WorkoutVolumeChart';
import { WeightChart } from './WeightChart';
import { MacroSplitChart } from './MacroSplitChart';
import { ActivityHeatmap } from './ActivityHeatmap';
import { SwipeableCharts } from './SwipeableCharts';

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const { data: report } = useLatestReport();
  const dashboard = data?.data;

  if (error) return <p className="text-sm text-destructive">Failed to load dashboard data.</p>;

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <ChartSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  const kpis = computeKpiData(
    dashboard.nutrition,
    dashboard.workouts,
    dashboard.biometrics,
    report,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Strip */}
      <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            trend={kpi.trend}
            sparkline={
              kpi.sparklineData && kpi.sparklineColor ? (
                <Sparkline data={kpi.sparklineData} color={kpi.sparklineColor} />
              ) : undefined
            }
          />
        ))}
      </div>
      {/* Mobile KPI strip — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none md:hidden">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            trend={kpi.trend}
            className="min-w-[140px] snap-center"
            sparkline={
              kpi.sparklineData && kpi.sparklineColor ? (
                <Sparkline data={kpi.sparklineData} color={kpi.sparklineColor} />
              ) : undefined
            }
          />
        ))}
      </div>

      {/* Report Alert Bar */}
      <ReportAlertBar />

      {/* Bento grid — desktop/tablet */}
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <NutritionChart data={dashboard.nutrition} />
        </div>
        <div>
          <WeightChart biometrics={dashboard.biometrics} />
        </div>
        <div>
          <WorkoutVolumeChart sessions={dashboard.workouts} />
        </div>
        <div>
          <MacroSplitChart nutrition={dashboard.nutrition} />
        </div>
        <div>
          <ActivityHeatmap workouts={dashboard.workouts} />
        </div>
      </div>

      {/* Swipeable charts — mobile */}
      <div className="md:hidden">
        <SwipeableCharts
          nutrition={dashboard.nutrition}
          workouts={dashboard.workouts}
          biometrics={dashboard.biometrics}
        />
      </div>
    </div>
  );
}
