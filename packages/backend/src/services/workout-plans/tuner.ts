import type pg from 'pg';
import type {
  AIProvider,
  PlanAdjustmentBatch,
  PlanAdjustment,
  PlanSet,
  PlanData,
  EvidenceKind,
} from '@vitals/shared';
import { jsonrepair } from 'jsonrepair';
import {
  getPlanVersion,
  getPlanById,
  insertAdjustmentBatchWithAdjustments,
  getAdjustmentBatch,
} from '../../db/queries/workout-plans.js';
import { getReportById, logAiGeneration } from '../../db/queries/reports.js';
import { listCorrelations } from '../../db/queries/correlations.js';
import { queryWorkoutSessions } from '../../db/queries/workouts.js';
import { generateCandidates } from './rules/candidate-generator.js';
import type { CandidateInput } from './rules/candidate-generator.js';
import type { Candidate } from './rules/progression-rules.js';
import { applyMaxChangeRatio } from './rules/safety-caps.js';
import { buildTunePrompt } from './tuner-prompt-builder.js';
import { validatePlanData } from './plan-schema.js';
import { flagSuspiciousInput } from '../ai/conversation-service.js';
import { completeWithRetry } from '../ai/retry-utils.js';

// ---------------------------------------------------------------------------
// Types for AI output
// ---------------------------------------------------------------------------

interface TunerAdjustmentSelection {
  exerciseRef: { dayIndex: number; exerciseOrder: number };
  selectedCandidateIndex: number;
  evidence: Array<{ kind: string; refId?: string; excerpt: string }>;
  rationale: string;
}

interface TunerAIOutput {
  rationale: string;
  adjustments: TunerAdjustmentSelection[];
}

// ---------------------------------------------------------------------------
// JSON parsing helpers (mirrors report-generator.ts)
// ---------------------------------------------------------------------------

function extractFirstJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.substring(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseTunerResponse(content: string): TunerAIOutput | null {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(cleaned)) as Record<string, unknown>;
    } catch {
      parsed = extractFirstJson(cleaned);
    }
  }

  if (!parsed) return null;

  const rationale = typeof parsed['rationale'] === 'string' ? parsed['rationale'] : '';
  const adjustments = Array.isArray(parsed['adjustments'])
    ? (parsed['adjustments'] as TunerAdjustmentSelection[])
    : [];

  return { rationale, adjustments };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateTunerOutput(
  output: TunerAIOutput,
  candidates: Map<string, Candidate[]>,
): { valid: boolean; reason?: string } {
  for (const adj of output.adjustments) {
    if (!adj.evidence || adj.evidence.length === 0) {
      return {
        valid: false,
        reason: `Missing evidence for exercise (day ${adj.exerciseRef.dayIndex}, order ${adj.exerciseRef.exerciseOrder})`,
      };
    }

    const key = `${adj.exerciseRef.dayIndex}:${adj.exerciseRef.exerciseOrder}`;
    const exCandidates = candidates.get(key);
    if (!exCandidates) {
      return { valid: false, reason: `No candidates found for key ${key}` };
    }

    if (
      typeof adj.selectedCandidateIndex !== 'number' ||
      adj.selectedCandidateIndex < 0 ||
      adj.selectedCandidateIndex >= exCandidates.length
    ) {
      return {
        valid: false,
        reason: `Invalid selectedCandidateIndex ${adj.selectedCandidateIndex} for key ${key} (max ${exCandidates.length - 1})`,
      };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// completeWithRetry (mirrors report-generator.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Map AI selections to PlanAdjustment fields
// ---------------------------------------------------------------------------

function buildAdjustmentFields(
  batchId: string,
  selection: TunerAdjustmentSelection,
  candidates: Map<string, Candidate[]>,
  planData: PlanData,
): Parameters<typeof insertAdjustmentBatchWithAdjustments>[2][number] & { batchId: string } {
  const key = `${selection.exerciseRef.dayIndex}:${selection.exerciseRef.exerciseOrder}`;
  const exCandidates = candidates.get(key)!;
  const chosen = exCandidates[selection.selectedCandidateIndex];

  const day = planData.days[selection.exerciseRef.dayIndex];
  const exercise = day?.exercises.find((e) => e.orderInDay === selection.exerciseRef.exerciseOrder);
  const oldValue: PlanSet[] = exercise?.sets ?? [];

  const confidence = (chosen.confidence ?? 3) as PlanAdjustment['confidence'];

  return {
    batchId,
    exerciseRef: selection.exerciseRef,
    changeType: chosen.changeType as PlanAdjustment['changeType'],
    oldValue,
    newValue: chosen.newValue,
    evidence: selection.evidence.map((e) => ({
      kind: e.kind as EvidenceKind,
      refId: e.refId,
      excerpt: e.excerpt,
    })),
    confidence,
    rationale: selection.rationale || chosen.rationale,
  };
}

// ---------------------------------------------------------------------------
// Main tunePlan function
// ---------------------------------------------------------------------------

/**
 * Main entry point for the workout plan fine-tuner.
 *
 * Orchestration flow (9 steps):
 * 1. Load plan version + plan
 * 2. Load weekly report
 * 3. Load PHIE correlations
 * 4. Load last-4-week workout sessions
 * 5. Generate candidate set per exercise
 * 6. Build tuner prompt + call AI
 * 7. Parse + validate AI response (retry once on evidence failure)
 * 8. Persist batch + adjustment rows
 * 9. Log via logAiGeneration
 */
export async function tunePlan(
  pool: pg.Pool,
  aiProvider: AIProvider,
  userId: string,
  planVersionId: string,
  reportId: string,
): Promise<PlanAdjustmentBatch> {
  // Step 1: Load plan version + plan
  const planVersion = await getPlanVersion(pool, planVersionId);
  if (!planVersion) {
    const err = new Error(`Plan version not found: ${planVersionId}`);
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  const plan = await getPlanById(pool, planVersion.planId);
  if (!plan) {
    const err = new Error(`Plan not found: ${planVersion.planId}`);
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  const planData = validatePlanData(planVersion.data);

  // Step 2: Load the weekly report
  const report = await getReportById(pool, reportId);
  if (!report) {
    const err = new Error(`Report not found: ${reportId}`);
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  // Step 3: Load PHIE correlations
  const correlations = await listCorrelations(pool, userId);

  // Step 4: Load last-4-week workout sessions
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  const recentSessions = await queryWorkoutSessions(pool, userId, startDate, endDate);

  // Step 5: Generate candidate set per exercise
  const candidateInput: CandidateInput = {
    planVersion,
    planData,
    recentSessions,
    report,
    correlations,
  };
  const candidates = generateCandidates(candidateInput);

  // Step 6: Sanitize plan content for prompt-injection patterns (H5 — defense in depth).
  // User-supplied text (day names, exercise notes, plan notes) is embedded in the LLM prompt.
  // Strip offending content rather than rejecting the tune run.
  const fieldsToScan: Array<{ label: string; value: string | undefined }> = [
    { label: 'plan.notes', value: plan.notes },
  ];
  for (const day of planData.days) {
    fieldsToScan.push({ label: `day.name:${day.name}`, value: day.name });
    for (const exercise of day.exercises) {
      fieldsToScan.push({ label: `exercise.name:${exercise.exerciseName}`, value: exercise.exerciseName });
      if (exercise.notes) {
        fieldsToScan.push({ label: `exercise.notes:${exercise.exerciseName}`, value: exercise.notes });
      }
    }
  }

  const suspiciousFields: string[] = [];
  for (const { label, value } of fieldsToScan) {
    if (value && flagSuspiciousInput(value)) {
      suspiciousFields.push(label);
    }
  }

  if (suspiciousFields.length > 0) {
    // Log warning but continue — strip the offending fields from candidateInput
    const logContext = { planId: plan.id, fields: suspiciousFields };
    // Use console.warn since we don't have a logger at this layer; caller logs on error
    console.warn('[tuner] suspicious input detected — stripping fields', logContext);

    // Strip suspicious content in planData (deep copy) before embedding in the LLM prompt
    const sanitizedPlanData: PlanData = {
      ...planData,
      days: planData.days.map((day) => ({
        ...day,
        name: flagSuspiciousInput(day.name) ? '[content removed for safety]' : day.name,
        exercises: day.exercises.map((exercise) => ({
          ...exercise,
          exerciseName: flagSuspiciousInput(exercise.exerciseName)
            ? '[content removed for safety]'
            : exercise.exerciseName,
          notes:
            exercise.notes && flagSuspiciousInput(exercise.notes)
              ? '[content removed for safety]'
              : exercise.notes,
        })),
      })),
    };
    // Rebuild candidateInput with sanitized data
    candidateInput.planData = sanitizedPlanData;
  }

  // Build prompt + call AI
  const messages = buildTunePrompt({ candidateInput, candidates, correlations, report });

  let aiResult = await completeWithRetry(aiProvider, messages);
  let parsed = parseTunerResponse(aiResult.content);
  let validation = parsed
    ? validateTunerOutput(parsed, candidates)
    : { valid: false, reason: 'Could not parse AI response' };

  // Step 7: Retry once on evidence/validation failure
  if (!validation.valid) {
    const retryMessages = [
      ...messages,
      { role: 'assistant' as const, content: aiResult.content },
      {
        role: 'user' as const,
        content: `Your response was invalid: ${validation.reason}. Please respond with valid JSON matching the required schema. Every adjustment MUST have a non-empty evidence array and a valid selectedCandidateIndex.`,
      },
    ];
    aiResult = await completeWithRetry(aiProvider, retryMessages);
    parsed = parseTunerResponse(aiResult.content);
    validation = parsed
      ? validateTunerOutput(parsed, candidates)
      : { valid: false, reason: 'Could not parse AI response after retry' };

    if (!validation.valid || !parsed) {
      throw new Error('tuner: LLM output failed evidence validation after 1 retry');
    }
  }

  if (!parsed) {
    throw new Error('tuner: LLM output failed evidence validation after 1 retry');
  }

  // Step 8a: Apply max-change-ratio cap (40% of exercises may change per batch).
  // Build a Map<exerciseKey, selected Candidate> from the LLM's selections, run the cap,
  // then force any demoted selections back to 'hold'. This prevents the LLM from changing
  // too many exercises at once, which could destabilise the programme.
  const totalExerciseCount = planData.days.reduce((sum, d) => sum + d.exercises.length, 0);
  const selectedByKey = new Map<string, Candidate>();
  for (const selection of parsed.adjustments) {
    const key = `${selection.exerciseRef.dayIndex}:${selection.exerciseRef.exerciseOrder}`;
    const exCandidates = candidates.get(key);
    if (exCandidates) {
      selectedByKey.set(key, exCandidates[selection.selectedCandidateIndex]);
    }
  }
  const cappedSelection = applyMaxChangeRatio(selectedByKey, totalExerciseCount);

  // Reflect cap in parsed.adjustments — demoted entries become hold (last candidate in list)
  parsed.adjustments = parsed.adjustments.map((selection) => {
    const key = `${selection.exerciseRef.dayIndex}:${selection.exerciseRef.exerciseOrder}`;
    const cappedCandidate = cappedSelection.get(key);
    if (cappedCandidate && cappedCandidate.changeType === 'hold') {
      const exCandidates = candidates.get(key);
      // Re-map to the hold candidate index (always last in the list)
      const holdIndex = exCandidates ? exCandidates.length - 1 : selection.selectedCandidateIndex;
      return { ...selection, selectedCandidateIndex: holdIndex };
    }
    return selection;
  });

  // Persist batch + adjustments atomically in a single transaction
  const adjustmentRows = parsed.adjustments.map((selection) => {
    const { batchId: _ignored, ...fields } = buildAdjustmentFields(
      '', // batchId not needed here — insertAdjustmentBatchWithAdjustments assigns it
      selection,
      candidates,
      planData,
    );
    return fields;
  });

  const batchId = await insertAdjustmentBatchWithAdjustments(
    pool,
    {
      planId: plan.id,
      sourceVersionId: planVersion.id,
      reportId,
      aiProvider: aiProvider.name(),
      aiModel: aiResult.model,
      rationale: parsed.rationale,
    },
    adjustmentRows,
  );

  // Step 9: Log via logAiGeneration
  await logAiGeneration(pool, {
    userId,
    provider: aiProvider.name(),
    model: aiResult.model,
    promptTokens: aiResult.usage.promptTokens,
    completionTokens: aiResult.usage.completionTokens,
    totalTokens: aiResult.usage.totalTokens,
    purpose: 'plan_tune',
  });

  // Return the full batch with adjustments
  const batch = await getAdjustmentBatch(pool, batchId);
  if (!batch) {
    throw new Error(`Failed to retrieve persisted batch: ${batchId}`);
  }

  return batch;
}
