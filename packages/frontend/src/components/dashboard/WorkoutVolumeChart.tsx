import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { WorkoutSession } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

function sessionVolume(session: WorkoutSession): number {
  return session.sets
    .filter((s) => s.setType !== 'warmup')
    .reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
}

export function WorkoutVolumeChart({ sessions }: { sessions: WorkoutSession[] }) {
  const chartData = sessions.map((s) => ({
    day: format(parseISO(s.date), 'MMM d'),
    volume: Math.round(sessionVolume(s)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workout Volume (kg)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="volume" fill={CHART_COLORS.volume} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
