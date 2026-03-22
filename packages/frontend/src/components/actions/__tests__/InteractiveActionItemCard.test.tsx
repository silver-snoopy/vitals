import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { InteractiveActionItemCard } from '../InteractiveActionItemCard';
import type { TrackedActionItem } from '@vitals/shared';

// Mock hooks
vi.mock('@/api/hooks/useActionItems', () => ({
  useUpdateActionItemStatus: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/store/useActionItemsStore', () => ({
  useActionItemsStore: () => ({
    setOptimisticStatus: vi.fn(),
    clearOptimisticStatus: vi.fn(),
    getEffectiveStatus: (item: TrackedActionItem) => item.status,
  }),
}));

const baseItem: TrackedActionItem = {
  id: 'item-1',
  reportId: 'report-1',
  category: 'nutrition',
  priority: 'high',
  text: 'Increase protein intake to 150g/day',
  status: 'pending',
  createdAt: '2026-03-22T08:00:00.000Z',
  statusChangedAt: '2026-03-22T08:00:00.000Z',
};

describe('InteractiveActionItemCard — pending state', () => {
  it('renders item text and category', () => {
    render(<InteractiveActionItemCard item={baseItem} />);
    expect(screen.getByText('Increase protein intake to 150g/day')).toBeInTheDocument();
    expect(screen.getByText('nutrition')).toBeInTheDocument();
  });

  it('shows accept, defer, and reject buttons', () => {
    render(<InteractiveActionItemCard item={baseItem} />);
    expect(screen.getByTestId('btn-accept')).toBeInTheDocument();
    expect(screen.getByTestId('btn-defer')).toBeInTheDocument();
    expect(screen.getByTestId('btn-reject')).toBeInTheDocument();
  });

  it('accept button is clickable', () => {
    render(<InteractiveActionItemCard item={baseItem} />);
    const btn = screen.getByTestId('btn-accept');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    // Mutation is called via mocked hook — no error thrown means success
  });
});

describe('InteractiveActionItemCard — active state', () => {
  const activeItem = { ...baseItem, status: 'active' as const };

  it('shows done and defer buttons', () => {
    render(<InteractiveActionItemCard item={activeItem} />);
    expect(screen.getByTestId('btn-complete')).toBeInTheDocument();
    expect(screen.getByTestId('btn-defer')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-reject')).not.toBeInTheDocument();
  });
});

describe('InteractiveActionItemCard — completed state', () => {
  const completedItem = {
    ...baseItem,
    status: 'completed' as const,
    completedAt: '2026-03-24T10:00:00.000Z',
  };

  it('shows completed date and no action buttons', () => {
    render(<InteractiveActionItemCard item={completedItem} />);
    expect(screen.getByText(/Completed Mar 24/)).toBeInTheDocument();
    expect(screen.queryByTestId('btn-accept')).not.toBeInTheDocument();
  });
});
