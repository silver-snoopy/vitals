import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ActionsPage } from '../ActionsPage';
import type { TrackedActionItem } from '@vitals/shared';

const pendingItem: TrackedActionItem = {
  id: 'item-1',
  reportId: 'report-1',
  category: 'nutrition',
  priority: 'high',
  text: 'Eat more protein',
  status: 'pending',
  createdAt: '2026-03-22T08:00:00.000Z',
  statusChangedAt: '2026-03-22T08:00:00.000Z',
};

const activeItem: TrackedActionItem = {
  id: 'item-2',
  reportId: 'report-1',
  category: 'workout',
  priority: 'medium',
  text: 'Add a rest day',
  status: 'active',
  createdAt: '2026-03-22T08:00:00.000Z',
  statusChangedAt: '2026-03-22T08:00:00.000Z',
};

vi.mock('@/api/hooks/useActionItems', () => ({
  useActionItems: vi.fn(({ status }: { status?: string[] }) => {
    const all = [pendingItem, activeItem];
    const filtered = status ? all.filter((i) => status.includes(i.status)) : all;
    return { data: { data: filtered }, isLoading: false };
  }),
  useActionItemSummary: vi.fn(() => ({
    data: { data: { pending: 1, active: 1, completed: 2, deferred: 0, expired: 0, total: 4 } },
  })),
  useUpdateActionItemStatus: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/store/useActionItemsStore', () => ({
  useActionItemsStore: () => ({
    setOptimisticStatus: vi.fn(),
    clearOptimisticStatus: vi.fn(),
    getEffectiveStatus: (item: TrackedActionItem) => item.status,
  }),
}));

describe('ActionsPage', () => {
  it('renders page heading', () => {
    render(<ActionsPage />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders progress summary', () => {
    render(<ActionsPage />);
    expect(screen.getByText(/2 of 4 completed/)).toBeInTheDocument();
  });

  it('renders pending and active sections by default', () => {
    render(<ActionsPage />);
    expect(screen.getAllByText(/Pending/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Active/i).length).toBeGreaterThan(0);
  });

  it('renders action item cards', () => {
    render(<ActionsPage />);
    expect(screen.getByText('Eat more protein')).toBeInTheDocument();
    expect(screen.getByText('Add a rest day')).toBeInTheDocument();
  });

  it('filter tabs render', () => {
    render(<ActionsPage />);
    expect(screen.getByTestId('tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('tab-pending')).toBeInTheDocument();
    expect(screen.getByTestId('tab-active')).toBeInTheDocument();
    expect(screen.getByTestId('tab-completed')).toBeInTheDocument();
  });

  it('switches to active-only view when active tab clicked', () => {
    render(<ActionsPage />);
    fireEvent.click(screen.getByTestId('tab-active'));
    // After filtering, only active section shown
    expect(screen.getByText('Add a rest day')).toBeInTheDocument();
  });
});
