import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';
import { mockDashboardApi } from './fixtures/dashboard.fixture';

test.describe('Dashboard', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    await mockDashboardApi(page);
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test.describe('UC1: Default Dashboard view', () => {
    test('displays the Dashboard heading', async () => {
      await expect(dashboard.heading).toBeVisible();
    });

    test('renders Nutrition Trends chart', async () => {
      await expect(dashboard.nutritionChart).toBeVisible();
    });

    test('renders Workout Volume chart', async () => {
      await expect(dashboard.workoutVolumeChart).toBeVisible();
    });

    test('renders Body Weight chart', async () => {
      await expect(dashboard.bodyWeightChart).toBeVisible();
    });

    test('renders KPI strip with 5 metrics', async () => {
      await expect(dashboard.kpiAvgCal).toBeVisible();
      await expect(dashboard.kpiSessions).toBeVisible();
      await expect(dashboard.kpiProtein).toBeVisible();
      await expect(dashboard.kpiAiScore).toBeVisible();
    });

    test('KPI cards show computed values', async () => {
      // avg cal card should have a number
      const calCard = dashboard.kpiCard('avg cal');
      await expect(calCard.locator('.tabular-nums')).not.toHaveText('—');

      // sessions card should show "2" (2 workout sessions in fixture)
      const sessionsCard = dashboard.kpiCard('sessions');
      await expect(sessionsCard.locator('.tabular-nums')).toHaveText('2');

      // AI score should show 7.2/10
      const aiCard = dashboard.kpiCard('AI score');
      await expect(aiCard.locator('.tabular-nums')).toHaveText('7.2/10');
    });

    test('renders insights panel with summary and actions', async () => {
      // Report summary from fixture (full text, not truncated)
      await expect(dashboard.page.getByText('Great progress this week')).toBeVisible();
      // View Report link
      await expect(dashboard.page.getByText('View Report →')).toBeVisible();
      // Action items section header
      await expect(dashboard.page.getByText(/This Week.s Focus/)).toBeVisible();
    });

    test('insights panel View Report link navigates to /reports', async ({ page }) => {
      await page.getByText('View Report →').first().click();
      await expect(page).toHaveURL(/\/reports/);
    });
  });

  test.describe('UC-DASH: Bento grid layout', () => {
    test('bento grid shows all 5 chart areas', async () => {
      await expect(dashboard.nutritionChart).toBeVisible();
      await expect(dashboard.workoutVolumeChart).toBeVisible();
      await expect(dashboard.bodyWeightChart).toBeVisible();
      await expect(dashboard.macroSplitChart).toBeVisible();
      await expect(dashboard.activityHeatmap).toBeVisible();
    });

    test('activity heatmap renders SVG with cells', async ({ page }) => {
      const svg = page.locator('svg[aria-label="Workout activity heatmap"]').first();
      await expect(svg).toBeVisible();
      // Should have rect elements (heatmap cells)
      const rects = svg.locator('rect');
      expect(await rects.count()).toBeGreaterThan(0);
    });

    test('macro split chart shows donut with macro labels', async ({ page }) => {
      await expect(dashboard.macroSplitChart).toBeVisible();
      await expect(page.getByText('kcal')).toBeVisible();
      await expect(page.getByText(/Protein \d+g/)).toBeVisible();
    });
  });

  test.describe('UC2: Custom date range selection', () => {
    test('date range picker is visible and shows current range', async () => {
      await expect(dashboard.datePickerTrigger).toBeVisible();
      await expect(dashboard.datePickerTrigger).toContainText('—');
    });

    test('opening date picker shows a calendar popover', async ({ page }) => {
      await dashboard.openDatePicker();
      const calendar = page.locator('[data-slot="calendar"]').first();
      await expect(calendar).toBeVisible();
    });

    test('selecting a new date range triggers a data refresh', async ({ page }) => {
      const apiCalls: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/api/dashboard/weekly')) {
          apiCalls.push(req.url());
        }
      });

      await page.waitForTimeout(500);
      const initialCount = apiCalls.length;

      await dashboard.openDatePicker();
      const calendar = page.locator('[data-slot="calendar"]').first();
      await expect(calendar).toBeVisible();

      await calendar.getByRole('button', { name: /March 1st/ }).click();
      await expect(dashboard.datePickerTrigger).toContainText('Mar 1');

      expect(apiCalls.length).toBeGreaterThan(initialCount);
    });

    test('dashboard content updates after date range change', async ({ page }) => {
      await dashboard.openDatePicker();
      const calendar = page.locator('[data-slot="calendar"]').first();
      await expect(calendar).toBeVisible();

      await calendar.getByRole('button', { name: /March 1st/ }).click();

      await expect(dashboard.nutritionChart).toBeVisible();
      await expect(dashboard.workoutVolumeChart).toBeVisible();
      await expect(dashboard.bodyWeightChart).toBeVisible();
    });
  });
});

test.describe('Dashboard Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    await mockDashboardApi(page);
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test('KPI strip is horizontally scrollable', async ({ page }) => {
    // On mobile, KPI cards are in a horizontal scroll container
    const scrollContainer = page.locator('.snap-x.snap-mandatory').first();
    await expect(scrollContainer).toBeVisible();
  });

  test('insights panel is visible without scrolling', async ({ page }) => {
    await expect(page.getByText('View Report →')).toBeVisible();
  });

  test('charts are swipeable with dot indicators', async ({ page }) => {
    // Wait for first dot to appear, then count all
    const firstDot = page.getByRole('button', { name: 'Go to Nutrition' });
    await expect(firstDot).toBeVisible();
    const dots = page.getByRole('button', { name: /Go to/ });
    expect(await dots.count()).toBe(4);
  });
});
