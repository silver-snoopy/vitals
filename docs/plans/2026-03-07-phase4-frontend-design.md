# Phase 4: Frontend — Design Document

**Date:** 2026-03-07
**Status:** Approved

---

## Stack

Additions to existing scaffold (`react`, `react-router-dom`, `@tanstack/react-query`, `recharts` already installed):

| Package | Purpose |
|---------|---------|
| `zustand` | Client state (date range, theme) |
| `shadcn/ui` (via CLI) | Component primitives |
| `lucide-react` | Icons |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn utilities |

---

## Architecture

### State Split

| Concern | Tool |
|---------|------|
| All API data (nutrition, workouts, reports, measurements) | TanStack Query |
| Shared date range across pages | Zustand `useDateRangeStore` |
| Theme preference (system/light/dark) | Zustand `useThemeStore` |

### Routes

```
/              → DashboardPage
/nutrition     → NutritionPage
/workouts      → WorkoutsPage
/reports       → ReportsPage
```

All routes render inside `AppShell` as a parent layout route. The `/upload` route is **removed** — upload is a modal dialog accessible from the sidebar/topbar.

---

## Components

### Layout (`src/components/layout/`)

- `AppShell` — sidebar + main content, renders `<Outlet />`
- `Sidebar` — nav links with active state, "Upload" button that opens modal, collapsible on mobile
- `Topbar` — page title, `DateRangePicker`, theme toggle

### Dashboard (`src/components/dashboard/`)

- `WeeklySummaryCard` — stat cards: avg calories, total workout sessions, avg weight
- `NutritionChart` — Recharts `LineChart`: calories + macros over date range
- `WorkoutVolumeChart` — Recharts `BarChart`: volume per session
- `WeightChart` — Recharts `LineChart`: `weight_kg` biometric readings
- `LatestReportPreview` — condensed AI report summary + action items

### Nutrition (`src/components/nutrition/`)

- `DailyNutritionTable` — shadcn `Table`: one row per day (calories, protein, carbs, fat, fiber)
- `MacroBreakdown` — Recharts `PieChart`: average macro split

### Workouts (`src/components/workouts/`)

- `WorkoutSessionCard` — shadcn `Card`: date, source, exercises, total volume
- `ExerciseProgressChart` — Recharts `LineChart`: max weight over time, shadcn `Select` to pick exercise

### Reports (`src/components/reports/`)

- `ReportCard` — shadcn `Card`: period, summary, data coverage badges
- `AIInsights` — markdown-rendered `insights` field
- `ActionItemList` — color-coded by priority (high=red, medium=amber, low=green)

### Upload (`src/components/upload/`)

- `UploadModal` — shadcn `Dialog` triggered from sidebar/topbar
- `AppleHealthUploader` — drag-and-drop zone, file validation, progress, result toast
- On success: invalidates TanStack Query caches for nutrition, measurements, dashboard

### Shared UI (`src/components/ui/`)

shadcn primitives: `Button`, `Card`, `Table`, `Select`, `Badge`, `Popover`, `Calendar`, `Skeleton`, `Dialog`, `Toast`

Custom shared:
- `DateRangePicker` — Popover + Calendar, reads/writes Zustand date range store
- `LoadingSkeleton` — consistent chart/table placeholders during loading
- `ErrorBoundary` — page-level error fallback card

---

## Zustand Stores (`src/store/`)

```typescript
// useDateRangeStore
{ startDate: string, endDate: string, setRange: (start, end) => void }
// default: today-30d → today

// useThemeStore
{ theme: 'system' | 'light' | 'dark', setTheme: (theme) => void }
```

---

## API Layer (`src/api/`)

```
client.ts            fetch wrapper, reads VITE_API_URL, throws ApiError on non-2xx
hooks/
  useNutrition.ts    useQuery — reads date range from Zustand
  useWorkouts.ts     useQuery sessions + useExerciseProgress(exerciseName)
  useMeasurements.ts useQuery for weight_kg (and other metrics)
  useDashboard.ts    useQuery dashboard weekly
  useReports.ts      useQuery list + byId
  useUpload.ts       useMutation POST /api/upload/apple-health
                     onSuccess: invalidates ['nutrition'], ['measurements'], ['dashboard']
```

---

## Data Flow

### Page visit
1. Page mounts, hook reads `{ startDate, endDate }` from Zustand
2. TanStack Query fires `GET /api/...?startDate=&endDate=`
3. Response cached under `QUERY_KEYS.*` key
4. Components render from cache; skeleton shown while loading

### Date range change
1. User selects new range in `DateRangePicker`
2. `setRange()` updates Zustand store
3. All hooks re-read new dates, queries with new keys fire
4. All visible charts/tables update simultaneously

### Upload
1. User opens `UploadModal` from sidebar
2. Selects Apple Health XML export
3. `useUpload` mutation fires `POST /api/upload/apple-health` (multipart)
4. On success: query invalidation → charts refresh; modal closes; toast shown

---

## Error Handling

| Scenario | Handling |
|---------|---------|
| API non-2xx | `client.ts` throws `ApiError`; TanStack Query surfaces via `error` state |
| Loading | `Skeleton` placeholder; no layout shift |
| Empty data | Inline empty state message per component |
| Upload failure | Toast with error message from API |
| Unhandled JS error | `ErrorBoundary` per page route shows fallback card |

---

## Testing

- **Framework:** Vitest + React Testing Library
- **API hooks:** mock `client.ts`, not native fetch
- **Zustand stores:** test actions/state directly, no React wrapper needed
- **Components:** smoke tests per page — renders, shows skeleton on load, shows data on resolve
- **Scope:** unit tests only; E2E deferred to Phase 5
