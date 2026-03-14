import type { Locator, Page } from '@playwright/test';

/**
 * Page Object Model for the Dashboard page.
 * Encapsulates selectors so tests stay readable and maintainable.
 */
export class DashboardPage {
  readonly page: Page;

  // Page heading
  readonly heading: Locator;

  // Chart cards (identified by their card titles)
  readonly nutritionChart: Locator;
  readonly workoutVolumeChart: Locator;
  readonly bodyWeightChart: Locator;

  // Weekly summary stat labels
  readonly avgCalories: Locator;
  readonly workoutSessions: Locator;
  readonly avgWeight: Locator;

  // Latest report
  readonly latestReport: Locator;

  // Date range picker (in the Topbar, contains "—" between dates)
  readonly datePickerTrigger: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Dashboard' });

    this.nutritionChart = page.getByText('Nutrition Trends');
    this.workoutVolumeChart = page.getByText('Workout Volume (kg)');
    this.bodyWeightChart = page.getByText('Body Weight (kg)');

    this.avgCalories = page.getByText('Avg Daily Calories');
    this.workoutSessions = page.getByText('Workout Sessions');
    this.avgWeight = page.getByText('Avg Weight');

    this.latestReport = page.getByText('Latest AI Report');

    // Desktop topbar date picker (the one with text-sm, not the compact mobile one)
    this.datePickerTrigger = page
      .locator('header [data-slot="popover-trigger"]')
      .filter({ hasText: '—' })
      .last();
  }

  async goto() {
    await this.page.goto('/');
  }

  /** Open the date range popover */
  async openDatePicker() {
    await this.datePickerTrigger.click();
  }

  /** Get the value (bold number) inside a stat card by its label text */
  statValue(label: string): Locator {
    // Each stat is its own Card. Find the card that contains the label,
    // then locate the bold value <p> within that specific card.
    return this.page
      .locator('[data-slot="card"]')
      .filter({ hasText: label })
      .locator('p.text-2xl')
      .first();
  }
}
