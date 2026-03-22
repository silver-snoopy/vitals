import { render, screen } from '@testing-library/react';
import type { AttributionSummary } from '@vitals/shared';
import { AttributionCard } from '../AttributionCard';

const baseSummary: AttributionSummary = {
  period: 'month',
  totalItems: 12,
  completedItems: 9,
  completionRate: 0.75,
  measuredItems: 7,
  improvedItems: 5,
  stableItems: 1,
  declinedItems: 1,
  improvementRate: 0.714,
  topImprovements: [
    { text: 'Increase protein', category: 'nutrition', metric: 'protein_g', change: '+14.0' },
    { text: 'Maintain volume', category: 'workout', metric: 'training_volume', change: '+200.0' },
  ],
};

describe('AttributionCard', () => {
  it('renders completion rate', () => {
    render(<AttributionCard data={baseSummary} />);
    expect(screen.getByText('9/12 items')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
  });

  it('renders outcome breakdown', () => {
    render(<AttributionCard data={baseSummary} />);
    expect(screen.getByText(/5 improved/)).toBeInTheDocument();
    expect(screen.getByText(/1 stable/)).toBeInTheDocument();
    expect(screen.getByText(/1 declined/)).toBeInTheDocument();
  });

  it('renders top improvements', () => {
    render(<AttributionCard data={baseSummary} />);
    expect(screen.getByText('+14.0')).toBeInTheDocument();
    expect(screen.getByText('protein_g')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    const empty: AttributionSummary = {
      ...baseSummary,
      totalItems: 0,
      completedItems: 0,
      measuredItems: 0,
      improvedItems: 0,
      stableItems: 0,
      declinedItems: 0,
      completionRate: 0,
      improvementRate: 0,
      topImprovements: [],
    };
    render(<AttributionCard data={empty} />);
    expect(screen.getByText(/No action items tracked yet/)).toBeInTheDocument();
  });

  it('uses correct period label', () => {
    render(<AttributionCard data={{ ...baseSummary, period: 'week' }} />);
    expect(screen.getByText("This Week's Impact")).toBeInTheDocument();
  });
});
