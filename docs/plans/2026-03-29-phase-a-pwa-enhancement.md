# Phase A: PWA Enhancement — Implementation Plan

**Date:** 2026-03-29
**Type:** Feature
**Prerequisite:** None (greenfield PWA setup)
**Research:** [PWA + iOS Feasibility Research](../research/2026-03-29-pwa-ios-feasibility.md)
**Estimated scope:** Medium (~2-3 days)

---

## Context

Vitals is a personal health dashboard (React 19 + Vite 6 + Tailwind 4 + shadcn/ui) deployed as a static SPA on Vercel. The frontend already has a mobile-first responsive design with bottom navigation, safe-area support, and swipeable charts — but zero PWA infrastructure. This phase transforms the existing web app into a fully installable, offline-capable Progressive Web App.

**What this delivers:**
- App icon on iOS/Android Home Screen with standalone mode (no browser chrome)
- Offline viewing of previously loaded dashboard data
- Faster repeat visits via cached assets
- Theme and date-range preferences persisted across sessions
- User-controlled update prompts when new versions deploy
- iOS-specific install guidance banner

**What this does NOT deliver (deferred to Phase B):**
- App Store distribution
- Automatic HealthKit sync
- Native push notifications
- Face ID / biometric auth

---

## Project Structure Reference

```
packages/frontend/
  ├── index.html                          # Entry HTML — needs iOS meta tags
  ├── vite.config.ts                      # Build config — needs VitePWA plugin
  ├── package.json                        # Dependencies
  ├── tsconfig.json                       # TypeScript config
  ├── public/                             # DOES NOT EXIST — must create
  │   └── icons/                          # App icons — must create
  ├── src/
  │   ├── main.tsx                        # React entry point
  │   ├── App.tsx                         # Router + QueryClient + ThemeProvider
  │   ├── index.css                       # Tailwind theme + safe-area styles
  │   ├── pwa.d.ts                        # DOES NOT EXIST — must create
  │   ├── api/client.ts                   # Fetch wrapper (VITE_API_URL)
  │   ├── store/
  │   │   ├── useDateRangeStore.ts        # Date range — needs persist middleware
  │   │   ├── useThemeStore.ts            # Theme — needs persist middleware
  │   │   ├── useChatStore.ts             # Chat messages (do NOT persist)
  │   │   ├── useReportGenerationStore.ts # Report gen (do NOT persist)
  │   │   └── useActionItemsStore.ts      # Action items (do NOT persist)
  │   ├── components/
  │   │   ├── layout/
  │   │   │   ├── AppShell.tsx            # Main layout — needs offline indicator + iOS prompt
  │   │   │   ├── BottomNav.tsx
  │   │   │   ├── MobileHeader.tsx
  │   │   │   ├── Sidebar.tsx
  │   │   │   └── Topbar.tsx
  │   │   ├── pwa/                        # DOES NOT EXIST — must create
  │   │   │   ├── PwaUpdatePrompt.tsx
  │   │   │   ├── OfflineIndicator.tsx
  │   │   │   └── IosInstallPrompt.tsx
  │   │   └── ui/
  │   │       ├── button.tsx
  │   │       ├── sonner.tsx              # Toast notifications (reuse for PWA prompts)
  │   │       └── ...
  │   └── hooks/
  │       └── useIsMobile.ts              # Mobile breakpoint detection (reuse)
```

---

## Dependencies

Run from the **repository root**:

```bash
npm install -w @vitals/frontend vite-plugin-pwa@^1.2.0
npm install -w @vitals/frontend @tanstack/react-query-persist-client@^5.62.0
npm install -w @vitals/frontend idb-keyval@^6.2.1
```

**No new devDependencies required.** `vite-plugin-pwa` bundles its own Workbox integration.

---

## Task 1: Create App Icons and Public Directory

### 1.1 Create directory structure

```bash
mkdir -p packages/frontend/public/icons
```

### 1.2 Create placeholder SVG icon

