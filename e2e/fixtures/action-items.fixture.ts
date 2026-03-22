import type { Page } from '@playwright/test';

const pendingItem = {
  id: 'action-item-1',
  reportId: 'report-1',
  category: 'nutrition',
  priority: 'high',
  text: 'Increase protein intake to 150g/day',
  status: 'pending',
  createdAt: '2026-03-22T08:00:00.000Z',
  dueBy: '2026-03-29',
  completedAt: null,
  statusChangedAt: '2026-03-22T08:00:00.000Z',
};

const activeItem = {
  id: 'action-item-2',
  reportId: 'report-1',
  category: 'workout',
  priority: 'medium',
  text: 'Add one additional rest day per week',
  status: 'active',
  createdAt: '2026-03-22T08:00:00.000Z',
  dueBy: '2026-03-29',
  completedAt: null,
  statusChangedAt: '2026-03-22T08:00:00.000Z',
};

const completedItemWithOutcome = {
  id: 'action-item-3',
  reportId: 'report-1',
  category: 'nutrition',
  priority: 'high',
  text: 'Hit 150g protein daily',
  status: 'completed',
  targetMetric: 'protein_g',
  targetDirection: 'increase',
  baselineValue: 120,
  outcomeValue: 148,
  outcomeConfidence: 'high',
  outcomeMeasuredAt: '2026-03-21T00:00:00.000Z',
  createdAt: '2026-03-15T08:00:00.000Z',
  dueBy: '2026-03-22',
  completedAt: '2026-03-20T12:00:00.000Z',
  statusChangedAt: '2026-03-20T12:00:00.000Z',
};

const summaryFixture = {
  pending: 1,
  active: 1,
  completed: 0,
  deferred: 0,
  expired: 0,
  total: 2,
};

const attributionFixture = {
  period: 'month',
  totalItems: 5,
  completedItems: 3,
  completionRate: 0.6,
  measuredItems: 2,
  improvedItems: 1,
  stableItems: 1,
  declinedItems: 0,
  improvementRate: 0.5,
  topImprovements: [
    { text: 'Hit 150g protein', category: 'nutrition', metric: 'protein_g', change: '+28.0' },
  ],
};

export async function mockActionItemsApi(page: Page) {
  const items = [{ ...pendingItem }, { ...activeItem }, { ...completedItemWithOutcome }];

  // Single route handler that dispatches by URL path
  await page.route('**/api/action-items**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    // GET /api/action-items/attribution
    if (pathname.includes('/attribution')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: attributionFixture }),
      });
      return;
    }

    // GET /api/action-items/summary
    if (pathname.endsWith('/summary')) {
      const pending = items.filter((i) => i.status === 'pending').length;
      const active = items.filter((i) => i.status === 'active').length;
      const completed = items.filter((i) => i.status === 'completed').length;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...summaryFixture,
            pending,
            active,
            completed,
            total: items.length,
          },
        }),
      });
      return;
    }

    // PATCH /:id/status
    if (method === 'PATCH') {
      const pathParts = pathname.split('/');
      const id = pathParts[pathParts.length - 2]; // /api/action-items/:id/status
      const body = JSON.parse(route.request().postData() ?? '{}') as { status: string };
      const item = items.find((i) => i.id === id);
      if (item) {
        item.status = body.status;
        if (body.status === 'completed') {
          item.completedAt = new Date().toISOString();
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: item ?? null }),
      });
      return;
    }

    // GET /api/action-items with filters
    const statusParam = url.searchParams.get('status');
    const statuses = statusParam ? statusParam.split(',') : null;
    const filtered = statuses ? items.filter((i) => statuses.includes(i.status)) : items;
    const limit = url.searchParams.get('limit');
    const result = limit ? filtered.slice(0, parseInt(limit, 10)) : filtered;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: result }),
    });
  });
}
