import { test, expect } from '@playwright/test';
import { ReportsPage } from './pages/reports.page';
import {
  mockReportsApiEmpty,
  mockReportsApiWithReport,
  mockReportsApiStructured,
} from './fixtures/reports.fixture';

test.describe('Reports', () => {
  test.describe('UC: Generate report (no existing reports)', () => {
    let reports: ReportsPage;

    test.beforeEach(async ({ page }) => {
      await mockReportsApiEmpty(page);
      reports = new ReportsPage(page);
      await reports.goto();
    });

    test('shows empty state with generate button', async () => {
      await expect(reports.emptyState).toBeVisible();
      await expect(reports.generateButton).toBeVisible();
    });

    test('generate button tooltip says "Generate Latest Insights"', async () => {
      await expect(reports.generateButton).toHaveAttribute('title', 'Generate Latest Insights');
    });

    test('clicking generate triggers report creation without confirmation', async ({ page }) => {
      const generateRequest = page.waitForRequest('**/api/reports/generate');

      await reports.generateButton.click();

      // Verify the POST was sent
      const req = await generateRequest;
      expect(req.method()).toBe('POST');

      // Report card should appear after generation
      await expect(page.getByText('Great progress this week')).toBeVisible();
      await expect(reports.emptyState).not.toBeVisible();
    });
  });

  test.describe('UC: Re-generate report (existing report)', () => {
    let reports: ReportsPage;

    test.beforeEach(async ({ page }) => {
      await mockReportsApiWithReport(page);
      reports = new ReportsPage(page);
      await reports.goto();
    });

    test('shows existing report card', async ({ page }) => {
      await expect(page.getByText('Great progress this week')).toBeVisible();
    });

    test('generate button tooltip says "Re-Generate Latest Insights"', async () => {
      await expect(reports.generateButton).toHaveAttribute('title', 'Re-Generate Latest Insights');
    });

    test('clicking re-generate opens confirmation dialog', async () => {
      await reports.generateButton.click();
      await expect(reports.confirmDialog).toBeVisible();
    });

    test('cancelling confirmation dialog does not trigger generation', async ({ page }) => {
      let generateCalled = false;
      page.on('request', (req) => {
        if (req.url().includes('/api/reports/generate')) generateCalled = true;
      });

      await reports.generateButton.click();
      await expect(reports.confirmDialog).toBeVisible();

      await reports.cancelRegenerate();
      await expect(reports.confirmDialog).not.toBeVisible();
      expect(generateCalled).toBe(false);
    });

    test('confirming regeneration triggers report creation', async ({ page }) => {
      const generateRequest = page.waitForRequest('**/api/reports/generate');

      await reports.generateButton.click();
      await expect(reports.confirmDialog).toBeVisible();

      await reports.confirmRegenerate();

      const req = await generateRequest;
      expect(req.method()).toBe('POST');
    });
  });

  test.describe('UC: View structured 8-section report (UC-RPT-05)', () => {
    let reports: ReportsPage;

    test.beforeEach(async ({ page }) => {
      await mockReportsApiStructured(page);
      reports = new ReportsPage(page);
      await reports.goto();
    });

    test('displays structured report summary with HRV concern', async ({ page }) => {
      await expect(page.getByText('Solid week with HRV concerns')).toBeVisible();
    });

    test('expanding report shows biometrics and nutrition analysis', async ({ page }) => {
      // Click expand button
      await page.locator('[data-slot="card-header"] button').first().click();

      // Verify concatenated insights contain section headers
      await expect(page.getByText('Biometrics Overview')).toBeVisible();
      await expect(page.getByText('Nutrition Analysis')).toBeVisible();
      await expect(page.getByText('Training Load')).toBeVisible();
    });

    test('expanding report shows specific data points from analysis', async ({ page }) => {
      await page.locator('[data-slot="card-header"] button').first().click();

      // Biometric data points
      await expect(page.getByText(/HRV dropped 17%/)).toBeVisible();
      await expect(page.getByText(/67\.1 kg/)).toBeVisible();

      // Nutrition data points
      await expect(page.getByText(/2,199 kcal/)).toBeVisible();
      await expect(page.getByText(/30\.4 kcal\/kg FFM/)).toBeVisible();
    });

    test('displays high-priority action items', async ({ page }) => {
      await page.locator('[data-slot="card-header"] button').first().click();

      await expect(page.getByText(/Increase daily intake to 2,350 kcal/)).toBeVisible();
      await expect(page.getByText(/Take 2 full rest days/)).toBeVisible();
    });

    test('displays data coverage badges', async ({ page }) => {
      await expect(page.getByText('7d nutrition')).toBeVisible();
      await expect(page.getByText('3d workouts')).toBeVisible();
      await expect(page.getByText('4d biometrics')).toBeVisible();
    });

    test('report generation sends POST with correct method', async ({ page }) => {
      const generateRequest = page.waitForRequest('**/api/reports/generate');

      await reports.generateButton.click();
      await expect(reports.confirmDialog).toBeVisible();
      await reports.confirmRegenerate();

      const req = await generateRequest;
      expect(req.method()).toBe('POST');
    });
  });
});
