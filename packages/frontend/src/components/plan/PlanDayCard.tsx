import type { PlanDay, PlanExercise, PlanSet } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PlanDayCardProps {
  day: PlanDay;
  /** 0-based index of this day within the plan. */
  dayIndex: number;
}

function formatReps(targetReps: PlanSet['targetReps']): string {
  if (Array.isArray(targetReps)) {
    return `${targetReps[0]}–${targetReps[1]}`;
  }
  return String(targetReps);
}

function formatLoad(set: PlanSet): string {
  if (set.targetWeightKg !== undefined) {
    return `${set.targetWeightKg} kg`;
  }
  return 'bodyweight';
}

function getSetsDisplay(exercise: PlanExercise): string {
  const workSets = exercise.sets.filter((s) => s.type === 'normal' || s.type === 'amrap');
  if (workSets.length === 0) return '';
  const first = workSets[0];
  return `${workSets.length}×${formatReps(first.targetReps)} @ ${formatLoad(first)}`;
}

/**
 * Displays a single training day: day name, target muscles, and a table of
 * exercises with their sets × reps × load targets.
 */
export function PlanDayCard({ day, dayIndex: _dayIndex }: PlanDayCardProps) {
  // Fallback: if no structured exercises but day.name is present with notes pattern
  const hasExercises = day.exercises && day.exercises.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">{day.name}</CardTitle>
          <div className="flex flex-wrap gap-1">
            {day.targetMuscles.map((muscle) => (
              <Badge key={muscle} variant="secondary" className="text-xs capitalize">
                {muscle}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasExercises ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-1.5 pr-4 font-medium">Exercise</th>
                <th className="pb-1.5 pr-4 font-medium">Sets × Reps @ Load</th>
                <th className="pb-1.5 pr-4 font-medium hidden sm:table-cell">RPE</th>
                <th className="pb-1.5 font-medium hidden md:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {day.exercises.map((exercise, idx) => (
                <tr key={exercise.id ?? idx} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 font-medium">{exercise.exerciseName}</td>
                  <td className="py-1.5 pr-4 text-muted-foreground">{getSetsDisplay(exercise)}</td>
                  <td className="py-1.5 pr-4 text-muted-foreground hidden sm:table-cell">
                    {exercise.sets.find((s) => s.targetRpe !== undefined)?.targetRpe ?? '—'}
                  </td>
                  <td className="py-1.5 text-muted-foreground hidden md:table-cell whitespace-pre-wrap max-w-md">
                    {exercise.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {(day as { notes?: string }).notes ?? 'No exercises defined.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
