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
  it('returns 401 without API key', async () => {
    // TODO: assert that requests without x-api-key header receive 401
  });

  it('returns 200 with empty array when no correlations exist', async () => {
    // TODO: inject GET /api/correlations with valid API key header
    // expect statusCode 200 and body.data to be an empty array
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/correlations',
      headers: { 'x-api-key': testEnv.xApiKey },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('passes category filter to listCorrelations', async () => {
    // TODO: inject with ?category=nutrition, assert listCorrelations called with correct filters
  });

  it('passes confidenceLevel filter to listCorrelations', async () => {
    // TODO: inject with ?confidenceLevel=high, assert listCorrelations called with correct filters
  });

  it('passes status filter to listCorrelations', async () => {
    // TODO: inject with ?status=active, assert listCorrelations called with correct filters
  });

  it('calls getTopCorrelations when top param is provided', async () => {
    // TODO: inject with ?top=5, assert getTopCorrelations called with limit 5
  });

  it('returns 400 when top param is not a positive integer', async () => {
    // TODO: inject with ?top=abc, expect 400
  });
});

describe('GET /api/projections/:metric', () => {
  it('returns 401 without API key', async () => {
    // TODO: assert that requests without x-api-key header receive 401
  });

  it('returns 200 with empty array when no projections exist for metric', async () => {
    // TODO: inject GET /api/projections/body_weight with valid API key header
    // expect statusCode 200 and body.data to be an empty array
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/projections/body_weight',
      headers: { 'x-api-key': testEnv.xApiKey },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('passes metric param to getProjections', async () => {
    // TODO: assert getProjections called with correct userId and metric
  });
});
