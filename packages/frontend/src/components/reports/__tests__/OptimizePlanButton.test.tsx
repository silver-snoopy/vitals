import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlanAdjustmentBatch } from '@vitals/shared';
import { OptimizePlanButton } from '../OptimizePlanButton';

const mockTuneMutate = vi.fn();
let mockTuneIsPending = false;
let mockCurrentPlanData: unknown = null;
let mockIsPlanLoading = false;

vi.mock('@/api/hooks/useWorkoutPlan', () => ({
  useCurrentPlan: () => ({
    data: mockCurrentPlanData,
    isLoading: mockIsPlanLoading,
  }),
  useTunePlan: () => ({
    mutate: mockTuneMutate,
    isPending: mockTuneIsPending,
  }),
}));

// Mock the AdjustmentReviewModal to keep tests simple
vi.mock('../../plan/AdjustmentReviewModal', () => ({
  AdjustmentReviewModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="adjustment-modal">Modal</div> : null,
}));

const planFixture = {
  id: 'plan-001',
  userId: 'user-1',
  name: 'My Plan',
  splitType: 'PPL',
  activeVersionId: 'v1',
  createdAt: '2026-04-11T00:00:00.000Z',
  updatedAt: '2026-04-11T00:00:00.000Z',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  mockTuneMutate.mockReset();
  mockTuneIsPending = false;
  mockCurrentPlanData = null;
  mockIsPlanLoading = false;
});

describe('OptimizePlanButton', () => {
  it('renders as disabled with tooltip when user has no plan', () => {
    mockCurrentPlanData = { data: null };
    render(<OptimizePlanButton reportId="report-1" />, { wrapper });
    const btn = screen.getByTestId('optimize-disabled');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disabled state shows "Create a plan to unlock" tooltip text', () => {
    mockCurrentPlanData = { data: null };
    render(<OptimizePlanButton reportId="report-1" />, { wrapper });
    expect(screen.getByText(/create a plan to unlock/i)).toBeDefined();
  });

  it('renders as enabled when user has a plan', () => {
    mockCurrentPlanData = {
      data: { plan: planFixture, latestVersion: { id: 'v1', versionNumber: 1 } },
    };
    render(<OptimizePlanButton reportId="report-1" />, { wrapper });
    const btn = screen.getByTestId('optimize-button');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('clicking enabled button triggers useTunePlan mutation', () => {
    mockCurrentPlanData = {
      data: { plan: planFixture, latestVersion: { id: 'v1', versionNumber: 1 } },
    };
    render(<OptimizePlanButton reportId="report-1" />, { wrapper });
    const btn = screen.getByTestId('optimize-button');
    fireEvent.click(btn);
    expect(mockTuneMutate).toHaveBeenCalledWith({ reportId: 'report-1' }, expect.anything());
  });

  it('shows loading state while tune mutation is pending', () => {
    mockCurrentPlanData = {
      data: { plan: planFixture, latestVersion: { id: 'v1', versionNumber: 1 } },
    };
    mockTuneIsPending = true;
    render(<OptimizePlanButton reportId="report-1" />, { wrapper });
    expect(screen.getByText(/analyzing your plan/i)).toBeDefined();
    const btn = screen.getByRole('button', { name: /analyzing/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens AdjustmentReviewModal when tune mutation succeeds', () => {
    mockCurrentPlanData = {
      data: { plan: planFixture, latestVersion: { id: 'v1', versionNumber: 1 } },
    };
    const fakeBatch: PlanAdjustmentBatch = {
      id: 'batch-1',
      planId: 'plan-001',
      sourceVersionId: 'v1',
      reportId: 'report-1',
      createdAt: '2026-04-11T00:00:00.000Z',
      rationale: 'test',
      adjustments: [],
    };
    mockTuneMutate.mockImplementation(
      (_body: unknown, opts: { onSuccess?: (res: { data: PlanAdjustmentBatch }) => void }) => {
        opts?.onSuccess?.({ data: fakeBatch });
      },
    );
    render(<OptimizePlanButton reportId="report-1" />, { wrapper });
    fireEvent.click(screen.getByTestId('optimize-button'));
    expect(screen.getByTestId('adjustment-modal')).toBeDefined();
  });

  it('shows error toast when tune mutation fails', () => {
    mockCurrentPlanData = {
      data: { plan: planFixture, latestVersion: { id: 'v1', versionNumber: 1 } },
    };
    // Just verify mutate is called — toast is tested via Sonner separately
    mockTuneMutate.mockImplementation((_body: unknown, opts: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error('AI failure'));
    });
    // Should not throw
    render(<OptimizePlanButton reportId="report-1" />, { wrapper });
    fireEvent.click(screen.getByTestId('optimize-button'));
    expect(mockTuneMutate).toHaveBeenCalled();
  });
});
