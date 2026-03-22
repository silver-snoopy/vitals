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

vi.mock('../../db/queries/action-items.js', () => {
  const item = {
    id: 'item-uuid-1',
    reportId: 'report-uuid-1',
    category: 'nutrition',
    priority: 'high',
    text: 'Increase protein intake',
    status: 'pending',
    createdAt: '2026-03-22T08:00:00.000Z',
    statusChangedAt: '2026-03-22T08:00:00.000Z',
  };
  return {
    listActionItems: vi.fn().mockResolvedValue([item]),
    getActionItem: vi.fn().mockResolvedValue(item),
    updateActionItemStatus: vi.fn().mockResolvedValue({ ...item, status: 'active' }),
    getActionItemSummary: vi.fn().mockResolvedValue({
      pending: 2,
      active: 1,
      completed: 3,
      deferred: 0,
      expired: 0,
      total: 6,
    }),
    promoteActionItems: vi.fn().mockResolvedValue(undefined),
  };
});

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

const AUTH = { headers: { 'x-api-key': 'test-api-key' } };

describe('GET /api/action-items/summary', () => {
  it('returns 401 without auth', async () => {
    const app = await buildApp(testEnv);
    const res = await app.inject({ method: 'GET', url: '/api/action-items/summary' });
    expect(res.statusCode).toBe(401);
  });

  it('returns summary with auth', async () => {
    const app = await buildApp(testEnv);
    const res = await app.inject({ method: 'GET', url: '/api/action-items/summary', ...AUTH });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.pending).toBe(2);
    expect(body.data.total).toBe(6);
  });
});

describe('GET /api/action-items', () => {
  it('returns 401 without auth', async () => {
    const app = await buildApp(testEnv);
    const res = await app.inject({ method: 'GET', url: '/api/action-items' });
    expect(res.statusCode).toBe(401);
  });

  it('returns list of action items', async () => {
    const app = await buildApp(testEnv);
    const res = await app.inject({ method: 'GET', url: '/api/action-items', ...AUTH });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('item-uuid-1');
  });
});

describe('GET /api/action-items/:id', () => {
  it('returns 404 when item not found', async () => {
    const { getActionItem } = await import('../../db/queries/action-items.js');
    vi.mocked(getActionItem).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const res = await app.inject({ method: 'GET', url: '/api/action-items/nonexistent', ...AUTH });
    expect(res.statusCode).toBe(404);
  });

  it('returns item when found', async () => {
    const app = await buildApp(testEnv);
    const res = await app.inject({
      method: 'GET',
      url: '/api/action-items/item-uuid-1',
      ...AUTH,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe('item-uuid-1');
  });
});

describe('PATCH /api/action-items/:id/status', () => {
  it('returns 400 without status in body', async () => {
    const app = await buildApp(testEnv);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/action-items/item-uuid-1/status',
      ...AUTH,
      headers: { ...AUTH.headers, 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on invalid status transition', async () => {
    const { updateActionItemStatus } = await import('../../db/queries/action-items.js');
    vi.mocked(updateActionItemStatus).mockRejectedValueOnce(
      new Error('Invalid status transition: completed → active'),
    );

    const app = await buildApp(testEnv);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/action-items/item-uuid-1/status',
      ...AUTH,
      headers: { ...AUTH.headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ status: 'active' }),
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Invalid status transition/);
  });

  it('updates status successfully', async () => {
    const app = await buildApp(testEnv);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/action-items/item-uuid-1/status',
      ...AUTH,
      headers: { ...AUTH.headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ status: 'active' }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('active');
  });
});
