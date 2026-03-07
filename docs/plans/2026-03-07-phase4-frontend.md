# Phase 4: Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Vitals frontend SPA — 4 pages (Dashboard, Nutrition, Workouts, Reports) + upload modal — wired to the Phase 3 backend API using shadcn/ui components, Zustand state, TanStack Query data fetching, and Recharts charts.

**Architecture:** React 19 + Vite 6 + Tailwind 4. Zustand owns client state (date range, theme). TanStack Query owns server state (all API data). `apiFetch` wrapper calls `VITE_API_URL`. All pages share the global date range via Zustand. Upload is a modal triggered from the Sidebar.

**Tech Stack:** React 19, React Router v7, TanStack Query v5, Zustand, shadcn/ui (Tailwind 4), Recharts 2, date-fns, Vitest + React Testing Library

---

## Key File Paths

```
packages/frontend/
  vitest.config.ts                         [CREATE]
  src/
    test-setup.ts                          [CREATE]
    store/
      useDateRangeStore.ts                 [CREATE]
      useThemeStore.ts                     [CREATE]
      __tests__/
        useDateRangeStore.test.ts          [CREATE]
        useThemeStore.test.ts              [CREATE]
    api/
      client.ts                            [CREATE]
      hooks/
        useNutrition.ts                    [CREATE]
        useWorkouts.ts                     [CREATE]
        useMeasurements.ts                 [CREATE]
        useDashboard.ts                    [CREATE]
        useReports.ts                      [CREATE]
        useUpload.ts                       [CREATE]
      __tests__/
        client.test.ts                     [CREATE]
        useNutrition.test.ts               [CREATE]
        useWorkouts.test.ts                [CREATE]
        useUpload.test.ts                  [CREATE]
    lib/
      chart-config.ts                      [CREATE]
    components/
      layout/
        AppShell.tsx                       [CREATE]
        Sidebar.tsx                        [CREATE]
        Topbar.tsx                         [CREATE]
      ui/
        DateRangePicker.tsx                [CREATE]
        LoadingSkeleton.tsx                [CREATE]
        (shadcn components added by CLI)
      dashboard/
        DashboardPage.tsx                  [CREATE]
        WeeklySummaryCard.tsx              [CREATE]
        NutritionChart.tsx                 [CREATE]
        WorkoutVolumeChart.tsx             [CREATE]
        WeightChart.tsx                    [CREATE]
        LatestReportPreview.tsx            [CREATE]
      nutrition/
        NutritionPage.tsx                  [CREATE]
        DailyNutritionTable.tsx            [CREATE]
        MacroBreakdown.tsx                 [CREATE]
      workouts/
        WorkoutsPage.tsx                   [CREATE]
        WorkoutSessionCard.tsx             [CREATE]
        ExerciseProgressChart.tsx          [CREATE]
      reports/
        ReportsPage.tsx                    [CREATE]
        ReportCard.tsx                     [CREATE]
        AIInsights.tsx                     [CREATE]
        ActionItemList.tsx                 [CREATE]
      upload/
        UploadModal.tsx                    [CREATE]
        AppleHealthUploader.tsx            [CREATE]
    App.tsx                                [MODIFY]
    index.css                              [MODIFY]
```

---

## Task 1: Configure test environment + install dependencies

**Files:**
- Create: `packages/frontend/vitest.config.ts`
- Create: `packages/frontend/src/test-setup.ts`
- Create: `packages/frontend/.env.local`
- Modify: `packages/frontend/package.json`

**Step 1: Install dependencies**

Run from workspace root:
```bash
npm install zustand date-fns -w @vitals/frontend
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/node jsdom -w @vitals/frontend
```

**Step 2: Create vitest.config.ts**