Create `packages/frontend/public/icons/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0a0a0a"/>
  <text x="256" y="340" font-family="system-ui, sans-serif" font-size="280" font-weight="bold" fill="#e5e5e5" text-anchor="middle">V</text>
</svg>
```

### 1.3 Generate PNG icons from SVG

Use a build script or manually create these files from the SVG:

- `packages/frontend/public/icons/icon-192.png` — 192x192 PNG
- `packages/frontend/public/icons/icon-512.png` — 512x512 PNG
- `packages/frontend/public/icons/apple-touch-icon-180.png` — 180x180 PNG
- `packages/frontend/public/icons/icon-64.png` — 64x64 PNG (favicon)

**Option A — Use sharp (Node.js script):**

Create a temporary script `packages/frontend/scripts/generate-icons.ts`:

```typescript
import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/icons/icon.svg');

const sizes = [
  { name: 'icon-64.png', size: 64 },
  { name: 'apple-touch-icon-180.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log(`Generated ${name}`);
}
```

Run: `cd packages/frontend && npx tsx scripts/generate-icons.ts`

Then delete the script — it's a one-time setup.

**Option B — Manual:** Use any image editor or online SVG-to-PNG converter. The exact design doesn't matter for this implementation — the user can replace icons later.

### 1.4 Move existing favicon

The current `packages/frontend/public/` does not exist. The existing `vite.svg` is referenced in `index.html`. After creating `public/`, move or replace it:

```bash
# vite.svg is likely at the build root, or auto-generated by Vite
# Keep it or replace with the new icon
cp packages/frontend/public/icons/icon-64.png packages/frontend/public/favicon.png
```

### Verification
- `packages/frontend/public/icons/` contains at least: `icon-192.png`, `icon-512.png`, `apple-touch-icon-180.png`
- All PNG files are valid images (not 0 bytes)

---

## Task 2: Configure vite-plugin-pwa

### Current file: `packages/frontend/vite.config.ts`

```typescript
// CURRENT (before)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Required changes

Replace the entire file with:

```typescript
// AFTER
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: {
        name: 'Vitals — Health Dashboard',
        short_name: 'Vitals',
        description: 'Personal health data management dashboard',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Key decisions

| Setting | Value | Rationale |
|---------|-------|-----------|
| `registerType` | `'prompt'` | User-controlled updates — prevents losing form state during auto-reload |
| `globPatterns` | `'**/*.{js,css,html,ico,png,svg,woff2}'` | Precache all static assets including fonts |
| API caching | `NetworkFirst` with 3s timeout | Fresh data preferred; serve cached if offline or slow |
| Font caching | `CacheFirst` | Fonts rarely change; content-hash invalidates stale entries |
| `manifest.display` | `'standalone'` | Full app-like experience, no browser chrome |
| `manifest.orientation` | `'portrait'` | Health dashboard optimized for portrait |

### Important notes
- `vite-plugin-pwa` **auto-injects** `<link rel="manifest">` into `index.html` at build time — do NOT add it manually
- The manifest file is generated as `dist/manifest.webmanifest`
- The service worker is generated as `dist/sw.js`

### Verification
- `npm run build -w @vitals/frontend` passes
- `dist/manifest.webmanifest` exists and contains correct values
- `dist/sw.js` exists

---

## Task 3: Add iOS Meta Tags to index.html

### Current file: `packages/frontend/index.html`

```html
<!-- CURRENT (before) -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Vitals</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Required changes

Replace the entire file with:

```html
<!-- AFTER -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Vitals</title>
    <meta name="description" content="Personal health data management dashboard" />

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="/favicon.png" />

    <!-- iOS PWA meta tags -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Vitals" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />

    <!-- Theme color (matches dark/light mode backgrounds in index.css) -->
    <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />

    <!-- Note: <link rel="manifest"> is auto-injected by vite-plugin-pwa — do NOT add manually -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Key decisions

| Tag | Value | Rationale |
|-----|-------|-----------|
| `apple-mobile-web-app-capable` | `yes` | Enables standalone mode on iOS (no Safari chrome) |
| `apple-mobile-web-app-status-bar-style` | `black-translucent` | Status bar overlays content — matches `viewport-fit=cover` |
| `theme-color` (dark) | `#0a0a0a` | Matches `--background: oklch(0.145 0 0)` in dark mode |
| `theme-color` (light) | `#ffffff` | Matches `--background: oklch(1 0 0)` in light mode |

### Verification
- Open `index.html` in browser dev tools → Elements → verify meta tags present
- No `<link rel="manifest">` manually added (vite-plugin-pwa handles this)

---

## Task 4: Add TypeScript Declarations for Virtual Modules

### Create new file: `packages/frontend/src/pwa.d.ts`

```typescript
declare module 'virtual:pwa-register/react' {
  import type { Dispatch, SetStateAction } from 'react';

  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
```

### Verification
- No TypeScript errors when importing `useRegisterSW` from `'virtual:pwa-register/react'`

---

## Task 5: Add TanStack Query Offline Persistence

### Current file: `packages/frontend/src/App.tsx`

```tsx
// CURRENT (before)
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
import { ChatPage } from '@/components/chat/ChatPage';
import { ActionsPage } from '@/components/actions/ActionsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
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
              <Route path="actions" element={<ActionsPage />} />
              <Route path="chat" element={<ChatPage />} />
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

### Required changes

Replace the entire file with:

```tsx
// AFTER
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';
import { Toaster } from '@/components/ui/sonner';
import { useThemeStore } from '@/store/useThemeStore';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { NutritionPage } from '@/components/nutrition/NutritionPage';
import { WorkoutsPage } from '@/components/workouts/WorkoutsPage';
import { ReportsPage } from '@/components/reports/ReportsPage';
import { ChatPage } from '@/components/chat/ChatPage';
import { ActionsPage } from '@/components/actions/ActionsPage';
import { PwaUpdatePrompt } from '@/components/pwa/PwaUpdatePrompt';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — must be >= persister maxAge
      networkMode: 'offlineFirst',
    },
  },
});

