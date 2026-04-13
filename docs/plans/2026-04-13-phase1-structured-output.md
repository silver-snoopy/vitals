# Phase 1: Structured Output via tool_use

**Date:** 2026-04-13
**Status:** Approved — ready for implementation
**Reference:** `docs/research/2026-04-13-agent-sdk-integration-analysis.md`

## Context

The Vitals backend has three features that generate or parse structured JSON from LLM responses using fragile strategies:

1. **Report Generator** (`report-generator.ts`) — 3-tier JSON parsing: `JSON.parse` → `jsonrepair` → brace-matching `extractFirstJson()`. Fails silently to raw text on parse failure.
2. **Plan Tuner** (`tuner.ts`) — Same 3-tier parsing + manual validation + retry-on-failure loop (sends correction message to LLM and tries again).
3. **Plan Parser** (`plan-parser.ts`) — Regex-only heuristic parser. Handles well-formatted `"Day 1: Push / Bench Press 3x8"` patterns but falls back to a single "Notes" day with raw text for anything else.

All three would benefit from Claude's **tool_use for structured output** — define the target JSON schema as a tool, force the LLM to call it, and receive guaranteed-valid structured data. This eliminates `jsonrepair`, `extractFirstJson()`, the tuner retry loop, and the regex parser's fallback failure mode.

---

## Task 1: Add `completeStructured()` to AIProvider + ClaudeProvider

**Goal:** New method that uses tool_use to force schema-constrained JSON output.

### Files to modify
- `packages/shared/src/interfaces/ai.ts` — Add `StructuredOutputConfig` interface and `completeStructured()` to `AIProvider`
- `packages/backend/src/services/ai/claude-provider.ts` — Implement using `tool_choice: { type: 'tool', name: '<schema_tool>' }`
- `packages/backend/src/services/ai/gemini-provider.ts` — Implement using Gemini's `responseMimeType: 'application/json'` + `responseSchema`

### Interface design

```typescript
// In packages/shared/src/interfaces/ai.ts
export interface StructuredOutputConfig {
  /** Tool name used internally for the schema constraint */
  name: string;
  /** Human-readable description of what the output represents */
  description: string;
  /** JSON Schema for the expected output */
  schema: Record<string, unknown>;
}

// Add to AIProvider interface:
completeStructured<T>(
  messages: AIMessage[],
  output: StructuredOutputConfig,
  config?: Partial<AIProviderConfig>,
): Promise<{ data: T } & AICompletionResult>;
```

### Claude implementation approach
1. Convert the `StructuredOutputConfig` into a single Anthropic tool definition
2. Call `messages.create()` with `tool_choice: { type: 'tool', name: output.name }` to force the tool call
3. Extract the tool_use block's `input` field (which IS the structured output) from the response
4. Return it as typed `T` alongside standard `AICompletionResult` (model, usage)

### Gemini implementation approach
1. Use `generationConfig.responseMimeType = 'application/json'` and `generationConfig.responseSchema` to constrain output
2. Parse the response text as JSON
3. Return typed result

---

## Task 2: Migrate Report Generator to Structured Output

**Goal:** Replace 3-tier JSON parsing with schema-constrained tool_use.

### Files to modify
- `packages/backend/src/services/ai/report-generator.ts`

### Schema definition
Define a tool schema matching the existing `ParsedAIReport` shape + `ReportSections`:

```typescript
const REPORT_SCHEMA: StructuredOutputConfig = {
  name: 'submit_weekly_report',
  description: 'Submit the structured weekly health report analysis',
  schema: {
    type: 'object',
    required: ['summary', 'biometricsOverview', 'nutritionAnalysis', 'trainingLoad',
               'crossDomainCorrelation', 'whatsWorking', 'hazards', 'recommendations',
               'scorecard', 'actionItems'],
    properties: {
      summary: { type: 'string', description: 'One-paragraph executive summary' },
      biometricsOverview: { type: 'string' },
      nutritionAnalysis: { type: 'string' },
      trainingLoad: { type: 'string' },
      crossDomainCorrelation: { type: 'string' },
      whatsWorking: { type: 'string' },
      hazards: { type: 'string' },
      recommendations: { type: 'string' },
      scorecard: {
        type: 'object',
        description: 'Domain scores (1-10) with notes',
        additionalProperties: {
          type: 'object',
          properties: { score: { type: 'number' }, notes: { type: 'string' } },
          required: ['score', 'notes'],
        },
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          required: ['category', 'priority', 'text'],
          properties: {
            category: { type: 'string', enum: ['nutrition', 'workout', 'recovery', 'general'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            text: { type: 'string' },
          },
        },
      },
    },
  },
};
```

