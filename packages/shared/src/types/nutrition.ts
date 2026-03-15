export interface NutritionRecord {
  id: string;
  userId: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  source: string;
  collectedAt: string;
}

export interface DailyNutritionSummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium?: number;
  sugar?: number;
  goalCalories?: number;
  goalProtein?: number;
  goalCarbs?: number;
  goalFat?: number;
}
