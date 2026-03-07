# Phase 3: Backend API + AI — Implementation Plan

**Date:** 2026-03-07
**Status:** Planned

## Context

Phase 2 is complete. The backend has: Fastify 5 app with database plugin, PostgreSQL schema (measurements EAV, workout_sets, weekly_reports, ai_generations, apple_health_imports, daily_aggregates materialized view), data collection pipeline with Cronometer and Hevy collectors, normalizers, batch ingest layer, and `POST /api/collect` route. 49 unit tests pass.

Phase 3 adds the read/query API layer for the frontend, the AI service for report generation, and Apple Health file uploads.

## Tasks

### Batch 1: Database Query Layer (parallel)

**Task 1: Measurements and Nutrition Queries**
- `db/queries/measurements.ts` — `queryMeasurementsByMetric`, `queryDailyNutritionSummary` (EAV-to-pivot)
- Tests with mocked pool

**Task 2: Workout Queries**
- `db/queries/workouts.ts` — `queryWorkoutSessions` (group by date+source), `queryExerciseProgress`
- Tests with mocked pool

**Task 3: Report Queries**
- `db/queries/reports.ts` — `getReportById`, `getLatestReport`, `listReports`, `saveReport`, `logAiGeneration`
- Tests with mocked pool, JSONB parsing

### Batch 2: Routes + AI Service (parallel)

**Task 4: Nutrition, Measurements, Dashboard Routes**
- `GET /api/nutrition/daily`, `GET /api/measurements`, `GET /api/dashboard/weekly`
- Extract shared `validateDateRange()` utility
- Depends on Task 1

**Task 5: Workout Routes**
- `GET /api/workouts`, `GET /api/workouts/progress/:exerciseName`
- Depends on Task 2

**Task 6: Claude AI Provider**
- `services/ai/claude-provider.ts` — implements `AIProvider` from `@vitals/shared`
- `services/ai/ai-service.ts` — factory function
- Add `@anthropic-ai/sdk` dependency

### Batch 3: Report Pipeline + Apple Health

**Task 7: Report Generation Pipeline**
- `services/ai/report-generator.ts` — orchestrates data fetch + AI call + save
- `services/ai/prompt-builder.ts` — structured prompts for Claude
- Depends on Tasks 1, 2, 3, 6

**Task 8: Report Routes**
- `POST /api/reports/generate` (API key protected), `GET /api/reports`, `GET /api/reports/:id`
- Depends on Task 7

**Task 9: Apple Health Upload**
- `services/collectors/apple-health/parser.ts` — regex-based XML extraction
- `POST /api/upload/apple-health` with `@fastify/multipart`

### Batch 4: Verification

**Task 10: Integration Verification**
- All tests pass, TypeScript compiles, smoke test all routes
- Code review

## New Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API client |
| `@fastify/multipart` | File upload for Apple Health |
