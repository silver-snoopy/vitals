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

const summaryFixture = {
  pending: 1,
  active: 1,
  completed: 0,
  deferred: 0,
  expired: 0,
  total: 2,
};

export async function mockActionItemsApi(page: Page) {
  const items = [{ ...pendingItem }, { ...activeItem }];

  await page.route('**/api/action-items/summary', async (route) => {
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
  });

  await page.route('**/api/action-items**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    // PATCH /:id/status
    if (method === 'PATCH') {
      const pathParts = url.pathname.split('/');
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

    // GET with filters
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
