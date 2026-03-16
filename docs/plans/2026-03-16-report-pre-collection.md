# Report Pre-Collection & Collection Status

**Date:** 2026-03-16
**Type:** bugfix + enhancement
**Ref:** docs/plans/2026-03-16-debug-report-data-collection.md

## Problem

Report generation only queries existing DB data. If the n8n daily collection schedule fails, reports contain empty/stale data.

## Solution

### Phase 2: Pre-collection in report generation

**File:** `packages/backend/src/routes/reports.ts`
- After date validation, before AI provider creation, call `runCollection()` with the report's date range
- Best-effort: catch errors, log them, continue with existing data
- Providers are already registered at app startup in `app.ts:32`

### Phase 3: Collection status endpoint + frontend warning

**Backend — `packages/backend/src/routes/collect.ts`:**
- Add `GET /api/collect/status` endpoint (API key protected)
- Query `collection_metadata` table for all providers for the default user
- Return array of `CollectionStatus` objects

**Shared — `packages/shared/src/`:**
- Add `CollectionStatus` interface
- Add `collection` query key to `QUERY_KEYS`

**Frontend:**
- Add `useCollectionStatus` hook in `packages/frontend/src/api/hooks/useCollectionStatus.ts`
- Add `StaleDataWarning` component — inline banner shown when any provider's last successful fetch > 24h ago
- Render in `ReportsPage.tsx` above the reports list

## Files to Modify/Create

| File | Action |
|------|--------|
| `packages/backend/src/routes/reports.ts` | Add runCollection call |
| `packages/backend/src/routes/collect.ts` | Add GET /api/collect/status |
| `packages/backend/src/db/helpers.ts` | Add loadAllCollectionMetadata query |
| `packages/shared/src/constants/query-keys.ts` | Add collection key |
| `packages/shared/src/interfaces/` | Add CollectionStatus type + export |
| `packages/frontend/src/api/hooks/useCollectionStatus.ts` | New hook |
| `packages/frontend/src/components/reports/StaleDataWarning.tsx` | New component |
| `packages/frontend/src/components/reports/ReportsPage.tsx` | Add warning |

## Test Strategy

- Unit test: reports route pre-collection (mock runCollection, verify it's called)
- Unit test: collect status endpoint
- Unit test: StaleDataWarning renders/hides based on data
- Existing tests must continue to pass
