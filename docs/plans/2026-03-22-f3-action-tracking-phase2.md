# F3 Action Item Tracking — Phase 2: Outcomes + Chat Tools + Report Feedback

**Date:** 2026-03-22
**Branch:** `feature/f3-action-tracking-phase2`
**Depends on:** Phase 1 (`docs/plans/2026-03-22-f3-action-tracking-phase1.md`)
**Research:** `docs/research/2026-03-22-actionable-intelligence-features.md`
**Status:** Approved for implementation (after Phase 1 is merged)

---

## Context

Phase 1 established the foundation: persistent action items with lifecycle management, an interactive dashboard widget, and a dedicated actions page. Phase 2 closes the loop:

1. **Outcome measurement** — Did completing an action item actually move the target metric?
2. **Chat integration** — Ask the AI about your action items and their outcomes
3. **Report feedback** — Next week's report knows what you completed and what improved
4. **AI-generated target metrics** — The report AI assigns measurable targets to each action item
5. **Attribution reporting** — Monthly rollup: "8 of 12 completed items correlated with improvement"

**Key design decisions:**
- Outcome measurement happens at next report generation (weekly cadence)
- On-demand outcome snapshots available via chat tool
- Attribution uses correlation language, not causation (Exist.io principle)
- Adherence-neutral: expired/incomplete items are context, not guilt

---

## 1. Ordered Task List

| # | Task | Package | Depends On |
|---|------|---------|------------|
| 1 | Enhance `ActionItem` type with AI-generated target fields | shared | — |
| 2 | Update AI report prompt to generate target metrics per action item | backend | 1 |
| 3 | Outcome measurement service: `services/action-items/outcome-measurer.ts` | backend | Phase 1 DB |
| 4 | Integrate outcome measurement into report generation pipeline | backend | 3 |
| 5 | Expire stale action items (system job during report generation) | backend | Phase 1 DB |
| 6 | Supersede old items when new report generates replacements | backend | Phase 1 DB |
| 7 | Chat tool: `query_action_items` | backend | Phase 1 DB |
| 8 | Chat tool: `query_action_outcomes` | backend | 3 |
| 9 | Update chat persona prompt with action item context | backend | 7, 8 |
| 10 | Feed action item context into report generation prompt | backend | Phase 1 DB |
| 11 | Build shared + backend, verify compilation | shared, backend | 1–10 |
| 12 | Attribution summary endpoint | backend | 3 |
| 13 | Outcome badges on completed action items (frontend) | frontend | 3 |
| 14 | Attribution summary card on ActionsPage | frontend | 12 |
| 15 | Enhanced InsightsPanel with outcome indicators | frontend | 13 |
| 16 | Build frontend, verify compilation | frontend | 12–15 |
| 17 | Backend unit tests | backend | 3–12 |
| 18 | Frontend unit tests | frontend | 13–15 |
| 19 | E2E tests | e2e | 11, 16 |

---

## 2. Files to Create / Modify

### shared

| File | Action | Change |
|------|--------|--------|
| `packages/shared/src/types/report.ts` | Modify | Extend `ActionItem` with optional `targetMetric`, `targetDirection` fields so the AI report output includes them. Add `ActionItemOutcome` interface. Add `AttributionSummary` interface. |

### backend — AI Prompts

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/ai/prompts/output-format.md` | Modify | Update action item schema in the AI prompt to require `targetMetric` (string, nullable) and `targetDirection` (increase/decrease/maintain, nullable) per item. Add examples showing metric linking. |
| `packages/backend/src/services/ai/prompts/analysis-protocol.md` | Modify | Add Step 6: "Action Item Follow-Up" — review completed/deferred items from previous week, note which metrics moved. |
| `packages/backend/src/services/ai/prompts/chat-persona.md` | Modify | Add section on action item tool usage: when to use `query_action_items`, how to interpret outcomes, correlation vs causation language. |

### backend — Outcome Measurement

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/action-items/outcome-measurer.ts` | Create | `measureOutcomes(db, userId, completedItems)`: For each completed item with a `targetMetric`, query the metric's current value vs `baselineValue`. Compute direction (improved/declined/stable). Set `outcomeValue`, `outcomeConfidence`, `outcomeMeasuredAt`. |
| `packages/backend/src/services/action-items/lifecycle-manager.ts` | Create | `expireStaleItems(db, userId)`: Mark items past `due_by` as expired. `supersedeItems(db, userId, reportId, newItems)`: When new report generates items in same category, mark old pending/active items as superseded if semantically replaced. |

