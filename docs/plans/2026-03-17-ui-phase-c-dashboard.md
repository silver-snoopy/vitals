# Phase C: Dashboard Redesign

**Date:** 2026-03-17
**Branch:** `experiment/ui-ux-pro-max-v2`
**Type:** Feature — UI/UX Transformation Phase C
**Research:** `docs/research/2026-03-17-ui-ux-transformation-plan.md`
**Depends on:** Phase A (KPI Card, Sparkline, color tokens), Phase B (mobile layout with BottomNav)

---

## Context

The dashboard is the app's landing page and currently has the worst data density. Three oversized KPI cards show only 3 numbers, the AI report panel dominates the left column, and charts are in a basic linear stack. The research screenshots show that on mobile, users must scroll 5+ screens to reach any chart.

This phase transforms the dashboard into a data-dense, information-centric view with:
- **KPI strip** — 5 compact metrics with trends and sparklines
- **Report alert bar** — one-line summary replacing the full report panel
- **Bento grid** — 2D chart layout that adapts to screen size
- **Activity heatmap** — GitHub-style workout consistency tracker
- **Swipeable charts** on mobile

**API note:** No backend changes needed. All data is already in the `/api/dashboard/weekly` response (`nutrition[]`, `workouts[]`, `biometrics[]`). The report data comes from the existing `useLatestReport` hook.

---

## Tasks

### C1. Build KPI strip (replace WeeklySummaryCard)

**File to modify:** `packages/frontend/src/components/dashboard/DashboardPage.tsx`
**File to remove (or repurpose):** `packages/frontend/src/components/dashboard/WeeklySummaryCard.tsx`
**Component to use:** `KpiCard` from Phase A (`src/components/ui/kpi-card.tsx`)
**Component to use:** `Sparkline` from Phase A (`src/components/charts/Sparkline.tsx`)

Replace the 3-card `WeeklySummaryCard` with a 5-metric KPI strip:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ 2,150    │ 4        │ 66.9 kg  │ 156g     │ 7.2/10   │
│ avg cal  │ sessions │ weight   │ protein  │ AI score │
│ ▲ +120   │ ▼ -1     │ → stable │ ▲ +12g   │ ▲ +0.4   │
│ ~~spark~~│ ~~spark~~│ ~~spark~~│ ~~spark~~│          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**5 metrics to compute from existing dashboard data:**

| Metric | Source | Calculation |
|--------|--------|-------------|
| Avg Calories | `dashboard.nutrition` | `sum(calories) / count` |
| Sessions | `dashboard.workouts` | `workouts.length` |
| Avg Weight | `dashboard.biometrics` | filter `weight_kg`, `sum / count` |
| Avg Protein | `dashboard.nutrition` | `sum(protein) / count` |
| AI Score | `useLatestReport()` | `report.sections?.scorecard?.overall?.score` or `null` |

**Trend calculation:**
- Split the date range in half (first half vs second half)
- Compare averages: if second half > first half → `up`, less → `down`, within ±1% → `stable`
- Delta = absolute difference formatted as string

**Sparkline data:**
- Pass the daily values as `number[]` to `Sparkline` component
- Calories: `nutrition.map(d => d.calories)`
- Weight: `biometrics.filter(weight_kg).map(d => d.value)`
- Protein: `nutrition.map(d => d.protein)`
- Sessions: no sparkline (discrete count, not daily)
- AI Score: no sparkline (single value)

**Layout:**
- Desktop (≥1440px): `grid grid-cols-5 gap-3` — all 5 in a row
- Tablet (768-1439px): `grid grid-cols-3 gap-3` — 3 top + 2 below
- Mobile (<768px): horizontal scroll container `flex gap-3 overflow-x-auto snap-x snap-mandatory` with each card `min-w-[140px] snap-center`

**Helper function:** Create `computeKpiData(dashboard, report)` in a new file `packages/frontend/src/components/dashboard/kpi-helpers.ts` to keep DashboardPage clean.

### C2. Replace ReportPanel with alert bar

**File to create:** `packages/frontend/src/components/dashboard/ReportAlertBar.tsx`
**File to keep (but remove from dashboard):** `packages/frontend/src/components/dashboard/ReportPanel.tsx` — still used on Reports page

The full ReportPanel moves OUT of the dashboard. In its place, a single compact alert bar:

```
┌─────────────────────────────────────────────────┐
│ 📊 Weekly Report: "Protein up, sleep down"      │
│ Score: 7.2/10  •  3 action items  [View →]      │
└─────────────────────────────────────────────────┘
```

**Implementation:**
- Uses `useLatestReport()` hook (already available)
- Shows: report summary (truncated to ~60 chars), overall score badge, action item count
- `[View →]` links to `/reports` page
- If no report exists: "No report yet — [Generate →]" with link to Reports page
- If report is generating: show spinner + "Generating report..."
- Height: single row on desktop, two rows on mobile
- Background: `bg-muted/50 border border-border rounded-lg px-4 py-3`