const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await set('vitals-query-cache', client);
  },
  restoreClient: async () => {
    return await get<PersistedClient>('vitals-query-cache');
  },
  removeClient: async () => {
    await del('vitals-query-cache');
  },
};

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister }}
    >
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="nutrition" element={<NutritionPage />} />
              <Route path="workouts" element={<WorkoutsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="actions" element={<ActionsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <PwaUpdatePrompt />
        <Toaster richColors />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
```

### Changes explained

| Change | Why |
|--------|-----|
| `QueryClientProvider` → `PersistQueryClientProvider` | Enables automatic IndexedDB persistence of React Query cache |
| `gcTime: 24 hours` | **Must be >= persister maxAge** (default 24h). Without this, queries are garbage-collected before they can be restored from IndexedDB on next visit |
| `networkMode: 'offlineFirst'` | Serves cached data immediately while refetching in background. Without network, returns cache without error |
| `idbPersister` using `idb-keyval` | IndexedDB storage via `idb-keyval` — async, handles large cache, no localStorage 5MB limit |
| `PwaUpdatePrompt` added | Renders the SW update toast (created in Task 7) |

### Important notes
- `PersistQueryClientProvider` wraps `QueryClientProvider` internally — do NOT nest both
- The persister throttles writes to IndexedDB automatically (once per second)
- `idb-keyval` uses a single IDB store named `keyval-store` in a database named `keyval-store`

### Verification
- `npm run build -w @vitals/frontend` passes (no type errors)
- Open app → navigate to Dashboard → close tab → reopen → data loads from cache instantly before network fetch completes

---

## Task 6: Add Zustand Persistence to Key Stores

### 6.1 Modify: `packages/frontend/src/store/useDateRangeStore.ts`

```typescript
// CURRENT (before)
import { create } from 'zustand';

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = new Date();
const fourteenDaysAgo = new Date(today);
fourteenDaysAgo.setDate(today.getDate() - 14);

interface DateRangeState {
  startDate: string;
  endDate: string;
  setRange: (startDate: string, endDate: string) => void;
}

export const useDateRangeStore = create<DateRangeState>((set) => ({
  startDate: toDateString(fourteenDaysAgo),
  endDate: toDateString(today),
  setRange: (startDate, endDate) => set({ startDate, endDate }),
}));
```

Replace the entire file with:

```typescript
// AFTER
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = new Date();
const fourteenDaysAgo = new Date(today);
fourteenDaysAgo.setDate(today.getDate() - 14);

interface DateRangeState {
  startDate: string;
  endDate: string;
  setRange: (startDate: string, endDate: string) => void;
}

export const useDateRangeStore = create<DateRangeState>()(
  persist(
    (set) => ({
      startDate: toDateString(fourteenDaysAgo),
      endDate: toDateString(today),
      setRange: (startDate, endDate) => set({ startDate, endDate }),
    }),
    { name: 'vitals-date-range' },
  ),
);
```

### Changes explained
- Added `persist()` middleware from `zustand/middleware` (built-in, no extra dependency)
- Zustand 5 requires the extra `()` call on `create<T>()( ... )` when using middleware — this is correct TypeScript syntax
- Storage key: `'vitals-date-range'` in `localStorage` (default storage — fine for < 5KB)
- Date range strings are already serializable — no custom serializer needed

### 6.2 Modify: `packages/frontend/src/store/useThemeStore.ts`

```typescript
// CURRENT (before)
import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';
import { Moon, Sun, Monitor } from 'lucide-react';

export type Theme = 'system' | 'light' | 'dark';

const THEME_CYCLE: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export const THEME_ICONS: Record<Theme, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
  cycleTheme: () => set((s) => ({ theme: THEME_CYCLE[s.theme] })),
}));
```

Replace the entire file with:

```typescript
// AFTER
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LucideIcon } from 'lucide-react';
import { Moon, Sun, Monitor } from 'lucide-react';

