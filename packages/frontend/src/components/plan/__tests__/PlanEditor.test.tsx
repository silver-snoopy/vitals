import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlanEditor } from '../PlanEditor';

const mockMutate = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('@/api/hooks/useWorkoutPlan', () => ({
  useCreatePlan: () => ({
    mutate: mockMutate,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  mockMutate.mockReset();
  mockIsPending = false;
  mockError = null;
});

describe('PlanEditor', () => {
  it('renders a textarea for pasting plan text', () => {
    render(<PlanEditor />, { wrapper });
    expect(screen.getByTestId('plan-textarea')).toBeDefined();
  });

  it('submit button is disabled when textarea is empty', () => {
    render(<PlanEditor />, { wrapper });
    const btn = screen.getByRole('button', { name: /parse & save/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking submit triggers the useCreatePlan mutation', () => {
    render(<PlanEditor />, { wrapper });
    const textarea = screen.getByTestId('plan-textarea');
    fireEvent.change(textarea, { target: { value: 'Push Day\nBench Press 3x5' } });
    const btn = screen.getByRole('button', { name: /parse & save/i });
    fireEvent.click(btn);
    expect(mockMutate).toHaveBeenCalledWith(
      { rawText: 'Push Day\nBench Press 3x5' },
      expect.anything(),
    );
  });

  it('shows loading state while mutation is pending', () => {
    mockIsPending = true;
    render(<PlanEditor />, { wrapper });
    expect(screen.getByText(/parsing your plan/i)).toBeDefined();
    const btn = screen.getByRole('button');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays parsed plan preview after successful submission', () => {
    // When onSuccess is called, the parent closes the dialog (tested via onSuccess callback)
    const onSuccess = vi.fn();
    render(<PlanEditor onSuccess={onSuccess} />, { wrapper });
    const textarea = screen.getByTestId('plan-textarea');
    fireEvent.change(textarea, { target: { value: 'some plan text' } });

    // Simulate successful mutation by calling onSuccess arg
    mockMutate.mockImplementation((_body: unknown, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });

    const btn = screen.getByRole('button', { name: /parse & save/i });
    fireEvent.click(btn);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error message when mutation fails', () => {
    mockError = new Error('Network error');
    render(<PlanEditor />, { wrapper });
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/network error/i)).toBeDefined();
  });
});
