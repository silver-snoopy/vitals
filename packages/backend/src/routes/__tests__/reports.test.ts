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

vi.mock('../../db/queries/reports.js', () => ({
  listReports: vi.fn().mockResolvedValue([]),
  getReportById: vi.fn().mockResolvedValue(null),
  saveReport: vi.fn().mockResolvedValue('new-uuid'),
  logAiGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ai/report-generator.js', () => ({
  generateWeeklyReport: vi.fn().mockResolvedValue({
    id: 'report-uuid',
    userId: 'user-uuid',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-07',
    summary: 'Great week!',
    insights: '- Good progress',
    actionItems: [],
    dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
    aiProvider: 'claude' as const,
    aiModel: 'claude-sonnet-4-20250514',
    createdAt: '2026-03-07T08:00:00.000Z',
  }),
}));

vi.mock('../../services/ai/ai-service.js', () => ({
  createAIProvider: vi.fn().mockReturnValue({ name: () => 'claude', complete: vi.fn() }),
}));

const testEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude' as const,
  aiApiKey: 'test-key',
  n8nApiKey: 'test-api-key',
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

describe('GET /api/reports', () => {
  it('returns 200 with empty array when no reports', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({ method: 'GET', url: '/api/reports' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    await app.close();
  });
});

describe('GET /api/reports/:id', () => {
  it('returns 404 when report not found', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/nonexistent-uuid',
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 200 with report when found', async () => {
    const { getReportById } = await import('../../db/queries/reports.js');
    (getReportById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'report-uuid',
      userId: 'user-uuid',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-07',
      summary: 'Great week!',
      insights: '- Good progress',
      actionItems: [],
      dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
      aiProvider: 'claude' as const,
      aiModel: 'claude-sonnet-4-20250514',
      createdAt: '2026-03-07T08:00:00.000Z',
    });

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/report-uuid',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBe('report-uuid');
    await app.close();
  });
});

describe('POST /api/reports/generate', () => {
  it('returns 401 when API key is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 400 when dates are missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01' }),
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 503 when AI service throws (not configured)', async () => {
    const { createAIProvider } = await import('../../services/ai/ai-service.js');
    (createAIProvider as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('AI_API_KEY is required');
    });

    const app = await buildApp({ ...testEnv, aiApiKey: '' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(503);
    await app.close();
  });

  it('returns 200 with generated report for valid request', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.summary).toBe('Great week!');
    await app.close();
  });
});
