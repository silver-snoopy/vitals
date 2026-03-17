# Vitals — Architecture

## System Overview

```
                         ┌─────────────┐
                         │   Frontend   │  React + Vite + Tailwind
                         │   (Vercel)   │  React Query for data fetching
                         └──────┬──────┘
                                │ REST API (CORS) + WebSocket
                         ┌──────▼──────┐
                         │   Backend    │  Fastify + TypeScript
                         │  (Railway)   │  Port 3001
                         └──┬───┬───┬──┘
                            │   │   │
               ┌────────────┘   │   └────────────┐
               │                │                 │
        ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
        │  PostgreSQL  │  │  Claude AI  │  │   n8n       │
        │  (Railway)   │  │  (Anthropic)│  │  (Cloud)    │
        └─────────────┘  └────────────┘  └─────────────┘
```

## Package Structure

| Package | Purpose | Tech |
|---------|---------|------|
| `@vitals/shared` | TypeScript types, interfaces, constants | TypeScript (no runtime deps) |
| `@vitals/backend` | API server, data collection, AI service | Fastify 5, pg, Anthropic SDK |
| `@vitals/frontend` | Single-page application | React, Vite, Tailwind, Recharts |
| `@vitals/workflows` | n8n workflow JSON definitions | n8n (external) |

**Build order:** shared → backend → frontend (frontend depends on shared types)

## Backend Architecture

```
src/
├── index.ts              Entry point
├── app.ts                Fastify factory (registers plugins + routes)
├── config/env.ts         EnvConfig interface + loadEnv()
├── plugins/
│   └── database.ts       pg.Pool as Fastify decorator (app.db)
├── middleware/
│   └── api-key.ts        X-API-Key header guard
├── routes/               Fastify route plugins
│   ├── health.ts         GET /health
│   ├── collect.ts        POST /api/collect, GET /api/collect/status
│   ├── nutrition.ts      GET /api/nutrition/daily        (Phase 3)
│   ├── measurements.ts   GET /api/measurements           (Phase 3)
│   ├── workouts.ts       GET /api/workouts               (Phase 3)
│   ├── dashboard.ts      GET /api/dashboard/weekly       (Phase 3)
│   ├── reports.ts        GET/POST /api/reports            (Phase 3)
│   ├── ws-reports.ts     WS /ws/reports/:reportId         (async status)
│   └── upload.ts         POST /api/upload/apple-health   (Phase 3)
├── db/
│   ├── pool.ts           Singleton pg.Pool
│   ├── helpers.ts        Collection metadata CRUD
│   ├── migrate.ts        SQL migration runner
│   ├── migrations/       Ordered .sql files
│   └── queries/          Query functions (Phase 3)
└── services/
    ├── data/
    │   ├── normalizers.ts   Raw data → typed rows
    │   └── ingest.ts        Batch INSERT with upsert
    ├── collectors/
    │   ├── provider-registry.ts   DataProvider registry
    │   ├── pipeline.ts            Collection orchestrator
    │   ├── register.ts            Provider instantiation
    │   ├── cronometer/            Nutrition + biometrics scraper
    │   ├── hevy/                  Workout API client
    │   └── apple-health/          XML upload parser (Phase 3)
    ├── report-event-bus.ts  In-process pub/sub for report status
    ├── report-runner.ts     Background report orchestrator
    └── ai/
        ├── claude-provider.ts     AIProvider implementation (Claude)
        ├── gemini-provider.ts     AIProvider implementation (Gemini)
        ├── ai-service.ts          Provider factory (AI_PROVIDER env)
        ├── report-generator.ts    Report orchestration (data fetch + AI call + save)
        ├── prompt-builder.ts      Data formatting + prompt assembly
        ├── prompt-loader.ts       Loads .md prompt files at startup
        └── prompts/               3-file prompt architecture
            ├── persona.md         Role, tone, analytical rules
            ├── analysis-protocol.md  5-step data processing order
            └── output-format.md   JSON schema for 8-section report
```

## Data Model

### Tables

| Table | Purpose | Key Pattern |
|-------|---------|-------------|
| `measurements` | EAV store for nutrition + biometrics | Unique: `(user_id, source, metric, measured_at)` |
| `workout_sets` | Individual exercise sets (flat, no session ID) | Unique: `(user_id, source, exercise_name, set_index, COALESCE(started_at, epoch))` |
| `collection_metadata` | Provider sync state | PK: `(user_id, provider_name)` |
| `weekly_reports` | AI-generated weekly analyses | JSONB: insights, action_items, data_coverage, sections |
| `ai_generations` | AI call audit trail | Token usage tracking |
| `apple_health_imports` | File upload tracking | Status: pending → processing → completed/failed |
| `daily_aggregates` | Materialized view for dashboard | Refreshed after each collection run |

### EAV Pattern (measurements table)

The `measurements` table uses Entity-Attribute-Value to store both nutrition macros and biometric readings in a single table:

```
category='nutrition', metric='calories',  value=2000, unit='kcal'
category='nutrition', metric='protein_g', value=150,  unit='g'
category='biometric', metric='weight_kg', value=82.5, unit='kg'
```

