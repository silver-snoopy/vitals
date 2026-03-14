import { create } from 'zustand';

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