**Props interface:**
```typescript
// No props — uses useLatestReport() internally
```

### C3. Implement bento grid layout

**File to modify:** `packages/frontend/src/components/dashboard/DashboardPage.tsx`

Replace the current two-column layout (fixed 380px left + fluid right) with a bento grid:

**Desktop (≥1440px):**
```
┌────────────────────┬──────────────┐
│ Nutrition Trend     │ Weight       │
│ (2/3 width)        │ (1/3)        │
├──────────┬─────────┼──────────────┤
│ Workout  │ Macro   │ Activity     │
│ Volume   │ Split   │ Heatmap      │
│ (1/3)    │ (1/3)   │ (1/3)        │
└──────────┴─────────┴──────────────┘
```

**CSS Grid implementation:**
```css
/* Desktop bento grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto;
  gap: 1.5rem; /* 24px, matches gap-6 */
}

/* Nutrition chart spans 2 columns */
.bento-nutrition { grid-column: span 2; }
```

Use Tailwind classes directly:
```tsx
<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
  <div className="xl:col-span-2">{/* Nutrition Trend */}</div>
  <div>{/* Weight Chart */}</div>
  <div>{/* Workout Volume */}</div>
  <div>{/* Macro Split — new mini chart */}</div>
  <div>{/* Activity Heatmap — new */}</div>
</div>
```

**Tablet (768-1439px):** `grid-cols-2` — nutrition spans full width, rest in 2-col grid
**Mobile (<768px):** `grid-cols-1` — but swipeable (see C5)

**Remove the widget order system** (`WidgetOrderSettings`, `useWidgetOrderStore`) since the bento grid has a fixed layout. The settings gear and drag-to-reorder are no longer needed.

**Files affected:**
- Modify: `DashboardPage.tsx`
- Delete: `WidgetOrderSettings.tsx`
- Delete (or keep for now): `src/store/useWidgetOrderStore.ts`

### C4. Add macro split mini chart

**File to create:** `packages/frontend/src/components/dashboard/MacroSplitChart.tsx`

A small donut/radial chart showing today's (or latest day's) macro breakdown as percentages. This fills the "Macro Split" cell in the bento grid.

**Implementation:**
- Use Recharts `PieChart` with `innerRadius` to create a donut
- 3 segments: Protein (blue), Carbs (yellow), Fat (red) — from `CHART_COLORS`
- Center text: total calories
- Data source: last entry in `dashboard.nutrition`
- Size: responsive, fills its grid cell
- Compact: no legend, use colored arcs + center label only

**Props interface:**
```typescript
interface MacroSplitChartProps {
  nutrition: DailyNutritionSummary[];  // uses last entry
}
```

### C5. Add activity heatmap

**File to create:** `packages/frontend/src/components/dashboard/ActivityHeatmap.tsx`

A GitHub-style calendar heatmap showing workout days for the past 90 days. This fills the "Activity Heatmap" cell in the bento grid.

**Implementation approach:**
- Custom SVG component (no external library needed)
- 13 columns (weeks) × 7 rows (days) grid of small rectangles
- Color: workout days = `bg-primary` (cyan) with opacity based on volume, rest days = `bg-muted`
- Hover tooltip: date + "Workout: X sets, Y kg" or "Rest day"
- Data source: `dashboard.workouts` — extract dates and map to heatmap cells
- For days outside the dashboard date range: use `bg-muted` (no data)

**Grid layout:**
```
Mon  □ □ ■ □ □ ■ □ □ ■ □ □ ■ □
Tue  □ ■ □ □ ■ □ □ ■ □ □ ■ □ □
Wed  □ □ □ ■ □ □ ■ □ □ ■ □ □ □
...
Sun  □ □ □ □ □ □ □ □ □ □ □ □ □
```

**Intensity levels (4):**
- 0 sets: `opacity-10` (rest day)
- 1-10 sets: `opacity-40`
- 11-20 sets: `opacity-70`
- 21+ sets: `opacity-100`

**Note:** The dashboard API currently returns workouts for the selected date range (default 30 days). The heatmap works best with 90 days. For now, use whatever data is available and show empty cells for missing dates. A future enhancement could extend the date range or add a separate API call.

### C6. Mobile swipeable chart cards

**File to create:** `packages/frontend/src/components/dashboard/SwipeableCharts.tsx`

On mobile (<768px), replace the vertical chart stack with horizontally swipeable cards:

```
← [Nutrition] [Volume] [Weight] [Heatmap] →
   ●  ○  ○  ○  (dot indicators)
```

**Implementation:**
- CSS scroll-snap container: `flex gap-4 overflow-x-auto snap-x snap-mandatory`
- Each chart card: `min-w-[calc(100vw-2rem)] snap-center`
- Dot indicators below: track scroll position via `IntersectionObserver` or `scrollLeft`
- Only render on mobile: wrap in responsive conditional or use `md:hidden` / `md:grid` switch

**No external library needed** — CSS scroll-snap is well-supported and lighter than a carousel library.

