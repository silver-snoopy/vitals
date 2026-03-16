# Debug: Report Missing Workout & Biometric Data

**Date:** 2026-03-16
**Issue:** Weekly report (March 10–16) shows no Hevy workouts and no Cronometer biometric data. Only one day of nutrition data (March 12) is present.

## Root Cause Analysis

### Finding: Report generation does NOT trigger data collection

The report generation flow (`POST /api/reports/generate`) only **queries existing data** from the database — it never calls `/api/collect` or `runCollection()`.

**Data flow:**
1. `generateWeeklyReport()` in `report-generator.ts` runs 7 parallel DB queries (current week nutrition/workouts/biometrics + previous week + previous report)
2. Results are formatted into markdown tables by `prompt-builder.ts`
3. The prompt is sent to the AI provider
4. If data isn't in the DB, the LLM gets empty tables ("No biometric data available", "No workout data available")

### Data collection is a separate, decoupled process

Data enters the database only via:
1. **Scheduled n8n workflows** — `daily-collection.json` runs at 06:00 UTC daily, calling `POST /api/collect`
2. **Manual API calls** — `POST /api/collect` with date range and optional provider filter

The frontend has **no data collection trigger**. `useGenerateReport()` calls only `/api/reports/generate`.

### Why data is missing

Possible causes (in order of likelihood):
1. **n8n daily collection hasn't run** or failed silently for this week (March 10–16)
2. **Provider API credentials expired** — Hevy API key or Cronometer session may be invalid
3. **Collection metadata issue** — `loadCollectionMetadata()` uses `lastSuccessfulFetch` as `effectiveStart`. If a previous collection set this to a future date or had an error, subsequent collections could skip the target range
4. **Date range mismatch** — `queryWorkoutSessions` filters by `started_at BETWEEN $2 AND $3`, while nutrition uses `measured_at BETWEEN`. Timezone differences between Date objects and DB timestamps could exclude boundary dates

### Why only one day of nutrition exists (March 12)

This suggests the daily collection ran successfully exactly once during the week (on March 12 or slightly before with data for that date). The other days either:
- Had collection failures (Cronometer auth issues are common — GWT session auth is fragile)
- Were never attempted (n8n workflow was paused/disabled)

## Proposed Fix Plan

### Phase 1: Immediate Diagnostic (investigate)
1. Check `collection_metadata` table for last successful fetch times, error messages, and status per provider
2. Check if n8n daily-collection workflow is active and review its execution history
3. Manually trigger `POST /api/collect` for March 10–16 and inspect results per provider

### Phase 2: Add pre-collection to report generation
**The core architectural fix:** Report generation should ensure fresh data before querying.

```
POST /api/reports/generate
  └─> Step 1: runCollection(pool, { userId, providers: all, startDate, endDate })
  └─> Step 2: queryDailyNutritionSummary / queryWorkoutSessions / queryMeasurementsByMetrics
  └─> Step 3: buildReportPrompt → AI → save
```

**Implementation in `report-generator.ts`:**
- Import `runCollection` from `../collectors/pipeline.js`
- Before the 7 parallel DB queries, call `runCollection()` with the report's date range
- Log collection results for debugging
- Continue with existing DB queries (data is now fresh)

**Trade-offs:**
- (+) Report always has fresh data, no dependency on n8n schedule
- (+) Simple change — one function call added before existing logic
- (-) Report generation becomes slower (adds collection latency: Hevy API + Cronometer CSV export)
- (-) Could fail if provider APIs are down (need graceful degradation)

**Mitigation:** Make the pre-collection best-effort — catch errors and log them, then proceed with whatever data is in the DB. This way the report still generates (with stale/partial data) rather than failing entirely.

### Phase 3: Add collection status visibility
- Add a `GET /api/collect/status` endpoint returning `collection_metadata` for all providers
- Surface collection status in the frontend (last sync time, errors per provider)
- Show a warning banner on report generation if data is stale (e.g., last collection > 24h ago)

### Phase 4: Improve collection resilience
- Add retry logic in `pipeline.ts` for individual provider failures
- Add better error reporting from Cronometer auth (the GWT session auth is fragile)
- Consider adding a collection health check to the `health-monitor.json` workflow

## Files to Modify

| Phase | File | Change |
|-------|------|--------|
| 2 | `packages/backend/src/services/ai/report-generator.ts` | Add `runCollection()` call before DB queries |
| 2 | `packages/backend/src/routes/reports.ts` | Pass `env` config to `generateWeeklyReport` for provider access |
| 3 | `packages/backend/src/routes/collect.ts` | Add `GET /api/collect/status` endpoint |
| 3 | `packages/frontend/src/api/hooks/` | Add `useCollectionStatus` hook |
| 3 | `packages/frontend/src/components/` | Add stale-data warning to report generation UI |
