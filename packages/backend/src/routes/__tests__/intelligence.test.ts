import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('../../db/queries/correlations.js', () => ({
  listCorrelations: vi.fn().mockResolvedValue([]),
  getTopCorrelations: vi.fn().mockResolvedValue([]),
  upsertCorrelation: vi.fn().mockResolvedValue('correlation-uuid'),
  markWeakening: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db/queries/projections.js', () => ({
  getProjections: vi.fn().mockResolvedValue([]),
  getLatestProjections: vi.fn().mockResolvedValue([]),
  upsertProjections: vi.fn().mockResolvedValue(undefined),
}));

const testEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude' as const,
  aiApiKey: 'test-key',
  xApiKey: 'test-api-key',
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

describe('GET /api/correlations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without API key', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/correlations',
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 200 with empty array when no correlations exist', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/correlations',
      headers: { 'x-api-key': testEnv.xApiKey },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    await app.close();
  });

  it('passes category filter to listCorrelations', async () => {
    const { listCorrelations } = await import('../../db/queries/correlations.js');

    const app = await buildApp(testEnv);
    await app.inject({
      method: 'GET',
      url: '/api/correlations?category=nutrition',
      headers: { 'x-api-key': testEnv.xApiKey },
    });

    const calls = (listCorrelations as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1]).toBe(testEnv.dbDefaultUserId);
    expect(calls[0][2]).toMatchObject({ category: 'nutrition' });
    await app.close();
  });

  it('passes confidenceLevel filter to listCorrelations', async () => {
    const { listCorrelations } = await import('../../db/queries/correlations.js');

    const app = await buildApp(testEnv);
    await app.inject({
      method: 'GET',
      url: '/api/correlations?confidenceLevel=high',
      headers: { 'x-api-key': testEnv.xApiKey },
    });

    const calls = (listCorrelations as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1]).toBe(testEnv.dbDefaultUserId);
    expect(calls[0][2]).toMatchObject({ confidenceLevel: 'high' });
    await app.close();
  });

  it('passes status filter to listCorrelations', async () => {
    const { listCorrelations } = await import('../../db/queries/correlations.js');

    const app = await buildApp(testEnv);
    await app.inject({
      method: 'GET',
      url: '/api/correlations?status=active',
      headers: { 'x-api-key': testEnv.xApiKey },
    });

    const calls = (listCorrelations as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1]).toBe(testEnv.dbDefaultUserId);
    expect(calls[0][2]).toMatchObject({ status: 'active' });
    await app.close();
  });

  it('calls getTopCorrelations when top param is provided', async () => {
    const { getTopCorrelations } = await import('../../db/queries/correlations.js');

    const app = await buildApp(testEnv);
    await app.inject({
      method: 'GET',
      url: '/api/correlations?top=5',
      headers: { 'x-api-key': testEnv.xApiKey },
    });

    const calls = (getTopCorrelations as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1]).toBe(testEnv.dbDefaultUserId);
    expect(calls[0][2]).toBe(5);
    await app.close();
  });

  it('returns 400 when top param is not a positive integer', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/correlations?top=abc',
      headers: { 'x-api-key': testEnv.xApiKey },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns correlation data from listCorrelations', async () => {
    const { listCorrelations } = await import('../../db/queries/correlations.js');
    const mockCorrelation = {
      id: 'corr-1',
      userId: testEnv.dbDefaultUserId,
      factorMetric: 'calories',
      factorCondition: 'calories_high',
      factorLabel: 'Higher calories',
      outcomeMetric: 'weight_kg',
      outcomeEffect: 'increase',
      outcomeLabel: 'weight higher',
      correlationCoefficient: 0.72,
      confidenceLevel: 'high',
      dataPoints: 30,
      pValue: 0.003,
      firstDetectedAt: '2026-03-01T00:00:00Z',
      lastConfirmedAt: '2026-04-01T00:00:00Z',
      timesConfirmed: 3,
      status: 'active',
      summary: 'Higher calories is strongly associated with higher weight_kg (r=0.72)',
      category: 'nutrition',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };
    (listCorrelations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockCorrelation]);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/correlations',
      headers: { 'x-api-key': testEnv.xApiKey },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('corr-1');
    expect(body.data[0].correlationCoefficient).toBe(0.72);
    await app.close();
  });
});

describe('GET /api/projections/:metric', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without API key', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/projections/body_weight',
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 200 with empty array when no projections exist for metric', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/projections/body_weight',
      headers: { 'x-api-key': testEnv.xApiKey },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    await app.close();
  });

  it('passes metric param to getProjections', async () => {
    const { getProjections } = await import('../../db/queries/projections.js');

    const app = await buildApp(testEnv);
    await app.inject({
      method: 'GET',
      url: '/api/projections/weight_kg',
      headers: { 'x-api-key': testEnv.xApiKey },
    });

    const calls = (getProjections as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1]).toBe(testEnv.dbDefaultUserId);
    expect(calls[0][2]).toBe('weight_kg');
    await app.close();
  });

  it('returns projection data from getProjections', async () => {
    const { getProjections } = await import('../../db/queries/projections.js');
    const mockProjection = {
      id: 'proj-1',
      userId: testEnv.dbDefaultUserId,
      metric: 'weight_kg',
      projectionDate: '2026-04-10',
      projectedValue: 78.5,
      confidenceLow: 77.0,
      confidenceHigh: 80.0,
      method: 'linear_regression',
      dataPoints: 30,
      generatedAt: '2026-04-06T00:00:00Z',
    };
    (getProjections as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockProjection]);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/projections/weight_kg',
      headers: { 'x-api-key': testEnv.xApiKey },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('proj-1');
    expect(body.data[0].projectedValue).toBe(78.5);
    await app.close();
  });
});
