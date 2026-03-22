# F3 Action Item Tracking — Phase 1: Persistence + Widget + Basic CRUD

**Date:** 2026-03-22
**Branch:** `feature/f3-action-tracking-phase1`
**Research:** `docs/research/2026-03-22-actionable-intelligence-features.md`
**Status:** Approved for implementation

---

## Context

The weekly AI report generates 3-7 action items that are currently ephemeral — stored as a JSONB blob inside the report and displayed read-only. Phase 1 promotes these into persistent, trackable entities with a user-facing interactive widget.

**Key design decisions from user gate:**
- **Acceptance model:** Items start as "pending" — user explicitly accepts (intentional engagement, not opt-out)
- **Outcome measurement:** Measured at next report generation (weekly cadence), with on-demand snapshots via chat (Phase 2)
- **Routing:** `/reports/actions` for all-actions view (semantically under Reports)
- **Scope:** Phase 1 covers persistence + widget + CRUD. Phase 2 adds outcome measurement, chat tools, and report feedback loop.

**UX principles (from research):**
- Adherence-neutral (MacroFactor): no guilt, just adaptation
- Milestones over streaks (avoid streak anxiety)
- Low friction: accept with one tap, complete with one tap
- The dashboard widget is the daily touchpoint; the actions page is the weekly reflection view

---

## 1. Ordered Task List

Execute in this sequence. Build order: shared → backend → frontend.

| # | Task | Package | Depends On |
|---|------|---------|------------|
| 1 | Add `TrackedActionItem` type + action item status types | shared | — |
| 2 | DB migration 008: `action_items` table | backend | — |
| 3 | DB query module: `db/queries/action-items.ts` | backend | 1, 2 |
| 4 | Action item routes: CRUD endpoints | backend | 3 |
| 5 | Report generator hook: promote items on report save | backend | 3 |
| 6 | Register new routes in `app.ts` | backend | 4 |
| 7 | Build shared + backend, verify compilation | shared, backend | 1–6 |
| 8 | API hooks: `useActionItems.ts` | frontend | 4 |
| 9 | Zustand store: `useActionItemsStore.ts` | frontend | — |
| 10 | Interactive `ActionItemCard` component | frontend | 8, 9 |
| 11 | Evolve `InsightsPanel` to show interactive action items | frontend | 10 |
| 12 | Actions page: `/reports/actions` | frontend | 8, 10 |
| 13 | Route wiring in `App.tsx` + link from InsightsPanel | frontend | 12 |
| 14 | Build frontend, verify compilation | frontend | 8–13 |
| 15 | Backend unit tests | backend | 3–6 |
| 16 | Frontend unit tests | frontend | 8–13 |
| 17 | E2E tests | e2e | 7, 14 |

---

## 2. Files to Create / Modify

### shared

| File | Action | Change |
|------|--------|--------|
| `packages/shared/src/types/report.ts` | Modify | Add `ActionItemStatus`, `TrackedActionItem` interface extending `ActionItem` with id, reportId, status, targetMetric, targetDirection, baselineValue, outcomeValue, createdAt, dueBy, completedAt, outcomeConfidence, outcomeMeasuredAt |
| `packages/shared/src/types/index.ts` | Modify | Re-export new types if not already re-exported |

### backend — Database

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/db/migrations/008_action_items.sql` | Create | New `action_items` table (see schema below) |
| `packages/backend/src/db/queries/action-items.ts` | Create | CRUD functions: `promoteActionItems`, `listActionItems`, `getActionItem`, `updateActionItemStatus`, `listActionItemsByReport` |

### backend — Routes

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/routes/action-items.ts` | Create | REST endpoints (see API section below) |
| `packages/backend/src/app.ts` | Modify | Import and register `actionItemRoutes` |