**Chart order in swipe:**
1. Nutrition Trend
2. Workout Volume
3. Weight Chart
4. Activity Heatmap

### C7. Update DashboardPage to compose everything

**File to modify:** `packages/frontend/src/components/dashboard/DashboardPage.tsx`

Final page structure:

```tsx
export function DashboardPage() {
  // ... existing hooks ...

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Strip */}
      <KpiStrip dashboard={dashboard} report={report} />

      {/* Report Alert Bar */}
      <ReportAlertBar />

      {/* Charts — bento grid on desktop, swipeable on mobile */}
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2"><NutritionChart /></div>
        <div><WeightChart /></div>
        <div><WorkoutVolumeChart /></div>
        <div><MacroSplitChart /></div>
        <div><ActivityHeatmap /></div>
      </div>

      <div className="md:hidden">
        <SwipeableCharts dashboard={dashboard} />
      </div>
    </div>
  );
}
```

**Imports to remove:** `WeeklySummaryCard`, `ReportPanel`, `WidgetOrderSettings`, `useWidgetOrderStore`
**Imports to add:** `KpiStrip` (or inline KPI cards), `ReportAlertBar`, `MacroSplitChart`, `ActivityHeatmap`, `SwipeableCharts`

### C8. Write E2E tests

**File to create:** `e2e/dashboard-redesign.spec.ts`

**Desktop tests (1440×900):**
1. KPI strip shows 5 metrics with values
2. Report alert bar displays summary and score
3. Report alert bar "View" link navigates to /reports
4. Bento grid shows all 5 chart areas
5. Activity heatmap renders SVG with cells

**Mobile tests (390×844):**
6. KPI strip is horizontally scrollable
7. Charts are swipeable with dot indicators
8. Swipe left reveals next chart
9. Report alert bar is visible without scrolling

### C9. Run full validation suite

```bash
npm run build -w @vitals/shared
npm run build -w @vitals/frontend
npm run lint
npm run format:check
npm test
npm run test:e2e
```

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `packages/frontend/src/components/dashboard/DashboardPage.tsx` (major rewrite) |
| Create | `packages/frontend/src/components/dashboard/kpi-helpers.ts` |
| Create | `packages/frontend/src/components/dashboard/ReportAlertBar.tsx` |
| Create | `packages/frontend/src/components/dashboard/MacroSplitChart.tsx` |
| Create | `packages/frontend/src/components/dashboard/ActivityHeatmap.tsx` |
| Create | `packages/frontend/src/components/dashboard/SwipeableCharts.tsx` |
| Delete | `packages/frontend/src/components/dashboard/WeeklySummaryCard.tsx` |
| Delete | `packages/frontend/src/components/dashboard/WidgetOrderSettings.tsx` |
| Delete | `packages/frontend/src/store/useWidgetOrderStore.ts` |
| Remove from dashboard (keep file) | `packages/frontend/src/components/dashboard/ReportPanel.tsx` |
| Create | `e2e/dashboard-redesign.spec.ts` |

## Dependencies

None — no new npm packages. Uses existing Recharts, Tailwind, and CSS scroll-snap.

## Test Strategy

- **Unit tests:** `kpi-helpers.ts` (trend calculation logic) — ~6 tests for edge cases (empty data, single day, equal halves)
- **E2E tests:** 9 new tests in `e2e/dashboard-redesign.spec.ts`
- **Existing tests:** Verify no tests import `WeeklySummaryCard` or `WidgetOrderSettings` — update or remove if they do
- **Visual verification:** Before/after screenshots at desktop (1440px) and mobile (390px)

## Risks

1. **ReportPanel still used elsewhere** — `ReportPanel.tsx` is currently only used in `DashboardPage.tsx`. Before deleting, grep to confirm. If it's used on Reports page too, keep the file. If only on dashboard, it can be deleted (the Reports page has its own `ReportCard.tsx`).
2. **useWidgetOrderStore may be persisted in localStorage** — if users had custom widget orders, deleting the store leaves orphaned localStorage keys. Not harmful, but good to clean up with a one-time `localStorage.removeItem('widget-order')` in the app init.
3. **Heatmap data sparsity** — with only 30 days of data (default range), the 90-day heatmap will be mostly empty. Consider showing only the available date range, or adding a note "Showing last 30 days" below the heatmap.
4. **Scroll-snap browser support** — CSS scroll-snap works in all modern browsers but may behave differently on iOS Safari vs Chrome. Test on both.
5. **Dashboard load performance** — adding 2 new chart components (MacroSplit, Heatmap) increases initial render. Both are lightweight (donut = few SVG paths, heatmap = ~90 small rects), so this should be negligible. Monitor with React DevTools Profiler if needed.
6. **AI Score availability** — the score comes from `report.sections.scorecard.overall.score`. If no report exists, show "—" in the KPI card. If the report structure varies, add defensive access: `report?.sections?.scorecard?.overall?.score ?? null`.
