import type {
  AIMessage,
  WeeklyDataBundle,
  DailyNutritionSummary,
  WorkoutSession,
  BiometricReading,
  WeeklyReport,
} from '@vitals/shared';
import { persona, analysisProtocol, outputFormat } from './prompt-loader.js';

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function num(v: number, decimals = 1): string {
  return v.toFixed(decimals);
}

function formatDailyNutritionTable(
  current: DailyNutritionSummary[],
  previous: DailyNutritionSummary[],
): string {
  if (current.length === 0) return 'No nutrition data available for the current week.';

  const lines: string[] = ['## CURRENT WEEK — DAILY NUTRITION'];
  lines.push(
    '| Date | Calories | Protein (g) | Carbs (g) | Fat (g) | Fiber (g) | Sodium (mg) | Sugar (g) |',
  );
  lines.push(
    '|------|----------|-------------|-----------|---------|-----------|-------------|-----------|',
  );

  for (const d of current) {
    lines.push(
      `| ${d.date} | ${num(d.calories, 0)} | ${num(d.protein)} | ${num(d.carbs)} | ${num(d.fat)} | ${num(d.fiber)} | ${d.sodium != null ? num(d.sodium, 0) : 'N/A'} | ${d.sugar != null ? num(d.sugar) : 'N/A'} |`,
    );
  }

  const avgRow = (data: DailyNutritionSummary[], label: string) => {
    const sodiums = data.filter((d) => d.sodium != null).map((d) => d.sodium!);
    const sugars = data.filter((d) => d.sugar != null).map((d) => d.sugar!);
    return `| ${label} | ${num(avg(data.map((d) => d.calories)), 0)} | ${num(avg(data.map((d) => d.protein)))} | ${num(avg(data.map((d) => d.carbs)))} | ${num(avg(data.map((d) => d.fat)))} | ${num(avg(data.map((d) => d.fiber)))} | ${sodiums.length > 0 ? num(avg(sodiums), 0) : 'N/A'} | ${sugars.length > 0 ? num(avg(sugars)) : 'N/A'} |`;
  };

  lines.push(avgRow(current, '**This Week Avg**'));

  if (previous.length > 0) {
    lines.push(avgRow(previous, '**Prev Week Avg**'));
  }

  return lines.join('\n');
}

function formatBiometricsByMetric(
  current: BiometricReading[],
  previous: BiometricReading[],
): string {
  if (current.length === 0) return 'No biometric data available for the current week.';

  const groupByMetric = (readings: BiometricReading[]) => {
    const map = new Map<string, BiometricReading[]>();
    for (const r of readings) {
      if (!map.has(r.metric)) map.set(r.metric, []);
      map.get(r.metric)!.push(r);
    }
    return map;
  };

  const currentByMetric = groupByMetric(current);
  const previousByMetric = groupByMetric(previous);

  const lines: string[] = ['## BIOMETRICS'];
  lines.push('| Metric | This Week Avg | Prev Week Avg | Δ | Readings |');
  lines.push('|--------|---------------|---------------|---|----------|');

  for (const [metric, readings] of currentByMetric) {
    const values = readings.map((r) => r.value);
    const currentAvg = avg(values);
    const prevReadings = previousByMetric.get(metric) ?? [];
    const prevValues = prevReadings.map((r) => r.value);
    const prevAvg = prevValues.length > 0 ? avg(prevValues) : null;

    const delta = prevAvg != null ? num(currentAvg - prevAvg) : 'N/A';
    const unit = readings[0]?.unit ?? '';

    lines.push(
      `| ${metric} | ${num(currentAvg)} ${unit} | ${prevAvg != null ? `${num(prevAvg)} ${unit}` : 'N/A'} | ${delta} | ${values.length} |`,
    );
  }

  // Add daily detail for key metrics
  const keyMetrics = [
    'weight_kg',
    'body_fat_pct',
    'hrv_ms',
    'resting_heart_rate_bpm',
    'spo2_pct',
    'sleep_hours',
  ];
  for (const metric of keyMetrics) {
    const readings = currentByMetric.get(metric);
    if (!readings || readings.length <= 1) continue;

    lines.push('');
    lines.push(`### ${metric} — Daily Values`);
    lines.push('| Date | Value |');
    lines.push('|------|-------|');
    for (const r of readings) {
      const date = r.date.split('T')[0];
      lines.push(`| ${date} | ${num(r.value)} ${r.unit} |`);
    }
  }

  return lines.join('\n');
}