**Why EAV:** Flexibility for arbitrary metrics without schema changes. New data sources (Apple Health, wearables) add new metrics without migrations.

**Trade-off:** Pivot queries needed for nutrition summaries (conditional aggregation: `SUM(CASE WHEN metric='calories' THEN value END)`).

### Idempotent Upserts

All ingestion uses `INSERT ... ON CONFLICT DO UPDATE` with unique indexes. This allows safe re-ingestion of the same date range without duplicates.

### Workout Session Grouping

The `workout_sets` table has no explicit session ID. Sessions are derived at query time by grouping sets with the same `(DATE(started_at), source)`. This avoids a separate sessions table and handles Hevy's flat API response naturally.

## Data Flow

### Collection Pipeline

```
Cronometer/Hevy API
        │
        ▼
   Raw data (CSV/JSON)
        │
        ▼
   Normalizers ──────► MeasurementRow[] / WorkoutSetRow[]
        │
        ▼
   Batch Ingest (500 rows) ──► ON CONFLICT upsert
        │
        ▼
   refreshDailyAggregates()
```

- Providers execute **sequentially** to respect API rate limits
- Pipeline supports **incremental fetch** via `last_successful_fetch` from collection_metadata
- Each batch runs in a **transaction** (BEGIN/COMMIT/ROLLBACK)

### Report Generation (Async)

```
POST /api/reports/generate
        │
        ▼
  createPendingReport() → 202 { reportId, status: 'pending' }
        │
        ▼
  runReportInBackground() ─── fire-and-forget IIFE
        │
        ├── emit('collecting_data') → updateReportStatus()
        │   └── runCollection() + query data
        │
        ├── emit('generating') → updateReportStatus()
        │   └── gatherAndGenerate() → AI call
        │
        ├── emit('completed') → completeReport()
        │   └── Report saved with full content
        │
        └── on error: emit('failed') → updateReportStatus()

  WebSocket /ws/reports/:reportId
        │
        ▼
  ReportEventBus.subscribe(reportId) → stream updates to client
```

**Sync fallback:** `?sync=true` preserves old blocking behavior for n8n workflows.

**Race condition prevention:** WS handler subscribes to EventBus BEFORE reading DB status, ensuring no events are missed between DB read and subscription.

## API Endpoints

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/health` | None | Live |
| POST | `/api/collect` | X-API-Key | Live |
| GET | `/api/collect/status` | X-API-Key | Live |
| GET | `/api/nutrition/daily` | None | Phase 3 |
| GET | `/api/measurements` | None | Phase 3 |
| GET | `/api/workouts` | None | Phase 3 |
| GET | `/api/workouts/progress/:name` | None | Phase 3 |
| GET | `/api/dashboard/weekly` | None | Phase 3 |
| POST | `/api/reports/generate` | X-API-Key | Phase 3 |
| WS | `/ws/reports/:reportId` | Token query param | Live |
| GET | `/api/reports` | None | Phase 3 |
| GET | `/api/reports/:id` | None | Phase 3 |
| POST | `/api/upload/apple-health` | X-API-Key | Phase 3 |

## Authentication

- **n8n webhooks:** `X-API-Key` header (compared against `N8N_API_KEY` env var)
- **Frontend:** CORS-based (no auth token — single-user app)
- **AI API:** Anthropic API key (`ANTHROPIC_API_KEY` env var)
- **Cronometer:** Cookie-based GWT session auth (username/password + CSRF). Auth flow:
  1. `GET /login/` (trailing slash required — `/login` returns empty body) → extract `anticsrf` CSRF token from HTML
  2. `POST /login` with credentials + CSRF → 302 redirect on success, JSON `{"error":"..."}` on failure
  3. `POST /cronometer/app` GWT RPC → `authenticate` call returns numeric `userId`
  4. `POST /cronometer/app` GWT RPC → `generateAuthorizationToken` call returns export token
  5. `GET /export?nonce=<token>&generate=dailySummary` → CSV download

  Rate-limit detection: login endpoint returns `{"error":"Too Many Attempts..."}` JSON or HTML containing "too many attempts"/"try again later" — both are caught and thrown before any retry.
- **Hevy:** REST API key in `api-key` header

## Deployment

| Component | Target | Notes |
|-----------|--------|-------|
| Backend | Railway | Auto-deploy from git, Railway PostgreSQL add-on |
| Frontend | Vercel | Auto-deploy, `VITE_API_URL` points to Railway |
| Workflows | n8n Cloud | Import via REST API scripts |
| Database | Railway PostgreSQL | Migrations run on backend startup |

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20+ |
| Language | TypeScript | 5.x |
| Backend framework | Fastify | 5.x |
| Database | PostgreSQL | 16 |
| DB driver | pg | 8.x |
| Frontend framework | React | 18.x |
| Build tool | Vite | 6.x |
| CSS | Tailwind CSS | 4.x |
| UI components | shadcn/ui | latest |
| Charts | Recharts | latest |
| AI SDK | @anthropic-ai/sdk | latest |
| WebSocket | @fastify/websocket | latest |
| Testing | Vitest | 3.x |
| Orchestration | n8n | Cloud |
