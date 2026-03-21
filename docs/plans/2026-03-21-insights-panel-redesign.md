# Dashboard Insights Panel Redesign

**Date:** 2026-03-21
**Type:** Feature (UI enhancement)
**Status:** Approved at user gate

## Context

The current dashboard shows a narrow `ReportAlertBar` that truncates the AI summary to 60 chars and only displays an action item **count** — forcing users to navigate to the Reports page to see actual action items. The full report `insights` field is very long, and action items are buried at the bottom of the analysis. Users need immediate visibility into what to focus on next week without extra navigation.

**Goal:** Replace `ReportAlertBar` with a rich, scannable `InsightsPanel` that surfaces the three most critical pieces directly on the dashboard: **score**, **action items**, and **focus areas** (what's working + hazards).

**Design inspiration:** Whoop recovery callouts, Oura Ring readiness insights, Apple Health summary cards.

## Layout

### Desktop (md+)

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌─────────┐                                                     │
│ │  Score   │  "Strong week nutritionally (EA = 36.8 kcal/kg     │
│ │  Ring    │   FFM/day, just above the 35+ threshold)..."       │
│ │   8/10   │  Mar 7 – Mar 21, 2026              View Report →  │
│ └─────────┘                                                     │
├────────────────────┬───────────────────┬─────────────────────────┤
│ 🔴 NUTRITION       │ 🟡 WORKOUT        │ 🔵 RECOVERY            │
│ "Increase daily    │ "Add a second     │ "Track sleep            │
│  protein to..."    │  leg session..."  │  consistency..."        │
│         [high]     │       [medium]    │           [low]         │
├────────────────────┴───────────────────┴─────────────────────────┤
│  ✅ What's Working              │  ⚠️ Watch Out                  │
│  • Consistent calorie target    │  • Protein dipping below 2g/kg│
│  • 4+ sessions per week         │  • No rest day recovery data  │
│  • Weight trending stable       │  • Carb timing around workouts│
└─────────────────────────────────┴────────────────────────────────┘
```

### Mobile (< md)

Everything stacks vertically:
1. Score ring (centered) + summary text below
2. Action items stack as full-width cards
3. Focus areas stack (What's Working, then Watch Out)

## Tasks (ordered)

### Task 1: Create shared report utilities

**File:** `NEW` `packages/frontend/src/components/reports/report-utils.ts`

Extract from `ReportPanel.tsx` into a shared module:
- `priorityColor` — map of priority → border color class
- `priorityVariant` — map of priority → Badge variant
- `scoreColor()` — score → bg/text color class
- `scoreRingColor()` — score → SVG stroke color class (new)
- `extractBullets(markdown, max)` — regex-based bullet extraction from markdown sections (new)

### Task 2: Refactor ReportPanel to use shared utilities

**File:** `EDIT` `packages/frontend/src/components/dashboard/ReportPanel.tsx`

- Remove inline `priorityColor`, `priorityVariant`, `scoreColor` definitions
- Import from `@/components/reports/report-utils`
- No visual or behavioral changes

### Task 3: Create InsightsPanel component

**File:** `NEW` `packages/frontend/src/components/dashboard/InsightsPanel.tsx`

Three sections within a single `<Card>`:

**Section 1 — Score + Summary Header:**
- Left: SVG circular score ring (~56px diameter), color-coded via `scoreRingColor`
- Right: Full summary text (no truncation), period dates, "View Report →" link
- Mobile: score ring centered above text

**Section 2 — Top 3 Action Items:**
- `report.actionItems.slice(0, 3)` in `grid-cols-3` (desktop) / `grid-cols-1` (mobile)
- Each card: colored left border by priority, uppercase category label, action text (2-line clamp), priority badge
- If > 3 items: "+N more in full report" link to `/reports`

**Section 3 — Focus Areas:**
- Two side-by-side tinted cards (`grid-cols-2` desktop, stacked mobile)
- **What's Working:** `bg-emerald-500/10 border-emerald-500/20`, extract first 3 bullets from `report.sections.whatsWorking`
- **Watch Out:** `bg-amber-500/10 border-amber-500/20`, extract first 3 bullets from `report.sections.hazards`

**States (preserved from ReportAlertBar):**
- Loading → `null`
- Generating → spinner card with "Generating report..." text
- No report → "No report yet" with Generate link

**Data source:** `useLatestReport()` hook + `useReportGenerationStore`

### Task 4: Wire InsightsPanel into DashboardPage

**File:** `EDIT` `packages/frontend/src/components/dashboard/DashboardPage.tsx`

- Replace `<ReportAlertBar />` with `<InsightsPanel />`
- Update imports accordingly
- `ReportAlertBar.tsx` file remains (unused on dashboard, may be useful elsewhere)

### Task 5: Lint, format, build, and test

- `npm run lint` — ESLint must pass
- `npm run format:check` — Prettier must pass
- `npm run build` — clean TypeScript build
- `npm test` — all existing tests pass

### Task 6: Visual verification

- Desktop (1280px+): all 3 sections render in grid layout
- Mobile (375px): stacked layout, score ring centered
- Test all states: loading, generating, no report, with report data

## Key files

| File | Action | Purpose |
|------|--------|---------|
| `packages/frontend/src/components/reports/report-utils.ts` | NEW | Shared utilities |
| `packages/frontend/src/components/dashboard/InsightsPanel.tsx` | NEW | Main new component |
| `packages/frontend/src/components/dashboard/DashboardPage.tsx` | EDIT | Swap in InsightsPanel |
| `packages/frontend/src/components/dashboard/ReportPanel.tsx` | EDIT | Import shared utils |
| `packages/frontend/src/components/dashboard/ReportAlertBar.tsx` | REF | Preserve states pattern |
| `packages/shared/src/types/report.ts` | REF | WeeklyReport, ActionItem types |
