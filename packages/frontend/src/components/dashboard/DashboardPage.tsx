import { useDashboard } from '@/api/hooks/useDashboard';
import { WeeklySummaryCard }   from './WeeklySummaryCard';
import { NutritionChart }      from './NutritionChart';
import { WorkoutVolumeChart }  from './WorkoutVolumeChart';
import { WeightChart }         from './WeightChart';
import { LatestReportPreview } from './LatestReportPreview';
import { ChartSkeleton }       from '@/components/ui/LoadingSkeleton';

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const dashboard = data?.data;

  if (error) return <p className="text-sm text-destructive">Failed to load dashboard data.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {isLoading || !dashboard ? (
        <ChartSkeleton />
      ) : (
        <WeeklySummaryCard
          nutrition={dashboard.nutrition}
          sessions={dashboard.workouts}
          biometrics={dashboard.biometrics}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isLoading || !dashboard ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <NutritionChart data={dashboard.nutrition} />
            <WorkoutVolumeChart sessions={dashboard.workouts} />
          </>
        )}
      </div>

      {isLoading || !dashboard ? (
        <ChartSkeleton />
      ) : (
        <WeightChart biometrics={dashboard.biometrics} />
      )}

      <LatestReportPreview />
    </div>
  );
}
