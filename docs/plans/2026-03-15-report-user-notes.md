# Report User Notes Feature

**Date:** 2026-03-15
**Type:** Feature
**Scope:** Small (frontend-only)

## Goal

Add a textarea to the report generation dialog so users can provide context/notes that influence the AI-generated report.

## Background

The backend already accepts `userNotes` in `GenerateReportRequest` and passes it to the report generator. This is purely a frontend wiring task.

## Changes

### 1. `packages/frontend/src/api/hooks/useReports.ts`
- Change `useGenerateReport` mutationFn to accept `{ userNotes?: string }`
- Include `userNotes` in POST body

### 2. `packages/frontend/src/components/reports/ReportsPage.tsx`
- Add `userNotes` state (useState)
- Always show dialog on generate click (remove skip-dialog for first gen)
- Add Textarea with label "Notes for AI (optional)" and placeholder guidance
- Clear notes when dialog closes
- Pass `userNotes` to `generateReport.mutate()`
- Update dialog title to "Generate Report" (not just "Re-Generate")

## Test Strategy
- Update existing unit tests for ReportsPage
- E2E test: verify textarea is visible in dialog, submit with notes
