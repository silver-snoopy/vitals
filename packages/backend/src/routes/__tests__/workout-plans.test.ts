import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { EnvConfig } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../plugins/database.js', () => ({
  databasePlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('db', {});
  },
}));

vi.mock('../../services/collectors/register.js', () => ({
  registerProviders: vi.fn(),
}));

vi.mock('../../db/queries/workout-plans.js', () => ({
  getCurrentPlan: vi.fn().mockResolvedValue(null),
  getPlanById: vi.fn().mockResolvedValue(null),
  getPlanVersion: vi.fn().mockResolvedValue(null),
  upsertPlan: vi.fn().mockResolvedValue({
    id: 'plan-uuid',
    userId: 'user-uuid',
    name: 'My Workout Plan',
    splitType: 'Custom',
    activeVersionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  insertPlanVersion: vi.fn().mockResolvedValue({
    id: 'version-uuid',
    planId: 'plan-uuid',
    versionNumber: 1,
    source: 'user',
    parentVersionId: null,
    data: { splitType: 'Custom', progressionPersonality: 'balanced', days: [] },
    createdAt: new Date().toISOString(),
    acceptedAt: null,
  }),
  listPlanVersions: vi.fn().mockResolvedValue([]),
  getAdjustmentBatch: vi.fn().mockResolvedValue(null),
  bulkUpdateAdjustmentStatus: vi.fn().mockResolvedValue(undefined),
  insertAdjustment: vi.fn().mockResolvedValue({}),
  mapPlanRow: vi.fn(),
  mapVersionRow: vi.fn(),
  mapAdjustmentRow: vi.fn(),
}));

vi.mock('../../services/workout-plans/plan-parser.js', () => ({
  parseFreeTextPlan: vi.fn().mockReturnValue({
    splitType: 'Custom',
    progressionPersonality: 'balanced',
    days: [{ name: 'Push', targetMuscles: ['chest'], exercises: [] }],
  }),
}));

vi.mock('../../services/workout-plans/tuner.js', () => ({
  tunePlan: vi.fn().mockResolvedValue({
    id: 'batch-uuid',
    planId: 'plan-uuid',
    sourceVersionId: 'version-uuid',
    reportId: 'report-uuid',
    createdAt: new Date().toISOString(),
    rationale: 'Overall good week.',
    adjustments: [],
  }),
}));

vi.mock('../../services/ai/ai-service.js', () => ({
  createAIProvider: vi.fn().mockReturnValue({ name: () => 'claude', complete: vi.fn() }),
}));

// Required by app.ts and other route registrations
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
  generateWeeklyReport: vi.fn().mockResolvedValue(null),
  gatherAndGenerate: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/report-runner.js', () => ({
  runReportInBackground: vi.fn(),
}));

vi.mock('../../services/intelligence/correlation-engine.js', () => ({
  runCorrelationAnalysis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/intelligence/trajectory-projector.js', () => ({
  runTrajectoryProjections: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/collectors/pipeline.js', () => ({
  runCollection: vi.fn().mockResolvedValue({ results: [], totalRecords: 0, durationMs: 50 }),
}));

// ---------------------------------------------------------------------------
// Test env
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/workout-plans', () => {
  it('with rawText body → 201 + parsed plan returned', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/workout-plans',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ rawText: 'Push\nBench Press 3x10 @ 80kg' }),
    });
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.plan).toBeDefined();
    expect(body.data.version).toBeDefined();
    await app.close();
  });

  it('without API key → 401 Unauthorized', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/workout-plans',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rawText: 'Push\nBench Press 3x10' }),
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('GET /api/workout-plans/current', () => {
  it('when user has no plan → 200 with { data: null }', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workout-plans/current',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    await app.close();
  });

  it('when user has a plan → 200 with plan + latestVersion', async () => {
    const { getCurrentPlan } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getCurrentPlan).mockResolvedValueOnce({
      id: 'plan-uuid',
      userId: 'user-uuid',
      name: 'My Plan',
      splitType: 'Custom',
      activeVersionId: 'version-uuid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latestVersion: {
        id: 'version-uuid',
        planId: 'plan-uuid',
        versionNumber: 1,
        source: 'user',
        parentVersionId: null,
        data: { splitType: 'Custom', progressionPersonality: 'balanced', days: [] },
        createdAt: new Date().toISOString(),
        acceptedAt: null,
      },
    });

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workout-plans/current',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBe('plan-uuid');
    expect(body.data.latestVersion).toBeDefined();
    await app.close();
  });
});

describe('POST /api/workout-plans/:id/tune', () => {
  it('missing reportId body → 400 Bad Request', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/workout-plans/plan-uuid/tune',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('reportId');
    await app.close();
  });

  it('nonexistent plan → 404 Not Found', async () => {
    const { getPlanById } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getPlanById).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/workout-plans/nonexistent/tune',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ reportId: 'report-uuid' }),
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('without API key → 401 Unauthorized', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/workout-plans/plan-uuid/tune',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportId: 'report-uuid' }),
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('happy path → 200 + PlanAdjustmentBatch', async () => {
    const { getPlanById } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getPlanById).mockResolvedValueOnce({
      id: 'plan-uuid',
      userId: 'user-uuid',
      name: 'My Plan',
      splitType: 'Custom',
      activeVersionId: 'version-uuid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/workout-plans/plan-uuid/tune',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ reportId: 'report-uuid' }),
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBe('batch-uuid');
    await app.close();
  });
});

