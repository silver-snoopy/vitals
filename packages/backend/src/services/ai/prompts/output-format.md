# Output Format

Return ONLY a valid JSON object with no prose before or after. Use the exact structure below.

All markdown fields should use tables where data comparison is involved, bullet points for lists, and signal indicators (✅ ⚠️ 🔴) for status.

```json
{
  "summary": "1-2 sentence overview identifying the week's most significant finding and overall trajectory.",
  "biometricsOverview": "Markdown. Body Composition table (this week vs previous week: weight, body fat %, FFM). Cardiac & Autonomic table (RHR, HRV, SpO2, respiration rate with signal indicators). Call out red flags with physiological explanation.",
  "nutritionAnalysis": "Markdown. Daily Averages table (macros with amount and % of calories, protein per kg, fiber, sodium). Energy Availability calculation with result and threshold comparison. Micronutrient flags for anomalous days.",
  "trainingLoad": "Markdown. Session Summary listing each session (split type, date, working sets, total volume). Volume Progression for key compound lifts week-over-week. Frequency Check comparing actual vs prescribed training days and rest days.",
  "crossDomainCorrelation": "Markdown. Synthesize subjective notes with objective data. Identify cause-effect patterns across domains. Connect training load to recovery markers to nutrition adequacy.",
  "whatsWorking": "Markdown. 3-5 bullet points of positive trends, strong adherence areas, or effective behaviors worth maintaining.",
  "hazards": "Markdown. Numbered list of concerns ranked by severity. Each item: observation, why it matters, physiological mechanism.",
  "recommendations": "Markdown with three subsections: **Immediate (this week)** — numbered, specific adjustments with target numbers. **Monitoring priorities** — what to watch next week with decision thresholds. **Medium-term (2-4 weeks)** — trajectory targets.",
  "scorecard": {
    "nutritionConsistency": { "score": 0, "notes": "Brief justification" },
    "proteinTarget": { "score": 0, "notes": "Brief justification" },
    "trainingAdherence": { "score": 0, "notes": "Brief justification" },
    "recovery": { "score": 0, "notes": "Brief justification" },
    "bodyCompTrend": { "score": 0, "notes": "Brief justification" },
    "overallRiskLevel": { "score": 0, "notes": "✅, ⚠️, or 🔴 with one-line summary" }
  },
  "actionItems": [
    {
      "category": "nutrition|workout|recovery|general",
      "priority": "high|medium|low",
      "text": "Specific actionable recommendation",
      "targetMetric": "protein_g|calories|carbs_g|fat_g|body_weight_kg|body_fat_percent|hrv_rmssd|training_volume|training_frequency|null",
      "targetDirection": "increase|decrease|maintain|null"
    }
  ]
}
```

## Score Scale

Scorecard scores use a 1-10 scale:
- 9-10: Excellent, exceeding targets
- 7-8: Good, on track
- 5-6: Acceptable but room for improvement
- 3-4: Below target, needs attention
- 1-2: Critical, immediate action required

## Constraints

- All scores must be integers between 1 and 10.
- Action items must have 3-7 entries covering the highest-priority changes.
- If data for a section is insufficient, state what is missing in that section rather than omitting it.
- Do not include any text outside the JSON object.
- Each action item should include `targetMetric` and `targetDirection` when a measurable metric exists. Use `null` for general/lifestyle items that cannot be measured numerically. Examples:
  - "Increase protein to 150g/day" → `targetMetric: "protein_g"`, `targetDirection: "increase"`
  - "Add a deload week" → `targetMetric: "training_volume"`, `targetDirection: "decrease"`
  - "Improve sleep consistency" → `targetMetric: null`, `targetDirection: null`
