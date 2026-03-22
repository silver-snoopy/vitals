import { render, screen } from '@testing-library/react';
import { OutcomeBadge } from '../OutcomeBadge';

describe('OutcomeBadge', () => {
  it('renders improved state', () => {
    render(<OutcomeBadge outcome="improved" />);
    expect(screen.getByTestId('outcome-badge')).toHaveTextContent('Improved');
    expect(screen.getByTestId('outcome-badge')).toHaveAttribute('data-outcome', 'improved');
  });

  it('renders stable state', () => {
    render(<OutcomeBadge outcome="stable" />);
    expect(screen.getByTestId('outcome-badge')).toHaveTextContent('Stable');
  });

  it('renders declined state', () => {
    render(<OutcomeBadge outcome="declined" />);
    expect(screen.getByTestId('outcome-badge')).toHaveTextContent('Declined');
  });

  it('shows confidence when provided', () => {
    render(<OutcomeBadge outcome="improved" confidence="high" />);
    expect(screen.getByTestId('outcome-badge')).toHaveTextContent('(high)');
  });

  it('hides confidence when not provided', () => {
    render(<OutcomeBadge outcome="improved" />);
    expect(screen.getByTestId('outcome-badge')).not.toHaveTextContent('(');
  });
});
