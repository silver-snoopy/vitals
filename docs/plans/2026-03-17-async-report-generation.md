# Async Report Generation via WebSocket

**Date:** 2026-03-17
**Type:** Feature
**Status:** Draft

## Context

Report generation (`POST /api/reports/generate`) currently blocks for 15-90 seconds while gathering data and calling the LLM. The user stares at a spinner with no progress indication. This plan introduces async generation with WebSocket-based real-time status updates.

**Flow:** User clicks "Generate" → POST returns immediately (202) with `reportId` → frontend connects via WebSocket → receives status updates (`collecting_data` → `generating` → `completed`) → report appears automatically.

## Tasks

### 1. Shared Types (`@vitals/shared`)

**1.1** Add `ReportStatus` type and `ReportStatusUpdate` interface to `packages/shared/src/types/report.ts`:
```typescript
export type ReportStatus = 'pending' | 'collecting_data' | 'generating' | 'completed' | 'failed';

export interface ReportStatusUpdate {
  reportId: string;
  status: ReportStatus;
  message?: string;
}

export interface GenerateReportResponse {
  reportId: string;
  status: ReportStatus;
}
```

**1.2** Add optional `status` and `errorMessage` fields to `WeeklyReport` interface.

**1.3** Build shared: `npm run build -w @vitals/shared`

### 2. Backend - Database Migration

**2.1** Create `packages/backend/src/db/migrations/003_report_status.sql`:
```sql
ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_weekly_reports_status
  ON weekly_reports (user_id, status) WHERE status != 'completed';
```

Existing rows default to `'completed'` (backward compatible).

### 3. Backend - Install Dependency

**3.1** `npm install @fastify/websocket -w @vitals/backend`

### 4. Backend - Report Event Bus

**4.1** Create `packages/backend/src/services/report-event-bus.ts`:
- EventEmitter wrapper with typed events per reportId
- `emit(reportId, update: ReportStatusUpdate)` — publish status change
- `subscribe(reportId, cb)` / `unsubscribe(reportId, cb)` — listen for changes
- Singleton export

### 5. Backend - DB Query Updates

**5.1** Update `packages/backend/src/db/queries/reports.ts`:
- Add `status, error_message` to `REPORT_COLUMNS`
- Update `mapReportRow` to include `status` and `errorMessage`
- Add `createPendingReport(pool, params) → reportId` — INSERT with `status='pending'`, placeholder summary
- Add `updateReportStatus(pool, reportId, status, errorMessage?)` — UPDATE status column
- Add `completeReport(pool, reportId, data)` — UPDATE all content fields + set `status='completed'`
- Update `listReports` to filter out `status='failed'` reports by default

### 6. Backend - Refactor Report Generator

**6.1** In `packages/backend/src/services/ai/report-generator.ts`:
- Extract data-gathering + AI call into `gatherAndGenerate(pool, aiProvider, userId, startDate, endDate, userNotes?, workoutPlan?)` — returns `{ parsed, dataCoverage, result }` without DB writes
- Keep `generateWeeklyReport` as convenience wrapper that calls `gatherAndGenerate` + `saveReport` (backward compat for `?sync=true`)

### 7. Backend - Background Report Runner

**7.1** Create `packages/backend/src/services/report-runner.ts`:
- `runReportInBackground(pool, env, reportId, params)`:
  1. Update status → `collecting_data`, emit via event bus
  2. Run `runCollection()` (best-effort)
  3. Update status → `generating`, emit
  4. Call `gatherAndGenerate()`
  5. Call `completeReport()` to fill pending row, emit `completed`
  6. On error: update status → `failed` with error_message, emit `failed`
- Fire-and-forget (not awaited), all errors caught internally

### 8. Backend - WebSocket Route

**8.1** Create `packages/backend/src/routes/ws-reports.ts`:
- Fastify plugin: `async function wsReportRoutes(app, opts: { env: EnvConfig })`
- Route: `GET /ws/reports` with `{ websocket: true }`
- Auth: validate `token` query param against `opts.env.xApiKey` in preValidation hook
- Extract `reportId` from query string
- On connect: read current status from DB, send immediately (handles race condition)
- Subscribe to event bus for reportId, forward updates as JSON
- On `completed` or `failed`: send final message, close socket (code 1000)
- Clean up event bus subscription on socket close

### 9. Backend - Update POST Route

**9.1** Modify `packages/backend/src/routes/reports.ts`:
- Add `Querystring` type with optional `sync` boolean
- Default behavior (no `?sync=true`):
  - Validate dates + create AI provider (same as now)
  - Call `createPendingReport()` → get reportId
  - Call `runReportInBackground()` (fire-and-forget)
  - Return `202` with `{ data: { reportId, status: 'pending' } }`
- `?sync=true`: preserve current blocking behavior (for n8n/scripts)

### 10. Backend - Register WebSocket Plugin

**10.1** Update `packages/backend/src/app.ts`:
- Import and register `@fastify/websocket` (before routes)
- Import and register `wsReportRoutes`

### 11. Frontend - WebSocket Hook

**11.1** Create `packages/frontend/src/api/hooks/useReportWebSocket.ts`:
- `useReportWebSocket(reportId: string | null, onUpdate: (msg: ReportStatusUpdate) => void)`
- Build WS URL from `VITE_API_URL` (replace http→ws), append `?reportId=<id>&token=<key>`
- Connect when reportId is non-null, disconnect on null/unmount
- Parse incoming JSON messages, call `onUpdate`
- Reconnect on close (3 attempts, exponential backoff)
- Close cleanly when `completed` or `failed` received