export type Theme = 'system' | 'light' | 'dark';

const THEME_CYCLE: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export const THEME_ICONS: Record<Theme, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      cycleTheme: () => set((s) => ({ theme: THEME_CYCLE[s.theme] })),
    }),
    {
      name: 'vitals-theme',
      partialState: undefined, // persist entire store (theme only — very small)
    },
  ),
);
```

### Which stores NOT to persist (and why)
- `useChatStore` — Messages can be large; chat requires server connectivity anyway
- `useReportGenerationStore` — Transient state (pendingReportId, status) — stale on reload
- `useActionItemsStore` — Optimistic overrides that must match server state

### Verification
- Open app → change theme to dark → change date range → close tab
- Reopen tab → theme is still dark, date range preserved
- Inspect `localStorage` → keys `vitals-date-range` and `vitals-theme` exist with JSON values

---

## Task 7: Create PWA Update Prompt Component

### Create new file: `packages/frontend/src/components/pwa/PwaUpdatePrompt.tsx`

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useEffect } from 'react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every hour
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('App ready for offline use');
    }
  }, [offlineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast('New version available', {
        description: 'Click update to get the latest features.',
        action: {
          label: 'Update',
          onClick: () => updateServiceWorker(true),
        },
        duration: Infinity,
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
```

### Design decisions
- Uses existing `sonner` toast system instead of custom UI — consistent with app patterns
- `duration: Infinity` on update toast — user must explicitly dismiss or click Update
- Hourly update checks via `registration.update()` — catches deploys while app is open
- Returns `null` — this is a behavior-only component, no visual output (toasts are portaled)

### Verification
- No TypeScript errors
- During development, the prompt component mounts without errors (SW features are dev-mode limited)

---

## Task 8: Create Offline Indicator Component

### Create new file: `packages/frontend/src/components/pwa/OfflineIndicator.tsx`

```tsx
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-xs font-medium text-warning-foreground">
      <WifiOff className="h-3.5 w-3.5" />
      <span>You're offline — showing cached data</span>
    </div>
  );
}
```

