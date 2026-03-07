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
