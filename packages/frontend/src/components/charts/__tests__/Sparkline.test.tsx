import { render } from '@testing-library/react';
import { Sparkline } from '../Sparkline';

// Recharts uses ResizeObserver internally
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let originalResizeObserver: typeof ResizeObserver | undefined;

beforeAll(() => {
  originalResizeObserver = globalThis.ResizeObserver;
  if (!originalResizeObserver) {
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  }
});

afterAll(() => {
  // Restore whatever value was present before these tests ran (possibly undefined)
  (globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    originalResizeObserver;
});

describe('Sparkline', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4, 5]} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with empty data without crashing', () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies custom dimensions', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={120} height={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '48');
  });
});
