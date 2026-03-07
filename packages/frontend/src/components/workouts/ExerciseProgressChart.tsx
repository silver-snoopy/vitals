import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { WorkoutSession } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useExerciseProgress } from '@/api/hooks/useWorkouts';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { CHART_COLORS } from '@/lib/chart-config';

export function ExerciseProgressChart({ sessions }: { sessions: WorkoutSession[] }) {
  const exercises = [
    ...new Set(sessions.flatMap((s) => s.sets.map((set) => set.exerciseName))),
  ].sort();

  const [selected, setSelected] = useState<string>(exercises[0] ?? '');

  const { data, isLoading } = useExerciseProgress(selected || null);
  const chartData =
    data?.data.dataPoints.map((dp) => ({
      day: format(parseISO(dp.date), 'MMM d'),
      maxWeight: dp.maxWeight,
    })) ?? [];

  if (exercises.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Exercise Progress</CardTitle>
          <Select value={selected} onValueChange={(v) => { if (v !== null) setSelected(v); }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select exercise" />
            </SelectTrigger>
            <SelectContent>
              {exercises.map((ex) => (
                <SelectItem key={ex} value={ex}>
                  {ex}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data for this exercise.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="maxWeight"
                name="Max Weight (kg)"
                stroke={CHART_COLORS.weight}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
