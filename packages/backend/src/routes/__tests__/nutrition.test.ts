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
  queryDailyNutritionSummary: vi
    .fn()
    .mockResolvedValue([
      { date: '2026-03-01', calories: 2100, protein: 150, carbs: 220, fat: 70, fiber: 25 },
    ]),
  queryMeasurementsByMetric: vi.fn().mockResolvedValue([]),
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

describe('GET /api/nutrition/daily', () => {
  it('returns 400 when startDate is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/nutrition/daily?endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when endDate is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/nutrition/daily?startDate=2026-03-01',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when dates are invalid', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/nutrition/daily?startDate=not-a-date&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when startDate is after endDate', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/nutrition/daily?startDate=2026-03-07&endDate=2026-03-01',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 200 with nutrition data for valid request', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/nutrition/daily?startDate=2026-03-01&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].date).toBe('2026-03-01');
    await app.close();
  });
});
