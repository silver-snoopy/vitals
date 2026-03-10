import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { BiometricReading } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

export function WeightChart({ biometrics }: { biometrics: BiometricReading[] }) {
  const chartData = biometrics
    .filter((b) => b.metric === 'weight_kg')
    .map((b) => ({ day: format(parseISO(b.date), 'MMM d'), weight: b.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Body Weight (kg)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[160px] md:h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="weight"
                stroke={CHART_COLORS.weight}
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