### Design decisions
- Uses existing `warning` CSS variable from the theme (`--warning` / `--warning-foreground`)
- Uses existing `lucide-react` icon (`WifiOff`) — already a dependency
- Compact design (`text-xs`, `py-1.5`) — doesn't push layout significantly
- Positioned inside the AppShell flex column — above the main content

### Verification
- Open Chrome DevTools → Network → toggle Offline → yellow bar appears
- Go back online → bar disappears

---

## Task 9: Create iOS Install Prompt Component

### Create new file: `packages/frontend/src/components/pwa/IosInstallPrompt.tsx`

```tsx
import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const IOS_PROMPT_DISMISSED_KEY = 'vitals-ios-prompt-dismissed';

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari && !isStandalone;
}

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;
    const dismissed = localStorage.getItem(IOS_PROMPT_DISMISSED_KEY);
    if (!dismissed) {
      // Delay showing the prompt to avoid interrupting initial load
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(IOS_PROMPT_DISMISSED_KEY, 'true');
  };

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <div className="flex-1 text-sm">
        <p className="font-medium">Install Vitals</p>
        <p className="text-muted-foreground">
          Tap <Share className="inline h-4 w-4" /> then "Add to Home Screen" for the best experience.
        </p>
      </div>
      <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss install prompt">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### Design decisions
- **Detection logic:** Checks for iOS + Safari + NOT already standalone — avoids showing in Chrome/Firefox on iOS, which can't install PWAs
- **iPadOS detection:** Includes `MacIntel` + `maxTouchPoints > 1` check (iPadOS reports as Mac)
- **Dismissal persisted** in localStorage — won't annoy returning users
- **3-second delay** — lets the app load before prompting
- **No `beforeinstallprompt`** — this event doesn't exist on iOS. This is a purely educational banner.
- Uses existing `Button`, `Share`, `X` components — consistent with app design

### Verification
- Component renders correctly in Storybook/isolation (mock iOS user agent for testing)
- Does NOT show on desktop browsers or non-Safari iOS browsers
- Dismiss persists via localStorage — refresh doesn't re-show

---

## Task 10: Integrate PWA Components into AppShell

### Current file: `packages/frontend/src/components/layout/AppShell.tsx`

```tsx
// CURRENT (before)
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader className="md:hidden" />
        <Topbar className="hidden md:flex" />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
        <BottomNav className="md:hidden" />
      </div>
    </div>
  );
}
```

Replace the entire file with:

```tsx
// AFTER
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { IosInstallPrompt } from '@/components/pwa/IosInstallPrompt';

export function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader className="md:hidden" />
        <Topbar className="hidden md:flex" />
        <OfflineIndicator />
        <IosInstallPrompt />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
        <BottomNav className="md:hidden" />
      </div>
    </div>
  );
}
```

### Changes explained
- `OfflineIndicator` placed above `<main>` — shows warning bar when offline, hidden when online
- `IosInstallPrompt` placed above `<main>` — shows only on iOS Safari (non-standalone), dismissed permanently
- Both components render `null` when inactive — zero layout impact

### Verification
- App shell renders correctly with no visual change in normal online state
- Toggle network offline in DevTools → warning bar appears above content
- Test on iOS Safari user agent → install prompt shows

---

## Task 11: Update Existing Tests

### 11.1 Update Zustand store tests (if any exist)

Check if tests exist for the modified stores:

```bash
find packages/frontend/src/store -name '*.test.*'
```

If `useDateRangeStore.test.ts` or `useThemeStore.test.ts` exist, update them to account for persist middleware:

- **localStorage mock** — Zustand persist reads from localStorage on init. In tests, either:
  - Clear localStorage before each test: `beforeEach(() => localStorage.clear())`
  - Or mock localStorage if in jsdom (jsdom provides a working localStorage)

### 11.2 Update App.tsx tests (if any exist)

The `QueryClientProvider` → `PersistQueryClientProvider` change may affect test wrappers. Check:

```bash
find packages/frontend/src -name '*.test.*' | xargs grep -l 'QueryClient'
```

For any test that creates its own `QueryClient`, ensure `gcTime` matches or test data isn't unexpectedly persisted.

### Verification
- `npm test -w @vitals/frontend` — all existing tests pass
- No new test failures from persist middleware or provider change

---

## Task 12: Final Verification Checklist

Run all checks in order:

### 12.1 Build

```bash
npm run build -w @vitals/shared && npm run build -w @vitals/frontend
```

Must pass with zero errors.

### 12.2 Lint & Format

```bash
npm run lint
npm run format:check
```

Both must pass. If format fails, run `npm run format` to auto-fix.

### 12.3 Unit Tests

```bash
npm test -w @vitals/frontend
```

All tests pass.

### 12.4 Build Output Verification

```bash
ls packages/frontend/dist/manifest.webmanifest
ls packages/frontend/dist/sw.js
```

Both files must exist.

Inspect the manifest:

```bash
cat packages/frontend/dist/manifest.webmanifest
```

Should contain: `"name": "Vitals — Health Dashboard"`, `"display": "standalone"`, icon entries.

### 12.5 Preview Server Testing

```bash
cd packages/frontend && npm run preview
```

Open `http://localhost:4173` in Chrome:
1. DevTools → Application → Manifest → verify manifest loaded, icons visible
2. DevTools → Application → Service Workers → verify SW registered
3. DevTools → Application → Cache Storage → verify static assets cached
4. DevTools → Network → toggle Offline → app still loads from cache
5. Navigate between pages while offline — cached API data displayed

