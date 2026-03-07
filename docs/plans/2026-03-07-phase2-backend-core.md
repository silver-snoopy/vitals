# Phase 2: Backend Core — Implementation Plan

**Date:** 2026-03-07
**Status:** Completed

## Summary

Built the data collection pipeline: database schema, connection pool, legacy collector migration (Cronometer + Hevy), normalizers, batch ingest layer, and the `POST /api/collect` endpoint. Code review applied with all critical/important issues fixed.

**Result:** 49 unit tests passing, 11 tasks completed across 4 batches.

## Context

Phase 1 scaffold was complete. All 4 packages built, health route worked, tests passed. The backend had Fastify + health endpoint + env config + pg driver (unused). Phase 2 built the full data collection pipeline.

## What Was Built

| Component | Files | Description |
|-----------|-------|-------------|
| DB schema | `db/migrations/001_initial_schema.sql` | 7 tables + materialized view + unique indexes for upserts |
| Migration runner | `db/migrate.ts` | Tracks applied migrations in `_migrations` table |
| Connection pool | `db/pool.ts` | Singleton pg.Pool with init/get/close |
| DB helpers | `db/helpers.ts` | `loadCollectionMetadata`, `saveCollectionMetadata`, `refreshDailyAggregates` |
| Fastify plugin | `plugins/database.ts` | Decorates `app.db` with Pool, runs migrations on startup |
| Provider registry | `services/collectors/provider-registry.ts` | Map-based ESM singleton for DataProvider registration |
| Normalizers | `services/data/normalizers.ts` | `normalizeNutritionRow`, `normalizeHevyRow`, `normalizeBiometricsRow` |
| Ingest layer | `services/data/ingest.ts` | 500-row batch INSERT with ON CONFLICT upsert |
| Cronometer | `services/collectors/cronometer/` | GWT auth session + CSV export + nutrition/biometrics providers |
| Hevy | `services/collectors/hevy/` | REST API client + workout flattener + provider |
| Pipeline | `services/collectors/pipeline.ts` | Sequential provider execution with incremental fetch |
| Collect route | `routes/collect.ts` | `POST /api/collect` with X-API-Key middleware |
| API key guard | `middleware/api-key.ts` | `apiKeyMiddleware` preHandler |

## Tasks

1. Commit pending frontend fix (`tsc --noEmit`)
2. Database schema and migration runner
3. Database connection pool and helpers
4. Fastify database plugin
5. Provider registry
6. Normalizers (TDD)
7. Ingest layer (batch insert)
8. Cronometer collector
9. Hevy collector
10. Collection pipeline and POST /api/collect route
11. Integration tests

## Code Review Fixes Applied

**Critical:**
- CookieJar: `indexOf('=')` for base64 cookie values
- Providers: preserve `lastSuccessfulFetch` from previous metadata on error
- Move initial `saveCollectionMetadata` inside try block
- `gwtTokenRegex`: non-greedy `.*?`

**Important:**
- `distance_meters` ternary operator precedence bug
- Add `tags` column to `ingestWorkoutSets` (COL_COUNT 12→13)
- `console.warn` for swallowed `refreshDailyAggregates` error
- `return` before `reply.send()` in API key middleware

**Minor:**
- `connectionTimeoutMillis: 5000` on pool
- Merge duplicate imports in pipeline.ts

## Dependencies Added

- `fastify-plugin: ^5.0.0`
- `csv-parse: ^6.1.0`
