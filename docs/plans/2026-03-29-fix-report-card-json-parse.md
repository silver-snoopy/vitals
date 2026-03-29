# Plan: Fix Report Card Broken Rendering (JSON Parse Failure)

**Date:** 2026-03-29
**Type:** Bugfix
**UC:** UC-RPT-01, UC-RPT-02

## Context

The report card shows "AI-generated weekly summary." (placeholder) instead of the actual
AI-generated summary. Root cause: the AI response contains unescaped straight double-quote
characters (char 34) inside JSON string values (e.g., `"adequate"` written as `"adequate"`
instead of `\"adequate\"`). This causes both `JSON.parse()` and the brace-matching
`extractFirstJson()` fallback to fail, triggering the catch block which returns the placeholder.

Evidence: Report `7f38fa74` has `status: completed`, `insights: 26657 chars` (raw AI content),
`summary: "AI-generated weekly summary."` — all consistent with the catch path.

## Tasks

1. Install `jsonrepair` in `packages/backend`
2. Add `jsonrepair` repair step in `parseAIResponse()` between direct parse and `extractFirstJson`
3. Add a JSON escaping note to `packages/backend/src/services/ai/prompts/output-format.md`
4. Add/update unit tests in report-generator tests covering unescaped-quote parse failure
5. Run build, lint, format, tests
6. Live verification: generate report on live local system, screenshot card rendering

## Files to Create/Modify

| File | Change |
|------|--------|
| `packages/backend/package.json` | Add `jsonrepair` dependency |
| `packages/backend/src/services/ai/report-generator.ts` | Import jsonrepair; add repair step in `parseAIResponse` |
| `packages/backend/src/services/ai/prompts/output-format.md` | Add JSON escaping instruction |
| `packages/backend/src/services/ai/__tests__/report-generator.test.ts` | Add test for unescaped-quote parse recovery |

## Dependencies

- `jsonrepair` — npm package, ~15 KB, zero dependencies, handles unescaped quotes, trailing commas, etc.

## Tests

- Unit: Add test to `report-generator.test.ts` that passes AI response with unescaped quotes in string values and verifies summary is extracted correctly
- Live: Navigate to /reports on local dev, confirm newest card shows real summary text

## Risks

- `jsonrepair` may over-eagerly repair malformed input and produce incorrect JSON. This is mitigated by trying `JSON.parse` first and only using `jsonrepair` as a middle step before the brace-matcher.
- The prompt change alone won't fix existing broken reports already in the DB. Those need to be left as-is or re-generated.
