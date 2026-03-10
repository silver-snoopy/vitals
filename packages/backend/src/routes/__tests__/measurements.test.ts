import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { EnvConfig } from '../../config/env.js';

vi.mock('../../plugins/database.js', () => ({
  databasePlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('db', {});
  },
}));

vi.mock('../../services/collectors/register.js', () => ({
  registerProviders: vi.fn(),
}));

vi.mock('../../db/queries/measurements.js', () => ({
  queryMeasurementsByMetric: vi.fn().mockResolvedValue([
    {
      id: 'uuid-1',
      userId: 'user-uuid',
      date: '2026-03-01T00:00:00.000Z',
      metric: 'weight_kg',
      value: 72.5,
      unit: 'kg',
      source: 'cronometer',
      collectedAt: '2026-03-01T06:00:00.000Z',
    },
  ]),
  queryDailyNutritionSummary: vi.fn().mockResolvedValue([]),
}));

const testEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude' as const,
  aiApiKey: '',
  n8nApiKey: '',
  dbDefaultUserId: '00000000-0000-0000-0000-000000000001',
  nodeEnv: 'test',
  cronometerUsername: '',
  cronometerPassword: '',
  cronometerGwtHeader: '',
  cronometerGwtPermutation: '',
  hevyApiKey: '',
  hevyApiBase: 'https://api.hevyapp.com/v1',
  frontendUrl: '',
};

describe('GET /api/measurements', () => {
  it('returns 400 when metric is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/measurements?startDate=2026-03-01&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when startDate is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/measurements?metric=weight_kg&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when dates are invalid', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/measurements?metric=weight_kg&startDate=bad&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 200 with measurement data for valid request', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/measurements?metric=weight_kg&startDate=2026-03-01&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].metric).toBe('weight_kg');
    await app.close();
  });
});
