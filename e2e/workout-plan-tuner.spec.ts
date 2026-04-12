import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PlanPagePOM } from './pages/PlanPage';
import { ReportsPage } from './pages/reports.page';
import parsedPlanFixture from './fixtures/parsed-plan.json' with { type: 'json' };
import adjustmentBatchFixture from './fixtures/plan-adjustment-batch.json' with { type: 'json' };
import planVersionsFixture from './fixtures/plan-versions.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Fixtures & mocks
// ---------------------------------------------------------------------------

const reportFixture = {
  id: 'report-fixture-001',
  userId: 'user-1',
  periodStart: '2026-04-05',
  periodEnd: '2026-04-11',
  summary: 'Solid training week. Good recovery indicators.',
  insights: '## Training Load\nStrong bench press progress. Pull work consistent.',
  actionItems: [],
  dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 6 },
  status: 'completed',
  aiProvider: 'gemini',
  aiModel: 'gemini-2.0-flash',
  createdAt: '2026-04-11',
};

const parsedPlan = parsedPlanFixture.data;

const planV2Fixture = {
  plan: {
    ...parsedPlan.plan,
    activeVersionId: 'version-fixture-002',
    updatedAt: '2026-04-11T11:00:00.000Z',
  },
  latestVersion: {
    ...parsedPlan.latestVersion,
    id: 'version-fixture-002',
    versionNumber: 2,
    source: 'tuner',
    parentVersionId: 'version-fixture-001',
    createdAt: '2026-04-11T11:00:00.000Z',
    acceptedAt: '2026-04-11T11:00:00.000Z',
    notes: 'AI tuned — 2 changes applied',
  },
};

/** Mock GET /api/workout-plans/current returning null (no plan). */
async function mockNoPlan(page: Page) {
  await page.route('**/api/workout-plans/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null }),
    });
  });
}

/** Mock GET /api/workout-plans/current returning parsed plan v1. */
async function mockPlanV1(page: Page) {
  await page.route('**/api/workout-plans/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(parsedPlanFixture),
    });
  });
}

/** Mock GET /api/workout-plans/current returning plan v2 (after accept). */
async function mockPlanV2(page: Page) {
  await page.route('**/api/workout-plans/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: planV2Fixture }),
    });
  });
}

/** Mock GET /api/reports. */
async function mockReportsWithReport(page: Page) {
  await page.route('**/api/reports', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [reportFixture] }),
      });
    } else {
      await route.fallback();
    }
  });
  // Also mock generate just in case
  await page.route('**/api/reports/generate', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ data: { reportId: 'report-fixture-001', status: 'pending' } }),
    });
  });
}

/** Mock POST /api/workout-plans/:id/tune. */
async function mockTunePlan(page: Page) {
  await page.route('**/api/workout-plans/*/tune', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adjustmentBatchFixture),
    });
  });
}

/** Mock PATCH /api/workout-plans/adjustments/:batchId. */
async function mockDecideAdjustments(page: Page) {
  await page.route('**/api/workout-plans/adjustments/**', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: planV2Fixture.latestVersion }),
      });
    } else {
      await route.fallback();
    }
  });
}

