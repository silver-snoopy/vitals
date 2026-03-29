import type { HealthDataType } from '@capgo/capacitor-health';
import { isNative, getPlatform } from './capacitor';

// Lazy import to avoid bundling native-only code in web builds
async function getHealthPlugin() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

export interface HealthDataPoint {
  startDate: string;
  endDate: string;
  value: number;
  unit: string;
  source: string;
}

export interface HealthQueryOptions {
  dataType: HealthDataType;
  startDate: Date;
  endDate: Date;
}

/**
 * Returns true if HealthKit is available (iOS native only).
 */
export function isHealthKitAvailable(): boolean {
  return isNative() && getPlatform() === 'ios';
}

/**
 * Request HealthKit read authorization for the specified data types.
 * Returns true only if at least one read permission was granted.
 * No-op on web.
 */
export async function requestHealthAuthorization(readTypes: HealthDataType[]): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;

  try {
    const health = await getHealthPlugin();
    const status = await health.requestAuthorization({
      read: readTypes,
      write: [],
    });
    return status.readAuthorized.length > 0;
  } catch (error) {
    console.error('HealthKit authorization failed:', error);
    return false;
  }
}

/**
 * Query HealthKit for aggregated data.
 * Returns empty array on web.
 */
export async function queryHealthData(options: HealthQueryOptions): Promise<HealthDataPoint[]> {
  if (!isHealthKitAvailable()) return [];

  try {
    const health = await getHealthPlugin();
    const result = await health.queryAggregated({
      dataType: options.dataType,
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
      bucket: 'day',
    });
    return result.samples.map((s) => ({
      startDate: s.startDate,
      endDate: s.endDate,
      value: s.value,
      unit: s.unit,
      source: 'healthkit',
    }));
  } catch (error) {
    console.error(`HealthKit query failed for ${options.dataType}:`, error);
    return [];
  }
}

/**
 * HealthKit data types relevant to Vitals.
 * Uses @capgo/capacitor-health HealthDataType identifiers.
 */
export const HEALTH_TYPES = {
  steps: 'steps',
  heartRate: 'heartRate',
  weight: 'weight',
  calories: 'calories',
  bodyFat: 'bodyFat',
  restingHeartRate: 'restingHeartRate',
  bloodPressure: 'bloodPressure',
} as const satisfies Record<string, HealthDataType>;