function formatWorkoutDetail(current: WorkoutSession[], previous: WorkoutSession[]): string {
  if (current.length === 0) return 'No workout data available for the current week.';

  const lines: string[] = ['## TRAINING DATA'];

  // Session summary
  lines.push('### Sessions');
  for (const session of current) {
    const workingSets = session.sets.filter((s) => s.weightKg != null && s.reps != null);
    const totalVolume = workingSets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
    const durationMin = Math.round(session.durationSeconds / 60);

    lines.push('');
    lines.push(
      `**${session.title || 'Untitled'}** — ${session.date} (${durationMin} min, ${workingSets.length} working sets, volume: ${num(totalVolume, 0)} kg)`,
    );
    lines.push('| Exercise | Sets | Weight × Reps | RPE |');
    lines.push('|----------|------|---------------|-----|');

    // Group sets by exercise
    const byExercise = new Map<string, typeof workingSets>();
    for (const s of session.sets) {
      if (!byExercise.has(s.exerciseName)) byExercise.set(s.exerciseName, []);
      byExercise.get(s.exerciseName)!.push(s);
    }

    for (const [exercise, sets] of byExercise) {
      const details = sets
        .map((s) => {
          const w = s.weightKg != null ? `${s.weightKg}kg` : 'BW';
          const r = s.reps != null ? `×${s.reps}` : '';
          return `${w}${r}`;
        })
        .join(', ');
      const rpes = sets.filter((s) => s.rpe != null).map((s) => s.rpe);
      const rpeStr = rpes.length > 0 ? rpes.join(', ') : '-';
      lines.push(`| ${exercise} | ${sets.length} | ${details} | ${rpeStr} |`);
    }
  }

  // Week-over-week volume comparison
  if (previous.length > 0) {
    const calcTotalVolume = (sessions: WorkoutSession[]) =>
      sessions.reduce(
        (total, s) =>
          total +
          s.sets
            .filter((set) => set.weightKg != null && set.reps != null)
            .reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
        0,
      );

    const currentVolume = calcTotalVolume(current);
    const prevVolume = calcTotalVolume(previous);

    lines.push('');
    lines.push('### Week-over-Week Summary');
    lines.push('| Metric | This Week | Prev Week |');
    lines.push('|--------|-----------|-----------|');
    lines.push(`| Sessions | ${current.length} | ${previous.length} |`);
    lines.push(
      `| Training days | ${new Set(current.map((s) => s.date)).size} | ${new Set(previous.map((s) => s.date)).size} |`,
    );
    lines.push(`| Total volume (kg) | ${num(currentVolume, 0)} | ${num(prevVolume, 0)} |`);
  }

  return lines.join('\n');
}

function formatUserNotes(notes?: string): string {
  if (!notes) return '';
  return `## USER NOTES\n${notes}`;
}

function formatWorkoutPlan(plan?: string): string {
  if (!plan) return '';
  return `## PRESCRIBED WORKOUT PLAN\n${plan}`;
}

function formatPreviousReport(report: WeeklyReport | null): string {
  if (!report) return '';
  const context = report.sections
    ? `Previous week scorecard and recommendations are available for trend tracking.`
    : report.summary;
  return `## PREVIOUS REPORT CONTEXT\nPeriod: ${report.periodStart} to ${report.periodEnd}\n${context.slice(0, 500)}`;
}

export function buildReportPrompt(bundle: WeeklyDataBundle): AIMessage[] {
  const system: AIMessage = {
    role: 'system',
    content: `${persona}\n\n${analysisProtocol}\n\n${outputFormat}`,
  };

  const sections = [
    formatDailyNutritionTable(bundle.nutrition, bundle.previousWeekNutrition),
    formatBiometricsByMetric(bundle.biometrics, bundle.previousWeekBiometrics),
    formatWorkoutDetail(bundle.workouts, bundle.previousWeekWorkouts),
    formatWorkoutPlan(bundle.workoutPlan),
    formatUserNotes(bundle.userNotes),
    formatPreviousReport(bundle.previousReport),
  ].filter(Boolean);

  const user: AIMessage = {
    role: 'user',
    content: `# Weekly Health Data for Analysis\n\n${sections.join('\n\n---\n\n')}`,
  };

  return [system, user];
}
