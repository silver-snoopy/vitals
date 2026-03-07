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
  queryDailyNutritionSummary: vi.fn().mockResolvedValue([]),
  queryMeasurementsByMetric: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/queries/workouts.js', () => ({
  queryWorkoutSessions: vi.fn().mockResolvedValue([]),
  queryExerciseProgress: vi.fn().mockResolvedValue({ exerciseName: '', dataPoints: [] }),
}));

const testEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude',
  anthropicApiKey: '',
  n8nApiKey: '',
  dbDefaultUserId: '00000000-0000-0000-0000-000000000001',
  nodeEnv: 'test',
  cronometerUsername: '',
  cronometerPassword: '',
  cronometerGwtHeader: '',
  cronometerGwtPermutation: '',
  hevyApiKey: '',
  hevyApiBase: 'https://api.hevyapp.com/v1',
};

describe('GET /api/dashboard/weekly', () => {
  it('returns 400 when startDate is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/weekly?endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when endDate is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/weekly?startDate=2026-03-01',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when startDate is after endDate', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/weekly?startDate=2026-03-07&endDate=2026-03-01',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 200 with combined data shape for valid request', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/weekly?startDate=2026-03-01&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveProperty('nutrition');
    expect(body.data).toHaveProperty('workouts');
    expect(body.data).toHaveProperty('biometrics');
    await app.close();
  });
});