describe('PATCH /api/workout-plans/adjustments/:batchId', () => {
  it('valid decisions map → 200 + new plan version', async () => {
    const { getAdjustmentBatch, getPlanVersion } =
      await import('../../db/queries/workout-plans.js');
    vi.mocked(getAdjustmentBatch).mockResolvedValueOnce({
      id: 'batch-uuid',
      planId: 'plan-uuid',
      sourceVersionId: 'version-uuid',
      reportId: 'report-uuid',
      createdAt: new Date().toISOString(),
      rationale: 'Good week.',
      adjustments: [
        {
          id: 'adj-uuid',
          batchId: 'batch-uuid',
          exerciseRef: { dayIndex: 0, exerciseOrder: 1 },
          changeType: 'progress_load' as const,
          oldValue: [],
          newValue: [{ type: 'normal', targetReps: 10, targetWeightKg: 82.5 }],
          evidence: [{ kind: 'report_section' as const, excerpt: 'Good week.' }],
          confidence: 4 as const,
          rationale: 'Progress.',
          status: 'pending' as const,
        },
      ],
    });

    vi.mocked(getPlanVersion).mockResolvedValueOnce({
      id: 'version-uuid',
      planId: 'plan-uuid',
      versionNumber: 1,
      source: 'user',
      parentVersionId: null,
      data: {
        splitType: 'Custom',
        progressionPersonality: 'balanced',
        days: [
          {
            name: 'Push',
            targetMuscles: ['chest'],
            exercises: [
              {
                id: 'ex-1',
                exerciseName: 'Bench Press',
                orderInDay: 1,
                sets: [{ type: 'normal', targetReps: 10, targetWeightKg: 80 }],
                progressionRule: 'double',
                primaryMuscle: 'chest',
                secondaryMuscles: [],
                pattern: 'push',
                equipment: 'barbell',
                sfrTier: 'S',
              },
            ],
          },
        ],
      },
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    });

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/workout-plans/adjustments/batch-uuid',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ decisions: { 'adj-uuid': 'accepted' } }),
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.versionNumber).toBeDefined();
    await app.close();
  });

  it('without API key → 401 Unauthorized', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/workout-plans/adjustments/batch-uuid',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decisions: { 'adj-uuid': 'accepted' } }),
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('nonexistent batchId → 404 Not Found', async () => {
    const { getAdjustmentBatch } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getAdjustmentBatch).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/workout-plans/adjustments/nonexistent',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ decisions: { 'adj-uuid': 'accepted' } }),
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /api/workout-plans/:id/versions', () => {
  it('valid plan id → 200 with versions array', async () => {
    const { getPlanById, listPlanVersions } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getPlanById).mockResolvedValueOnce({
      id: 'plan-uuid',
      userId: 'user-uuid',
      name: 'My Plan',
      splitType: 'Custom',
      activeVersionId: 'version-uuid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(listPlanVersions).mockResolvedValueOnce([
      {
        id: 'version-uuid',
        planId: 'plan-uuid',
        versionNumber: 1,
        source: 'user',
        parentVersionId: null,
        data: { splitType: 'Custom', progressionPersonality: 'balanced', days: [] },
        createdAt: new Date().toISOString(),
        acceptedAt: null,
      },
    ]);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workout-plans/plan-uuid/versions',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    await app.close();
  });

  it('nonexistent plan id → 404 Not Found', async () => {
    const { getPlanById } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getPlanById).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workout-plans/nonexistent/versions',
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /api/workout-plans/versions/:versionId', () => {
  it('valid versionId → 200 with version', async () => {
    const { getPlanVersion } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getPlanVersion).mockResolvedValueOnce({
      id: 'version-uuid',
      planId: 'plan-uuid',
      versionNumber: 1,
      source: 'user',
      parentVersionId: null,
      data: { splitType: 'Custom', progressionPersonality: 'balanced', days: [] },
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    });

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workout-plans/versions/version-uuid',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBe('version-uuid');
    await app.close();
  });

  it('nonexistent versionId → 404 Not Found', async () => {
    const { getPlanVersion } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getPlanVersion).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workout-plans/versions/nonexistent',
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('PUT /api/workout-plans/:id', () => {
  it('valid body → 200 with updated plan', async () => {
    const { getPlanById } = await import('../../db/queries/workout-plans.js');
    vi.mocked(getPlanById).mockResolvedValueOnce({
      id: 'plan-uuid',
      userId: 'user-uuid',
      name: 'My Plan',
      splitType: 'Custom',
      activeVersionId: 'version-uuid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'PUT',
      url: '/api/workout-plans/plan-uuid',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      body: JSON.stringify({ rawText: 'Push\nBench Press 3x10 @ 80kg' }),
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.version).toBeDefined();
    await app.close();
  });

  it('without API key → 401 Unauthorized', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'PUT',
      url: '/api/workout-plans/plan-uuid',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rawText: 'Push\nBench Press 3x10' }),
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
