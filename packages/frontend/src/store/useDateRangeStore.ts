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
