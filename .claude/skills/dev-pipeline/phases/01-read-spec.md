# Phase 1: Read Spec

## Phase Policy

**Hard requirement:** Understand the request well enough to state the goal, acceptance criteria, affected areas, and likely use cases.
**Preferred mechanism:** Read the referenced spec or plan file directly when the input is a path.
**Allowed fallback:** If a dedicated read helper is unavailable, use any available file-reading mechanism. The outcome is mandatory even if the helper tool is not.

## Input Handling

### File path input
If the argument looks like a file path (contains `/`, `\`, or ends in `.md`):
1. Read the file
2. Parse the content for goal, acceptance criteria, and scope

### Text description input
If the argument is plain text:
1. Treat it as the feature/bug description
2. Ask clarifying questions if the description is ambiguous

### Spec file locations
Check these locations for existing specs:
- `docs/plans/` — Implementation plans (dated)
- `docs/research/` — Decision records
- The argument itself as a path

## Output Format

Present to the user:

```
## Spec Summary

**Type:** feature | bugfix | refactor
**Goal:** <one-sentence summary>

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Affected Areas:**
- packages/<name> — <what changes>

**Related Use Cases:** UC-XXX-XX (from docs/product-capabilities.md)
```

## Checklist
- [ ] Input is read and understood
- [ ] Type is identified (feature/bugfix/refactor)
- [ ] Goal is clearly stated
- [ ] Acceptance criteria are enumerated
- [ ] Affected packages/areas are identified
