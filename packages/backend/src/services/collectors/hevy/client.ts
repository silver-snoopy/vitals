export interface HevyClient {
  fetchWorkouts(startDate: Date, endDate: Date): Promise<Record<string, unknown>[]>;
}

function formatHevyDatetime(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && value.includes(',')) return value;
  try {
    const raw = typeof value === 'string' ? value.replace('Z', '+00:00') : String(value);
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return String(value);
    const day = dt.getUTCDate().toString().padStart(2, '0');
    const month = dt.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = dt.getUTCFullYear();
    const hh = dt.getUTCHours().toString().padStart(2, '0');
    const mm = dt.getUTCMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  } catch {
    return String(value);
  }
}

function flattenWorkouts(workouts: Array<Record<string, unknown>>): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  for (const workout of workouts) {
    const title = (workout.title ?? workout.name) as string | undefined;
    const startTime = formatHevyDatetime(workout.start_time ?? workout.startTime ?? workout.startedAt);
    const endTime = formatHevyDatetime(workout.end_time ?? workout.endTime ?? workout.endedAt);
    const description = (workout.description ?? '') as string;
    const exercises = (workout.exercises ?? []) as Array<Record<string, unknown>>;

    for (const exercise of exercises) {
      const exerciseTitle = (exercise.title ?? exercise.name) as string | undefined;
      const sets = (exercise.sets ?? []) as Array<Record<string, unknown>>;

      for (const [idx, set] of sets.entries()) {
        const setIndex = set.set_index ?? set.index ?? idx;
        rows.push({
          title,
          start_time: startTime,
          end_time: endTime,
          description,
          exercise_title: exerciseTitle,
          set_index: setIndex,
          weight_kg: set.weight_kg ?? set.weight,
          reps: set.reps,
          distance_meters: set.distance_km != null
            ? Number(set.distance_km) * 1000
            : set.distance_meters != null
            ? Number(set.distance_meters)
            : null,
          duration_seconds: set.duration_seconds ?? set.duration,
          rpe: set.rpe,
        });
      }
    }
  }

  return rows;
}

function extractWorkouts(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.workouts)) return record.workouts as Array<Record<string, unknown>>;
    if (Array.isArray(record.data)) return record.data as Array<Record<string, unknown>>;
  }
  return [];
}

export class HevyApiClient implements HevyClient {
  private apiKey: string;
  private apiBase: string;

  constructor(apiKey: string, apiBase = 'https://api.hevyapp.com/v1') {
    this.apiKey = apiKey;
    this.apiBase = apiBase.replace(/\/$/, '');
  }

  async fetchWorkouts(startDate: Date, endDate: Date): Promise<Record<string, unknown>[]> {
    if (!this.apiKey) throw new Error('Missing HEVY_API_KEY');

    const params = new URLSearchParams({
      from: startDate.toISOString().slice(0, 10),
      to: endDate.toISOString().slice(0, 10),
    });
    const response = await fetch(`${this.apiBase}/workouts?${params}`, {
      headers: { 'api-key': this.apiKey },
    });
    if (!response.ok) throw new Error(`Hevy API request failed: ${response.status}`);

    const payload = await response.json();
    const workouts = extractWorkouts(payload);
    return flattenWorkouts(workouts);
  }
}
