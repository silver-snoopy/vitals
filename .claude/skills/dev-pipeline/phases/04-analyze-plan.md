# Phase 4: Analyze & Plan

## Phase Policy

**Hard requirement:** Produce a concrete written implementation plan that is specific enough to execute without ambiguity.
**Preferred mechanism:** Spawn a plan agent with the approved context and use its output to draft the plan file.
**Allowed fallback:** If a plan agent is unavailable, write the plan directly. The plan contents and output file are still mandatory.

## Purpose
Translate the approved approach into a concrete, step-by-step implementation plan.
This plan becomes the single source of truth for Phase 5 (Implement).

## Preferred: Launch Plan Agent

Spawn a Plan agent with:
- All research context from Phase 3 (file paths, code traces, existing patterns)
- The approved approach and any user feedback from the user gate
- Acceptance criteria from Phase 1

## Fallback: Write the Plan Directly

If a plan agent is unavailable, draft the plan manually using the same inputs:
- Research context from Phase 3
- Approved approach and user feedback
- Acceptance criteria from Phase 1

## Plan Structure

Write the plan to: `docs/plans/<YYYY-MM-DD>-<feature-slug>.md`

The plan file must include:

### 1. Context
- Why this change is being made
- What prompted it (spec reference, bug report, user request)
- Intended outcome

### 2. Ordered Task List
Break the work into discrete, sequential tasks respecting build order:
1. `@vitals/shared` — types and interfaces (if needed)
2. `@vitals/backend` — routes, services, queries (if needed)
3. `@vitals/frontend` — components, hooks, pages (if needed)

Each task should specify:
- **What:** Description of the change
- **Where:** Exact file path(s) to create or modify
- **How:** Key implementation details, functions to reuse, patterns to follow

### 3. Files to Create/Modify
Table format:
| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types/foo.ts` | Create | New interface for ... |
| `packages/backend/src/routes/bar.ts` | Modify | Add new endpoint ... |

### 4. Dependencies
- New npm packages needed (if any)
- New environment variables (if any)

### 5. Test Strategy
- Unit tests to write or update
- E2E tests to write (reference UC IDs from product-capabilities.md)
- Edge cases to cover

### 6. Risk Areas
- Anything that could break existing functionality
- Migration concerns
- Performance implications

## Checklist
- [ ] Plan completed with either the preferred mechanism or fallback
- [ ] Plan file written to `docs/plans/`
- [ ] Tasks are ordered by dependency (shared → backend → frontend)
- [ ] Each task is specific enough to execute without ambiguity
- [ ] Test strategy covers acceptance criteria
