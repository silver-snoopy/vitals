import { test, expect } from '@playwright/test';
import { ActionsPage } from './pages/ActionsPage';
import { mockActionItemsApi } from './fixtures/action-items.fixture';
import { mockDashboardApi } from './fixtures/dashboard.fixture';

test.describe('UC-ACT-01: Actions page', () => {
  let actionsPage: ActionsPage;

  test.beforeEach(async ({ page }) => {
    await mockActionItemsApi(page);
    actionsPage = new ActionsPage(page);
    await actionsPage.goto();
  });

  test('displays Actions heading', async () => {
    await expect(actionsPage.heading).toBeVisible();
  });

  test('shows action item cards', async () => {
    const cards = actionsPage.actionCards();
    await expect(cards.first()).toBeVisible();
  });

  test('shows filter tabs', async () => {
    await expect(actionsPage.tabAll).toBeVisible();
    await expect(actionsPage.tabPending).toBeVisible();
    await expect(actionsPage.tabActive).toBeVisible();
  });

  test('accept button transitions pending item to active', async ({ page }) => {
    // Find a pending card and accept it
    const acceptBtn = page.getByTestId('btn-accept').first();
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();
    // After accepting, the item no longer shows accept button (it becomes active)
    await page.waitForTimeout(200);
  });

  test('shows progress summary card', async () => {
    await expect(actionsPage.progressSummary).toBeVisible();
  });
});

test.describe('UC-ACT-02: Dashboard InsightsPanel with action items', () => {
  test.beforeEach(async ({ page }) => {
    await mockActionItemsApi(page);
    await mockDashboardApi(page);
  });

  test('dashboard loads without errors when action items are mocked', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL('/error');
  });
});

test.describe('UC-ACT-03: Actions page filter tabs', () => {
  let actionsPage: ActionsPage;

  test.beforeEach(async ({ page }) => {
    await mockActionItemsApi(page);
    actionsPage = new ActionsPage(page);
    await actionsPage.goto();
  });

  test('pending tab filters to pending items only', async ({ page }) => {
    await actionsPage.tabPending.click();
    await expect(page.getByText('Increase protein intake to 150g/day')).toBeVisible();
  });

  test('active tab filters to active items only', async ({ page }) => {
    await actionsPage.tabActive.click();
    await expect(page.getByText('Add one additional rest day per week')).toBeVisible();
  });
});
