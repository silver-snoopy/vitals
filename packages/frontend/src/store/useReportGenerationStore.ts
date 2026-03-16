import { create } from 'zustand';
import type { ReportStatus } from '@vitals/shared';

interface ReportGenerationState {
  pendingReportId: string | null;
  status: ReportStatus | null;
  statusMessage: string | null;
  startGeneration: (reportId: string) => void;
  updateStatus: (status: ReportStatus, message?: string) => void;
  reset: () => void;
}

export const useReportGenerationStore = create<ReportGenerationState>((set) => ({
  pendingReportId: null,
  status: null,
  statusMessage: null,
  startGeneration: (reportId: string) =>
    set({ pendingReportId: reportId, status: 'pending', statusMessage: null }),
  updateStatus: (status: ReportStatus, message?: string) =>
    set({ status, statusMessage: message ?? null }),
  reset: () => set({ pendingReportId: null, status: null, statusMessage: null }),
}));

// Expose store for E2E testing (Playwright can call window.__reportGenStore__)
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__reportGenStore__ = useReportGenerationStore;
}
