---
name: dev-pipeline
description: End-to-end delivery pipeline for the vitals monorepo. Use when the user wants a feature, bugfix, or refactor carried from a spec file or description through research, implementation, live/local verification, documentation updates, and pull request creation.
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
    → USER GATE → Phase 4: Analyze & Plan → PLAN GATE
    → Phase 5: Implement → Phase 6: Code Review → Phase 7: QA Test
    → Phase 8: Update Docs → Phase 9: Commit & PR
```

## Execution Policy

Treat each phase's **exit criteria** as the hard requirement unless the phase explicitly says it is optional.
Do NOT skip a phase just because a named tool, agent type, or helper skill is unavailable.

For every phase, distinguish between:
- **Hard requirement** — the outcome that must be achieved before proceeding
- **Preferred mechanism** — the default tool or workflow to achieve that outcome
- **Allowed fallback** — the substitute method to use if the preferred mechanism is unavailable

Fallbacks may change *how* the work is done, but they must not lower the quality bar of the phase.
Examples:
- If an explore agent is unavailable, do equivalent repo investigation manually
- If `AskUserQuestion` is unavailable, ask in normal chat and stop until approval is received
- If a plan agent is unavailable, write the plan directly
- If review agents are unavailable, perform a structured self-review across logic, conventions, and security

Non-degradable quality gates remain hard requirements:
- Live local reproduction for bugfixes when the bug is reproducible in the running system
- Live local verification with screenshot evidence for user-visible UI changes
- Build, lint, format, unit, and E2E validation required by the phase
- Documentation updates required by the change

---

## Phase 1: Read Spec

Read and parse the input to understand what needs to be done.

**If `$ARGUMENTS` is a file path:** Read it directly.
**If `$ARGUMENTS` is a description:** Use it directly.

Extract and present to the user:
- **Type:** feature | bugfix | refactor
- **Goal:** One-sentence summary
- **Acceptance criteria:** Bullet list of what "done" looks like
- **Affected areas:** Which packages/features are likely impacted

**Hard requirement:** Understand the request well enough to clearly state goal, acceptance criteria, and affected areas.
**Preferred mechanism:** Read the spec file directly when `$ARGUMENTS` is a path.
**Allowed fallback:** If a dedicated read helper is unavailable, use any available file-reading mechanism. The outcome is mandatory; the specific tool is not.

For detailed instructions, see [phases/01-read-spec.md](phases/01-read-spec.md).

**Exit criteria:** Goal and acceptance criteria are clearly stated.

---

## Phase 2: QA Verify (bugs only)

**Skip this phase for features and refactors.**

For bugs: reproduce the issue on the **live local environment** (docker compose + dev servers) by exercising the affected feature through the real UI via Playwright. Mocked E2E tests are NOT sufficient — the bug must be reproduced against the actual running system with a screenshot captured as evidence.

**Hard requirement:** For bugfixes, reproduce the bug against the live local system and capture evidence before implementing a fix. If the bug is visible in the UI, reproduce it through the real UI.
**Preferred mechanism:** Start the full local stack and use Playwright against the real frontend and backend.
**Allowed fallback:** If the preferred automation path is unavailable, use another method that still exercises the live local system and preserves evidence quality. For backend-only bugs with no UI component, live API reproduction is acceptable. Mocked tests are never a substitute for this phase.

For detailed instructions, see [phases/02-qa-verify.md](phases/02-qa-verify.md).

**Exit criteria:** Bug is reproduced on the live UI with screenshot evidence, or explicitly marked as not reproducible with explanation of what was tried.

---

## Phase 3: Research & Understand

Prefer launching up to 3 Explore agents IN PARALLEL to understand the affected code:

1. **Existing implementation** — Find the files, functions, and patterns involved
2. **Related patterns** — How similar features are implemented elsewhere in the codebase
3. **Reusable utilities** — Existing helpers, hooks, components that can be reused

**Hard requirement:** Research the existing implementation, similar patterns, and reusable utilities well enough to propose an implementation approach.
**Preferred mechanism:** Launch up to 3 parallel explore agents with split responsibilities.
**Allowed fallback:** If explore agents are unavailable, do the same investigation manually with repo search, file inspection, and targeted notes. Coverage of the research areas is mandatory even if parallelism is unavailable.

For detailed instructions, see [phases/03-research.md](phases/03-research.md).

**Exit criteria:** Present findings to the user with a proposed implementation approach.

---

## ◆ USER GATE ◆

**STOP HERE.** Present your research findings and implementation plan to the user.
Get explicit approval before writing any code. Prefer `AskUserQuestion` when it is available.

Include in your presentation:
- Summary of research findings
- Proposed approach (files to create/modify)
- Any design decisions that need user input
- Estimated scope (small / medium / large)

**Hard requirement:** Obtain explicit user approval before proceeding to implementation planning and code changes.
**Preferred mechanism:** Use `AskUserQuestion`.
**Allowed fallback:** If that tool is unavailable, ask in the normal chat and stop until the user clearly approves. Do not infer approval.

**Do NOT proceed to Phase 4 until the user approves.**

---

## Phase 4: Analyze & Plan

Write a detailed implementation plan based on the approved approach from the user gate.

Prefer launching a Plan agent to design the implementation:
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

**Hard requirement:** Produce a concrete written plan that is specific enough to execute without ambiguity.
**Preferred mechanism:** Use a plan agent to draft the implementation plan.
**Allowed fallback:** If a plan agent is unavailable, write the plan directly. The required plan contents and output file are still mandatory.

For detailed instructions, see [phases/04-analyze-plan.md](phases/04-analyze-plan.md).

**Exit criteria:** Implementation plan is written to a plan file. Each task is specific enough to execute without ambiguity.

---

## ◆ PLAN GATE ◆

**MANDATORY:** Before proceeding to Phase 5, verify:
1. A plan file exists at `docs/plans/<YYYY-MM-DD>-<feature-slug>.md` — confirm with Glob or `ls`
2. The plan file contains all 6 required sections (Context, Tasks, Files, Dependencies, Tests, Risks)
3. Report the plan file path to the user

**If the file is missing or incomplete, return to Phase 4 and complete it. Do NOT proceed to Phase 5 without a verified plan file on disk.**

---

## Phase 5: Implement

Write the code following the plan from Phase 4 and project conventions from CLAUDE.md.

**Hard requirement:** Implement the approved plan while following repo conventions, and leave the code compiling successfully.
**Preferred mechanism:** Follow the written plan in dependency order and run `npm run build` after significant changes.
**Allowed fallback:** You may adjust the implementation sequence if needed, but you must preserve the approved intent, follow conventions, and finish with a passing build.

For detailed instructions, see [phases/05-implement.md](phases/05-implement.md).

**Exit criteria:** All code changes compile (`npm run build` passes).

---

## Phase 6: Code Review

Prefer spawning 3 review agents IN PARALLEL using the `superpowers:requesting-code-review` skill or the `feature-dev:code-reviewer` agent:

1. **Bugs & logic** — Logic errors, edge cases, null handling
2. **Conventions** — Project patterns from CLAUDE.md, naming, structure
3. **Security** — OWASP top 10, injection, XSS, auth issues

Fix any HIGH or MEDIUM findings before proceeding.

**Hard requirement:** Review the change across logic, conventions, and security; resolve HIGH and MEDIUM findings before moving on.
**Preferred mechanism:** Run 3 parallel review agents with focused scopes.
**Allowed fallback:** If review agents or helper skills are unavailable, perform a structured self-review using the same three lenses and document findings before fixing them. The review gate remains mandatory even if the reviewers are manual.

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
6. **If UI is affected (MANDATORY):** Start local dev environment, write a temporary Playwright visual test against the live UI (`http://localhost:3000`), capture screenshots at key states, present them to the user as evidence, then clean up the temporary test and screenshots. This applies to frontend changes, new UI features, AND backend changes that extend API responses consumed by the frontend — if a user would see something different on screen, this step is mandatory.

