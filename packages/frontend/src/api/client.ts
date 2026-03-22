import type { ApiError } from '@vitals/shared';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  const apiKey = import.meta.env.VITE_X_API_KEY;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error: ApiError = await res.json();
    throw error;
  }

  return res.json() as Promise<T>;
}