/** Mock GET /api/workout-plans/:id/versions returning version list. */
async function mockPlanVersions(page: Page) {
  await page.route('**/api/workout-plans/*/versions', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(planVersionsFixture),
      });
    } else {
      await route.fallback();
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('UC-PLAN-01: Workout Plan Fine Tuner', () => {
  test.describe('Create plan flow', () => {
    test('navigating to /plan shows empty state with create CTA', async ({ page }) => {
      await mockNoPlan(page);
      const planPage = new PlanPagePOM(page);
      await planPage.goto();

      await expect(planPage.heading).toBeVisible();
      await expect(planPage.emptyState).toBeVisible();
      // "Create your first plan" button should be present
      await expect(planPage.createFirstPlanButton).toBeVisible();
    });

    test('pasting plan text and submitting parses and displays days', async ({ page }) => {
      let planCreated = false;

      await page.route('**/api/workout-plans/current', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(planCreated ? parsedPlanFixture : { data: null }),
        });
      });

      await page.route('**/api/workout-plans', async (route) => {
        if (route.request().method() === 'POST') {
          planCreated = true;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(parsedPlanFixture),
          });
        } else {
          await route.fallback();
        }
      });

      // Mock versions endpoint for after plan creation
      await page.route('**/api/workout-plans/*/versions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [parsedPlanFixture.data.latestVersion],
            }),
          });
        } else {
          await route.fallback();
        }
      });

      const planPage = new PlanPagePOM(page);
      await planPage.goto();
      await expect(planPage.emptyState).toBeVisible();

      // Open create modal and fill
      await planPage.createFirstPlanButton.click();
      await expect(planPage.createDialog).toBeVisible();

      await planPage.pasteTextarea.fill(
        'Push A\nBench Press 3x8 @ 80kg\n\nPull A\nBarbell Row 3x8 @ 80kg',
      );
      await planPage.submitButton.click();

      // Day cards should appear inside the active version card
      await expect(planPage.getDayCard('Push A')).toBeVisible({ timeout: 8000 });
      await expect(planPage.getDayCard('Pull A')).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe('Version list display', () => {
    test('shows active version with green indicator and expanded content', async ({ page }) => {
      await mockPlanV2(page);
      await mockPlanVersions(page);
      const planPage = new PlanPagePOM(page);
      await planPage.goto();

      // Active version card should be visible with indicator
      await expect(planPage.activeIndicator).toBeVisible({ timeout: 5000 });
      await expect(planPage.getVersionCard(2)).toBeVisible();

      // Active card should be expanded — day cards visible
      await expect(planPage.getDayCard('Push A')).toBeVisible();
      await expect(planPage.getDayCard('Pull A')).toBeVisible();
    });

    test('shows previous versions as collapsed cards', async ({ page }) => {
      await mockPlanV2(page);
      await mockPlanVersions(page);
      const planPage = new PlanPagePOM(page);
      await planPage.goto();

      // Both version cards should be visible
      await planPage.expectVersionCount(2);

      // v1 should be visible but collapsed (exercise names not visible inside it)
      await expect(planPage.getVersionCard(1)).toBeVisible({ timeout: 5000 });
      // The v1 card should show "Manual edit" badge
      const v1Card = planPage.getVersionCard(1);
      await expect(v1Card.getByText('Manual edit')).toBeVisible();
    });

    test('clicking previous version expands to show exercises', async ({ page }) => {
      await mockPlanV2(page);
      await mockPlanVersions(page);
      const planPage = new PlanPagePOM(page);
      await planPage.goto();

      // Click expand on v1 card
      const v1Card = planPage.getVersionCard(1);
      await v1Card.getByRole('button').first().click();

      // Now exercises from v1 should be visible within v1's card
      // v1 has Bench Press, Incline Dumbbell Press, Overhead Press, Barbell Row, Pull-ups
      await expect(v1Card.getByText('Incline Dumbbell Press')).toBeVisible({ timeout: 5000 });
      await expect(v1Card.getByText('Overhead Press')).toBeVisible();
    });
  });

  test.describe('Optimize plan CTA on report card', () => {
    test('report card shows "Optimize next week\'s plan" button when plan exists', async ({
      page,
    }) => {
      await mockReportsWithReport(page);
      await mockPlanV1(page);

      const reports = new ReportsPage(page);
      await reports.goto();

      // Expand the first report card
      await page.locator('[data-slot="card-header"] button').first().click();

      // The optimize button should be visible and enabled
      await expect(page.getByTestId('optimize-button')).toBeVisible({ timeout: 5000 });
    });

    test('report card shows disabled CTA with "Create a plan to unlock" when no plan', async ({
      page,
    }) => {
      await mockReportsWithReport(page);
      await mockNoPlan(page);

      const reports = new ReportsPage(page);
      await reports.goto();

      await page.locator('[data-slot="card-header"] button').first().click();

      // Disabled button should be present
      await expect(page.getByTestId('optimize-disabled')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/create a plan to unlock/i)).toBeVisible();
    });
  });

  test.describe('Tune plan → review → accept flow (happy path)', () => {
    test('clicking optimize triggers tune, opens modal with adjustment batch', async ({ page }) => {
      await mockReportsWithReport(page);
      await mockPlanV1(page);
      await mockTunePlan(page);

      const reports = new ReportsPage(page);
      await reports.goto();

      await page.locator('[data-slot="card-header"] button').first().click();
      await expect(page.getByTestId('optimize-button')).toBeVisible({ timeout: 5000 });

      await page.getByTestId('optimize-button').click();

      // Modal should open with adjustment rows
      await expect(page.getByRole('heading', { name: /review plan adjustments/i })).toBeVisible({
        timeout: 8000,
      });

      // Should show progress_load changes (multiple may appear for multiple exercises)
      await expect(page.getByText('Progress load').first()).toBeVisible();
    });

    test('rejecting one change and accepting the rest commits correctly', async ({ page }) => {
      await mockReportsWithReport(page);
      await mockPlanV1(page);
      await mockTunePlan(page);
      await mockDecideAdjustments(page);

      const reports = new ReportsPage(page);
      await reports.goto();
      await page.locator('[data-slot="card-header"] button').first().click();
      await page.getByTestId('optimize-button').click();

      await expect(page.getByRole('heading', { name: /review plan adjustments/i })).toBeVisible({
        timeout: 8000,
      });

      // Reject the second adjustment (adj-fixture-002)
      await page.getByTestId('reject-adj-fixture-002').click();

      // Commit should now say "2 accepted" (3 total, 1 rejected)
      await expect(page.getByText(/commit changes \(2 accepted\)/i)).toBeVisible();

      // Click commit
      const patchRequest = page.waitForRequest(
        (req) => req.url().includes('/api/workout-plans/adjustments/') && req.method() === 'PATCH',
      );
      await page.getByRole('button', { name: /commit changes/i }).click();
      const req = await patchRequest;

      const body = req.postDataJSON() as {
        decisions: Record<string, 'accepted' | 'rejected'>;
      };
      expect(body.decisions['adj-fixture-001']).toBe('accepted');
      expect(body.decisions['adj-fixture-002']).toBe('rejected');
      expect(body.decisions['adj-fixture-003']).toBe('accepted');
    });

    test('after accepting, /plan shows new version number and history entry', async ({ page }) => {
      await mockPlanV2(page);
      await mockPlanVersions(page);

      const planPage = new PlanPagePOM(page);
      await planPage.goto();

      // Should display version 2 as active
      await expect(planPage.activeVersionBadge).toBeVisible({ timeout: 5000 });
      await expect(planPage.activeIndicator).toBeVisible();
      await expect(planPage.getVersionCard(2)).toBeVisible();
    });
  });
});