### backend — Report Integration

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/ai/report-generator.ts` | Modify | Before generating new report: (1) call `measureOutcomes()` for completed items, (2) call `expireStaleItems()`, (3) build action item follow-up context and include in `WeeklyDataBundle`. After generating: (4) call `supersedeItems()` for replaced items. |
| `packages/backend/src/services/ai/prompt-builder.ts` | Modify | Add action item follow-up section to the prompt: list completed items with outcomes, deferred items, expired items. This gives the AI context for generating better next-week actions. |

### backend — Chat Tools

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/ai/tools/health-tools.ts` | Modify | Add 2 new tool definitions: `query_action_items` and `query_action_outcomes` |
| `packages/backend/src/services/ai/tools/tool-executor.ts` | Modify | Add case handlers for both new tools, calling query functions from `db/queries/action-items.ts` |

### backend — API

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/routes/action-items.ts` | Modify | Add `GET /api/action-items/attribution` endpoint returning `AttributionSummary` |
| `packages/backend/src/db/queries/action-items.ts` | Modify | Add `getActionItemsWithOutcomes()`, `getAttributionSummary()`, `measureAndUpdateOutcome()`, `expireStaleItems()`, `supersedeItems()` |

### frontend — Outcome Display

| File | Action | Change |
|------|--------|--------|
| `packages/frontend/src/components/actions/OutcomeBadge.tsx` | Create | Small badge showing outcome: green checkmark + "Improved" / amber dash + "Stable" / red arrow + "Declined" with confidence indicator |
| `packages/frontend/src/components/actions/InteractiveActionItemCard.tsx` | Modify | For completed items, show `OutcomeBadge` if outcome data exists. Show target metric and direction. |
| `packages/frontend/src/components/actions/AttributionCard.tsx` | Create | Summary card: "This month: 8/12 completed items correlated with improvement. Completion rate: 75%." with mini donut chart. |
| `packages/frontend/src/components/actions/ActionsPage.tsx` | Modify | Add `AttributionCard` at top of page. Completed items section shows outcome badges. |
| `packages/frontend/src/components/dashboard/InsightsPanel.tsx` | Modify | Completed items in the widget show small outcome indicator (checkmark or dash). |

### frontend — API Hooks

| File | Action | Change |
|------|--------|--------|
| `packages/frontend/src/api/hooks/useActionItems.ts` | Modify | Add `useAttributionSummary()` hook for the attribution endpoint |

### Tests

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/action-items/__tests__/outcome-measurer.test.ts` | Create | Test metric comparison logic, confidence assignment, edge cases (no baseline, metric not found) |
| `packages/backend/src/services/action-items/__tests__/lifecycle-manager.test.ts` | Create | Test expiration, superseding logic |
| `packages/backend/src/routes/__tests__/action-items-attribution.test.ts` | Create | Test attribution endpoint |
| `packages/frontend/src/components/actions/__tests__/OutcomeBadge.test.tsx` | Create | Render improved/stable/declined states |
| `packages/frontend/src/components/actions/__tests__/AttributionCard.test.tsx` | Create | Render summary with various data states |
| `e2e/action-item-outcomes.spec.ts` | Create | Full loop: generate report → accept items → complete → generate another report → verify outcomes measured → check attribution |

---

## 3. Chat Tool Definitions

### `query_action_items`

```typescript
{
  name: 'query_action_items',
  description:
    'Query the user\'s tracked action items from weekly reports. Can filter by status (pending, active, completed, deferred, expired) and category (nutrition, workout, recovery, general). Use this when the user asks about their action items, tasks, or recommendations from reports.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'active', 'completed', 'deferred', 'expired', 'all'],
        description: 'Filter by status. Default: "active" to show current items.',
      },
      category: {
        type: 'string',
        enum: ['nutrition', 'workout', 'recovery', 'general'],
        description: 'Filter by category. Omit to show all categories.',
      },
      limit: {
        type: 'number',
        description: 'Max items to return. Default: 20.',
      },
    },
    required: [],
  },
}
```

