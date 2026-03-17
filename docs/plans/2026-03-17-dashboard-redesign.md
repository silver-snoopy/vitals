# Dashboard Redesign — Visual Rework

**Date:** 2026-03-17
**Type:** Feature (UI rework)
**Status:** Approved at user gate

## Context

The dashboard currently renders all widgets in a single vertical stack. On large screens (1440px+), this wastes horizontal space and forces users to scroll to cross-reference the AI report with chart data. Action items in the report preview are truncated (max 3) and visually flat.

Goals:
1. Default date range → 14 days (was 30)
2. Two-column layout on large screens (report left, charts right)
3. AI report panel with prominent action items, scorecard, and expandable sections

Mockup: `docs/mockups/dashboard-redesign.html`

## Tasks (ordered)

### Task 1: Default date range → 14 days
- Modify `packages/frontend/src/store/useDateRangeStore.ts` — change `30` to `14`
- Modify `packages/frontend/src/components/ui/DateRangePicker.tsx` — add 14d preset, reorder presets to [7d, 14d, 30d, 90d]
- Update test `packages/frontend/src/store/__tests__/useDateRangeStore.test.ts`

### Task 2: Two-column dashboard layout
- Modify `packages/frontend/src/components/dashboard/DashboardPage.tsx`:
  - On `2xl` (1440px+ Tailwind ≈ `2xl` is 1536px, use custom `min-[1440px]` or `xl` with sidebar awareness), split into two columns
  - Left column: `WeeklySummaryCard` + new `ReportPanel` (sticky, scrollable)
  - Right column: charts stacked (NutritionChart, WorkoutVolumeChart paired; WeightChart full-width)
  - Below `xl`: single-column fallback (current layout order)
- Widget order system: report + summary excluded from reorderable widgets on 2-col layout (they're pinned left)

### Task 3: New ReportPanel component
- Create `packages/frontend/src/components/dashboard/ReportPanel.tsx`
  - Replaces `LatestReportPreview` on dashboard (preview stays for potential reuse)
  - Fetches via `useLatestReport()` — same hook
  - Sections (top to bottom):
    1. Header with date range + regenerate button
    2. Summary paragraph (always visible)
    3. **Action items** — full list, each with colored left-border (red/amber/blue), category label, priority badge
    4. **Scorecard** — 2×2 grid of score rings (if `sections.scorecard` exists)
    5. **Expandable sections** — What's Working, Hazards, Recommendations, Nutrition Analysis, Training Load (if `sections` exists)
  - Reuses `GenerateReportDialog` for regeneration
  - Empty state: same as current LatestReportPreview

### Task 4: Update tests
- Unit: update date range store test (14 days assertion)
- E2E: update dashboard E2E tests if they assert on layout structure
- New E2E: test two-column layout visibility at wide viewport

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/store/useDateRangeStore.ts` | 30 → 14 |
| Modify | `src/store/__tests__/useDateRangeStore.test.ts` | Assert 14 days |
| Modify | `src/components/ui/DateRangePicker.tsx` | Add 14d preset |
| Modify | `src/components/dashboard/DashboardPage.tsx` | Two-column layout |
| Create | `src/components/dashboard/ReportPanel.tsx` | Rich report panel |
| Modify | `src/store/useWidgetOrderStore.ts` | Possibly adjust default order |
| Modify | E2E tests | Layout assertions |

All paths relative to `packages/frontend/`.

## Dependencies

None — no new packages needed. Uses existing Tailwind classes, Lucide icons, shadcn Card/Badge.

## Test Strategy

- **Unit:** Date range store default = 14 days
- **E2E:** Dashboard renders two-column at 1440px+ viewport, single-column below
- **E2E:** Action items visible in report panel, expandable sections toggle
- **Visual:** Live screenshot verification against mockup

## Risks

- **Widget order store** — users with persisted localStorage order may have `latest-report` in their order; need to handle gracefully when it's pinned in the left column
- **Report sections** — `sections` field is optional on `WeeklyReport`; panel must degrade gracefully when absent
- **Sticky left column** — needs `overflow-y: auto` with max-height to avoid content overflow on smaller vertical screens
