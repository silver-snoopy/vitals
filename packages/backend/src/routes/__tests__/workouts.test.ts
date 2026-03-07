import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { EnvConfig } from '../../config/env.js';
import * as workoutQueries from '../../db/queries/workouts.js';

vi.mock('../../plugins/database.js', () => ({
  databasePlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('db', {});
  },
}));

vi.mock('../../services/collectors/register.js', () => ({
  registerProviders: vi.fn(),
}));

vi.mock('../../db/queries/workouts.js', () => ({
  queryWorkoutSessions: vi.fn().mockResolvedValue([
    {
      id: 'session-2026-03-01-hevy',
      userId: 'user-uuid',
      date: '2026-03-01',
      title: 'Hevy Workout',
      durationSeconds: 3600,
      sets: [],
      source: 'hevy',
      collectedAt: '2026-03-01T12:00:00.000Z',
    },
  ]),
  queryExerciseProgress: vi.fn().mockResolvedValue({
    exerciseName: 'Bench Press',
    dataPoints: [{ date: '2026-03-01', maxWeight: 100, totalVolume: 2400, totalSets: 3 }],
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('GET /api/workouts', () => {
  it('returns 400 when startDate is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workouts?endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when dates are invalid', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workouts?startDate=bad&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 200 with workout sessions for valid request', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workouts?startDate=2026-03-01&endDate=2026-03-07',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].source).toBe('hevy');
    await app.close();
  });
});

describe('GET /api/workouts/progress/:exerciseName', () => {
  it('returns 200 with exercise progress', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/workouts/progress/Bench%20Press',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.exerciseName).toBe('Bench Press');
    expect(Array.isArray(body.data.dataPoints)).toBe(true);
    await app.close();
  });

  it('URL-decodes exercise name with spaces', async () => {
    const app = await buildApp(testEnv);
    await app.inject({
      method: 'GET',
      url: '/api/workouts/progress/Bench%20Press',
    });
    const calls = (workoutQueries.queryExerciseProgress as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toBe('Bench Press');
    await app.close();
  });
});