```typescript
// packages/frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Note: separate from `vite.config.ts` intentionally — the Tailwind CSS plugin does not work in jsdom.

**Step 3: Create test-setup.ts**

```typescript
// packages/frontend/src/test-setup.ts
import '@testing-library/jest-dom';
```

**Step 4: Create .env.local**

```
VITE_API_URL=http://localhost:3001
```

**Step 5: Update tsconfig.json** to include vitest globals type

Modify `packages/frontend/tsconfig.json` — add `"types"` to `compilerOptions`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

**Step 6: Smoke-run tests**

```bash
npm test -w @vitals/frontend
```

Expected: passes with 0 test files (no tests yet).

**Step 7: Commit**

```bash
git add packages/frontend/vitest.config.ts packages/frontend/src/test-setup.ts packages/frontend/tsconfig.json packages/frontend/package.json packages/frontend/.env.local
git commit -m "chore: configure vitest + jsdom test environment for frontend"
```

---

## Task 2: Install and init shadcn/ui

**Files:**
- Modify: `packages/frontend/src/index.css`
- Modify: `packages/frontend/package.json` (via CLI)
- Creates: `packages/frontend/src/lib/utils.ts` (via CLI)
- Creates: `packages/frontend/src/components/ui/*.tsx` (via CLI)

**Step 1: Run shadcn init**

```bash
cd packages/frontend
npx shadcn@latest init
```

When prompted:
- Style → **New York**
- Base color → **Zinc**
- CSS variables → **Yes**

This creates `src/lib/utils.ts` with the `cn()` helper and updates `index.css` with CSS custom properties.

**Step 2: Install shadcn components**

```bash
npx shadcn@latest add button card table select badge popover calendar skeleton dialog separator
cd ../..
```

This installs Radix UI primitives and creates component files in `src/components/ui/`.

**Step 3: Install sonner (toast) manually**

shadcn uses sonner for toasts but it requires a separate install:
```bash
npm install sonner -w @vitals/frontend
npx shadcn@latest add sonner -c packages/frontend
```

**Step 4: Add dark mode variant to index.css**

Tailwind v4 needs an explicit custom variant for class-based dark mode. After shadcn init, `index.css` will have `@import "tailwindcss"`. Add the dark variant **after** that import:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

/* shadcn CSS variables below — leave as generated by CLI */
```

**Step 5: Verify build still passes**

```bash
npm run build -w @vitals/frontend
```

Expected: no TypeScript errors, build succeeds.

**Step 6: Commit**

```bash
git add packages/frontend/src packages/frontend/package.json
git commit -m "feat: install shadcn/ui with New York style, Zinc base, dark mode variant"
```

---

## Task 3: Zustand stores

**Files:**
- Create: `packages/frontend/src/store/useDateRangeStore.ts`
- Create: `packages/frontend/src/store/useThemeStore.ts`
- Create: `packages/frontend/src/store/__tests__/useDateRangeStore.test.ts`
- Create: `packages/frontend/src/store/__tests__/useThemeStore.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/frontend/src/store/__tests__/useDateRangeStore.test.ts
import { useDateRangeStore } from '../useDateRangeStore';

