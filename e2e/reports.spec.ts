import { test, expect } from '@playwright/test';
import { ReportsPage } from './pages/reports.page';
import { mockReportsApiEmpty, mockReportsApiWithReport } from './fixtures/reports.fixture';

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
});
