import { useEffect } from 'react';
import type { ReactNode } from 'react';
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
    try {
      await set('vitals-query-cache', client);
    } catch {
      // IndexedDB unavailable (e.g. Safari private browsing) — silently skip persistence
    }
  },
  restoreClient: async () => {
    try {
      return await get<PersistedClient>('vitals-query-cache');
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del('vitals-query-cache');
    } catch {
      // ignore
    }
  },
};

function ThemeProvider({ children }: { children: ReactNode }) {
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
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: idbPersister }}>
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
