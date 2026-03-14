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

    test('renders weekly summary stats with computed values', async () => {
      await expect(dashboard.avgCalories).toBeVisible();
      await expect(dashboard.workoutSessions).toBeVisible();
      await expect(dashboard.avgWeight).toBeVisible();

      // Verify the stats show actual values (not dashes)
      const calorieValue = dashboard.statValue('Avg Daily Calories');
      await expect(calorieValue).toContainText('kcal');

      const sessionValue = dashboard.statValue('Workout Sessions');
      await expect(sessionValue).toContainText('2');

      const weightValue = dashboard.statValue('Avg Weight');
      await expect(weightValue).toContainText('kg');
    });

    test('renders Latest AI Report preview', async () => {
      await expect(dashboard.latestReport).toBeVisible();

      // Report summary text from fixture
      await expect(
        dashboard.page.getByText('Great progress this week'),
      ).toBeVisible();

      // Action items are shown
      await expect(
        dashboard.page.getByText('Increase fiber intake'),
      ).toBeVisible();
    });

    test('displays all five widget sections on initial load', async () => {
      // All five dashboard widgets should be present
      await expect(dashboard.nutritionChart).toBeVisible();
      await expect(dashboard.workoutVolumeChart).toBeVisible();
      await expect(dashboard.bodyWeightChart).toBeVisible();
      await expect(dashboard.avgCalories).toBeVisible();
      await expect(dashboard.latestReport).toBeVisible();
    });
  });

  test.describe('UC2: Custom date range selection', () => {
    test('date range picker is visible and shows current range', async () => {
      await expect(dashboard.datePickerTrigger).toBeVisible();
      // Default range is 30 days — trigger should contain a date-like string
      await expect(dashboard.datePickerTrigger).toContainText('—');
    });

    test('opening date picker shows a calendar popover', async ({ page }) => {
      await dashboard.openDatePicker();

      // Calendar component renders with data-slot="calendar"
      const calendar = page.locator('[data-slot="calendar"]').first();
      await expect(calendar).toBeVisible();
    });

    test('selecting a new date range triggers a data refresh', async ({ page }) => {
      // Track API calls to verify refetch
      const apiCalls: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/api/dashboard/weekly')) {
          apiCalls.push(req.url());
        }
      });

      // Wait for initial load request
      await page.waitForTimeout(500);
      const initialCount = apiCalls.length;

      // Open date picker
      await dashboard.openDatePicker();
      const calendar = page.locator('[data-slot="calendar"]').first();
      await expect(calendar).toBeVisible();

      // react-day-picker in range mode: clicking a single day sets from=to,
      // which satisfies the handleSelect condition and closes the popover.
      await calendar.getByRole('button', { name: /March 1st/ }).click();

      // Popover should close and the date range trigger updates
      await expect(dashboard.datePickerTrigger).toContainText('Mar 1');

      // A new API call should have been made
      expect(apiCalls.length).toBeGreaterThan(initialCount);
    });

    test('dashboard content updates after date range change', async ({ page }) => {
      // After changing dates, the dashboard should still render all widgets
      await dashboard.openDatePicker();
      const calendar = page.locator('[data-slot="calendar"]').first();
      await expect(calendar).toBeVisible();

      // Select a single day — this changes the range and closes the popover
      await calendar.getByRole('button', { name: /March 1st/ }).click();

      // All widgets should still be visible after range change
      await expect(dashboard.nutritionChart).toBeVisible();
      await expect(dashboard.workoutVolumeChart).toBeVisible();
      await expect(dashboard.bodyWeightChart).toBeVisible();
      await expect(dashboard.avgCalories).toBeVisible();
    });
  });
});
