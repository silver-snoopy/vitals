import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DailyNutritionSummary } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

export function MacroBreakdown({ data }: { data: DailyNutritionSummary[] }) {
  if (data.length === 0) return null;

  const avg = (key: keyof DailyNutritionSummary) =>
    (data.reduce((sum, d) => sum + (d[key] as number), 0) / data.length);

  const pieData = [
    { name: 'Protein', value: Math.round(avg('protein') * 4), color: CHART_COLORS.protein },
    { name: 'Carbs',   value: Math.round(avg('carbs')   * 4), color: CHART_COLORS.carbs },
    { name: 'Fat',     value: Math.round(avg('fat')     * 9), color: CHART_COLORS.fat },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avg Macro Split (kcal)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
