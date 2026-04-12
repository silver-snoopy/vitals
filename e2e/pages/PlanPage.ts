import type { Locator, Page } from '@playwright/test';

/**
 * Page Object Model for the Workout Plan page (/plan).
 */
export class PlanPagePOM {
  readonly page: Page;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly newPlanButton: Locator;
  readonly createFirstPlanButton: Locator;
  readonly createDialog: Locator;
  readonly pasteTextarea: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Workout Plan' });
    this.emptyState = page.getByText('No workout plan yet.');
    this.newPlanButton = page.getByRole('button', { name: /new plan/i });
    this.createFirstPlanButton = page.getByRole('button', { name: /create your first plan/i });
    this.createDialog = page.getByRole('heading', { name: /create workout plan/i });
    this.pasteTextarea = page.getByTestId('plan-textarea');
    this.submitButton = page.getByRole('button', { name: /parse & save/i });
  }

  async goto() {
    await this.page.goto('/plan');
  }

  /** Submit a raw text plan via the create modal. */
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

  /** Returns the active version indicator badge. */
  get activeIndicator() {
    return this.page.getByTestId('active-indicator');
  }

  /** Returns a version card by version number. */
  getVersionCard(versionNumber: number): Locator {
    return this.page.getByTestId(`version-card-${versionNumber}`);
  }

  /** Returns a day card by day name (matches CardTitle div text). */
  getDayCard(dayName: string): Locator {
    return this.page.getByText(dayName, { exact: true }).first();
  }

  /** Expects N version cards to be visible. */
  async expectVersionCount(n: number) {
    const { expect } = await import('@playwright/test');
    const cards = this.page.locator('[data-testid^="version-card-"]');
    await expect(cards).toHaveCount(n);
  }

  /** Expects the version badge to show version N. */
  async expectVersion(n: number) {
    const { expect } = await import('@playwright/test');
    await expect(this.page.getByText(`v${n}`)).toBeVisible();
  }
}