### `query_action_outcomes`

```typescript
{
  name: 'query_action_outcomes',
  description:
    'Query outcome measurements for completed action items. Shows whether target metrics improved after the user completed recommended actions. Use this when the user asks about results, impact, or effectiveness of their actions. Can also generate an on-demand outcome snapshot for a specific item.',
  inputSchema: {
    type: 'object',
    properties: {
      actionItemId: {
        type: 'string',
        description: 'Specific action item ID to measure outcome for. If provided, generates a fresh snapshot.',
      },
      period: {
        type: 'string',
        enum: ['week', 'month', 'all'],
        description: 'Time period for attribution summary. Default: "month".',
      },
    },
    required: [],
  },
}
```

---

## 4. Outcome Measurement Logic

### `measureOutcomes(db, userId, items)`

For each completed item with a `targetMetric`:

1. **Capture baseline** — If `baselineValue` is null, query the metric value for the week BEFORE the action item was created (from `measurements` or `daily_aggregates`). Store as `baselineValue`.
2. **Capture outcome** — Query the metric's average value for the 7 days after `completedAt`.
3. **Determine direction:**
   - If `targetDirection` = 'increase' and outcome > baseline → **improved**
   - If `targetDirection` = 'decrease' and outcome < baseline → **improved**
   - If `targetDirection` = 'maintain' and |outcome - baseline| < 5% → **improved**
   - Otherwise → **declined** or **stable** (within 2% threshold)
4. **Assign confidence:**
   - `high` — metric moved > 10% in expected direction AND at least 5 data points
   - `medium` — metric moved 2-10% in expected direction OR fewer data points
   - `low` — metric barely moved OR insufficient data (< 3 data points)
5. **Update DB** — Set `outcome_value`, `outcome_confidence`, `outcome_measured_at`

### Metric Resolution

The `targetMetric` string maps to measurement queries:
- `protein_g`, `calories`, `carbs_g`, `fat_g` → `queryDailyNutritionSummary` → extract field
- `body_weight_kg`, `body_fat_percent`, `hrv_rmssd` → `queryMeasurementsByMetrics`
- `training_volume`, `training_frequency` → `queryWorkoutSessions` → aggregate
- For non-measurable targets (e.g., "general" category), `targetMetric` is null → no outcome measurement

---

## 5. Report Feedback Loop

### WeeklyDataBundle Extension

```typescript
interface WeeklyDataBundle {
  // ... existing fields ...
  actionItemFollowUp?: {
    completed: Array<{
      text: string;
      category: string;
      targetMetric?: string;
      outcome?: 'improved' | 'stable' | 'declined';
      outcomeConfidence?: string;
    }>;
    deferred: Array<{ text: string; category: string; reason?: string }>;
    expired: Array<{ text: string; category: string }>;
    completionRate: number; // 0-1
  };
}
```

### Prompt Addition

Added to `buildReportPrompt()` output:

```markdown
## Action Item Follow-Up (Previous Week)

Completion rate: 60% (3 of 5 items)

### Completed Items
1. [NUTRITION] "Increase protein to 150g/day" → Target: protein_g increase → IMPROVED (138g → 152g, high confidence)
2. [WORKOUT] "Add a deload set to heavy compounds" → Target: training_volume maintain → STABLE (within 3%)
3. [RECOVERY] "Improve sleep consistency" → No measurable target

### Deferred Items
1. [NUTRITION] "Reduce sodium below 2000mg" — deferred to next week

### Expired Items
1. [GENERAL] "Schedule recovery week" — expired without action

Consider these outcomes when generating this week's recommendations. Reinforce what worked, adjust what didn't, and address deferred items if still relevant.
```

---

## 6. Attribution Summary

### `GET /api/action-items/attribution`

Query params: `period=week|month|quarter` (default: month)

