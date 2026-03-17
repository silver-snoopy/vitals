import { render, screen } from '@testing-library/react';
import { KpiCard } from '../kpi-card';

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Calories" value="2,150" />);
    expect(screen.getByText('2,150')).toBeInTheDocument();
    expect(screen.getByText('Calories')).toBeInTheDocument();
  });

  it('renders trend arrow with correct direction text', () => {
    render(<KpiCard label="Weight" value="180" trend={{ direction: 'down', delta: '-2 lbs' }} />);
    expect(screen.getByText(/▼/)).toBeInTheDocument();
    expect(screen.getByText(/-2 lbs/)).toBeInTheDocument();
  });

  it('renders without trend when not provided', () => {
    const { container } = render(<KpiCard label="Steps" value="8,000" />);
    expect(container.querySelector('.text-success')).not.toBeInTheDocument();
    expect(container.querySelector('.text-destructive')).not.toBeInTheDocument();
  });

  it('renders sparkline slot when provided', () => {
    render(<KpiCard label="HR" value="72" sparkline={<div data-testid="spark">chart</div>} />);
    expect(screen.getByTestId('spark')).toBeInTheDocument();
  });
});
