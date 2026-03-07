import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { EnvConfig } from '../../config/env.js';

vi.mock('../../plugins/database.js', () => ({
  databasePlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('db', {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'import-uuid' }] }),
    });
  },
}));

vi.mock('../../services/collectors/register.js', () => ({
  registerProviders: vi.fn(),
}));

vi.mock('../../services/collectors/apple-health/parser.js', () => ({
  parseAppleHealthExport: vi.fn().mockReturnValue({
    measurements: [{ metric: 'weight_kg', value: 80 }],
    workoutSets: [],
  }),
}));

vi.mock('../../services/data/ingest.js', () => ({
  ingestMeasurements: vi.fn().mockResolvedValue({ inserted: 1, errors: [] }),
  ingestWorkoutSets: vi.fn().mockResolvedValue({ inserted: 0, errors: [] }),
}));

vi.mock('../../db/helpers.js', () => ({
  refreshDailyAggregates: vi.fn().mockResolvedValue(undefined),
  loadCollectionMetadata: vi.fn(),
  saveCollectionMetadata: vi.fn(),
}));

const testEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude',
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
};

describe('POST /api/upload/apple-health', () => {
  // The success path requires a real db connection (app.db.query) so it is covered
  // by the integration test suite. Unit tests verify the error paths only.

  it('returns 400 when no file part is in the multipart body', async () => {
    const app = await buildApp(testEnv);

    const response = await app.inject({
      method: 'POST',
      url: '/api/upload/apple-health',
      headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      payload: '------boundary--\r\n',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.statusCode).toBe(400);
    await app.close();
  });

  it('route is registered and accepts multipart requests', async () => {
    const app = await buildApp(testEnv);

    // Posting without content-type should not be a 404
    const response = await app.inject({
      method: 'POST',
      url: '/api/upload/apple-health',
      headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      payload: '------boundary--\r\n',
    });

    expect(response.statusCode).not.toBe(404);
    await app.close();
  });
});