### backend — Report integration

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/ai/report-generator.ts` | Modify | After `saveReport()`, call `promoteActionItems()` to create rows in `action_items` table from the report's `actionItems` array. Set status='pending'. |

### frontend — API layer

| File | Action | Change |
|------|--------|--------|
| `packages/frontend/src/api/hooks/useActionItems.ts` | Create | TanStack Query hooks: `useActionItems(filters?)`, `useActionItemsByReport(reportId)`, `useAcceptActionItem()`, `useCompleteActionItem()`, `useDeferActionItem()`, `useRejectActionItem()`, `useInvalidateActionItems()` |

### frontend — State

| File | Action | Change |
|------|--------|--------|
| `packages/frontend/src/store/useActionItemsStore.ts` | Create | Zustand store for optimistic UI updates during status transitions |

### frontend — Components

| File | Action | Change |
|------|--------|--------|
| `packages/frontend/src/components/actions/InteractiveActionItemCard.tsx` | Create | Card with swipe/tap actions: accept (pending→active), complete (active→completed), defer (→deferred), reject (→rejected). Reuses priority color system. |
| `packages/frontend/src/components/actions/ActionItemsList.tsx` | Create | Filterable list of action items, grouped by status. Used on both dashboard widget and actions page. |
| `packages/frontend/src/components/actions/ActionsPage.tsx` | Create | Full page at `/reports/actions` — active items, completed, deferred sections. Progress summary card at top. |
| `packages/frontend/src/components/dashboard/InsightsPanel.tsx` | Modify | Replace static `ActionItemCard` with `InteractiveActionItemCard`. Change data source from `report.actionItems` to `useActionItems({ status: 'pending' })` + `useActionItems({ status: 'active' })`. Add "View all actions →" link to `/reports/actions`. Show progress: "X of Y completed". |

### frontend — Routing

| File | Action | Change |
|------|--------|--------|
| `packages/frontend/src/App.tsx` | Modify | Add `<Route path="reports/actions" element={<ActionsPage />} />` |

### Tests

| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/db/queries/__tests__/action-items.test.ts` | Create | Unit tests for all query functions (mock pg.Pool) |
| `packages/backend/src/routes/__tests__/action-items.test.ts` | Create | Route tests via `app.inject()` |
| `packages/frontend/src/components/actions/__tests__/InteractiveActionItemCard.test.tsx` | Create | Component tests for status transitions |
| `packages/frontend/src/components/actions/__tests__/ActionsPage.test.tsx` | Create | Page render and filter tests |
| `e2e/action-items.spec.ts` | Create | E2E: promote items, accept, complete, view actions page |
| `e2e/pages/ActionsPage.ts` | Create | Page Object Model for actions page |

---

## 3. Database Schema

### Migration 008: `action_items` table

```sql
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('nutrition', 'workout', 'recovery', 'general')),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'expired', 'deferred', 'superseded', 'rejected')),
  target_metric TEXT,
  target_direction TEXT CHECK (target_direction IN ('increase', 'decrease', 'maintain')),
  baseline_value DOUBLE PRECISION,
  outcome_value DOUBLE PRECISION,
  outcome_confidence TEXT CHECK (outcome_confidence IN ('high', 'medium', 'low')),
  outcome_measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_by DATE,
  completed_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_items_user_status ON action_items (user_id, status);
CREATE INDEX idx_action_items_report ON action_items (report_id);
CREATE INDEX idx_action_items_due ON action_items (user_id, due_by) WHERE status IN ('pending', 'active');
```

---

## 4. API Endpoints

All endpoints follow existing Fastify plugin pattern with `apiKeyMiddleware`.

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| `GET` | `/api/action-items` | List action items with optional filters | Query: `status?`, `category?`, `reportId?`, `limit?` | `{ data: TrackedActionItem[] }` |
| `GET` | `/api/action-items/:id` | Get single action item | — | `{ data: TrackedActionItem }` |
| `PATCH` | `/api/action-items/:id/status` | Update status (accept, complete, defer, reject) | Body: `{ status, dueBy? }` | `{ data: TrackedActionItem }` |
| `GET` | `/api/action-items/summary` | Aggregate counts by status | — | `{ data: { pending, active, completed, deferred, expired, total } }` |

**Status transition rules:**
- `pending` → `active` (accept), `rejected`, `deferred`
- `active` → `completed`, `deferred`, `expired` (system)
- `deferred` → `active` (re-accept), `expired` (system)
- `completed` — terminal (no further transitions)
- `expired` — terminal
- `rejected` — terminal
- `superseded` — terminal (set by system when new report generates replacement)

---

## 5. Type Definitions

```typescript
// In packages/shared/src/types/report.ts

export type ActionItemStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'expired'
  | 'deferred'
  | 'superseded'
  | 'rejected';

export interface TrackedActionItem extends ActionItem {
  id: string;
  reportId: string;
  status: ActionItemStatus;
  targetMetric?: string;
  targetDirection?: 'increase' | 'decrease' | 'maintain';
  baselineValue?: number;
  outcomeValue?: number;
  outcomeConfidence?: 'high' | 'medium' | 'low';
  outcomeMeasuredAt?: string;
  createdAt: string;
  dueBy?: string;
  completedAt?: string;
  statusChangedAt: string;
}
```

---

## 6. Frontend Component Details

### InteractiveActionItemCard

Extends the existing `ActionItemCard` pattern from `InsightsPanel.tsx`:

