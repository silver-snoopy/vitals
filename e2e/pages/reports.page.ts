import type { Locator, Page } from '@playwright/test';

/**
 * Page Object Model for the Reports page.
 */
export class ReportsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly generateButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Reports' });
    this.generateButton = page.getByRole('button', {
      name: /Generate Latest Insights|Re-Generate Latest Insights/i,
    });
    this.emptyState = page.getByText('No reports yet');
  }

  async goto() {
    await this.page.goto('/reports');
  }

  /** Get the confirmation dialog */
  get confirmDialog() {
    return this.page.getByText('Re-Generate Report?');
  }

  /** Click the confirm button inside the regenerate dialog */
  async confirmRegenerate() {
    await this.page.getByRole('button', { name: 'Re-Generate' }).click();
  }

  /** Click cancel in the regenerate dialog */
  async cancelRegenerate() {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
  }
}
