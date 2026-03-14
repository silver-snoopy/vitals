# Phase 7: Update Documentation

## Purpose
Keep project documentation in sync with code changes. Every user-facing change must be reflected in documentation.

## Required: Product Capabilities (`docs/product-capabilities.md`)

### For new features:
Add a new use case entry under the appropriate feature area:

```markdown
### UC-XXX-NN: <Title>

**As a** user, **I want to** <action>,
**so that** <benefit>.

**Behavior:**
- Bullet list of acceptance criteria / observable behavior

**E2E Coverage:** `e2e/<file>.spec.ts` — <test description> (or "None")
```

- Assign the next sequential UC ID within the feature area
- Add the UC to the feature area's summary table
- If a new feature area is needed, create a new section

### For bugfixes:
- Update the affected UC's behavior description if the fix changes observable behavior
- Add E2E coverage reference if a regression test was added

### For refactors:
- No product-capabilities update needed unless behavior changes

## Conditional: CLAUDE.md

Update CLAUDE.md if any of these changed:
- New project conventions or patterns
- New packages or dependencies
- New test patterns or commands
- New environment variables
- Changes to build order or project structure

## Conditional: Architecture (`docs/architecture.md`)

Update architecture.md if any of these changed:
- New API routes
- New database tables or columns
- New services or data flows
- Deployment configuration changes

## Checklist
- [ ] `docs/product-capabilities.md` updated with new/changed UCs
- [ ] `CLAUDE.md` updated (if applicable)
- [ ] `docs/architecture.md` updated (if applicable)
