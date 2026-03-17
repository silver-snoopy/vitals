export interface ExerciseTypeMap {
  [exerciseTitle: string]: string;
}

export interface HevyClient {
  fetchWorkouts(startDate: Date, endDate: Date): Promise<Record<string, unknown>[]>;
  fetchExerciseTemplates(): Promise<ExerciseTypeMap>;
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

function flattenWorkouts(
  workouts: Array<Record<string, unknown>>,
  exerciseTypes: ExerciseTypeMap = {},
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  for (const workout of workouts) {
    const title = (workout.title ?? workout.name) as string | undefined;
    const startTime = formatHevyDatetime(
      workout.start_time ?? workout.startTime ?? workout.startedAt,
    );
    const endTime = formatHevyDatetime(workout.end_time ?? workout.endTime ?? workout.endedAt);
    const description = (workout.description ?? '') as string;
    const exercises = (workout.exercises ?? []) as Array<Record<string, unknown>>;

    for (const exercise of exercises) {
      const exerciseTitle = (exercise.title ?? exercise.name) as string | undefined;
      const sets = (exercise.sets ?? []) as Array<Record<string, unknown>>;

      const exerciseType = exerciseTitle ? (exerciseTypes[exerciseTitle] ?? null) : null;

      for (const [idx, set] of sets.entries()) {
        const setIndex = set.set_index ?? set.index ?? idx;
        rows.push({
          title,
          start_time: startTime,
          end_time: endTime,
          description,
          exercise_title: exerciseTitle,
          exercise_type: exerciseType,
          set_index: setIndex,
          weight_kg: set.weight_kg ?? set.weight,
          reps: set.reps,
          distance_meters:
            set.distance_km != null
              ? Number(set.distance_km) * 1000
              : set.distance_meters != null
                ? Number(set.distance_meters)
                : null,
          duration_seconds: set.duration_seconds ?? set.duration,
          rpe: set.rpe,
          set_type: set.set_type ?? set.type ?? 'normal',
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

  async fetchExerciseTemplates(): Promise<ExerciseTypeMap> {
    if (!this.apiKey) throw new Error('Missing HEVY_API_KEY');

    const typeMap: ExerciseTypeMap = {};
    let page = 1;
    const pageSize = 10;
    const maxPages = 500;

    while (page <= maxPages) {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await fetch(`${this.apiBase}/exercise_templates?${params}`, {
        headers: { 'api-key': this.apiKey },
      });
      if (!response.ok) break;

      const payload = (await response.json()) as Record<string, unknown>;
      const templates = (
        Array.isArray(payload.exercise_templates)
          ? payload.exercise_templates
          : Array.isArray(payload.data)
            ? payload.data
            : []
      ) as Array<Record<string, unknown>>;
      if (templates.length === 0) break;

      for (const t of templates) {
        const title = String(t.title ?? t.name ?? '');
        const type = String(t.type ?? '');
        if (title && type) typeMap[title] = type;
      }

      const rawPageCount = payload.page_count;
      const pageCount = rawPageCount != null ? Number(rawPageCount) : NaN;
      if (!isNaN(pageCount) && page >= pageCount) break;
      if (templates.length < pageSize) break;

      page++;
    }

    return typeMap;
  }

  async fetchWorkouts(_startDate: Date, _endDate: Date): Promise<Record<string, unknown>[]> {
    if (!this.apiKey) throw new Error('Missing HEVY_API_KEY');

    const exerciseTypes = await this.fetchExerciseTemplates();

    const allWorkouts: Array<Record<string, unknown>> = [];
    let page = 1;
    const pageSize = 10;
    const maxPages = 500;

    while (page <= maxPages) {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await fetch(`${this.apiBase}/workouts?${params}`, {
        headers: { 'api-key': this.apiKey },
      });
      if (!response.ok) throw new Error(`Hevy API request failed: ${response.status}`);

      const payload = await response.json();
      const workouts = extractWorkouts(payload);
      if (workouts.length === 0) break;

      allWorkouts.push(...workouts);

      const rawPageCount =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>).page_count
          : undefined;
      const pageCount = rawPageCount != null ? Number(rawPageCount) : NaN;
      if (!isNaN(pageCount) && page >= pageCount) break;
      if (workouts.length < pageSize) break;

      page++;
    }

    return flattenWorkouts(allWorkouts, exerciseTypes);
  }
}
