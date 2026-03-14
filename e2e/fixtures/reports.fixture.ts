import type { Page } from '@playwright/test';
import { format, subDays } from 'date-fns';

const today = new Date();
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

const reportFixture = {
  id: 'report-1',
  userId: 'user-1',
  periodStart: fmt(subDays(today, 6)),
  periodEnd: fmt(today),
  summary: 'Great progress this week. Calorie targets met consistently.',
  insights: 'Protein intake is strong. Consider adding more fiber.',
  actionItems: [
    { category: 'nutrition' as const, priority: 'high' as const, text: 'Increase fiber intake to 30g daily' },
    { category: 'workout' as const, priority: 'medium' as const, text: 'Add a third leg day' },
    { category: 'recovery' as const, priority: 'low' as const, text: 'Try foam rolling post-workout' },
  ],
  dataCoverage: { nutritionDays: 7, workoutDays: 3, biometricDays: 4 },
  aiProvider: 'gemini',
  aiModel: 'gemini-2.0-flash',
  createdAt: fmt(today),
};

/**
 * Mock the reports API with no existing reports.
 * POST /api/reports/generate returns a new report and subsequent GET returns it.
 */
export async function mockReportsApiEmpty(page: Page) {
  let generated = false;

  await page.route('**/api/reports', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: generated ? [reportFixture] : [] }),
      });
    } else {
      await route.fallback();
    }
  });

  await page.route('**/api/reports/generate', async (route) => {
    generated = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: reportFixture }),
    });
  });
}

/**
 * Mock the reports API with an existing report.
 * POST /api/reports/generate returns a refreshed report.
 */
export async function mockReportsApiWithReport(page: Page) {
  await page.route('**/api/reports', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [reportFixture] }),
      });
    } else {
      await route.fallback();
    }
  });

  await page.route('**/api/reports/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ...reportFixture, id: 'report-2' } }),
    });
  });
}
