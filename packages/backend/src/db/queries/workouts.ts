import type pg from 'pg';
import type { WorkoutSession, WorkoutSet, ExerciseProgress } from '@vitals/shared';

interface WorkoutSetDbRow {
  id: string;
  user_id: string;
  source: string;
  exercise_name: string;
  set_index: string | number;
  weight_kg: string | null;
  reps: string | null;
  duration_seconds: string | null;
  distance_meters: string | null;
  rpe: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  collected_at: Date;
}

function toDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null;
  return val instanceof Date ? val : new Date(String(val));
}

function groupIntoSessions(rows: WorkoutSetDbRow[], userId: string): WorkoutSession[] {
  const groups = new Map<string, { date: string; source: string; rows: WorkoutSetDbRow[] }>();

  for (const row of rows) {
    const startedAt = toDate(row.started_at);
    const collectedAt = toDate(row.collected_at) ?? new Date();
    const dateStr = startedAt
      ? startedAt.toISOString().split('T')[0]
      : collectedAt.toISOString().split('T')[0];
    const key = `${dateStr}-${row.source}`;

    if (!groups.has(key)) {
      groups.set(key, { date: dateStr, source: row.source, rows: [] });
    }
    groups.get(key)!.rows.push(row);
  }

  const sessions: WorkoutSession[] = [];

  for (const group of groups.values()) {
    const sessionId = `session-${group.date}-${group.source}`;

    let minStartedAt: Date | null = null;
    let maxEndedAt: Date | null = null;
    let minCollectedAt: Date = toDate(group.rows[0].collected_at) ?? new Date();

    for (const r of group.rows) {
      const started = toDate(r.started_at);
      const ended = toDate(r.ended_at);
      const collected = toDate(r.collected_at) ?? new Date();

      if (started && (!minStartedAt || started < minStartedAt)) minStartedAt = started;
      if (ended && (!maxEndedAt || ended > maxEndedAt)) maxEndedAt = ended;
      if (collected < minCollectedAt) minCollectedAt = collected;
    }

    const durationSeconds = minStartedAt && maxEndedAt
      ? Math.round((maxEndedAt.getTime() - minStartedAt.getTime()) / 1000)
      : 0;

    const sets: WorkoutSet[] = group.rows.map((r) => ({
      id: String(r.id),
      sessionId,
      exerciseName: String(r.exercise_name),
      setIndex: Number(r.set_index),
      weightKg: r.weight_kg !== null && r.weight_kg !== undefined ? Number(r.weight_kg) : null,
      reps: r.reps !== null && r.reps !== undefined ? Number(r.reps) : null,
      durationSeconds: r.duration_seconds !== null && r.duration_seconds !== undefined
        ? Number(r.duration_seconds)
        : null,
      distanceMeters: r.distance_meters !== null && r.distance_meters !== undefined
        ? Number(r.distance_meters)
        : null,
      rpe: r.rpe !== null && r.rpe !== undefined ? Number(r.rpe) : null,
    }));

    const source = String(group.source);
    const title = source.charAt(0).toUpperCase() + source.slice(1) + ' Workout';

    sessions.push({
      id: sessionId,
      userId,
      date: group.date,
      title,
      durationSeconds,
      sets,
      source,
      collectedAt: minCollectedAt.toISOString(),
    });
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

export async function queryWorkoutSessions(
  pool: pg.Pool,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<WorkoutSession[]> {
  const { rows } = await pool.query(
    `SELECT id, user_id, source, exercise_name, set_index,
       weight_kg, reps, duration_seconds, distance_meters, rpe,
       started_at, ended_at, collected_at
     FROM workout_sets
     WHERE user_id = $1 AND started_at BETWEEN $2 AND $3
     ORDER BY started_at, exercise_name, set_index`,
    [userId, startDate, endDate],
  );

  return groupIntoSessions(rows as WorkoutSetDbRow[], userId);
}

export async function queryExerciseProgress(
  pool: pg.Pool,
  userId: string,
  exerciseName: string,
): Promise<ExerciseProgress> {
  const { rows } = await pool.query(
    `SELECT DATE(started_at) AS day,
       MAX(weight_kg) AS max_weight,
       SUM(weight_kg * COALESCE(reps, 0)) AS total_volume,
       COUNT(*) AS total_sets
     FROM workout_sets
     WHERE user_id = $1 AND exercise_name = $2
     GROUP BY DATE(started_at)
     ORDER BY day`,
    [userId, exerciseName],
  );

  return {
    exerciseName,
    dataPoints: rows.map((r) => ({
      date: r.day instanceof Date
        ? r.day.toISOString().split('T')[0]
        : String(r.day),
      maxWeight: Number(r.max_weight ?? 0),
      totalVolume: Number(r.total_volume ?? 0),
      totalSets: Number(r.total_sets),
    })),
  };
}
