export interface MeasurementRow {
  userId: string;
  source: string;
  category: string;
  metric: string;
  value: number;
  unit: string;
  measuredAt: Date;
  tags: Record<string, unknown>;
}

export interface WorkoutSetRow {
  userId: string;
  source: string;
  exerciseName: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  tags: Record<string, unknown>;
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function requiredDate(val: unknown, field: string): Date {
  const d = toDate(val);
  if (!d) throw new Error(`Invalid or missing date for field '${field}': ${val}`);
  return d;
}

/**
 * Decompose a raw nutrition record into individual MeasurementRows (one per macro).
 * Expects raw fields: date, energy_kcal (or Energy (kcal)), protein_g, carbs_g,
 * fat_g, fiber_g, sugar_g, sodium_mg.
 */
export function normalizeNutritionRow(
  raw: Record<string, unknown>,
  userId: string,
  source: string,
): MeasurementRow[] {
  const dateStr = raw['date'] ?? raw['Day'] ?? raw['Date'];
  const measuredAt = requiredDate(dateStr, 'date');

  const macros: Array<{ metric: string; unit: string; keys: string[] }> = [
    { metric: 'calories', unit: 'kcal', keys: ['energy_kcal', 'Energy (kcal)', 'calories'] },
    { metric: 'protein_g', unit: 'g', keys: ['protein_g', 'Protein (g)', 'protein'] },
    { metric: 'carbs_g', unit: 'g', keys: ['carbs_g', 'Carbs (g)', 'Carbohydrates (g)', 'carbs', 'carbohydrates_g'] },
    { metric: 'fat_g', unit: 'g', keys: ['fat_g', 'Fat (g)', 'fat'] },
    { metric: 'fiber_g', unit: 'g', keys: ['fiber_g', 'Fiber (g)', 'fiber'] },
    { metric: 'sugar_g', unit: 'g', keys: ['sugar_g', 'Sugar (g)', 'sugar'] },
    { metric: 'sodium_mg', unit: 'mg', keys: ['sodium_mg', 'Sodium (mg)', 'sodium'] },
  ];

  const rows: MeasurementRow[] = [];
  for (const { metric, unit, keys } of macros) {
    const rawVal = keys.reduce<unknown>(
      (found, k) => (found !== undefined ? found : raw[k]),
      undefined,
    );
    const value = toNum(rawVal);
    if (value === null) continue;

    rows.push({ userId, source, category: 'nutrition', metric, value, unit, measuredAt, tags: {} });
  }

  return rows;
}

/**
 * Normalize a raw Hevy workout set into a WorkoutSetRow.
 * Expects fields: exercise_name/title, set_index/set_order, weight_kg,
 * reps, duration_seconds, distance_meters, rpe, start_time, end_time.
 */
export function normalizeHevyRow(
  raw: Record<string, unknown>,
  userId: string,
): WorkoutSetRow {
  const exerciseName = String(
    raw['exercise_name'] ?? raw['title'] ?? raw['exercise_title'] ?? '',
  );
  const setIndex = Number(raw['set_index'] ?? raw['set_order'] ?? raw['index'] ?? 0);

  return {
    userId,
    source: 'hevy',
    exerciseName,
    setIndex,
    weightKg: toNum(raw['weight_kg']),
    reps: toNum(raw['reps']),
    durationSeconds: toNum(raw['duration_seconds']),
    distanceMeters: (() => {
      const km = toNum(raw['distance_km']);
      if (km !== null) return km * 1000;
      return toNum(raw['distance_meters']);
    })(),
    rpe: toNum(raw['rpe']),
    startedAt: toDate(raw['start_time'] ?? raw['started_at']),
    endedAt: toDate(raw['end_time'] ?? raw['ended_at']),
    tags: {},
  };
}

/**
 * Normalize a raw biometric reading into a single MeasurementRow.
 * Expects fields: date/Day, metric/Metric, value/Amount, unit.
 */
export function normalizeBiometricsRow(
  raw: Record<string, unknown>,
  userId: string,
  source: string,
): MeasurementRow {
  const dateStr = raw['date'] ?? raw['Day'] ?? raw['Date'];
  const measuredAt = requiredDate(dateStr, 'date');

  const metric = String(raw['metric'] ?? raw['Metric'] ?? '');
  const unit = String(raw['unit'] ?? raw['Unit'] ?? '');
  const value = toNum(raw['value'] ?? raw['Amount']);

  if (value === null) throw new Error(`Missing value for biometric metric '${metric}'`);

  return { userId, source, category: 'biometric', metric, value, unit, measuredAt, tags: {} };
}

export interface ValidationResult<T> {
  valid: T[];
  errors: string[];
}

/**
 * Filter rows using a validator function that returns error strings.
 * Rows with no errors are considered valid.
 */
export function validateNormalizedRows<T>(
  rows: T[],
  validator: (row: T) => string[],
): ValidationResult<T> {
  const valid: T[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const rowErrors = validator(row);
    if (rowErrors.length === 0) {
      valid.push(row);
    } else {
      errors.push(...rowErrors);
    }
  }

  return { valid, errors };
}
