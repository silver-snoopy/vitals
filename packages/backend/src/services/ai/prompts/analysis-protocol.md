# Analysis Protocol

Process the provided data in this order before generating the report.

## Step 1 — Biometrics Extraction

- **Body composition:** Daily weight and body fat %. Compute weekly averages and compare to previous week. Note direction and magnitude. Contextualize BF% against bioimpedance limitations (hydration sensitivity).
- **Resting heart rate (RHR):** Daily values. Compute weekly average. Compare to previous week.
- **Heart rate variability (HRV):** Daily values. Compute weekly average. Compare to previous week.
- **SpO2:** Daily averages and minimums.
- **Respiration rate:** Daily averages.
- **Sleep:** Daily hours if available.
- Flag any metric that moves >10% week-over-week or crosses a clinical threshold.

## Step 2 — Nutrition Extraction

- Compute daily and weekly averages for: Energy (kcal), Protein (g), Carbs (g), Fat (g), Fiber (g), Sodium (mg), Sugar (g).
- Compute macronutrient split (% of calories).
- Compute protein per kg bodyweight (using current week average weight).
- Flag anomalies: fat below 50g, caffeine above 400mg, sodium below 2000mg with high water intake, calcium drops.

## Step 3 — Energy Availability Calculation

- FFM = weight_kg × (1 − body_fat_decimal)
- Estimated daily exercise expenditure = (sessions_per_week × estimated_kcal_per_session) / 7
- EA = (daily_caloric_intake − daily_exercise_expenditure) / FFM
- Flag if EA < 35 kcal/kg FFM/day.

## Step 4 — Training Load Extraction

- Group workout data by session.
- For each session: count working sets, list exercises with weight × reps, compute total session volume (Σ weight × reps).
- Count total sessions, sessions by split type, and rest days.
- Compare session frequency and volume to the workout plan (if provided).
- Track strength progression: compare key lifts to previous week values (same exercise, same context).

## Step 5 — Cross-Domain Correlation

- Correlate user notes (sweating, sleep quality, energy, soreness) with objective markers (HRV, RHR, SpO2).
- Identify patterns: e.g., HRV suppression + elevated RHR + reduced sweating = autonomic fatigue signal.
- Assess whether training volume/frequency deviations explain recovery marker changes.
- Evaluate whether caloric intake is appropriate for the actual (not prescribed) training load.

## Step 6 — Action Item Follow-Up

If previous action items are provided in the data bundle:

- Review completed items and their measured outcomes (improved/stable/declined).
- Note which recommendations led to measurable improvement — reinforce these patterns.
- Review deferred items — if still relevant, consider re-recommending with updated context.
- Review expired items — assess whether the underlying issue persists or has resolved itself.
- Use the completion rate and outcome data to calibrate this week's recommendations:
  - If completion rate is low, recommend fewer, higher-impact items.
  - If outcomes show improvement, build on what worked.
  - If outcomes declined, investigate whether the recommendation was appropriate or if other factors intervened.
- Use correlation language ("correlated with"), never causation ("caused").
