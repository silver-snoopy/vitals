export interface BiometricReading {
  id: string;
  userId: string;
  date: string;
  metric: string;
  value: number;
  unit: string;
  source: string;
  collectedAt: string;
}

export type BiometricMetric =
  | 'weight_kg'
  | 'body_fat_pct'
  | 'resting_hr'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'sleep_hours'
  | 'steps';
