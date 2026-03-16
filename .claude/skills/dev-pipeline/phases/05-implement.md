# Phase 5: Implement

## Prerequisites
- User has approved the implementation approach (USER GATE passed)
- Research findings are available from Phase 3

## Implementation Rules

### Follow CLAUDE.md Conventions
- 2-space indentation (TypeScript/React)
- `interface` over `type` for object shapes
- `import type` for type-only imports
- Fastify plugin pattern for routes
- Direct parameterized SQL (no ORM)
- Zustand for frontend state
- TanStack Query for server state

### Build Order
Always build in dependency order:
1. `@vitals/shared` — types and interfaces first
2. `@vitals/backend` — routes, services, queries
3. `@vitals/frontend` — components, hooks, pages

### Code Quality
- No `any` types in production code (warn level)
- Prefix unused variables with `_`
- Use existing UI components from `components/ui/` (shadcn/Base UI)
- Base UI uses `render` prop, NOT `asChild` (Radix pattern)
- Reuse existing API hooks pattern from `packages/frontend/src/api/hooks/`

### After Writing Code
Run a build check after each significant change:
```bash
npm run build
```

Fix any TypeScript errors before proceeding.

## Checklist
- [ ] Shared types updated (if needed)
- [ ] Backend changes implemented (if needed)
- [ ] Frontend changes implemented (if needed)
- [ ] `npm run build` passes with 0 errors
