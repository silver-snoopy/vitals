import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { DailyNutritionSummary } from '@vitals/shared';
import { CHART_COLORS } from '@/lib/chart-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MacroSplitChartProps {
  nutrition: DailyNutritionSummary[];
}

export function MacroSplitChart({ nutrition }: MacroSplitChartProps) {
  const latest = nutrition[nutrition.length - 1];

  if (!latest || latest.protein + latest.carbs + latest.fat === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Macro Split</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data</p>
        </CardContent>
      </Card>
    );
  }

  const pieData = [
    { name: 'Protein', value: latest.protein, color: CHART_COLORS.protein },
    { name: 'Carbs', value: latest.carbs, color: CHART_COLORS.carbs },
    { name: 'Fat', value: latest.fat, color: CHART_COLORS.fat },
  ];

  const totalCals = latest.calories;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Macro Split</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex items-center justify-center" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-semibold tabular-nums">{totalCals}</span>
            <span className="text-xs text-muted-foreground">kcal</span>
          </div>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs">
          {pieData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">
                {entry.name} {entry.value}g
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