**Hard requirement:** Complete the automated validation required by the change, and for any user-visible UI impact, verify behavior on the live local environment with screenshot evidence.
**Preferred mechanism:** Use the repo's lint, format, unit, E2E, and Playwright-based live verification workflow.
**Allowed fallback:** If a named helper or exact temporary test workflow is unavailable, use another method only if it preserves the same validation strength. User-visible UI changes must still be verified against the live local environment; mocked tests alone are not sufficient.

**Exit criteria:** All tests pass. New E2E tests written for new interactive behavior. Any change that affects what users see on screen is verified on live local environment with screenshot evidence presented to user.

---

## Phase 8: Update Documentation

Update project documentation to reflect the changes.

For detailed instructions, see [phases/08-update-docs.md](phases/08-update-docs.md).

**Required updates:**
1. **`docs/product-capabilities.md`** — Add new use cases or update existing ones with UC IDs, user stories, behavior specs, and E2E coverage references
2. **`CLAUDE.md`** — Update if new conventions, patterns, or project structure changes were introduced
3. **`docs/architecture.md`** — Update if new routes, DB tables, or architectural changes were made

**Hard requirement:** Keep all affected project documentation in sync with the change.
**Preferred mechanism:** Update the standard project docs listed below.
**Allowed fallback:** None for the outcome. The exact files are conditional on the type of change, but if the change affects documented behavior, conventions, or architecture, the corresponding docs must be updated before completion.

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

**Hard requirement:** For full delivery through this pipeline, finish with a clean commit and PR that accurately describe the change and verification performed.
**Preferred mechanism:** Use the standard git workflow and `gh pr create`.
**Allowed fallback:** If PR tooling is unavailable, prepare the exact commit and PR content manually and stop at the last reachable step. Do not fabricate a completed PR if one was not actually created.

**Exit criteria:** PR is created and URL is returned to the user.
