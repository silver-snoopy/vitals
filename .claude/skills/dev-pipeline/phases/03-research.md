# Phase 3: Research & Understand

## Purpose
Understand the affected code deeply before writing anything.
Actively search for existing functions, utilities, and patterns that can be reused.

## Preferred: Launch Explore Agents

Spawn up to 3 Explore agents IN PARALLEL (single message, multiple Agent tool calls):

### Agent 1: Existing Implementation
- Find all files related to the affected feature
- Trace the execution path (route → handler → service → DB query)
- Identify the exact code that needs to change

### Agent 2: Related Patterns
- How are similar features implemented elsewhere?
- What conventions does the codebase follow for this type of change?
- Are there test patterns to follow?

### Agent 3: Reusable Utilities
- Check `packages/shared/` for existing types and interfaces
- Check for existing hooks, components, helpers
- Check for existing test fixtures and mocks

## Fallback: Manual Research

If explore agents are unavailable, cover the same three scopes manually:
- Existing implementation
- Related patterns
- Reusable utilities

Capture enough detail to support the user gate:
- Relevant file paths
- Key functions, routes, services, queries, hooks, or components
- Reusable patterns to follow
- Open questions or decisions requiring user approval

## Key Locations to Search

### Backend
- Routes: `packages/backend/src/routes/`
- DB queries: `packages/backend/src/db/queries/`
- Services: `packages/backend/src/services/`
- Normalizers: `packages/backend/src/services/normalizers/`
- Config: `packages/backend/src/config/env.ts`

### Frontend
- Pages: `packages/frontend/src/components/`
- API hooks: `packages/frontend/src/api/hooks/`
- State stores: `packages/frontend/src/store/`
- UI components: `packages/frontend/src/components/ui/`

### Shared
- Types: `packages/shared/src/types/`
- Interfaces: `packages/shared/src/interfaces/`
- Constants: `packages/shared/src/constants/`

### Tests
- Backend tests: `packages/backend/src/**/__tests__/`
- Frontend tests: `packages/frontend/src/**/__tests__/`
- E2E tests: `e2e/`
- E2E fixtures: `e2e/fixtures/`
- E2E page objects: `e2e/pages/`

## Output
Present findings to the user including:
- Files that need to change (with line references)
- Existing utilities/patterns to reuse
- Proposed implementation approach
- Any design decisions that need user input

## Checklist
- [ ] Research covers implementation, related patterns, and reusable utilities
- [ ] Findings are ready for the user gate
- [ ] Proposed approach is specific enough for user approval
