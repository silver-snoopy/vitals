import type {
  AIMessage,
  WeeklyDataBundle,
  DailyNutritionSummary,
  WorkoutSession,
  BiometricReading,
  WeeklyReport,
} from '@vitals/shared';

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatNutritionSummary(nutrition: DailyNutritionSummary[]): string {
  if (nutrition.length === 0) return 'No nutrition data available.';
  const avgCalories = avg(nutrition.map((d) => d.calories)).toFixed(0);
  const avgProtein = avg(nutrition.map((d) => d.protein)).toFixed(1);
  const avgCarbs = avg(nutrition.map((d) => d.carbs)).toFixed(1);
  const avgFat = avg(nutrition.map((d) => d.fat)).toFixed(1);
  return `${nutrition.length} days logged. Averages: ${avgCalories} kcal, ${avgProtein}g protein, ${avgCarbs}g carbs, ${avgFat}g fat.`;
}

function formatWorkoutSummary(workouts: WorkoutSession[]): string {
  if (workouts.length === 0) return 'No workout data available.';
  const uniqueDays = new Set(workouts.map((w) => w.date)).size;
  const totalSets = workouts.reduce((sum, w) => sum + w.sets.length, 0);
  return `${workouts.length} sessions across ${uniqueDays} days. Total sets: ${totalSets}.`;
}

function formatBiometricSummary(biometrics: BiometricReading[]): string {
  if (biometrics.length === 0) return 'No biometric data available.';
  const byMetric = new Map<string, number[]>();
  for (const b of biometrics) {
    if (!byMetric.has(b.metric)) byMetric.set(b.metric, []);
    byMetric.get(b.metric)!.push(b.value);
  }
  const lines: string[] = [];
  for (const [metric, values] of byMetric) {
    const latest = values[values.length - 1];
    lines.push(`${metric}: latest ${latest} (${values.length} readings)`);
  }
  return lines.join(', ');
}

function formatPreviousReport(report: WeeklyReport | null): string {
  if (!report) return 'No previous report available.';
  return `Previous week (${report.periodStart} to ${report.periodEnd}): ${report.summary.slice(0, 200)}`;
}

export function buildReportPrompt(bundle: WeeklyDataBundle): AIMessage[] {
  const system: AIMessage = {
    role: 'system',
    content: `You are a personal health data analyst reviewing a week of fitness and nutrition data.
Analyze the provided data and return a JSON object with these exact fields:
{
  "summary": "<1-2 sentence overview of the week>",
  "insights": "<markdown string with 3-5 bullet points of key observations>",
  "actionItems": [
    { "category": "nutrition|workout|recovery|general", "priority": "high|medium|low", "text": "<actionable recommendation>" }
  ]
}
Return ONLY valid JSON. No prose before or after. Be specific and data-driven.`,
  };

  const nutritionText = formatNutritionSummary(bundle.nutrition);
  const workoutText = formatWorkoutSummary(bundle.workouts);
  const biometricText = formatBiometricSummary(bundle.biometrics);
  const previousText = formatPreviousReport(bundle.previousReport);

  const user: AIMessage = {
    role: 'user',
    content: `Weekly Health Data Report

NUTRITION:
${nutritionText}

WORKOUTS:
${workoutText}

BIOMETRICS:
${biometricText}

PREVIOUS WEEK CONTEXT:
${previousText}

Please analyze this data and provide your structured JSON response.`,
  };

  return [system, user];
}