describe('useDateRangeStore', () => {
  beforeEach(() => {
    // Reset to initial state between tests
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    useDateRangeStore.setState({
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    });
  });

  it('defaults endDate to today (YYYY-MM-DD format)', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(useDateRangeStore.getState().endDate).toBe(today);
  });

  it('defaults startDate to 30 days ago', () => {
    const { startDate, endDate } = useDateRangeStore.getState();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it('setRange updates startDate and endDate', () => {
    useDateRangeStore.getState().setRange('2026-01-01', '2026-01-31');
    const { startDate, endDate } = useDateRangeStore.getState();
    expect(startDate).toBe('2026-01-01');
    expect(endDate).toBe('2026-01-31');
  });
});
```

```typescript
// packages/frontend/src/store/__tests__/useThemeStore.test.ts
import { useThemeStore } from '../useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'system' });
  });

  it('defaults to system theme', () => {
    expect(useThemeStore.getState().theme).toBe('system');
  });

  it('setTheme updates theme', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('accepts light, dark, and system', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().theme).toBe('system');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -w @vitals/frontend
```

Expected: FAIL — "Cannot find module '../useDateRangeStore'"

**Step 3: Implement the stores**

```typescript
// packages/frontend/src/store/useDateRangeStore.ts
import { create } from 'zustand';

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

interface DateRangeState {
  startDate: string;
  endDate: string;
  setRange: (startDate: string, endDate: string) => void;
}

export const useDateRangeStore = create<DateRangeState>((set) => ({
  startDate: toDateString(thirtyDaysAgo),
  endDate: toDateString(today),
  setRange: (startDate, endDate) => set({ startDate, endDate }),
}));
```

```typescript
// packages/frontend/src/store/useThemeStore.ts
import { create } from 'zustand';

type Theme = 'system' | 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
```

**Step 4: Run tests to verify they pass**

```bash
npm test -w @vitals/frontend
```

Expected: PASS — 6 tests.

**Step 5: Commit**

```bash
git add packages/frontend/src/store
git commit -m "feat: add Zustand date range and theme stores"
```

---

## Task 4: API client

**Files:**
- Create: `packages/frontend/src/api/client.ts`
- Create: `packages/frontend/src/api/__tests__/client.test.ts`

**Step 1: Write failing test**

```typescript
// packages/frontend/src/api/__tests__/client.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { apiFetch } from '../client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches from VITE_API_URL + path', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    await apiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      undefined
    );
  });

  it('returns parsed JSON on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [1, 2, 3] }),
    } as Response);

    const result = await apiFetch<{ data: number[] }>('/api/test');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('throws parsed error on non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Not Found', message: 'Resource not found', statusCode: 404 }),
    } as Response);

    await expect(apiFetch('/api/missing')).rejects.toMatchObject({
      error: 'Not Found',
      statusCode: 404,
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -w @vitals/frontend
```

Expected: FAIL — "Cannot find module '../client'"

**Step 3: Implement client.ts**

```typescript
// packages/frontend/src/api/client.ts
import type { ApiError } from '@vitals/shared';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${base}${path}`, options);

  if (!res.ok) {
    const error: ApiError = await res.json();
    throw error;
  }

  return res.json() as Promise<T>;
}
```

**Step 4: Run tests**

```bash
npm test -w @vitals/frontend
```

Expected: PASS — all client tests pass.

**Step 5: Commit**

```bash
git add packages/frontend/src/api/client.ts packages/frontend/src/api/__tests__/client.test.ts
git commit -m "feat: add apiFetch API client wrapper"
```

---

## Task 5: API hooks

**Files:**
- Create: `packages/frontend/src/api/hooks/useNutrition.ts`
- Create: `packages/frontend/src/api/hooks/useWorkouts.ts`
- Create: `packages/frontend/src/api/hooks/useMeasurements.ts`
- Create: `packages/frontend/src/api/hooks/useDashboard.ts`
- Create: `packages/frontend/src/api/hooks/useReports.ts`
- Create: `packages/frontend/src/api/hooks/useUpload.ts`
- Create: `packages/frontend/src/api/__tests__/useNutrition.test.ts`
- Create: `packages/frontend/src/api/__tests__/useWorkouts.test.ts`
- Create: `packages/frontend/src/api/__tests__/useUpload.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/frontend/src/api/__tests__/useNutrition.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useNutritionDaily } from '../hooks/useNutrition';
import * as client from '../client';

vi.mock('../client');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useNutritionDaily', () => {
  it('fetches nutrition data and returns it', async () => {
    const mockData = [{ date: '2026-03-01', calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 25 }];
    vi.mocked(client.apiFetch).mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useNutritionDaily(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(mockData);
  });
});
```

```typescript
// packages/frontend/src/api/__tests__/useWorkouts.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useWorkoutSessions, useExerciseProgress } from '../hooks/useWorkouts';
import * as client from '../client';

vi.mock('../client');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useWorkoutSessions', () => {
  it('returns sessions on success', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({ data: [] });
    const { result } = renderHook(() => useWorkoutSessions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual([]);
  });
});

describe('useExerciseProgress', () => {
  it('does not fetch when exerciseName is null', () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useExerciseProgress(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches when exerciseName is provided', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({ data: { exerciseName: 'Squat', dataPoints: [] } });
    const { result } = renderHook(() => useExerciseProgress('Squat'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
```

```typescript
// packages/frontend/src/api/__tests__/useUpload.test.ts
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useUpload } from '../hooks/useUpload';
import * as client from '../client';

vi.mock('../client');

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useUpload', () => {
  it('calls apiFetch with multipart form data', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({
      data: { importId: 'abc', recordCount: 100, status: 'completed' },
    });
    const { result } = renderHook(() => useUpload(), { wrapper });
    const file = new File(['<xml/>'], 'export.xml', { type: 'text/xml' });
    await result.current.mutateAsync(file);
    expect(client.apiFetch).toHaveBeenCalledWith(
      '/api/upload/apple-health',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -w @vitals/frontend
```

Expected: FAIL — "Cannot find module '../hooks/useNutrition'"

**Step 3: Implement the hooks**

```typescript
// packages/frontend/src/api/hooks/useNutrition.ts
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, DailyNutritionSummary } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function useNutritionDaily() {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: QUERY_KEYS.nutrition.daily(startDate, endDate),
    queryFn: () =>
      apiFetch<ApiResponse<DailyNutritionSummary[]>>(
        `/api/nutrition/daily?startDate=${startDate}&endDate=${endDate}`
      ),
  });
}
```

```typescript
// packages/frontend/src/api/hooks/useWorkouts.ts
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, WorkoutSession, ExerciseProgress } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function useWorkoutSessions() {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: QUERY_KEYS.workouts.sessions(startDate, endDate),
    queryFn: () =>
      apiFetch<ApiResponse<WorkoutSession[]>>(
        `/api/workouts?startDate=${startDate}&endDate=${endDate}`
      ),
  });
}

export function useExerciseProgress(exerciseName: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.workouts.progress(exerciseName ?? ''),
    queryFn: () =>
      apiFetch<ApiResponse<ExerciseProgress>>(
        `/api/workouts/progress/${encodeURIComponent(exerciseName!)}`
      ),
    enabled: !!exerciseName,
  });
}
```

```typescript
// packages/frontend/src/api/hooks/useMeasurements.ts
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, BiometricReading } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function useMeasurements(metric: string) {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: [...QUERY_KEYS.measurements.byMetric(metric), startDate, endDate],
    queryFn: () =>
      apiFetch<ApiResponse<BiometricReading[]>>(
        `/api/measurements?metric=${metric}&startDate=${startDate}&endDate=${endDate}`
      ),
  });
}
```

```typescript
// packages/frontend/src/api/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, DailyNutritionSummary, WorkoutSession, BiometricReading } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';
import { useDateRangeStore } from '@/store/useDateRangeStore';

interface DashboardData {
  nutrition: DailyNutritionSummary[];
  workouts: WorkoutSession[];
  biometrics: BiometricReading[];
}

export function useDashboard() {
  const { startDate, endDate } = useDateRangeStore();
  return useQuery({
    queryKey: QUERY_KEYS.dashboard.weekly(startDate, endDate),
    queryFn: () =>
      apiFetch<ApiResponse<DashboardData>>(
        `/api/dashboard/weekly?startDate=${startDate}&endDate=${endDate}`
      ),
  });
}
```

```typescript
// packages/frontend/src/api/hooks/useReports.ts
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, WeeklyReport } from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';

export function useReports() {
  return useQuery({
    queryKey: QUERY_KEYS.reports.all,
    queryFn: () => apiFetch<ApiResponse<WeeklyReport[]>>('/api/reports'),
  });
}

export function useLatestReport() {
  return useQuery({
    queryKey: QUERY_KEYS.reports.latest,
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<WeeklyReport[]>>('/api/reports');
      return res.data[0] ?? null;
    },
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.byId(id),
    queryFn: () => apiFetch<ApiResponse<WeeklyReport>>(`/api/reports/${id}`),
    enabled: !!id,
  });
}
```

```typescript
// packages/frontend/src/api/hooks/useUpload.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@vitals/shared';
import { apiFetch } from '../client';

interface UploadResult {
  importId: string;
  recordCount: number;
  status: string;
}

export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<ApiResponse<UploadResult>>('/api/upload/apple-health', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

**Step 4: Run tests**

```bash
npm test -w @vitals/frontend
```

Expected: PASS — all hook tests pass.

**Step 5: Commit**

```bash
git add packages/frontend/src/api
git commit -m "feat: add API hooks for nutrition, workouts, measurements, dashboard, reports, upload"
```

---

## Task 6: chart-config + App.tsx wiring

**Files:**
- Create: `packages/frontend/src/lib/chart-config.ts`
- Modify: `packages/frontend/src/App.tsx`

**Step 1: Create chart-config.ts**

```typescript
// packages/frontend/src/lib/chart-config.ts
export const CHART_COLORS = {
  calories: '#f97316',
  protein:  '#3b82f6',
  carbs:    '#eab308',
  fat:      '#ef4444',
  fiber:    '#22c55e',
  weight:   '#a855f7',
  volume:   '#06b6d4',
} as const;
```

**Step 2: Rewrite App.tsx**

```tsx
// packages/frontend/src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { useThemeStore } from '@/store/useThemeStore';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { NutritionPage } from '@/components/nutrition/NutritionPage';
import { WorkoutsPage } from '@/components/workouts/WorkoutsPage';
import { ReportsPage } from '@/components/reports/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 }, // 5 min cache
  },
});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) =>
      dark ? root.classList.add('dark') : root.classList.remove('dark');

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    apply(theme === 'dark');
  }, [theme]);

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="nutrition" element={<NutritionPage />} />
              <Route path="workouts" element={<WorkoutsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

**Step 3: Verify TypeScript build**

```bash
npm run build -w @vitals/frontend
```

Expected: Fails with "Cannot find module '@/components/layout/AppShell'" — that's correct, we haven't built it yet. But there should be no other TypeScript errors. If there are other errors, fix them before continuing.

**Step 4: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/lib/chart-config.ts
git commit -m "feat: wire App.tsx with router, theme provider, and TanStack Query"
```

---

## Task 7: AppShell, Sidebar, Topbar

**Files:**
- Create: `packages/frontend/src/components/layout/AppShell.tsx`
- Create: `packages/frontend/src/components/layout/Sidebar.tsx`
- Create: `packages/frontend/src/components/layout/Topbar.tsx`

**Step 1: Create AppShell**

```tsx
// packages/frontend/src/components/layout/AppShell.tsx
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Create Sidebar**

```tsx
// packages/frontend/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Salad, Dumbbell, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UploadModal } from '@/components/upload/UploadModal';

const navItems = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/nutrition', label: 'Nutrition',  icon: Salad },
  { to: '/workouts',  label: 'Workouts',   icon: Dumbbell },
  { to: '/reports',   label: 'Reports',    icon: FileText },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-lg font-bold tracking-tight">Vitals</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <UploadModal
        trigger={
          <Button variant="outline" size="sm" className="mt-4 w-full gap-2">
            <Upload className="h-4 w-4" />
            Upload Data
          </Button>
        }
      />
    </aside>
  );
}
```

**Step 3: Create Topbar**

```tsx
// packages/frontend/src/components/layout/Topbar.tsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/store/useThemeStore';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

export function Topbar() {
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-border px-6">
      <DateRangePicker />
      <Button variant="ghost" size="icon" onClick={cycleTheme} title={`Theme: ${theme}`}>
        <ThemeIcon className="h-4 w-4" />
      </Button>
    </header>
  );
}
```

**Step 4: Commit (partial — DateRangePicker and UploadModal are stubs for now)**

We'll stub the missing components in the next task. For now verify TypeScript is happy with the stubs noted, then commit after Task 8.

---

## Task 8: DateRangePicker + LoadingSkeleton

**Files:**
- Create: `packages/frontend/src/components/ui/DateRangePicker.tsx`
- Create: `packages/frontend/src/components/ui/LoadingSkeleton.tsx`

**Step 1: Create DateRangePicker**

Uses shadcn `Popover` + `Calendar` (both installed in Task 2). `date-fns` is used for display formatting.

```tsx
// packages/frontend/src/components/ui/DateRangePicker.tsx
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function DateRangePicker() {
  const { startDate, endDate, setRange } = useDateRangeStore();
  const [open, setOpen] = useState(false);

  const selected: DateRange = {
    from: parseISO(startDate),
    to: parseISO(endDate),
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setRange(format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-sm">
          <CalendarIcon className="h-4 w-4" />
          {format(parseISO(startDate), 'MMM d, yyyy')} — {format(parseISO(endDate), 'MMM d, yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Create LoadingSkeleton**

```tsx
// packages/frontend/src/components/ui/LoadingSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function ChartSkeleton() {
  return <Skeleton className="h-[300px] w-full rounded-lg" />;
}