### Changes to `gatherAndGenerate()`
1. Replace `completeWithRetry(aiProvider, messages)` with `completeStructuredWithRetry(aiProvider, messages, REPORT_SCHEMA)`
2. Replace the entire `parseAIResponse()` function with direct field mapping from the structured result
3. Build `sections` and `insights` directly from the typed response fields

### Code to remove
- `parseAIResponse()` function (lines 101-182) — entire 80-line function
- `extractFirstJson()` function (lines 63-99) — 36 lines
- `isValidScorecard()` function (lines 44-56) — schema enforces it
- `import { jsonrepair }` — no longer needed in this file

---

## Task 3: Migrate Plan Tuner to Structured Output

**Goal:** Replace JSON parsing + validation retry loop with schema-constrained output.

### Files to modify
- `packages/backend/src/services/workout-plans/tuner.ts`
- `packages/backend/src/services/workout-plans/tuner-prompt-builder.ts`

### Schema definition
```typescript
const TUNER_SCHEMA: StructuredOutputConfig = {
  name: 'submit_plan_adjustments',
  description: 'Submit workout plan adjustment recommendations',
  schema: {
    type: 'object',
    required: ['rationale', 'adjustments'],
    properties: {
      rationale: { type: 'string' },
      adjustments: {
        type: 'array',
        items: {
          type: 'object',
          required: ['exerciseRef', 'selectedCandidateIndex', 'evidence', 'rationale'],
          properties: {
            exerciseRef: {
              type: 'object',
              required: ['dayIndex', 'exerciseOrder'],
              properties: { dayIndex: { type: 'number' }, exerciseOrder: { type: 'number' } },
            },
            selectedCandidateIndex: { type: 'number' },
            evidence: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['kind', 'excerpt'],
                properties: {
                  kind: { type: 'string', enum: ['report_section', 'correlation', 'metric', 'hazard', 'exercise_progress'] },
                  refId: { type: 'string' },
                  excerpt: { type: 'string' },
                },
              },
            },
            rationale: { type: 'string' },
          },
        },
      },
    },
  },
};
```

### Changes to `tunePlan()`
1. Replace `completeWithRetry(aiProvider, messages)` with `completeStructuredWithRetry(aiProvider, messages, TUNER_SCHEMA)`
2. Remove the retry-on-validation-failure loop (lines 327-345) — schema enforcement handles this
3. Keep `validateTunerOutput()` as a post-schema safety check (validates candidate index bounds)
4. Update `tuner-prompt-builder.ts` system prompt: remove the "Output Schema (strict JSON)" section since the tool schema enforces it

### Code to remove
- `extractFirstJson()` function (lines 49-85)
- `parseTunerResponse()` function (lines 87-113)
- `import { jsonrepair }` — no longer needed
- Retry loop (lines 327-345)

---

## Task 4: Replace Regex Plan Parser with LLM Structured Output

**Goal:** Replace the regex-based `parseFreeTextPlan()` with an LLM call using structured output to produce `PlanData`.

### Files to modify
- `packages/backend/src/services/workout-plans/plan-parser.ts` — Major rewrite
- `packages/backend/src/routes/workout-plans.ts` — Update POST and PUT handlers to use `aiProvider`

### Schema definition
The `PlanData` schema from `@vitals/shared` maps to JSON Schema:

```typescript
const PLAN_PARSER_SCHEMA: StructuredOutputConfig = {
  name: 'submit_parsed_plan',
  description: 'Submit the structured workout plan parsed from free text',
  schema: {
    type: 'object',
    required: ['splitType', 'days'],
    properties: {
      splitType: { type: 'string', description: 'PPL, UL, FB, or Custom' },
      progressionPersonality: { type: 'string', enum: ['conservative', 'balanced', 'aggressive'] },
      days: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'targetMuscles', 'exercises'],
          properties: {
            name: { type: 'string' },
            targetMuscles: { type: 'array', items: { type: 'string' } },
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'exerciseName', 'orderInDay', 'sets', 'progressionRule',
                           'primaryMuscle', 'secondaryMuscles', 'pattern', 'equipment', 'sfrTier'],
                properties: {
                  id: { type: 'string' },
                  exerciseName: { type: 'string' },
                  orderInDay: { type: 'number' },
                  supersetGroup: { type: 'number' },
                  sets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['type', 'targetReps'],
                      properties: {
                        type: { type: 'string', enum: ['warmup', 'normal', 'drop', 'failure', 'amrap'] },
                        targetReps: {},
                        targetWeightKg: { type: 'number' },
                        targetRpe: { type: 'number' },
                        restSec: { type: 'number' },
                      },
                    },
                  },
                  progressionRule: { type: 'string', enum: ['double', 'linear', 'rpe_stop', 'manual'] },
                  primaryMuscle: { type: 'string' },
                  secondaryMuscles: { type: 'array', items: { type: 'string' } },
                  pattern: { type: 'string', description: 'push, pull, hinge, squat, carry, isolation, other' },
                  equipment: { type: 'string', description: 'barbell, dumbbell, cable, machine, bodyweight, other' },
                  sfrTier: { type: 'string', enum: ['S', 'A', 'B', 'C'] },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};
```

