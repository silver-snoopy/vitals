import type { DailyNutritionSummary } from './nutrition.js';
import type { WorkoutSession } from './workout.js';
import type { BiometricReading } from './measurement.js';

export interface ActionItem {
  category: 'nutrition' | 'workout' | 'recovery' | 'general';
  priority: 'high' | 'medium' | 'low';
  text: string;
}

export interface WeeklyReport {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  insights: string;
  actionItems: ActionItem[];
  dataCoverage: {
    nutritionDays: number;
    workoutDays: number;
    biometricDays: number;
  };
  aiProvider: string;
  aiModel: string;
  createdAt: string;
}

export interface WeeklyDataBundle {
  nutrition: DailyNutritionSummary[];
  workouts: WorkoutSession[];
  biometrics: BiometricReading[];
  previousReport: WeeklyReport | null;
}