### 12. Frontend - Generation Status Store

**12.1** Create `packages/frontend/src/stores/useReportGenerationStore.ts`:
- Zustand store:
  ```typescript
  interface ReportGenerationState {
    pendingReportId: string | null;
    status: ReportStatus | null;
    statusMessage: string | null;
    startGeneration: (reportId: string) => void;
    updateStatus: (status: ReportStatus, message?: string) => void;
    reset: () => void;
  }
  ```

### 13. Frontend - Update Mutation Hook

**13.1** Update `packages/frontend/src/api/hooks/useReports.ts`:
- `useGenerateReport` mutation now expects `{ data: GenerateReportResponse }` response
- Remove `onSuccess` query invalidation (will happen when WS reports `completed`)
- Return the response so callers can read `reportId`

### 14. Frontend - Update GenerateReportDialog

**14.1** Modify `packages/frontend/src/components/reports/GenerateReportDialog.tsx`:
- After mutation returns 202: switch dialog to "progress view" (keep dialog open)
- Show stepped progress: "Collecting data..." → "Generating report..." → "Complete!"
- Use `useReportWebSocket` to subscribe to status updates
- Use `useReportGenerationStore` to persist state across re-renders
- On `completed`: invalidate report queries, close dialog, toast success
- On `failed`: show error in dialog, offer retry button
- Prevent closing dialog while generation is in progress (warn user)

### 15. Frontend - Update ReportsPage

**15.1** Modify `packages/frontend/src/components/reports/ReportsPage.tsx`:
- Read from `useReportGenerationStore` to show pending report placeholder
- Show a skeleton card with status indicator when generation is in progress
- Remove the old `generateReport.isPending` spinner from the header button (now handled by dialog/store)

## Files to Create/Modify

| Action | Path | Description |
|--------|------|-------------|
| **Modify** | `packages/shared/src/types/report.ts` | Add `ReportStatus`, `ReportStatusUpdate`, `GenerateReportResponse`; add `status?` to `WeeklyReport` |
| **Create** | `packages/backend/src/db/migrations/003_report_status.sql` | Add `status` + `error_message` columns |
| **Create** | `packages/backend/src/services/report-event-bus.ts` | EventEmitter pub/sub for report status |
| **Create** | `packages/backend/src/services/report-runner.ts` | Background report orchestrator |
| **Create** | `packages/backend/src/routes/ws-reports.ts` | WebSocket route for status streaming |
| **Modify** | `packages/backend/src/app.ts` | Register `@fastify/websocket` + WS route |
| **Modify** | `packages/backend/src/routes/reports.ts` | POST returns 202 async; `?sync=true` compat |
| **Modify** | `packages/backend/src/db/queries/reports.ts` | Add pending/status/complete queries; update columns |
| **Modify** | `packages/backend/src/services/ai/report-generator.ts` | Extract `gatherAndGenerate` |
| **Create** | `packages/frontend/src/api/hooks/useReportWebSocket.ts` | WebSocket connection hook |
| **Create** | `packages/frontend/src/stores/useReportGenerationStore.ts` | Zustand store for generation state |
| **Modify** | `packages/frontend/src/api/hooks/useReports.ts` | Update mutation for 202 response |
| **Modify** | `packages/frontend/src/components/reports/GenerateReportDialog.tsx` | Progress UI with status stages |
| **Modify** | `packages/frontend/src/components/reports/ReportsPage.tsx` | Pending report placeholder |

## Dependencies

| Package | Dependency | Version |
|---------|-----------|---------|
| `@vitals/backend` | `@fastify/websocket` | `^11.0.0` |

No frontend dependencies needed — uses native `WebSocket` API.

## Test Strategy

### Unit Tests (Vitest)

1. `report-event-bus.test.ts` — emit/subscribe/unsubscribe, cleanup on unsubscribe
2. `report-runner.test.ts` — mock DB + AI + event bus; verify status transitions; verify error → `failed`
3. `ws-reports.test.ts` — auth rejection without token; connection setup
4. `reports.test.ts` (update) — POST returns 202 with reportId; `?sync=true` returns 200 with full report
5. `reports queries` (update) — test `createPendingReport`, `updateReportStatus`, `completeReport`
6. `useReportWebSocket.test.ts` — mock WebSocket, verify connect/disconnect/message parsing
7. `useReportGenerationStore.test.ts` — Zustand store state transitions

### E2E Tests (Playwright)

8. `report-generation-async.spec.ts`:
   - Intercept POST `/api/reports/generate` to return 202
   - Mock WebSocket with scripted status messages
   - Verify progress UI shows each status stage
   - Verify report appears after `completed` status

## Risks

1. **Race condition:** Client connects WS after background task already completed. **Mitigation:** WS handler reads current status from DB on connect and sends immediately.

2. **Process crash mid-generation:** Report stuck in `pending`/`generating` forever. **Mitigation (v2):** Add startup sweeper for stale in-progress reports. Not blocking for v1.

3. **WebSocket through proxy:** Railway supports WS upgrades natively. Frontend on Vercel connects directly to Railway backend. Should work without config. Verify in production.

4. **Memory leak:** EventEmitter listeners not cleaned up. **Mitigation:** Always unsubscribe in WS `close` handler.

5. **Backward compatibility:** `?sync=true` query param preserves blocking behavior for n8n workflows and scripts.
