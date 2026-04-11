import type { Locator, Page } from '@playwright/test';

/**
 * Page Object Model for the Workout Plan page (/plan).
 */
export class PlanPagePOM {
  readonly page: Page;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly pasteTextarea: Locator;
  readonly submitButton: Locator;
  readonly versionHistorySection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Workout Plan' });
    this.emptyState = page.getByText('Create your plan');
    this.pasteTextarea = page.getByTestId('plan-textarea');
    this.submitButton = page.getByRole('button', { name: /parse & save/i });
    this.versionHistorySection = page.getByText(/version history/i);
  }

  async goto() {
    await this.page.goto('/plan');
  }

  /** Submit a raw text plan via the paste editor. */
  async submitPlan(rawText: string) {
    await this.pasteTextarea.fill(rawText);
    await this.submitButton.click();
  }

  /** Paste text and click Parse & Save (alias for submitPlan). */
  async pasteAndSubmit(text: string) {
    await this.submitPlan(text);
  }

  /** Returns the version badge/label for the current active version. */
  get activeVersionBadge() {
    return this.page.getByText(/v\d+/i).first();
  }

  /** Returns a day card by day name (matches CardTitle div text). */
  getDayCard(dayName: string): Locator {
    return this.page.getByText(dayName, { exact: true }).first();
  }

  /** Expects N day cards to be visible. */
  async expectDayCount(n: number) {
    const { expect } = await import('@playwright/test');
    const cards = this.page.locator('[data-slot="card"]');
    await expect(cards).toHaveCount(n);
  }

  /** Expects the version badge to show version N. */
  async expectVersion(n: number) {
    const { expect } = await import('@playwright/test');
    await expect(this.page.getByText(`v${n}`)).toBeVisible();
  }
}