Response:
```typescript
interface AttributionSummary {
  period: string;
  totalItems: number;
  completedItems: number;
  completionRate: number; // 0-1
  measuredItems: number; // completed items with target metrics
  improvedItems: number;
  stableItems: number;
  declinedItems: number;
  improvementRate: number; // improved / measured, 0-1
  topImprovements: Array<{
    text: string;
    category: string;
    metric: string;
    change: string; // e.g., "+14g protein/day"
  }>;
}
```

### Frontend Attribution Card

```
┌─────────────────────────────────────────────────────┐
│  This Month's Impact                                 │
│  ─────────────────────────────────────────────────── │
│                                                       │
│  [====75%====]  Completion Rate (9/12 items)         │
│                                                       │
│  Of 7 measured items:                                │
│  🟢 5 improved  🟡 1 stable  🔴 1 declined          │
│                                                       │
│  Top wins:                                           │
│  • Protein intake: +14g/day average                  │
│  • Training volume: maintained during cut            │
└─────────────────────────────────────────────────────┘
```

---

## 7. Lifecycle Rules (System Automation)

These run during report generation, before the new report is created:

1. **Expire stale items:**
   - Any item with `status IN ('pending', 'active')` AND `due_by < today` → set `status = 'expired'`
   - Default `due_by` is 7 days from creation (set in Phase 1)

2. **Supersede replaced items:**
   - When new report generates items, compare with existing `pending`/`active` items in same category
   - If new item text is semantically similar (>70% overlap via simple keyword matching — not ML), mark old as `superseded`
   - Simple approach: if new report has a nutrition action and there's an existing pending nutrition action, supersede the old one
   - Conservative: only supersede `pending` items, not `active` ones (user already committed to active)

3. **Measure outcomes:**
   - All items with `status = 'completed'` AND `outcome_measured_at IS NULL` get measured
   - Run before prompt building so results are available for AI context

---

## 8. Dependencies

No new npm packages required. All built on existing stack.

---

## 9. Test Strategy

### Backend Unit Tests
- `outcome-measurer.test.ts`: metric improved/stable/declined detection, confidence assignment, missing baseline handling, non-measurable targets (null metric)
- `lifecycle-manager.test.ts`: expiration by due_by date, superseding logic (same category, pending only), no false supersedes across categories
- `action-items-attribution.test.ts`: correct aggregation across periods, handles zero-items edge case
- `report-generator.test.ts`: verify outcome measurement + lifecycle runs before new report generation, verify action item follow-up appears in prompt context
- `tool-executor.test.ts`: verify `query_action_items` and `query_action_outcomes` tools return correct data

### Frontend Unit Tests
- `OutcomeBadge.test.tsx`: renders improved/stable/declined with correct colors and confidence
- `AttributionCard.test.tsx`: renders summary stats, handles empty data, displays top improvements

### E2E Tests
- Full closed loop: generate report → accept items → complete items → generate new report → verify outcomes are measured and displayed
- Chat integration: ask "what are my active actions?" → verify tool call and response
- Chat snapshot: ask "how did my protein action work out?" → verify on-demand outcome measurement
- Attribution page: navigate to actions, verify attribution card shows correct data

---

## 10. Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI doesn't reliably generate `targetMetric` / `targetDirection` | Many items unmeasurable | Strong prompt engineering with examples; fallback: items without targets still track status, just no outcome measurement |
| Superseding logic is too aggressive | User's accepted items get replaced unexpectedly | Only supersede `pending` items, never `active`. Simple keyword matching, not semantic. User can re-accept superseded items. |
| Outcome measurement queries are slow (scanning large metric tables) | Report generation slows down | Limit to completed items from last 30 days; use existing indexes on measurements table |
| Metric resolution mapping gets out of sync | Wrong baselines/outcomes | Central metric resolution function with exhaustive mapping; unit test covers all known metrics |
| Chat tool returns too much data | Slow responses, token waste | Default limit of 20 items; `query_action_outcomes` returns summary first, details on request |
| Correlation ≠ causation — users over-attribute | Trust issues when correlations don't hold | Always use "correlated with" language, never "caused by". Show confidence levels. Follow Exist.io principle. |