```
┌──────────────────────────────────────────┐
│ ▌ NUTRITION                    [HIGH] │
│ ▌ Increase protein intake to 150g/day    │
│ ▌                                        │
│ ▌ [✓ Accept]  [⏭ Defer]  [✕ Reject]    │  ← pending state
│ ▌ [✓ Done]    [⏭ Defer]                 │  ← active state
│ ▌ ✓ Completed Mar 20                    │  ← completed state
└──────────────────────────────────────────┘
```

- Priority left-border color: red (high), amber (medium), blue (low)
- Status-specific action buttons shown in footer
- Mobile: buttons are full-width, stacked; consider swipe gestures as enhancement
- Desktop: buttons inline, hover-reveal or always visible
- Optimistic UI: update Zustand store immediately, revert on API error

### InsightsPanel Evolution

Current "This Week's Focus" section changes from static display to interactive:
- Data source switches from `report.actionItems` to API (`/api/action-items?status=pending&status=active`)
- Shows pending items first (with accept CTA), then active items
- Progress indicator: "2 of 5 completed this week" with mini progress bar
- "View all actions →" links to `/reports/actions`
- Maintains existing layout pattern (grid-cols-1 mobile, grid-cols-3 desktop)

### ActionsPage (`/reports/actions`)

```
┌─────────────────────────────────────────────────────┐
│  Actions                                             │
│  ─────────────────────────────────────────────────── │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Progress: ████████░░ 3/5 active  │ 2 pending  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [All] [Pending] [Active] [Completed] [Deferred]    │
│                                                       │
│  ┌─ Pending (2) ──────────────────────────────────┐  │
│  │ InteractiveActionItemCard (accept/reject/defer) │  │
│  │ InteractiveActionItemCard                       │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Active (3) ───────────────────────────────────┐  │
│  │ InteractiveActionItemCard (complete/defer)      │  │
│  │ InteractiveActionItemCard                       │  │
│  │ InteractiveActionItemCard                       │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Completed (4) ────────────────────────────────┐  │
│  │ ActionItemCard (read-only, with completed date) │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

- Mobile: single column, collapsible status sections
- Desktop: same single column layout (action items are text-heavy, don't benefit from multi-column)
- Filter tabs at top (chip/toggle style)
- Each section collapsible with count badge

---

## 7. Report Generator Integration

In `report-generator.ts`, after `saveReport()` succeeds:

```typescript
// Promote action items to tracked entities
const actionItems = parsedReport.actionItems ?? [];
if (actionItems.length > 0) {
  await promoteActionItems(app.db, userId, reportId, actionItems);
}
```

`promoteActionItems` does:
1. INSERT each action item into `action_items` table with status='pending'
2. For each item, AI should ideally set `target_metric` and `target_direction` — but in Phase 1, these are NULL (populated in Phase 2 via enhanced AI prompt)
3. Set `due_by` to 7 days from creation (default, can be overridden by user via defer)

---

## 8. Dependencies

No new npm packages required. All functionality built on existing stack:
- Fastify (routes)
- pg (database queries)
- React + TanStack Query + Zustand (frontend state)
- shadcn/ui Card, Badge, Button (UI components)

---

## 9. Test Strategy

### Backend Unit Tests
- `action-items.test.ts` (queries): test promoteActionItems, listActionItems (with filters), updateActionItemStatus (valid transitions), reject invalid transitions
- `action-items.test.ts` (routes): test GET/PATCH endpoints, 400 on invalid status transition, 404 on missing item
- `report-generator.test.ts`: verify promoteActionItems is called after saveReport

### Frontend Unit Tests
- `InteractiveActionItemCard.test.tsx`: render pending/active/completed states, click accept/complete/defer/reject triggers mutation
- `ActionsPage.test.tsx`: renders grouped sections, filter tabs work, empty state
- `InsightsPanel.test.tsx`: update existing tests to verify interactive action items render

### E2E Tests
- Generate a report (or mock one) → verify action items appear as pending in InsightsPanel
- Accept an action item → verify it moves to active
- Complete an action item → verify it moves to completed
- Navigate to `/reports/actions` → verify full list with filters
- Defer an action item with custom date → verify status change

---

## 10. Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Report generation fails after action item promotion | Orphaned action items in DB | Wrap promote + save in same try/catch; action items are created AFTER successful report save, not before |
| Race condition: two reports generated close together | Duplicate action items | `promoteActionItems` is idempotent — check for existing items from same report_id before inserting |
| Mobile swipe gesture conflicts with page scroll | Poor UX on mobile | Phase 1 uses button taps only; swipe gestures are an optional enhancement |
| InsightsPanel data source change breaks existing tests | Test failures | Update existing InsightsPanel tests to mock new API endpoint |
| Large number of action items over time | Slow queries | Indexed on (user_id, status); expired/completed items naturally filtered out of active views |
