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
    { name: 'vitals-theme' },
  ),
);
