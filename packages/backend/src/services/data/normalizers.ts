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
  title: string | null;
  exerciseName: string;
  exerciseType: string | null;
  setIndex: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  volumeKg: number | null;
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
    {
      metric: 'carbs_g',
      unit: 'g',
      keys: ['carbs_g', 'Carbs (g)', 'Carbohydrates (g)', 'carbs', 'carbohydrates_g'],
    },
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
export function normalizeHevyRow(raw: Record<string, unknown>, userId: string): WorkoutSetRow {
  const exerciseName = String(raw['exercise_title'] ?? raw['exercise_name'] ?? raw['title'] ?? '');
  const setIndex = Number(raw['set_index'] ?? raw['set_order'] ?? raw['index'] ?? 0);

  const setType = String(raw['set_type'] ?? 'normal');
  const title = raw['title'] != null ? String(raw['title']) : null;
  const exerciseType = raw['exercise_type'] != null ? String(raw['exercise_type']) : null;

  return {
    userId,
    source: 'hevy',
    title,
    exerciseName,
    exerciseType,
    setIndex,
    setType,
    weightKg: toNum(raw['weight_kg']),
    volumeKg: null,
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
 * Map vendor-specific biometric metric names to standardized names.
 * Keys are lowercased for case-insensitive matching.
 */
const BIOMETRIC_METRIC_MAP: Record<string, { metric: string; unit: string }> = {
  'weight (withings)': { metric: 'weight_kg', unit: 'kg' },
  weight: { metric: 'weight_kg', unit: 'kg' },
  'body fat (withings)': { metric: 'body_fat_pct', unit: '%' },
  'body fat': { metric: 'body_fat_pct', unit: '%' },
  'heart rate (apple health)': { metric: 'heart_rate_bpm', unit: 'bpm' },
  'resting heart rate (apple health)': { metric: 'resting_heart_rate_bpm', unit: 'bpm' },
  'heart rate variability (hrv) (apple health)': { metric: 'hrv_ms', unit: 'ms' },
  'oxygen saturation (spo2) (apple health)': { metric: 'spo2_pct', unit: '%' },
  'respiration rate (apple health)': { metric: 'respiration_rate_brpm', unit: 'brpm' },
};

function normalizeBiometricMetric(raw: string, rawUnit: string): { metric: string; unit: string } {
  return BIOMETRIC_METRIC_MAP[raw.toLowerCase()] ?? { metric: raw, unit: rawUnit };
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

  const rawMetric = String(raw['metric'] ?? raw['Metric'] ?? '');
  const rawUnit = String(raw['unit'] ?? raw['Unit'] ?? '');
  const { metric, unit } = normalizeBiometricMetric(rawMetric, rawUnit);
  const value = toNum(raw['value'] ?? raw['Amount']);

  if (value === null) throw new Error(`Missing value for biometric metric '${rawMetric}'`);

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
