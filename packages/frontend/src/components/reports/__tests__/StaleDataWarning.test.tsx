import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaleDataWarning } from '../StaleDataWarning';
import * as client from '@/api/client';

vi.mock('@/api/client');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('StaleDataWarning', () => {
  it('renders nothing when all providers are fresh', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({
      data: [
        {
          providerName: 'hevy',
          lastSuccessfulFetch: new Date().toISOString(),
          lastAttemptedFetch: new Date().toISOString(),
          recordCount: 10,
          status: 'success',
          errorMessage: null,
        },
      ],
    });

    const { container } = render(<StaleDataWarning />, { wrapper });
    // Wait for query to resolve, then check no warning rendered
    await vi.waitFor(() => {
      expect(container.querySelector('.bg-yellow-500\\/10')).toBeNull();
    });
  });

  it('renders warning when a provider is stale', async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    vi.mocked(client.apiFetch).mockResolvedValueOnce({
      data: [
        {
          providerName: 'cronometer-nutrition',
          lastSuccessfulFetch: staleDate,
          lastAttemptedFetch: staleDate,
          recordCount: 5,
          status: 'success',
          errorMessage: null,
        },
      ],
    });

    render(<StaleDataWarning />, { wrapper });
    await screen.findByText(/Data may be stale/);
    expect(screen.getByText('cronometer-nutrition')).toBeDefined();
  });

  it('renders nothing when a provider has never been attempted', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({
      data: [
        {
          providerName: 'hevy',
          lastSuccessfulFetch: null,
          lastAttemptedFetch: null,
          recordCount: 0,
          status: 'idle',
          errorMessage: null,
        },
      ],
    });

    const { container } = render(<StaleDataWarning />, { wrapper });
    await vi.waitFor(() => {
      expect(container.querySelector('.bg-yellow-500\\/10')).toBeNull();
    });
  });

  it('renders warning when a provider was attempted but never succeeded', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({
      data: [
        {
          providerName: 'cronometer-nutrition',
          lastSuccessfulFetch: null,
          lastAttemptedFetch: new Date().toISOString(),
          recordCount: 0,
          status: 'error',
          errorMessage: 'Collection error occurred',
        },
      ],
    });

    render(<StaleDataWarning />, { wrapper });
    await screen.findByText(/Data may be stale/);
  });
});
