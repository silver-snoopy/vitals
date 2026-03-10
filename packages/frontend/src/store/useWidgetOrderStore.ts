import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_WIDGET_ORDER = [
  'nutrition-chart',
  'workout-volume-chart',
  'weight-chart',
  'weekly-summary',
  'latest-report',
];

export const WIDGET_LABELS: Record<string, string> = {
  'nutrition-chart': 'Nutrition Trends',
  'workout-volume-chart': 'Workout Volume',
  'weight-chart': 'Body Weight',
  'weekly-summary': 'Weekly Summary',
  'latest-report': 'Latest Report',
};

interface WidgetOrderState {
  order: string[];
  setOrder: (order: string[]) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  reset: () => void;
}

export const useWidgetOrderStore = create<WidgetOrderState>()(
  persist(
    (set) => ({
      order: DEFAULT_WIDGET_ORDER,
      setOrder: (order) => set({ order }),
      moveUp: (id) =>
        set((state) => {
          const idx = state.order.indexOf(id);
          if (idx <= 0) return state;
          const next = [...state.order];
          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
          return { order: next };
        }),
      moveDown: (id) =>
        set((state) => {
          const idx = state.order.indexOf(id);
          if (idx < 0 || idx >= state.order.length - 1) return state;
          const next = [...state.order];
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          return { order: next };
        }),
      reset: () => set({ order: DEFAULT_WIDGET_ORDER }),
    }),
    { name: 'vitals-widget-order' },
  ),
);
