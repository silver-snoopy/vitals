import type { Page } from '@playwright/test';
import { format, subDays } from 'date-fns';

const today = new Date();
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

const reportFixture = {
  id: 'report-1',
  userId: 'user-1',
  periodStart: fmt(subDays(today, 6)),
  periodEnd: fmt(today),
  summary: 'Great progress this week. Calorie targets met consistently.',
  insights: 'Protein intake is strong. Consider adding more fiber.',
  actionItems: [
    {
      category: 'nutrition' as const,
      priority: 'high' as const,
      text: 'Increase fiber intake to 30g daily',
    },
    { category: 'workout' as const, priority: 'medium' as const, text: 'Add a third leg day' },
    {
      category: 'recovery' as const,
      priority: 'low' as const,
      text: 'Try foam rolling post-workout',
    },
  ],
  dataCoverage: { nutritionDays: 7, workoutDays: 3, biometricDays: 4 },
  status: 'completed',
  aiProvider: 'gemini',
  aiModel: 'gemini-2.0-flash',
  createdAt: fmt(today),
};

/**
 * Simulate the WebSocket-driven async report completion via the exposed Zustand store.
 * In E2E, the real WebSocket won't connect — this bridges that gap.
 * Fire-and-forget: if the test ends before completion, the error is silently ignored.
 */
function simulateAsyncCompletion(page: Page) {
  void (async () => {
    try {
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const store = (window as any).__reportGenStore__;
        if (store) {
          store.getState().updateStatus('collecting_data', 'Collecting latest health data...');
        }
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const store = (window as any).__reportGenStore__;
        if (store) {
          store.getState().updateStatus('completed', 'Report ready');
        }
      });
    } catch {
      // Test may have ended — safe to ignore
    }
  })();
}

/**
 * Mock the reports API with no existing reports.
 * POST /api/reports/generate returns 202 (async), then simulates completion.
 */
export async function mockReportsApiEmpty(page: Page) {
  let generated = false;

  await page.route('**/api/reports', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: generated ? [reportFixture] : [] }),
      });
    } else {
      await route.fallback();
    }
  });

  await page.route('**/api/reports/generate', async (route) => {
    generated = true;
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ data: { reportId: 'report-1', status: 'pending' } }),
    });
    simulateAsyncCompletion(page);
  });
}

const structuredReportFixture = {
  ...reportFixture,
  id: 'report-structured-1',
  summary: 'Solid week with HRV concerns. Training volume exceeded prescription by 40%.',
  insights:
    '## Biometrics Overview\nWeight stable at 67.1 kg. HRV dropped 17% from 36 ms to 30 ms.\n\n## Nutrition Analysis\nCalories averaged 2,199 kcal. Energy availability at 30.4 kcal/kg FFM — below 35 threshold.\n\n## Training Load\n6 sessions across 6 days. 3 leg days vs 2 prescribed. Total volume: 46,500 kg.\n\n## Recommendations\n**Immediate:** Increase to 2,350 kcal/day. Cap caffeine at 300 mg.',
  actionItems: [
    {
      category: 'nutrition' as const,
      priority: 'high' as const,
      text: 'Increase daily intake to 2,350 kcal — add 15g fat via omega-3 sources',
    },
    {
      category: 'recovery' as const,
      priority: 'high' as const,
      text: 'Take 2 full rest days — non-negotiable given HRV trend',
    },
    {
      category: 'workout' as const,
      priority: 'medium' as const,
      text: 'Stick to 5 sessions and 2 leg days maximum',
    },
    {
      category: 'nutrition' as const,
      priority: 'medium' as const,
      text: 'Cap caffeine at 300 mg/day, aim for 200 mg on rest days',
    },
  ],
  sections: {
    biometricsOverview:
      '**Body Composition**\n| Metric | This Week | Prev Week | Δ |\n|---|---|---|---|\n| Weight | 67.1 kg | 67.1 kg | 0.0 |\n| Body Fat | 6.9% | 7.3% | -0.4% |\n\n**Cardiac & Autonomic**\n| Metric | This Week | Prev Week | Signal |\n|---|---|---|---|\n| HRV | 29.8 ms | 35.9 ms | 🔴 Down 17% |\n| RHR | 60.4 bpm | 59.7 bpm | ⚠️ Slightly elevated |',
    nutritionAnalysis:
      '**Daily Averages:** 2,199 kcal, 161g protein (2.4 g/kg), 279g carbs, 55g fat.\n\n**Energy Availability:** 30.4 kcal/kg FFM — ⚠️ BELOW 35 threshold.',
    trainingLoad:
      '6 sessions across 6 days (1 rest day). 3 leg days vs 2 prescribed.\nTotal volume: 46,500 kg (+22% vs prev week).',
    crossDomainCorrelation:
      'HRV suppression + elevated RHR + minimal sweating = autonomic fatigue signal. Training volume exceeds recovery capacity at current caloric intake.',
    whatsWorking:
      '- Protein at 2.4 g/kg — optimal\n- Caloric consistency excellent (2,182–2,226 range)\n- Upper body strength progressing',
    hazards:
      '1. EA at 30.4 kcal/kg FFM — below threshold\n2. HRV down 17% week-over-week\n3. 3 leg sessions instead of 2 prescribed',
    recommendations:
      '**Immediate:** Increase to 2,350 kcal/day. Take 2 rest days. Cap caffeine at 300 mg.\n**Monitoring:** If HRV stays below 33 ms, proceed with deload.',
    scorecard: {
      nutritionConsistency: { score: 9, notes: 'Tight adherence' },
      proteinTarget: { score: 10, notes: '2.4 g/kg, perfect' },
      trainingAdherence: { score: 5, notes: 'Exceeded volume and frequency' },
      recovery: { score: 4, notes: 'HRV dropping, 1 rest day' },
      bodyCompTrend: { score: 8, notes: 'Stable weight, BF trending down' },
      overallRiskLevel: { score: 4, notes: '⚠️ Moderate-high risk' },
    },
  },
};

/**
 * Mock the reports API with a structured 8-section report.
 */
export async function mockReportsApiStructured(page: Page) {
  await page.route('**/api/reports', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [structuredReportFixture] }),
      });
    } else {
      await route.fallback();
    }
  });

  await page.route('**/api/reports/generate', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ data: { reportId: 'report-structured-1', status: 'pending' } }),
    });
    simulateAsyncCompletion(page);
  });
}

/**
 * Mock the reports API with an existing report.
 */
export async function mockReportsApiWithReport(page: Page) {
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

  await page.route('**/api/reports/generate', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ data: { reportId: 'report-2', status: 'pending' } }),
    });
    simulateAsyncCompletion(page);
  });
}
