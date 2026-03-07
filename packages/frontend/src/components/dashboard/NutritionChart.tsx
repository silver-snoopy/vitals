import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { DailyNutritionSummary } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

export function NutritionChart({ data }: { data: DailyNutritionSummary[] }) {
  const chartData = data.map((d) => ({
    ...d,
    day: format(parseISO(d.date), 'MMM d'),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nutrition Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="calories" stroke={CHART_COLORS.calories} dot={false} />
            <Line type="monotone" dataKey="protein"  stroke={CHART_COLORS.protein}  dot={false} />
            <Line type="monotone" dataKey="carbs"    stroke={CHART_COLORS.carbs}    dot={false} />
            <Line type="monotone" dataKey="fat"      stroke={CHART_COLORS.fat}      dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
