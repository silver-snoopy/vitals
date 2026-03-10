import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const WIDGET_IDS = [
  'nutrition-chart',
  'workout-volume-chart',
  'weight-chart',
  'weekly-summary',
  'latest-report',
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [...WIDGET_IDS];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  'nutrition-chart': 'Nutrition Trends',
  'workout-volume-chart': 'Workout Volume',
  'weight-chart': 'Body Weight',
  'weekly-summary': 'Weekly Summary',
  'latest-report': 'Latest Report',
};

interface WidgetOrderState {
  order: WidgetId[];
  setOrder: (order: WidgetId[]) => void;
  moveUp: (id: WidgetId) => void;
  moveDown: (id: WidgetId) => void;
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
