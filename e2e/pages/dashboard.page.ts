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

  // KPI strip metrics (identified by label text inside KpiCard)
  readonly kpiAvgCal: Locator;
  readonly kpiSessions: Locator;
  readonly kpiWeight: Locator;
  readonly kpiProtein: Locator;
  readonly kpiAiScore: Locator;

  // Report alert bar
  readonly reportAlertBar: Locator;

  // New bento grid components
  readonly macroSplitChart: Locator;
  readonly activityHeatmap: Locator;

  // Date range picker (in the Topbar, contains "—" between dates)
  readonly datePickerTrigger: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Dashboard' });

    // Charts appear twice in DOM (bento grid + swipeable mobile) — scope to first (desktop)
    this.nutritionChart = page.getByText('Nutrition Trends').first();
    this.workoutVolumeChart = page.getByText('Workout Volume (kg)').first();
    this.bodyWeightChart = page.getByText('Body Weight (kg)').first();

    // KPI cards appear twice (desktop grid + mobile scroll) — scope to first
    this.kpiAvgCal = page.getByText('avg cal').first();
    this.kpiSessions = page.getByText('sessions').first();
    this.kpiWeight = page.getByText('weight').first();
    this.kpiProtein = page.getByText('protein').first();
    this.kpiAiScore = page.getByText('AI score').first();

    // Report alert bar
    this.reportAlertBar = page.getByText('View →').locator('..');

    // Bento grid new components
    this.macroSplitChart = page.getByText('Macro Split').first();
    this.activityHeatmap = page.getByText('Activity').first();

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

  /** Get a KPI card by its label text */
  kpiCard(label: string): Locator {
    return this.page.locator('[data-slot="card"]').filter({ hasText: label }).first();
  }
}
