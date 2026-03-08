import { useNutritionDaily } from '@/api/hooks/useNutrition';
import { DailyNutritionTable } from './DailyNutritionTable';
import { MacroBreakdown } from './MacroBreakdown';
import { TableSkeleton, ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { Card, CardContent } from '@/components/ui/card';

export function NutritionPage() {
  const { data, isLoading, error } = useNutritionDaily();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nutrition</h1>

      {error && <p className="text-sm text-destructive">Failed to load nutrition data.</p>}

      {isLoading ? <ChartSkeleton /> : <MacroBreakdown data={rows} />}

      <Card>
        <CardContent className="pt-4">
          {isLoading ? <TableSkeleton /> : <DailyNutritionTable data={rows} />}
        </CardContent>
      </Card>
    </div>
  );
}
