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

vi.mock('../../services/collectors/pipeline.js', () => ({
  runCollection: vi.fn().mockResolvedValue({
    results: [],
    totalRecords: 0,
    durationMs: 50,
  }),
}));

vi.mock('../../db/queries/reports.js', () => ({
  listReports: vi.fn().mockResolvedValue([]),
  getReportById: vi.fn().mockResolvedValue(null),
  saveReport: vi.fn().mockResolvedValue('new-uuid'),
  logAiGeneration: vi.fn().mockResolvedValue(undefined),
  createPendingReport: vi.fn().mockResolvedValue('pending-report-uuid'),
  updateReportStatus: vi.fn().mockResolvedValue(undefined),
  completeReport: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../services/report-runner.js', () => ({
  runReportInBackground: vi.fn(),
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

describe('GET /api/reports', () => {
  it('returns 200 with empty array when no reports', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({ method: 'GET', url: '/api/reports' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    await app.close();
  });

  it('returns reports from listReports', async () => {
    const { listReports } = await import('../../db/queries/reports.js');
    (listReports as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 'report-2',
        userId: 'user-uuid',
        periodStart: '2026-03-10',
        periodEnd: '2026-03-16',
        summary: 'Full data report',
        insights: '',
        actionItems: [],
        dataCoverage: { nutritionDays: 5, workoutDays: 5, biometricDays: 4 },
        aiProvider: 'gemini',
        aiModel: 'gemini-2.0-flash',
        createdAt: '2026-03-16T17:09:10.574Z',
      },
    ]);

    const app = await buildApp(testEnv);
    const response = await app.inject({ method: 'GET', url: '/api/reports' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('report-2');
    expect(body.data[0].dataCoverage.nutritionDays).toBe(5);
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

  it('returns 202 with no dates (uses server-calculated default window)', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.statusCode).toBe(202);
    await app.close();
  });

  it('returns 400 when only one date override is provided', async () => {
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

  it('returns 202 with reportId for async request (default)', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.data.reportId).toBe('pending-report-uuid');
    expect(body.data.status).toBe('pending');
    await app.close();
  });

  it('calls runReportInBackground for async request', async () => {
    const { runReportInBackground } = await import('../../services/report-runner.js');
    (runReportInBackground as ReturnType<typeof vi.fn>).mockClear();

    const app = await buildApp(testEnv);
    await app.inject({
      method: 'POST',
      url: '/api/reports/generate',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });

    expect(runReportInBackground).toHaveBeenCalledOnce();
    await app.close();
  });

  it('returns 429 with safe message on rate limit error (sync)', async () => {
    const { generateWeeklyReport } = await import('../../services/ai/report-generator.js');
    (generateWeeklyReport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('429 Too Many Requests: quota exceeded'),
    );

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate?sync=true',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('AI service is rate limited. Please try again later.');
    expect(body.message).not.toContain('quota');
    await app.close();
  });

  it('returns 502 with safe message on AI provider error (sync)', async () => {
    const { generateWeeklyReport } = await import('../../services/ai/report-generator.js');
    (generateWeeklyReport as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Connection refused to generativelanguage.googleapis.com'),
    );

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate?sync=true',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('AI service failed to generate the report. Please try again later.');
    expect(body.message).not.toContain('googleapis');
    await app.close();
  });

  it('returns 200 with generated report for sync request', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate?sync=true',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.summary).toBe('Great week!');
    await app.close();
  });

  it('calls runCollection before generating the report (sync)', async () => {
    const { runCollection } = await import('../../services/collectors/pipeline.js');
    (runCollection as ReturnType<typeof vi.fn>).mockClear();

    const app = await buildApp(testEnv);
    await app.inject({
      method: 'POST',
      url: '/api/reports/generate?sync=true',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });

    expect(runCollection).toHaveBeenCalledOnce();
    const callArgs = (runCollection as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toMatchObject({
      userId: testEnv.dbDefaultUserId,
    });
    await app.close();
  });

  it('still generates report when pre-collection fails (sync)', async () => {
    const { runCollection } = await import('../../services/collectors/pipeline.js');
    (runCollection as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Cronometer auth failed'),
    );

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/reports/generate?sync=true',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-03-01', endDate: '2026-03-07' }),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.summary).toBe('Great week!');
    await app.close();
  });
});
