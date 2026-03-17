import { test, expect } from '@playwright/test';
import { mockDashboardApi } from './fixtures/dashboard.fixture';

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto('/');
  });

  test('bottom nav renders with 4 tabs on mobile', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    const tabs = nav.locator('a');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText('Dashboard');
    await expect(tabs.nth(1)).toContainText('Nutrition');
    await expect(tabs.nth(2)).toContainText('Workouts');
    await expect(tabs.nth(3)).toContainText('Reports');
  });

  test('bottom nav is hidden on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeHidden();
  });

  test('navigate via bottom tabs', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');

    await nav.locator('a', { hasText: 'Nutrition' }).click();
    await expect(page).toHaveURL('/nutrition');

    await nav.locator('a', { hasText: 'Workouts' }).click();
    await expect(page).toHaveURL('/workouts');

    await nav.locator('a', { hasText: 'Reports' }).click();
    await expect(page).toHaveURL('/reports');

    await nav.locator('a', { hasText: 'Dashboard' }).click();
    await expect(page).toHaveURL('/');
  });

  test('active tab has primary color styling', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    const dashboardTab = nav.locator('a', { hasText: 'Dashboard' });

    // Active tab should have text-primary class (via NavLink isActive)
    await expect(dashboardTab).toHaveClass(/text-primary/);

    // Inactive tab should have muted-foreground
    const nutritionTab = nav.locator('a', { hasText: 'Nutrition' });
    await expect(nutritionTab).toHaveClass(/text-muted-foreground/);
  });

  test('upload accessible from mobile header', async ({ page }) => {
    const uploadButton = page.locator('button[aria-label="Upload data"]');
    await expect(uploadButton).toBeVisible();
    await uploadButton.click();

    // UploadModal should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
  });

  test('content is not hidden behind bottom nav', async ({ page }) => {
    // The main content area should have bottom padding
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Verify the main element has pb-20 class for mobile spacing
    await expect(main).toHaveClass(/pb-20/);
  });
});