### New function signature
```typescript
export async function parseFreeTextPlan(
  rawText: string,
  aiProvider: AIProvider,
): Promise<PlanData>
```

### System prompt for parser
A concise system prompt instructing the LLM to:
- Parse the free-text workout plan into structured `PlanData`
- Identify exercise names, sets, reps, weight, RPE from any format
- Classify exercises by muscle group, movement pattern, equipment, SFR tier
- Infer split type from day structure
- Use domain knowledge for exercise classification (S-tier = big compounds, etc.)

### Route changes
- `POST /api/workout-plans` and `PUT /api/workout-plans/:id` need access to `aiProvider`
- Create provider in handler via `createAIProvider(opts.env)`
- Handle AI service unavailable (503) same as tune endpoint

### Fallback strategy
- Keep the regex parser as a **fallback** when AI provider is not configured (dev mode, tests)
- Rename existing `parseFreeTextPlan` to `parseFreeTextPlanRegex`
- New code path: try LLM parse → on failure, fall back to regex parse → on failure, return fallback notes plan
- Post-process LLM output with `getExerciseMeta()` to enrich/correct metadata
- Validate with `validatePlanData()` before storage

---

## Task 5: Cleanup

### Dependencies to remove
- `jsonrepair` from `packages/backend/package.json`

### Code deduplication resolved
- `extractFirstJson()` was duplicated in `report-generator.ts` and `tuner.ts` — both copies removed

### Update retry utility
- Add `completeStructuredWithRetry()` to `packages/backend/src/services/ai/retry-utils.ts`

---

## Critical Files Summary

| File | Action |
|------|--------|
| `packages/shared/src/interfaces/ai.ts` | Add `StructuredOutputConfig` + `completeStructured()` to `AIProvider` |
| `packages/backend/src/services/ai/claude-provider.ts` | Implement `completeStructured()` using `tool_choice` |
| `packages/backend/src/services/ai/gemini-provider.ts` | Implement `completeStructured()` using `responseSchema` |
| `packages/backend/src/services/ai/retry-utils.ts` | Add `completeStructuredWithRetry()` |
| `packages/backend/src/services/ai/report-generator.ts` | Use structured output, remove parsing functions |
| `packages/backend/src/services/workout-plans/tuner.ts` | Use structured output, remove parsing + retry loop |
| `packages/backend/src/services/workout-plans/tuner-prompt-builder.ts` | Remove "Output Schema" section from system prompt |
| `packages/backend/src/services/workout-plans/plan-parser.ts` | Rewrite: LLM structured output + regex fallback |
| `packages/backend/src/routes/workout-plans.ts` | Pass `aiProvider` to plan parser |
| `packages/backend/package.json` | Remove `jsonrepair` dependency |

## Existing Utilities to Reuse

- `completeWithRetry()` in `retry-utils.ts` — extend pattern for structured variant
- `getExerciseMeta()` in `exercise-metadata.ts` — post-process LLM plan parser output
- `validatePlanData()` in `plan-schema.ts` — validate LLM parser output before storage
- `validateTunerOutput()` in `tuner.ts` — keep as post-schema safety check
- `flagSuspiciousInput()` in `conversation-service.ts` — already used by tuner
- `buildReportPrompt()` in `prompt-builder.ts` — keep as-is
- `buildTunePrompt()` in `tuner-prompt-builder.ts` — simplify system prompt section

## Verification

1. **Unit tests:** `npm run test -w @vitals/backend` — existing tests must pass
2. **Report quality:** Generate a report and compare sections/scores against previous output
3. **Tuner quality:** Run a tune cycle; verify evidence arrays and candidate indices
4. **Plan parser quality:** Test with:
   - Standard PPL format (`Day 1: Push / Bench Press 3x8`)
   - Unstructured notes ("I want to do bench, squat, deadlift 3 times a week")
   - Partially formatted (mix of headers and free text)
5. **Fallback:** Verify regex fallback works when AI provider is not configured
6. **Regression:** `npm run lint && npm run format:check` must pass
7. **Integration:** `npm run test:integration -w @vitals/backend` if available
