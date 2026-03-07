import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '../client';
import { useWorkoutSessions, useExerciseProgress } from '../hooks/useWorkouts';

vi.mock('../client');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useWorkoutSessions', () => {
  it('returns sessions on success', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useWorkoutSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual([]);
  });
});

describe('useExerciseProgress', () => {
  it('does not fetch when exerciseName is null', () => {
    const { result } = renderHook(() => useExerciseProgress(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches when exerciseName is provided', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({
      data: { exerciseName: 'Squat', dataPoints: [] },
    });

    const { result } = renderHook(() => useExerciseProgress('Squat'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.exerciseName).toBe('Squat');
  });
});