export function TableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <Skeleton className="h-32 w-full rounded-lg" />;
}
```

**Step 3: Verify build**

```bash
npm run build -w @vitals/frontend
```

Expected: Fails only on missing page components (DashboardPage etc.) — no other errors.

**Step 4: Commit layout so far**

```bash
git add packages/frontend/src/components/layout packages/frontend/src/components/ui/DateRangePicker.tsx packages/frontend/src/components/ui/LoadingSkeleton.tsx
git commit -m "feat: add AppShell, Sidebar, Topbar, DateRangePicker, LoadingSkeleton"
```

---

## Task 9: Dashboard page

**Files:**
- Create: `packages/frontend/src/components/dashboard/DashboardPage.tsx`
- Create: `packages/frontend/src/components/dashboard/WeeklySummaryCard.tsx`
- Create: `packages/frontend/src/components/dashboard/NutritionChart.tsx`
- Create: `packages/frontend/src/components/dashboard/WorkoutVolumeChart.tsx`
- Create: `packages/frontend/src/components/dashboard/WeightChart.tsx`
- Create: `packages/frontend/src/components/dashboard/LatestReportPreview.tsx`

**Step 1: Create WeeklySummaryCard**

```tsx
// packages/frontend/src/components/dashboard/WeeklySummaryCard.tsx
import type { DailyNutritionSummary, WorkoutSession, BiometricReading } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  nutrition: DailyNutritionSummary[];
  sessions: WorkoutSession[];
  biometrics: BiometricReading[];
}

