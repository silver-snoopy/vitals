import type { AIMessage, Correlation, WeeklyReport } from '@vitals/shared';
import type { CandidateInput } from './rules/candidate-generator.js';
import type { Candidate } from './rules/progression-rules.js';

/**
 * Input bundle for building the tuner prompt.
 * Mirrors the structure of buildReportPrompt's bundle parameter.
 */
export interface TunerPromptInput {
  candidateInput: CandidateInput;
  /** Pre-computed candidate map from generateCandidates(). */
  candidates: Map<string, Candidate[]>;
  /** Active PHIE correlations for the user. */
  correlations: Correlation[];
  /** The weekly report that triggered this tuning run. */
  report: WeeklyReport;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatPlanTable(input: CandidateInput): string {
  const { planData } = input;
  const lines: string[] = ['## Current Workout Plan\n'];

  for (let d = 0; d < planData.days.length; d++) {
    const day = planData.days[d];
    lines.push(`### Day ${d + 1}: ${day.name}`);
    lines.push(`Target muscles: ${day.targetMuscles.join(', ') || '(none specified)'}\n`);
    lines.push('| # | Exercise | Sets | Reps | Weight (kg) | RPE | Rule |');
    lines.push('|---|----------|------|------|-------------|-----|------|');

    for (const ex of day.exercises) {
      const normalSets = ex.sets.filter((s) => s.type !== 'warmup');
      const setCount = normalSets.length;
      const firstSet = normalSets[0];
      const reps = firstSet
        ? Array.isArray(firstSet.targetReps)
          ? `${firstSet.targetReps[0]}-${firstSet.targetReps[1]}`
          : String(firstSet.targetReps)
        : '-';
      const weight = firstSet?.targetWeightKg != null ? `${firstSet.targetWeightKg}` : '-';
      const rpe = firstSet?.targetRpe != null ? `${firstSet.targetRpe}` : '-';
      lines.push(
        `| ${ex.orderInDay} | ${ex.exerciseName} | ${setCount} | ${reps} | ${weight} | ${rpe} | ${ex.progressionRule} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatCandidateSets(candidates: Map<string, Candidate[]>, input: CandidateInput): string {
  const { planData } = input;
  const lines: string[] = ['## Candidate Adjustments Per Exercise\n'];
  lines.push(
    'For each exercise you MUST select exactly one candidate by its index number (0-based).\n',
  );

  for (let d = 0; d < planData.days.length; d++) {
    const day = planData.days[d];
    lines.push(`### Day ${d + 1}: ${day.name}`);

    for (const ex of day.exercises) {
      const key = `${d}:${ex.orderInDay}`;
      const exCandidates = candidates.get(key) ?? [];
      lines.push(`\n**${ex.exerciseName}** (day ${d}, order ${ex.orderInDay})`);
      lines.push(`\`exerciseRef: { dayIndex: ${d}, exerciseOrder: ${ex.orderInDay} }\``);

      if (exCandidates.length === 0) {
        lines.push('  (no candidates — this exercise must be held)');
        continue;
      }

      for (let i = 0; i < exCandidates.length; i++) {
        const c = exCandidates[i];
        lines.push(
          `  [${i}] **${c.changeType}** — ${c.rationale} (confidence: ${c.confidence ?? 3}/5)`,
        );
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatReportSections(report: WeeklyReport): string {
  const lines: string[] = ['## Weekly Report Summary\n'];
  lines.push(`Period: ${report.periodStart} → ${report.periodEnd}`);
  lines.push(`Summary: ${report.summary}\n`);

  if (report.sections) {
    if (report.sections.trainingLoad) {
      lines.push(`### Training Load\n${report.sections.trainingLoad}\n`);
    }
    if (report.sections.hazards) {
      lines.push(`### Hazards & Red Flags\n${report.sections.hazards}\n`);
    }
    if (report.sections.recommendations) {
      lines.push(`### Recommendations\n${report.sections.recommendations}\n`);
    }
    if (report.sections.whatsWorking) {
      lines.push(`### What's Working\n${report.sections.whatsWorking}\n`);
    }
  }

  return lines.join('\n');
}

function formatCorrelations(correlations: Correlation[]): string {
  if (correlations.length === 0) {
    return '## PHIE Correlations\n\nNo correlations available yet.\n';
  }

  const lines: string[] = ['## PHIE Correlations (strongest signals)\n'];
  lines.push('| ID | Summary | Coefficient | Confidence |');
  lines.push('|----|---------|-------------|------------|');

  const top = correlations.slice(0, 10);
  for (const c of top) {
    lines.push(
      `| ${c.id} | ${c.summary} | ${c.correlationCoefficient.toFixed(2)} | ${c.confidenceLevel} |`,
    );
  }
  return lines.join('\n') + '\n';
}

function formatExerciseHistory(input: CandidateInput): string {
  const { planData, recentSessions } = input;
  const lines: string[] = ['## Last 4 Weeks Exercise Progress\n'];

  for (const day of planData.days) {
    for (const ex of day.exercises) {
      const history: Array<{ date: string; maxWeight: number; reps: number }> = [];

      for (const session of recentSessions) {
        const matchingSets = session.sets.filter(
          (s) =>
            s.exerciseName.toLowerCase() === ex.exerciseName.toLowerCase() &&
            s.weightKg !== null &&
            s.reps !== null,
        );
        if (matchingSets.length > 0) {
          const maxWeight = Math.max(...matchingSets.map((s) => s.weightKg ?? 0));
          const maxReps = Math.max(...matchingSets.map((s) => s.reps ?? 0));
          history.push({ date: session.date, maxWeight, reps: maxReps });
        }
      }

      if (history.length === 0) continue;

      lines.push(`**${ex.exerciseName}**`);
      lines.push('| Date | Max Weight (kg) | Max Reps |');
      lines.push('|------|----------------|----------|');
      for (const h of history.slice(-4)) {
        lines.push(`| ${h.date} | ${h.maxWeight} | ${h.reps} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Builds the system + user messages for the plan tuner AI call.
 *
 * @param input - All data required to assemble the prompt.
 * @returns [system, user] message array ready for completeStructuredWithRetry.
 */
export function buildTunePrompt(input: TunerPromptInput): AIMessage[] {
  const system: AIMessage = {
    role: 'system',
    content: `You are an expert strength and conditioning coach and data analyst. Your task is to recommend adjustments to a client's workout plan for the upcoming week based on their recent performance data and weekly health report.

## Rules (MANDATORY)
1. You MUST select exactly one candidate per exercise from the provided candidate list. Use the 0-based index.
2. You MAY NOT invent loads, reps, exercises, or change types that are not present in the candidate list.
3. Every selection MUST include at least one evidence reference from the provided data (correlations, report sections, or exercise history).
4. You MUST include a rationale string explaining your overall recommendation strategy.
5. Do NOT add or remove training days. Only modify exercises within existing days.
6. If no progression signal is clear, select the "hold" candidate.

Every element in the adjustments array must have a non-empty evidence array.`,
  };

  const userContent = [
    formatPlanTable(input.candidateInput),
    formatCandidateSets(input.candidates, input.candidateInput),
    formatReportSections(input.report),
    formatCorrelations(input.correlations),
    formatExerciseHistory(input.candidateInput),
  ].join('\n---\n\n');

  const user: AIMessage = {
    role: 'user',
    content: userContent,
  };

  return [system, user];
}
