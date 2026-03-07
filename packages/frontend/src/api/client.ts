import type { ApiError } from '@vitals/shared';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${base}${path}`, options);

  if (!res.ok) {
    const error: ApiError = await res.json();
    throw error;
  }

  return res.json() as Promise<T>;
}
