import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { EnvConfig } from '../../config/env.js';

// Mock the database plugin so tests don't need real PostgreSQL
vi.mock('../../plugins/database.js', () => ({
  databasePlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('db', {});
  },
}));

// Mock the pipeline so tests don't need real providers
vi.mock('../../services/collectors/pipeline.js', () => ({
  runCollection: vi.fn().mockResolvedValue({
    results: [],
    totalRecords: 0,
    durationMs: 42,
  }),
}));

// Mock provider registration — no real clients needed
vi.mock('../../services/collectors/register.js', () => ({
  registerProviders: vi.fn(),
}));

// Mock DB helpers for status endpoint
vi.mock('../../db/helpers.js', () => ({
  loadAllCollectionMetadata: vi.fn().mockResolvedValue([]),
  loadCollectionMetadata: vi.fn().mockResolvedValue(null),
  saveCollectionMetadata: vi.fn().mockResolvedValue(undefined),
  refreshDailyAggregates: vi.fn().mockResolvedValue(undefined),
}));

// Mock report queries (needed for app build)
vi.mock('../../db/queries/reports.js', () => ({
  listReports: vi.fn().mockResolvedValue([]),
  getReportById: vi.fn().mockResolvedValue(null),
  saveReport: vi.fn().mockResolvedValue('new-uuid'),
  logAiGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ai/report-generator.js', () => ({
  generateWeeklyReport: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/ai/ai-service.js', () => ({
  createAIProvider: vi.fn().mockReturnValue({ name: () => 'claude', complete: vi.fn() }),
}));

const testEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude' as const,
  aiApiKey: '',
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

async function buildTestApp(env: EnvConfig = testEnv) {
  return buildApp(env);
}

describe('POST /api/collect', () => {
  it('returns 400 when startDate is missing', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when endDate is missing', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01' }),
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when startDate is after endDate', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-07', endDate: '2026-03-01' }),
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when dates are invalid ISO strings', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: 'not-a-date', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 200 with pipeline result for valid request', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.totalRecords).toBe(0);
    expect(body.data.durationMs).toBe(42);
    await app.close();
  });

  it('returns 401 when API key is wrong', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: { 'x-api-key': 'wrong-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('allows request when no API key is configured (dev mode)', async () => {
    const openEnv = { ...testEnv, xApiKey: '' };
    const app = await buildTestApp(openEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe('GET /api/collect/status', () => {
  it('returns 401 when API key is missing', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/collect/status',
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 200 with empty array when no metadata exists', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/collect/status',
      headers: { 'x-api-key': 'test-api-key' },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    await app.close();
  });

  it('returns collection status for all providers', async () => {
    const { loadAllCollectionMetadata } = await import('../../db/helpers.js');
    (loadAllCollectionMetadata as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        userId: testEnv.dbDefaultUserId,
        providerName: 'hevy',
        lastSuccessfulFetch: new Date('2026-03-15T10:00:00Z'),
        lastAttemptedFetch: new Date('2026-03-15T10:00:00Z'),
        recordCount: 42,
        status: 'success',
        errorMessage: null,
      },
      {
        userId: testEnv.dbDefaultUserId,
        providerName: 'cronometer-nutrition',
        lastSuccessfulFetch: null,
        lastAttemptedFetch: new Date('2026-03-14T06:00:00Z'),
        recordCount: 0,
        status: 'error',
        errorMessage: 'Auth failed',
      },
    ]);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/collect/status',
      headers: { 'x-api-key': 'test-api-key' },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].providerName).toBe('hevy');
    expect(body.data[0].lastSuccessfulFetch).toBe('2026-03-15T10:00:00.000Z');
    expect(body.data[0].recordCount).toBe(42);
    expect(body.data[1].providerName).toBe('cronometer-nutrition');
    expect(body.data[1].errorMessage).toBe('Collection error occurred');
    await app.close();
  });
});
