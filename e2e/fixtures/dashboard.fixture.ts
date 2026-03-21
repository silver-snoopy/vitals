import type { Page } from '@playwright/test';
import { format, subDays } from 'date-fns';

const today = new Date();
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

function makeDashboardData(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(fmt(new Date(d)));
  }

  return {
    data: {
      nutrition: days.map((date, i) => ({
        date,
        calories: 2000 + i * 50,
        protein: 120 + i * 2,
        carbs: 220 + i * 5,
        fat: 70 + i,
        fiber: 25,
      })),
      workouts: [
        {
          id: 'session-1',
          userId: 'user-1',
          date: days[1] ?? startDate,
          title: 'Upper Body',
          durationSeconds: 3600,
          source: 'strong',
          collectedAt: startDate,
          sets: [
            {
              id: 'set-1',
              sessionId: 'session-1',
              exerciseName: 'Bench Press',
              setIndex: 1,
              weightKg: 80,
              reps: 10,
              durationSeconds: null,
              distanceMeters: null,
              rpe: null,
            },
          ],
        },
        {
          id: 'session-2',
          userId: 'user-1',
          date: days[3] ?? startDate,
          title: 'Lower Body',
          durationSeconds: 4200,
          source: 'strong',
          collectedAt: startDate,
          sets: [
            {
              id: 'set-2',
              sessionId: 'session-2',
              exerciseName: 'Squat',
              setIndex: 1,
              weightKg: 100,
              reps: 8,
              durationSeconds: null,
              distanceMeters: null,
              rpe: null,
            },
          ],
        },
      ],
      biometrics: days
        .filter((_, i) => i % 2 === 0)
        .map((date) => ({
          id: `bio-${date}`,
          userId: 'user-1',
          date,
          metric: 'weight_kg',
          value: 82.5,
          unit: 'kg',
          source: 'apple_health',
          collectedAt: date,
        })),
    },
  };
}

const reportsFixture = {
  data: [
    {
      id: 'report-1',
      userId: 'user-1',
      periodStart: fmt(subDays(today, 7)),
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
      sections: {
        scorecard: {
          overall: { score: 7.2, notes: 'Good week overall' },
          nutrition: { score: 7.5, notes: 'Calorie targets met' },
          training: { score: 6.8, notes: 'Could add more volume' },
        },
        biometricsOverview: '',
        nutritionAnalysis: '',
        trainingLoad: '',
        crossDomainCorrelation: '',
        whatsWorking:
          '- Consistent calorie tracking every day\n- Hit protein targets 5 out of 7 days\n- Workout frequency on track',
        hazards:
          '- Fiber intake below 25g most days\n- No dedicated recovery sessions\n- Sleep data missing',
        recommendations: '',
      },
      aiProvider: 'gemini',
      aiModel: 'gemini-2.0-flash',
      createdAt: fmt(today),
    },
  ],
};

/**
 * Intercept all dashboard-related API calls with deterministic fixture data.
 */
export async function mockDashboardApi(page: Page) {
  await page.route('**/api/dashboard/weekly*', async (route) => {
    const url = new URL(route.request().url());
    const startDate = url.searchParams.get('startDate') ?? fmt(subDays(today, 30));
    const endDate = url.searchParams.get('endDate') ?? fmt(today);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeDashboardData(startDate, endDate)),
    });
  });

  await page.route('**/api/reports', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reportsFixture),
    });
  });
}
