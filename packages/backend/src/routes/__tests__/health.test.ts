import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../app.js';

// Mock the database plugin so tests don't need a real PostgreSQL connection
vi.mock('../../plugins/database.js', () => ({
  databasePlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('db', {});
  },
}));

const testEnv = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude' as const,
  aiApiKey: '',
  xApiKey: '',
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

describe('GET /health', () => {
  it('returns ok status', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();

    await app.close();
  });
});
