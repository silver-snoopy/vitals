import type { DailyNutritionSummary } from './nutrition.js';
import type { WorkoutSession } from './workout.js';
import type { BiometricReading } from './measurement.js';

export interface ActionItem {
  category: 'nutrition' | 'workout' | 'recovery' | 'general';
  priority: 'high' | 'medium' | 'low';
  text: string;
}

export interface ScorecardEntry {
  score: number;
  notes: string;
}

export interface ReportSections {
  biometricsOverview: string;
  nutritionAnalysis: string;
  trainingLoad: string;
  crossDomainCorrelation: string;
  whatsWorking: string;
  hazards: string;
  recommendations: string;
  scorecard: Record<string, ScorecardEntry>;
}

export type ReportStatus = 'pending' | 'collecting_data' | 'generating' | 'completed' | 'failed';

export interface ReportStatusUpdate {
  reportId: string;
  status: ReportStatus;
  message?: string;
}

export interface GenerateReportResponse {
  reportId: string;
  status: ReportStatus;
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
  sections?: ReportSections;
  aiProvider: string;
  aiModel: string;
  status?: ReportStatus;
  errorMessage?: string;
  createdAt: string;
}

export interface WeeklyDataBundle {
  nutrition: DailyNutritionSummary[];
  workouts: WorkoutSession[];
  biometrics: BiometricReading[];
  previousReport: WeeklyReport | null;
  previousWeekNutrition: DailyNutritionSummary[];
  previousWeekWorkouts: WorkoutSession[];
  previousWeekBiometrics: BiometricReading[];
  userNotes?: string;
  workoutPlan?: string;
}