export function WeeklySummaryCard({ nutrition, sessions, biometrics }: Props) {
  const avgCalories = nutrition.length > 0
    ? Math.round(nutrition.reduce((sum, d) => sum + d.calories, 0) / nutrition.length)
    : null;

  const weightReadings = biometrics.filter((b) => b.metric === 'weight_kg');
  const avgWeight = weightReadings.length > 0
    ? (weightReadings.reduce((sum, b) => sum + b.value, 0) / weightReadings.length).toFixed(1)
    : null;

  const stats = [
    { label: 'Avg Daily Calories', value: avgCalories ? `${avgCalories} kcal` : '—' },
    { label: 'Workout Sessions',   value: sessions.length.toString() },
    { label: 'Avg Weight',         value: avgWeight ? `${avgWeight} kg` : '—' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Create NutritionChart**

```tsx
// packages/frontend/src/components/dashboard/NutritionChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { DailyNutritionSummary } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

export function NutritionChart({ data }: { data: DailyNutritionSummary[] }) {
  const chartData = data.map((d) => ({
    ...d,
    day: format(parseISO(d.date), 'MMM d'),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nutrition Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="calories" stroke={CHART_COLORS.calories} dot={false} />
            <Line type="monotone" dataKey="protein"  stroke={CHART_COLORS.protein}  dot={false} />
            <Line type="monotone" dataKey="carbs"    stroke={CHART_COLORS.carbs}    dot={false} />
            <Line type="monotone" dataKey="fat"      stroke={CHART_COLORS.fat}      dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create WorkoutVolumeChart**

```tsx
// packages/frontend/src/components/dashboard/WorkoutVolumeChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { WorkoutSession } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

function sessionVolume(session: WorkoutSession): number {
  return session.sets.reduce(
    (sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0),
    0
  );
}

export function WorkoutVolumeChart({ sessions }: { sessions: WorkoutSession[] }) {
  const chartData = sessions.map((s) => ({
    day: format(parseISO(s.date), 'MMM d'),
    volume: Math.round(sessionVolume(s)),
    title: s.title,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workout Volume (kg)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="volume" fill={CHART_COLORS.volume} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create WeightChart**

```tsx
// packages/frontend/src/components/dashboard/WeightChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { BiometricReading } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

export function WeightChart({ biometrics }: { biometrics: BiometricReading[] }) {
  const chartData = biometrics
    .filter((b) => b.metric === 'weight_kg')
    .map((b) => ({ day: format(parseISO(b.date), 'MMM d'), weight: b.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Body Weight (kg)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="weight" stroke={CHART_COLORS.weight} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create LatestReportPreview**

```tsx
// packages/frontend/src/components/dashboard/LatestReportPreview.tsx
import { format, parseISO } from 'date-fns';
import type { WeeklyReport } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLatestReport } from '@/api/hooks/useReports';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

const priorityVariant = {
  high:   'destructive',
  medium: 'secondary',
  low:    'outline',
} as const;

export function LatestReportPreview() {
  const { data, isLoading } = useLatestReport();
  const report: WeeklyReport | null = data ?? null;

  if (isLoading) return <CardSkeleton />;
  if (!report) return (
    <Card>
      <CardContent className="py-6 text-center text-sm text-muted-foreground">
        No reports yet. Generate one via the API.
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Latest AI Report — {format(parseISO(report.periodStart), 'MMM d')} to {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{report.summary}</p>
        <div className="space-y-1">
          {report.actionItems.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Badge variant={priorityVariant[item.priority]} className="mt-0.5 shrink-0 text-xs">
                {item.priority}
              </Badge>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 6: Create DashboardPage**

```tsx
// packages/frontend/src/components/dashboard/DashboardPage.tsx
import { useDashboard } from '@/api/hooks/useDashboard';
import { WeeklySummaryCard }  from './WeeklySummaryCard';
import { NutritionChart }     from './NutritionChart';
import { WorkoutVolumeChart } from './WorkoutVolumeChart';
import { WeightChart }        from './WeightChart';
import { LatestReportPreview } from './LatestReportPreview';
import { ChartSkeleton }      from '@/components/ui/LoadingSkeleton';

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const dashboard = data?.data;

  if (error) return <p className="text-destructive text-sm">Failed to load dashboard data.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {isLoading || !dashboard ? (
        <ChartSkeleton />
      ) : (
        <WeeklySummaryCard
          nutrition={dashboard.nutrition}
          sessions={dashboard.workouts}
          biometrics={dashboard.biometrics}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isLoading || !dashboard ? (
          <><ChartSkeleton /><ChartSkeleton /></>
        ) : (
          <>
            <NutritionChart data={dashboard.nutrition} />
            <WorkoutVolumeChart sessions={dashboard.workouts} />
          </>
        )}
      </div>

      {isLoading || !dashboard ? (
        <ChartSkeleton />
      ) : (
        <WeightChart biometrics={dashboard.biometrics} />
      )}

      <LatestReportPreview />
    </div>
  );
}
```

**Step 7: Run tests and build**

```bash
npm test -w @vitals/frontend
npm run build -w @vitals/frontend
```

Expected: Tests pass. Build fails only on remaining missing page components (Nutrition, Workouts, Reports).

**Step 8: Commit**

```bash
git add packages/frontend/src/components/dashboard
git commit -m "feat: add Dashboard page with summary cards and Recharts visualizations"
```

---

## Task 10: Nutrition page

**Files:**
- Create: `packages/frontend/src/components/nutrition/NutritionPage.tsx`
- Create: `packages/frontend/src/components/nutrition/DailyNutritionTable.tsx`
- Create: `packages/frontend/src/components/nutrition/MacroBreakdown.tsx`

**Step 1: Create DailyNutritionTable**

```tsx
// packages/frontend/src/components/nutrition/DailyNutritionTable.tsx
import { format, parseISO } from 'date-fns';
import type { DailyNutritionSummary } from '@vitals/shared';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export function DailyNutritionTable({ data }: { data: DailyNutritionSummary[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No nutrition data for this period.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Calories</TableHead>
          <TableHead className="text-right">Protein (g)</TableHead>
          <TableHead className="text-right">Carbs (g)</TableHead>
          <TableHead className="text-right">Fat (g)</TableHead>
          <TableHead className="text-right">Fiber (g)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.date}>
            <TableCell>{format(parseISO(row.date), 'EEE, MMM d')}</TableCell>
            <TableCell className="text-right">{Math.round(row.calories)}</TableCell>
            <TableCell className="text-right">{Math.round(row.protein)}</TableCell>
            <TableCell className="text-right">{Math.round(row.carbs)}</TableCell>
            <TableCell className="text-right">{Math.round(row.fat)}</TableCell>
            <TableCell className="text-right">{Math.round(row.fiber)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 2: Create MacroBreakdown**

```tsx
// packages/frontend/src/components/nutrition/MacroBreakdown.tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DailyNutritionSummary } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/chart-config';

export function MacroBreakdown({ data }: { data: DailyNutritionSummary[] }) {
  if (data.length === 0) return null;

  const avg = (key: keyof DailyNutritionSummary) =>
    data.reduce((sum, d) => sum + (d[key] as number), 0) / data.length;

  const pieData = [
    { name: 'Protein', value: Math.round(avg('protein') * 4), color: CHART_COLORS.protein },
    { name: 'Carbs',   value: Math.round(avg('carbs')   * 4), color: CHART_COLORS.carbs },
    { name: 'Fat',     value: Math.round(avg('fat')     * 9), color: CHART_COLORS.fat },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avg Macro Split (kcal)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create NutritionPage**

```tsx
// packages/frontend/src/components/nutrition/NutritionPage.tsx
import { useNutritionDaily } from '@/api/hooks/useNutrition';
import { DailyNutritionTable } from './DailyNutritionTable';
import { MacroBreakdown }      from './MacroBreakdown';
import { TableSkeleton, ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { Card, CardContent } from '@/components/ui/card';

export function NutritionPage() {
  const { data, isLoading, error } = useNutritionDaily();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nutrition</h1>

      {error && <p className="text-destructive text-sm">Failed to load nutrition data.</p>}

      <MacroBreakdown data={rows} />
      {isLoading && <ChartSkeleton />}

      <Card>
        <CardContent className="pt-4">
          {isLoading ? <TableSkeleton /> : <DailyNutritionTable data={rows} />}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add packages/frontend/src/components/nutrition
git commit -m "feat: add Nutrition page with daily table and macro breakdown chart"
```

---

## Task 11: Workouts page

**Files:**
- Create: `packages/frontend/src/components/workouts/WorkoutsPage.tsx`
- Create: `packages/frontend/src/components/workouts/WorkoutSessionCard.tsx`
- Create: `packages/frontend/src/components/workouts/ExerciseProgressChart.tsx`

**Step 1: Create WorkoutSessionCard**

```tsx
// packages/frontend/src/components/workouts/WorkoutSessionCard.tsx
import { format, parseISO } from 'date-fns';
import type { WorkoutSession } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function sessionVolume(session: WorkoutSession): number {
  return Math.round(session.sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0));
}

export function WorkoutSessionCard({ session }: { session: WorkoutSession }) {
  const uniqueExercises = [...new Set(session.sets.map((s) => s.exerciseName))];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{session.title}</CardTitle>
          <span className="shrink-0 text-sm text-muted-foreground">
            {format(parseISO(session.date), 'EEE, MMM d')}
          </span>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{formatDuration(session.durationSeconds)}</span>
          <span>·</span>
          <span>{sessionVolume(session).toLocaleString()} kg volume</span>
          <span>·</span>
          <span>{session.sets.length} sets</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {uniqueExercises.map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create ExerciseProgressChart**

```tsx
// packages/frontend/src/components/workouts/ExerciseProgressChart.tsx
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { WorkoutSession } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExerciseProgress } from '@/api/hooks/useWorkouts';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { CHART_COLORS } from '@/lib/chart-config';

export function ExerciseProgressChart({ sessions }: { sessions: WorkoutSession[] }) {
  const exercises = [...new Set(sessions.flatMap((s) => s.sets.map((set) => set.exerciseName)))].sort();
  const [selected, setSelected] = useState<string | null>(exercises[0] ?? null);

  const { data, isLoading } = useExerciseProgress(selected);
  const progress = data?.data;

  const chartData = progress?.dataPoints.map((dp) => ({
    day: format(parseISO(dp.date), 'MMM d'),
    maxWeight: dp.maxWeight,
    volume: Math.round(dp.totalVolume),
  })) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Exercise Progress</CardTitle>
          <Select value={selected ?? ''} onValueChange={setSelected}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select exercise" />
            </SelectTrigger>
            <SelectContent>
              {exercises.map((ex) => (
                <SelectItem key={ex} value={ex}>{ex}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data for this exercise.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="maxWeight" name="Max Weight (kg)" stroke={CHART_COLORS.weight} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create WorkoutsPage**

```tsx
// packages/frontend/src/components/workouts/WorkoutsPage.tsx
import { useWorkoutSessions } from '@/api/hooks/useWorkouts';
import { WorkoutSessionCard }  from './WorkoutSessionCard';
import { ExerciseProgressChart } from './ExerciseProgressChart';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

export function WorkoutsPage() {
  const { data, isLoading, error } = useWorkoutSessions();
  const sessions = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Workouts</h1>

      {error && <p className="text-destructive text-sm">Failed to load workouts.</p>}

      {sessions.length > 0 && <ExerciseProgressChart sessions={sessions} />}

      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          : sessions.length === 0
          ? <p className="text-sm text-muted-foreground">No workouts in this period.</p>
          : sessions.map((s) => <WorkoutSessionCard key={s.id} session={s} />)
        }
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add packages/frontend/src/components/workouts
git commit -m "feat: add Workouts page with session cards and exercise progress chart"
```

---

## Task 12: Reports page

**Files:**
- Create: `packages/frontend/src/components/reports/ReportsPage.tsx`
- Create: `packages/frontend/src/components/reports/ReportCard.tsx`
- Create: `packages/frontend/src/components/reports/AIInsights.tsx`
- Create: `packages/frontend/src/components/reports/ActionItemList.tsx`

**Step 1: Create ActionItemList**

```tsx
// packages/frontend/src/components/reports/ActionItemList.tsx
import type { ActionItem } from '@vitals/shared';
import { Badge } from '@/components/ui/badge';

const priorityVariant: Record<ActionItem['priority'], 'destructive' | 'secondary' | 'outline'> = {
  high:   'destructive',
  medium: 'secondary',
  low:    'outline',
};

export function ActionItemList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Badge variant={priorityVariant[item.priority]} className="mt-0.5 shrink-0 capitalize text-xs">
            {item.priority}
          </Badge>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
```

**Step 2: Create AIInsights**

```tsx
// packages/frontend/src/components/reports/AIInsights.tsx
export function AIInsights({ insights }: { insights: string }) {
  return (
    <div className="whitespace-pre-wrap rounded-md bg-muted px-4 py-3 text-sm leading-relaxed">
      {insights}
    </div>
  );
}
```

**Step 3: Create ReportCard**

```tsx
// packages/frontend/src/components/reports/ReportCard.tsx
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { WeeklyReport } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AIInsights }     from './AIInsights';
import { ActionItemList } from './ActionItemList';

export function ReportCard({ report }: { report: WeeklyReport }) {
  const [expanded, setExpanded] = useState(false);

  const coverageBadges = [
    { label: `${report.dataCoverage.nutritionDays}d nutrition`,  ok: report.dataCoverage.nutritionDays > 0 },
    { label: `${report.dataCoverage.workoutDays}d workouts`,    ok: report.dataCoverage.workoutDays > 0 },
    { label: `${report.dataCoverage.biometricDays}d biometrics`, ok: report.dataCoverage.biometricDays > 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {format(parseISO(report.periodStart), 'MMM d')} – {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              {coverageBadges.map(({ label, ok }) => (
                <Badge key={label} variant={ok ? 'secondary' : 'outline'} className="text-xs">{label}</Badge>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{report.summary}</p>
        {expanded && (
          <>
            <AIInsights insights={report.insights} />
            <ActionItemList items={report.actionItems} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create ReportsPage**

```tsx
// packages/frontend/src/components/reports/ReportsPage.tsx
import { useReports } from '@/api/hooks/useReports';
import { ReportCard } from './ReportCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

export function ReportsPage() {
  const { data, isLoading, error } = useReports();
  const reports = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      {error && <p className="text-destructive text-sm">Failed to load reports.</p>}

      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          : reports.length === 0
          ? <p className="text-sm text-muted-foreground">No reports yet. Generate one via POST /api/reports/generate.</p>
          : reports.map((r) => <ReportCard key={r.id} report={r} />)
        }
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add packages/frontend/src/components/reports
git commit -m "feat: add Reports page with expandable report cards, AI insights, and action items"
```

---

## Task 13: Upload modal + final wiring

**Files:**
- Create: `packages/frontend/src/components/upload/AppleHealthUploader.tsx`
- Create: `packages/frontend/src/components/upload/UploadModal.tsx`

**Step 1: Create AppleHealthUploader**

```tsx
// packages/frontend/src/components/upload/AppleHealthUploader.tsx
import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUpload } from '@/api/hooks/useUpload';

interface Props {
  onSuccess: () => void;
}

export function AppleHealthUploader({ onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, isPending } = useUpload();

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xml')) {
      toast.error('Please select an Apple Health export .xml file');
      return;
    }
    try {
      const result = await mutateAsync(file);
      toast.success(`Imported ${result.data.recordCount} records`);
      onSuccess();
    } catch {
      toast.error('Upload failed. Check that the file is a valid Apple Health export.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary"
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Drop your Apple Health export here</p>
        <p className="text-xs text-muted-foreground">
          Export from the Health app → Profile → Export All Health Data → export.xml
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? 'Uploading…' : 'Browse file'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
```

**Step 2: Create UploadModal**

```tsx
// packages/frontend/src/components/upload/UploadModal.tsx
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { AppleHealthUploader } from './AppleHealthUploader';

interface Props {
  trigger: React.ReactNode;
}

export function UploadModal({ trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Apple Health Data</DialogTitle>
        </DialogHeader>
        <AppleHealthUploader onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Full build + test verification**

```bash
npm test -w @vitals/frontend
npm run build -w @vitals/frontend
```

Expected: All tests pass. TypeScript build succeeds with no errors.

If TypeScript reports errors about missing `@vitals/shared` types, run `npm run build -w @vitals/shared` first.

**Step 4: Final commit**

```bash
git add packages/frontend/src/components/upload
git commit -m "feat: add Apple Health upload modal with drag-and-drop"
```

---

## Task 14: Integration smoke test

**Step 1: Start backend + frontend**

Terminal 1:
```bash
docker compose up -d   # PostgreSQL
npm run dev -w @vitals/backend
```

Terminal 2:
```bash
npm run dev -w @vitals/frontend
```

**Step 2: Verify checklist**

- [ ] `http://localhost:3000` loads — no blank screen, no console errors
- [ ] Sidebar shows all 4 nav links + Upload button
- [ ] DateRangePicker opens and updates date range
- [ ] Theme toggle cycles system → light → dark
- [ ] Dashboard page: stat cards render (show "—" if no data)
- [ ] Nutrition page: table renders (empty state message if no data)
- [ ] Workouts page: empty state message if no data
- [ ] Reports page: empty state message if no data
- [ ] Upload button opens modal; dragging a file shows uploader

**Step 3: Final commit (if any fixes needed)**

```bash
git add -p   # stage only relevant fixes
git commit -m "fix: resolve integration smoke test issues"
```

---

## Dependency Graph

```
Task 1 (setup) → Task 2 (shadcn) → Task 3 (stores) → Task 4 (client) → Task 5 (hooks)
                                                                              │
                                                      Task 6 (App.tsx) ←────┘
                                                            │
                                               Task 7 (layout) → Task 8 (shared UI)
                                                                        │
                              Task 9 (Dashboard) ←─────────────────────┤
                              Task 10 (Nutrition) ←────────────────────┤
                              Task 11 (Workouts) ←─────────────────────┤
                              Task 12 (Reports) ←──────────────────────┤
                              Task 13 (Upload) ←───────────────────────┘
                                                            │
                                               Task 14 (smoke test)
```

**Parallelizable batches:**
- Batch 1: Tasks 1–2 (sequential, each unblocks the next)
- Batch 2: Tasks 3–5 (stores, client, hooks — independent of UI)
- Batch 3: Tasks 6–8 (App + layout — depends on stores/hooks)
- Batch 4: Tasks 9–13 (pages — all depend on layout, independent of each other)
- Batch 5: Task 14 (smoke test — after all)
