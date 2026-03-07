import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '../client';
import { useNutritionDaily } from '../hooks/useNutrition';

vi.mock('../client');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useNutritionDaily', () => {
  it('returns nutrition data on success', async () => {
    const mockData = [
      { date: '2026-03-01', calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 25 },
    ];
    vi.mocked(client.apiFetch).mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useNutritionDaily(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(mockData);
  });

  it('surfaces error on failure', async () => {
    vi.mocked(client.apiFetch).mockRejectedValueOnce({ error: 'Server Error', statusCode: 500 });

    const { result } = renderHook(() => useNutritionDaily(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
