# UI/UX Transformation — Agent Briefing

**Date:** 2026-03-17
**Branch:** `experiment/ui-ux-pro-max-v2` (clean from master, zero code changes)
**Purpose:** Input for a planning agent to break this into phased implementation plans

---

## What Is This App?

**Vitals** is a personal health data dashboard. It collects nutrition data (from Cronometer), workout data (from Hevy), and biometrics (from Apple Health/Cronometer), stores them in PostgreSQL, and displays them in a React frontend.

**Stack:** React 19 + Vite 6 + Tailwind 4 + shadcn/ui (Base UI) + Zustand + TanStack Query + Recharts
**Backend:** Fastify 5 + TypeScript, port 3001
**Frontend:** port 3000

---

## Confirmed Design Decisions

| Decision | Choice |
|----------|--------|
| Primary color | Healthcare cyan `#0891B2` |
| Font | JetBrains Mono Variable (ALL text — headings, body, data) |
| Mobile navigation | Bottom tab bar (replace hamburger/sidebar) |
| Dashboard report panel | Compact alert bar (full report moves to Reports page) |
| Phase priority | Foundation → Mobile → Dashboard |

---

## Current Frontend Structure (Files to Modify)

### Layout (will change significantly)
- `src/components/layout/AppShell.tsx` — main layout wrapper
- `src/components/layout/Sidebar.tsx` — desktop sidebar (will be restyled)
- `src/components/layout/MobileDrawer.tsx` — hamburger drawer (**replace with bottom nav**)
- `src/components/layout/MobileHeader.tsx` — mobile top bar
- `src/components/layout/Topbar.tsx` — desktop top bar
- `src/components/layout/nav-items.ts` — navigation config
- `src/hooks/useIsMobile.ts` — responsive breakpoint hook

### Dashboard (will change heavily)
- `src/components/dashboard/DashboardPage.tsx` — main page
- `src/components/dashboard/WeeklySummaryCard.tsx` — oversized KPI cards (**replace with KPI strip**)
- `src/components/dashboard/ReportPanel.tsx` — full report panel (**replace with alert bar**)
- `src/components/dashboard/LatestReportPreview.tsx` — report preview
- `src/components/dashboard/NutritionChart.tsx` — basic line chart
- `src/components/dashboard/WeightChart.tsx` — weight line chart
- `src/components/dashboard/WorkoutVolumeChart.tsx` — bar chart
- `src/components/dashboard/WidgetOrderSettings.tsx` — widget order config

### Nutrition (moderate changes)
- `src/components/nutrition/NutritionPage.tsx`
- `src/components/nutrition/MacroBreakdown.tsx` — pie chart (**replace with progress rings**)
- `src/components/nutrition/DailyNutritionTable.tsx` — data table (**add conditional formatting**)

### Workouts (moderate changes)
- `src/components/workouts/WorkoutsPage.tsx`
- `src/components/workouts/WorkoutSessionCard.tsx` — session cards (**compact timeline**)
- `src/components/workouts/ExerciseProgressChart.tsx` — progress chart (**enhance**)

### Reports (moderate changes)
- `src/components/reports/ReportsPage.tsx`
- `src/components/reports/ReportCard.tsx` — report cards (**add tabs**)
- `src/components/reports/AIInsights.tsx`
- `src/components/reports/ActionItemList.tsx`

### Shared/Foundation
- `src/index.css` — Tailwind config, CSS variables, dark mode
- `src/lib/chart-config.ts` — chart color constants
- `src/lib/utils.ts` — utility functions

### Existing UI Components (shadcn/Base UI)
badge, button, calendar, card, dialog, popover, select, separator, sheet, skeleton, sonner, table, textarea

### State Management (Zustand stores)
- `useDateRangeStore` — 30-day default date range
- `useThemeStore` — system/light/dark
- `useSidebarStore` — sidebar open/close
- `useWidgetOrderStore` — dashboard widget ordering

### API Hooks (TanStack Query)
useNutrition, useWorkouts, useDashboard, useMeasurements, useReports, useUpload, useCollectionStatus, useReportWebSocket

---

## Phase Breakdown (to be expanded into detailed plans)

### Phase A: Foundation (Design System)
**Goal:** Update CSS variables, font, color tokens — zero visual regressions
1. Install JetBrains Mono Variable font
2. Update Tailwind/CSS color tokens to healthcare cyan primary
3. Create reusable KPI card component (`src/components/ui/kpi-card.tsx`)
4. Create Sparkline component (`src/components/charts/Sparkline.tsx`)
5. Update chart color constants in `chart-config.ts`
6. Verify dark mode still works
7. Run lint + format + tests

### Phase B: Mobile Navigation
**Goal:** Replace hamburger drawer with bottom tab bar, improve thumb-zone UX
1. Create BottomNav component
2. Update AppShell to use BottomNav on mobile (keep sidebar on desktop)
3. Remove MobileDrawer component
4. Move date picker to bottom sheet on mobile
5. Add pull-to-refresh on dashboard
6. Write E2E tests for mobile navigation
7. Verify all 4 pages accessible via bottom nav

### Phase C: Dashboard Redesign
**Goal:** Data-dense, information-centric dashboard
1. Replace WeeklySummaryCard with compact KPI strip (5 metrics + trends + sparklines)
2. Replace ReportPanel with compact alert bar
3. Implement bento grid layout for charts
4. Enhance NutritionChart (add confidence bands)
5. Add activity heatmap (GitHub-style, 90 days)
6. Mobile: swipeable chart cards with dot indicators
7. Write E2E tests for new dashboard interactions

### Phase D: Page Improvements
**Goal:** Enhance individual pages with data-dense patterns
1. Nutrition: macro progress rings (replace pie chart)
2. Nutrition: conditional formatting in data table
3. Workouts: compact timeline (replace full-width cards)
4. Workouts: PR markers + target lines on progress chart
5. Reports: tabbed content layout
6. Reports: scorecard comparison (last 4 weeks trend)
7. Write E2E tests for new interactions

### Phase E: Polish
**Goal:** Professional finish
1. Skeleton loaders matching new layouts
2. Animation (150-300ms transitions)
3. Accessibility audit (contrast, focus, screen reader)
4. Dark mode verification across all pages
5. Performance audit (bundle size, render performance)

---

## Key Constraints for Planning Agent

1. **Build order:** shared → backend → frontend (shared must build first)
2. **No backend changes needed** — all API responses already contain the data we need
3. **Existing tests must not break** — 24 frontend unit tests, E2E tests
4. **New interactive features require E2E tests** (project convention)
5. **shadcn/ui uses Base UI** (not Radix) — no `asChild`, use `render` prop
6. **Tailwind v4** — uses `@theme inline` not `tailwind.config.js`
7. **Dark mode:** `@custom-variant dark (&:is(.dark *))` in index.css
8. **Prettier + ESLint enforced** — hooks auto-format on every file write
9. **Each phase should be a separate PR** to keep changes reviewable

---

## Reference Files

| File | Purpose |
|------|---------|
| `docs/research/2026-03-17-ui-ux-transformation-plan.md` | Full research with wireframes and rationale |
| `design-system/vitals/MASTER.md` | Design system spec (colors, fonts, spacing, components) |
| `docs/screenshots/current-ui/*.png` | 8 screenshots (4 pages × desktop + mobile) |
| `CLAUDE.md` | Project conventions and build instructions |
| `docs/architecture.md` | System architecture |
| `docs/product-capabilities.md` | Feature catalog with UC IDs |
