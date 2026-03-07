import { useWorkoutSessions } from '@/api/hooks/useWorkouts';
import { WorkoutSessionCard }    from './WorkoutSessionCard';
import { ExerciseProgressChart } from './ExerciseProgressChart';
import { CardSkeleton }          from '@/components/ui/LoadingSkeleton';

export function WorkoutsPage() {
  const { data, isLoading, error } = useWorkoutSessions();
  const sessions = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Workouts</h1>

      {error && <p className="text-sm text-destructive">Failed to load workouts.</p>}

      {sessions.length > 0 && <ExerciseProgressChart sessions={sessions} />}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workouts in this period.</p>
        ) : (
          sessions.map((s) => <WorkoutSessionCard key={s.id} session={s} />)
        )}
      </div>
    </div>
  );
}
