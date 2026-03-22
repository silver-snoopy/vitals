import { create } from 'zustand';
import type { TrackedActionItem, ActionItemStatus } from '@vitals/shared';

interface ActionItemsState {
  // Optimistic status overrides: id → status
  optimisticStatuses: Record<string, ActionItemStatus>;
  setOptimisticStatus: (id: string, status: ActionItemStatus) => void;
  clearOptimisticStatus: (id: string) => void;
  getEffectiveStatus: (item: TrackedActionItem) => ActionItemStatus;
}

export const useActionItemsStore = create<ActionItemsState>((set, get) => ({
  optimisticStatuses: {},

  setOptimisticStatus: (id, status) =>
    set((state) => ({
      optimisticStatuses: { ...state.optimisticStatuses, [id]: status },
    })),

  clearOptimisticStatus: (id) =>
    set((state) => {
      const next = { ...state.optimisticStatuses };
      delete next[id];
      return { optimisticStatuses: next };
    }),

  getEffectiveStatus: (item) => {
    const override = get().optimisticStatuses[item.id];
    return override ?? item.status;
  },
}));
