import type { MeasurementRow, WorkoutSetRow } from '../../data/normalizers.js';

// Map Apple Health HKQuantityType identifiers to our metric names
const METRIC_MAP: Record<string, { metric: string; category: string; unit: string }> = {
  HKQuantityTypeIdentifierBodyMass: { metric: 'weight_kg', category: 'biometric', unit: 'kg' },
  HKQuantityTypeIdentifierBodyFatPercentage: {
    metric: 'body_fat_pct',
    category: 'biometric',
    unit: '%',
  },
  HKQuantityTypeIdentifierStepCount: { metric: 'steps', category: 'biometric', unit: 'count' },
  HKQuantityTypeIdentifierHeartRate: { metric: 'resting_hr', category: 'biometric', unit: 'bpm' },
  HKQuantityTypeIdentifierDietaryEnergyConsumed: {
    metric: 'calories',
    category: 'nutrition',
    unit: 'kcal',
  },
  HKQuantityTypeIdentifierDietaryProtein: { metric: 'protein_g', category: 'nutrition', unit: 'g' },
  HKQuantityTypeIdentifierDietaryCarbohydrates: {
    metric: 'carbs_g',
    category: 'nutrition',
    unit: 'g',
  },
  HKQuantityTypeIdentifierDietaryFatTotal: { metric: 'fat_g', category: 'nutrition', unit: 'g' },
  HKQuantityTypeIdentifierDietaryFiber: { metric: 'fiber_g', category: 'nutrition', unit: 'g' },
  HKQuantityTypeIdentifierDistanceWalkingRunning: {
    metric: 'distance_meters',
    category: 'biometric',
    unit: 'm',
  },
  HKQuantityTypeIdentifierFlightsClimbed: {
    metric: 'flights_climbed',
    category: 'biometric',
    unit: 'count',
  },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    metric: 'active_calories',
    category: 'biometric',
    unit: 'kcal',
  },
  HKQuantityTypeIdentifierBasalEnergyBurned: {
    metric: 'basal_calories',
    category: 'biometric',
    unit: 'kcal',
  },
  HKQuantityTypeIdentifierSleepAnalysis: {
    metric: 'sleep_hours',
    category: 'biometric',
    unit: 'h',
  },
};

// Unit conversions needed for Apple Health exports
function convertValue(value: number, sourceUnit: string, targetMetric: string): number {
  if (targetMetric === 'weight_kg' && sourceUnit === 'lb') {
    return value * 0.453592;
  }
  if (targetMetric === 'distance_meters' && sourceUnit === 'mi') {
    return value * 1609.344;
  }
  if (targetMetric === 'distance_meters' && sourceUnit === 'km') {
    return value * 1000;
  }
  if (targetMetric === 'body_fat_pct' && value > 1) {
    // Apple Health may report as 0.20 (fraction) or 20 (percent)
    return value;
  }
  return value;
}

// Extract attribute value from a Record element string
function getAttr(element: string, attr: string): string {
  const match = element.match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

export interface AppleHealthParseResult {
  measurements: MeasurementRow[];
  workoutSets: WorkoutSetRow[];
}

export function parseAppleHealthExport(xml: string, userId: string): AppleHealthParseResult {
  const measurements: MeasurementRow[] = [];
  const workoutSets: WorkoutSetRow[] = [];

  // Match all self-closing <Record ... /> elements
  const recordPattern = /<Record\s[^/]*/gi;
  const matches = xml.match(recordPattern) ?? [];

  for (const element of matches) {
    const type = getAttr(element, 'type');
    const mapping = METRIC_MAP[type];

    if (!mapping) continue; // Skip unknown record types

    const rawValue = parseFloat(getAttr(element, 'value'));
    if (isNaN(rawValue)) continue;

    const sourceUnit = getAttr(element, 'unit');
    const startDateStr = getAttr(element, 'startDate');
    const sourceName = getAttr(element, 'sourceName') || 'apple_health';

    if (!startDateStr) continue;

    const measuredAt = new Date(startDateStr);
    if (isNaN(measuredAt.getTime())) continue;

    const value = convertValue(rawValue, sourceUnit, mapping.metric);

    measurements.push({
      userId,
      source: 'apple_health',
      category: mapping.category,
      metric: mapping.metric,
      value,
      unit: mapping.unit,
      measuredAt,
      tags: { sourceName },
    });
  }

  // Match <Workout ... /> elements for workout sets
  const workoutPattern = /<Workout\s[^/]*/gi;
  const workoutMatches = xml.match(workoutPattern) ?? [];

  for (const element of workoutMatches) {
    const activityType = getAttr(element, 'workoutActivityType');
    const durationStr = getAttr(element, 'duration');
    const startDateStr = getAttr(element, 'startDate');

    if (!startDateStr) continue;
    const startedAt = new Date(startDateStr);
    if (isNaN(startedAt.getTime())) continue;

    const endDateStr = getAttr(element, 'endDate');
    const endedAt = endDateStr ? new Date(endDateStr) : null;
    const durationSeconds = durationStr ? parseFloat(durationStr) * 60 : null;

    const exerciseName = activityType
      .replace('HKWorkoutActivityType', '')
      .replace(/([A-Z])/g, ' $1')
      .trim();

    workoutSets.push({
      userId,
      source: 'apple_health',
      title: null,
      exerciseName: exerciseName || 'Unknown',
      exerciseType: null,
      setIndex: 0,
      setType: 'normal',
      weightKg: null,
      volumeKg: null,
      reps: null,
      durationSeconds,
      distanceMeters: null,
      rpe: null,
      startedAt,
      endedAt: endedAt && !isNaN(endedAt.getTime()) ? endedAt : null,
      tags: { activityType },
    });
  }

  return { measurements, workoutSets };
}
