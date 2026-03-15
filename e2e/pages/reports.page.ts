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

  /** Get the confirmation dialog (matches both Generate and Re-Generate titles) */
  get confirmDialog() {
    return this.page.getByRole('heading', { name: /Generate Report|Re-Generate Report/ });
  }

  /** Get the user notes textarea */
  get notesTextarea() {
    return this.page.getByRole('textbox', { name: /Notes for AI/i });
  }

  /** Click the confirm button inside the dialog */
  async confirmGenerate() {
    await this.page.getByRole('button', { name: /^(Re-)?Generate$/ }).click();
  }

  /** Click cancel in the dialog */
  async cancelGenerate() {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
  }
}
