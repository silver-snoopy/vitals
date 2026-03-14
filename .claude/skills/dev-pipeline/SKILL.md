---
name: dev-pipeline
description: Full development pipeline for features and bugfixes. Orchestrates spec reading, QA verification, research, implementation, code review, testing, documentation, and PR creation.
disable-model-invocation: true
argument-hint: <spec-file-or-description>
---

# Development Pipeline

You are executing a structured development pipeline. Follow each phase sequentially.
Do NOT skip phases. Each phase has explicit exit criteria that must be met before proceeding.

**Input:** `$ARGUMENTS` — either a path to a spec/plan file, or a text description of the feature/bugfix.

## Pipeline Overview

```
Phase 1: Read Spec → Phase 2: QA Verify → Phase 3: Research
    → USER GATE → Phase 4: Analyze & Plan → Phase 5: Implement
    → Phase 6: Code Review → Phase 7: QA Test → Phase 8: Update Docs
    → Phase 9: Commit & PR
```

---

## Phase 1: Read Spec

Read and parse the input to understand what needs to be done.

**If `$ARGUMENTS` is a file path:** Read it with the Read tool.
**If `$ARGUMENTS` is a description:** Use it directly.

Extract and present to the user:
- **Type:** feature | bugfix | refactor
- **Goal:** One-sentence summary
- **Acceptance criteria:** Bullet list of what "done" looks like
- **Affected areas:** Which packages/features are likely impacted

For detailed instructions, see [phases/01-read-spec.md](phases/01-read-spec.md).

**Exit criteria:** Goal and acceptance criteria are clearly stated.

---

## Phase 2: QA Verify (bugs only)

**Skip this phase for features and refactors.**

For bugs: reproduce the issue in the local environment before writing any fix.

For detailed instructions, see [phases/02-qa-verify.md](phases/02-qa-verify.md).

**Exit criteria:** Bug is reproduced and confirmed, or explicitly marked as not reproducible with explanation.

---

## Phase 3: Research & Understand

Launch up to 3 Explore agents IN PARALLEL to understand the affected code:

1. **Existing implementation** — Find the files, functions, and patterns involved
2. **Related patterns** — How similar features are implemented elsewhere in the codebase
3. **Reusable utilities** — Existing helpers, hooks, components that can be reused

For detailed instructions, see [phases/03-research.md](phases/03-research.md).

**Exit criteria:** Present findings to the user with a proposed implementation approach.

---

## ◆ USER GATE ◆

**STOP HERE.** Present your research findings and implementation plan to the user.
Use AskUserQuestion to get explicit approval before writing any code.

Include in your presentation:
- Summary of research findings
- Proposed approach (files to create/modify)
- Any design decisions that need user input
- Estimated scope (small / medium / large)

**Do NOT proceed to Phase 4 until the user approves.**

---

## Phase 4: Analyze & Plan

Write a detailed implementation plan based on the approved approach from the user gate.

Launch a Plan agent to design the implementation:
- Provide all research context from Phase 3 (file paths, code traces, patterns found)
- Include the approved approach and any user feedback from the gate
- Request a step-by-step implementation plan with file-level granularity

The plan should include:
1. **Ordered task list** — What to build and in what sequence (respecting build order: shared → backend → frontend)
2. **Files to create/modify** — Exact paths with description of changes per file
3. **Dependencies** — New packages needed (if any)
4. **Test strategy** — What unit tests and E2E tests to write
5. **Risk areas** — Anything that could go wrong or needs extra care

Write the plan to a file: `docs/plans/<date>-<feature-slug>.md`

For detailed instructions, see [phases/04-analyze-plan.md](phases/04-analyze-plan.md).

**Exit criteria:** Implementation plan is written to a plan file. Each task is specific enough to execute without ambiguity.

---

## Phase 5: Implement

Write the code following the plan from Phase 4 and project conventions from CLAUDE.md.

For detailed instructions, see [phases/05-implement.md](phases/05-implement.md).

**Exit criteria:** All code changes compile (`npm run build` passes).

---

## Phase 6: Code Review

Spawn 3 review agents IN PARALLEL using the `superpowers:requesting-code-review` skill or the `feature-dev:code-reviewer` agent:

1. **Bugs & logic** — Logic errors, edge cases, null handling
2. **Conventions** — Project patterns from CLAUDE.md, naming, structure
3. **Security** — OWASP top 10, injection, XSS, auth issues

Fix any HIGH or MEDIUM findings before proceeding.

For detailed instructions, see [phases/06-code-review.md](phases/06-code-review.md).

**Exit criteria:** No unresolved HIGH/MEDIUM findings. Build still passes.

---

## Phase 7: QA Test

Run the full test suite and verify changes work end-to-end.

For detailed instructions, see [phases/07-qa-test.md](phases/07-qa-test.md).

Steps:
1. Run `npm run lint` — must pass with 0 errors
2. Run `npm run format:check` — new/changed files must pass
3. Run `npm test` — all unit tests pass
4. Run `npx playwright test` — all E2E tests pass
5. **If UI changes:** Write new E2E tests covering the new use cases
6. **If applicable:** Start local dev environment and verify visually with Playwright

**Exit criteria:** All tests pass. New E2E tests written for new interactive behavior.

---

## Phase 8: Update Documentation

Update project documentation to reflect the changes.

For detailed instructions, see [phases/08-update-docs.md](phases/08-update-docs.md).

**Required updates:**
1. **`docs/product-capabilities.md`** — Add new use cases or update existing ones with UC IDs, user stories, behavior specs, and E2E coverage references
2. **`CLAUDE.md`** — Update if new conventions, patterns, or project structure changes were introduced
3. **`docs/architecture.md`** — Update if new routes, DB tables, or architectural changes were made

**Exit criteria:** All affected documentation is updated. New features have UC entries.

---

## Phase 9: Commit & PR

Create a clean commit and open a pull request.

For detailed instructions, see [phases/09-commit-pr.md](phases/09-commit-pr.md).

Steps:
1. Stage relevant files (not .env, credentials, or unrelated changes)
2. Commit with conventional message (imperative mood, max 72 chars, reference UC IDs)
3. Push to feature branch
4. Open PR with `gh pr create`:
   - Title: concise summary (under 70 chars)
   - Body: Summary bullets, UC IDs affected, test plan, link to spec file if applicable

**Exit criteria:** PR is created and URL is returned to the user.
