import type { DailyNutritionSummary, WorkoutSession, BiometricReading } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  nutrition: DailyNutritionSummary[];
  sessions: WorkoutSession[];
  biometrics: BiometricReading[];
}

export function WeeklySummaryCard({ nutrition, sessions, biometrics }: Props) {
  const avgCalories =
    nutrition.length > 0
      ? Math.round(nutrition.reduce((sum, d) => sum + d.calories, 0) / nutrition.length)
      : null;

  const weightReadings = biometrics.filter((b) => b.metric === 'weight_kg');
  const avgWeight =
    weightReadings.length > 0
      ? (weightReadings.reduce((sum, b) => sum + b.value, 0) / weightReadings.length).toFixed(1)
      : null;

  const stats = [
    { label: 'Avg Daily Calories', value: avgCalories ? `${avgCalories} kcal` : '—' },
    { label: 'Workout Sessions',   value: sessions.length.toString() },
    { label: 'Avg Weight',         value: avgWeight ? `${avgWeight} kg` : '—' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
