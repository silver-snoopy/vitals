import { format, parseISO } from 'date-fns';
import type { WorkoutSession } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function sessionVolume(session: WorkoutSession): number {
  return Math.round(session.sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0));
}

export function WorkoutSessionCard({ session }: { session: WorkoutSession }) {
  const uniqueExercises = [...new Set(session.sets.map((s) => s.exerciseName))];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{session.title}</CardTitle>
          <span className="shrink-0 text-sm text-muted-foreground">
            {format(parseISO(session.date), 'EEE, MMM d')}
          </span>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{formatDuration(session.durationSeconds)}</span>
          <span>·</span>
          <span>{sessionVolume(session).toLocaleString()} kg volume</span>
          <span>·</span>
          <span>{session.sets.length} sets</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {uniqueExercises.map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