### 12.6 E2E Smoke Test

Run existing Playwright tests to ensure nothing broke:

```bash
npm run test:e2e
```

All existing E2E tests must still pass.

---

## Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Service worker caches stale API data | Medium | `NetworkFirst` with 3s timeout ensures fresh data when online; 24h cache expiry limits staleness |
| Zustand persist breaks existing tests | Low | `localStorage.clear()` in `beforeEach` prevents state leakage between tests |
| IndexedDB persistence slows initial load | Low | `PersistQueryClientProvider` restores cache asynchronously; app renders immediately with loading states |
| vite-plugin-pwa dev mode limitations | Low | SW features only fully work in `preview` mode; dev mode shows console warnings (expected) |
| iOS 7-day storage eviction | Medium | Re-cache on launch via SW `activate` event; `navigator.storage.persist()` can be called but requires notification permission |
| Large query cache in IndexedDB | Low | 50-entry limit on API cache + 24h expiry keeps size manageable (estimated < 1MB) |

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `packages/frontend/public/icons/icon.svg` | Source SVG icon |
| Create | `packages/frontend/public/icons/icon-192.png` | PWA manifest icon |
| Create | `packages/frontend/public/icons/icon-512.png` | PWA manifest icon |
| Create | `packages/frontend/public/icons/apple-touch-icon-180.png` | iOS Home Screen icon |
| Create | `packages/frontend/public/icons/icon-64.png` | Favicon |
| Create | `packages/frontend/public/favicon.png` | HTML favicon |
| Create | `packages/frontend/src/pwa.d.ts` | Virtual module type declarations |
| Create | `packages/frontend/src/components/pwa/PwaUpdatePrompt.tsx` | SW update toast |
| Create | `packages/frontend/src/components/pwa/OfflineIndicator.tsx` | Offline warning banner |
| Create | `packages/frontend/src/components/pwa/IosInstallPrompt.tsx` | iOS install guidance |
| Modify | `packages/frontend/vite.config.ts` | Add VitePWA plugin |
| Modify | `packages/frontend/index.html` | iOS meta tags, favicon |
| Modify | `packages/frontend/src/App.tsx` | PersistQueryClientProvider, gcTime, networkMode, PwaUpdatePrompt |
| Modify | `packages/frontend/src/store/useDateRangeStore.ts` | Add persist middleware |
| Modify | `packages/frontend/src/store/useThemeStore.ts` | Add persist middleware |
| Modify | `packages/frontend/src/components/layout/AppShell.tsx` | Add OfflineIndicator, IosInstallPrompt |
