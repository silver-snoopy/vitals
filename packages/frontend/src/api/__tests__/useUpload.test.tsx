import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '../client';
import { useUpload } from '../hooks/useUpload';

vi.mock('../client');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useUpload', () => {
  it('calls apiFetch with POST method and FormData', async () => {
    vi.mocked(client.apiFetch).mockResolvedValueOnce({
      data: { importId: 'abc', recordCount: 100, status: 'completed' },
    });

    const { result } = renderHook(() => useUpload(), { wrapper });
    const file = new File(['<xml/>'], 'export.xml', { type: 'text/xml' });

    await result.current.mutateAsync(file);

    expect(client.apiFetch).toHaveBeenCalledWith(
      '/api/upload/apple-health',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
