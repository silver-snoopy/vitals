import type {
  DailyNutritionSummary,
  WorkoutSession,
  BiometricReading,
  WeeklyReport,
} from '@vitals/shared';

export interface KpiMetric {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'stable'; delta: string };
  sparklineData?: number[];
  sparklineColor?: string;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function computeTrend(
  values: number[],
): { direction: 'up' | 'down' | 'stable'; delta: string } | undefined {
  if (values.length < 2) return undefined;
  const mid = Math.floor(values.length / 2);
  const firstHalf = avg(values.slice(0, mid));
  const secondHalf = avg(values.slice(mid));

  if (firstHalf === 0) return undefined;

  const pctChange = ((secondHalf - firstHalf) / Math.abs(firstHalf)) * 100;
  const absDelta = Math.abs(secondHalf - firstHalf);

  if (Math.abs(pctChange) <= 1) {
    return { direction: 'stable', delta: 'stable' };
  }

  const direction = pctChange > 0 ? 'up' : 'down';
  const sign = direction === 'up' ? '+' : '-';

  return { direction, delta: `${sign}${Math.round(absDelta)}` };
}

export function computeKpiData(
  nutrition: DailyNutritionSummary[],
  workouts: WorkoutSession[],
  biometrics: BiometricReading[],
  report: WeeklyReport | null | undefined,
): KpiMetric[] {
  // Avg Calories
  const calValues = nutrition.map((d) => d.calories);
  const avgCal = Math.round(avg(calValues));

  // Sessions count
  const sessionCount = workouts.length;

  // Avg Weight
  const weightReadings = biometrics.filter((b) => b.metric === 'weight_kg');
  const weightValues = weightReadings.map((b) => b.value);
  const avgWeight = weightValues.length > 0 ? avg(weightValues).toFixed(1) : '—';

  // Avg Protein
  const proteinValues = nutrition.map((d) => d.protein);
  const avgProtein = Math.round(avg(proteinValues));

  // AI Score
  const aiScore = report?.sections?.scorecard?.overall?.score ?? null;

  return [
    {
      label: 'avg cal',
      value: avgCal > 0 ? avgCal.toLocaleString() : '—',
      trend: computeTrend(calValues),
      sparklineData: calValues,
      sparklineColor: '#f97316',
    },
    {
      label: 'sessions',
      value: sessionCount.toString(),
      trend: undefined, // discrete count, no trend
    },
    {
      label: 'weight',
      value: avgWeight === '—' ? '—' : `${avgWeight} kg`,
      trend: computeTrend(weightValues),
      sparklineData: weightValues.length > 0 ? weightValues : undefined,
      sparklineColor: '#a855f7',
    },
    {
      label: 'protein',
      value: avgProtein > 0 ? `${avgProtein}g` : '—',
      trend: computeTrend(proteinValues),
      sparklineData: proteinValues,
      sparklineColor: '#3b82f6',
    },
    {
      label: 'AI score',
      value: aiScore !== null ? `${aiScore}/10` : '—',
      trend: undefined, // single value, no trend
    },
  ];
}
