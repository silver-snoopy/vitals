import { apiFetch } from '../client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch with the base URL + path', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    await apiFetch('/api/test');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('returns parsed JSON on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [1, 2, 3] }),
    } as Response);

    const result = await apiFetch<{ data: number[] }>('/api/test');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('throws parsed error object on non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Not Found', message: 'Resource not found', statusCode: 404 }),
    } as Response);

    await expect(apiFetch('/api/missing')).rejects.toMatchObject({
      error: 'Not Found',
      statusCode: 404,
    });
  });
});
