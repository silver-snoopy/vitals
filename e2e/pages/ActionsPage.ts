import type { Locator, Page } from '@playwright/test';

export class ActionsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly progressSummary: Locator;
  readonly tabAll: Locator;
  readonly tabPending: Locator;
  readonly tabActive: Locator;
  readonly tabCompleted: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Actions' });
    this.progressSummary = page
      .locator('[data-slot="card"]')
      .filter({ hasText: /completed/ })
      .first();
    this.tabAll = page.getByTestId('tab-all');
    this.tabPending = page.getByTestId('tab-pending');
    this.tabActive = page.getByTestId('tab-active');
    this.tabCompleted = page.getByTestId('tab-completed');
  }

  async goto() {
    await this.page.goto('/reports/actions');
  }

  actionCards() {
    return this.page.getByTestId('action-item-card');
  }

  acceptButton(index = 0) {
    return this.page.getByTestId('btn-accept').nth(index);
  }

  completeButton(index = 0) {
    return this.page.getByTestId('btn-complete').nth(index);
  }

  deferButton(index = 0) {
    return this.page.getByTestId('btn-defer').nth(index);
  }
}
