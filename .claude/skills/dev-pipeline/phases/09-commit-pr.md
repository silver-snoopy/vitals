# Phase 9: Commit & PR

## Purpose
Create a clean commit and open a pull request targeting master.

## Step 1: Review Changes
```bash
git status
git diff --stat
```
- Verify only intended files are changed
- Do NOT commit: `.env`, credentials, `node_modules/`, unrelated changes

## Step 2: Stage & Commit

Stage specific files (avoid `git add -A`):
```bash
git add <file1> <file2> ...
```

Commit with a conventional message:
```bash
git commit -m "<type>: <summary in imperative mood, max 72 chars>"
```

If your shell or team conventions support a multiline commit body, include:

```text
<Body: what changed and why. Reference UC IDs.>

UC: UC-XXX-NN
Co-Authored-By: <as required by CLAUDE.md or system prompt conventions>
```

**Note:** Always include the `Co-Authored-By` trailer required by the project's commit conventions (see CLAUDE.md).

**Commit types:**
- `feat:` — new feature
- `fix:` — bugfix
- `refactor:` — code restructuring
- `docs:` — documentation only
- `test:` — test additions/changes

## Step 3: Push
```bash
git push -u origin HEAD
```

## Step 4: Open PR

**For bugfixes:** If `fix-verified.png` exists from Phase 7, include a before/after evidence section in the PR body describing what was broken (Phase 2 screenshot) and what it looks like now (Phase 7 screenshot). Since GitHub PRs accept markdown but not local images, describe the screenshots textually (what the user sees) rather than embedding image links.

Create the PR with `gh pr create` if available. Use a title under 70 characters and a body shaped like:

```markdown
## Summary
- <1-3 bullet points describing what changed>

## Use Cases
- UC-XXX-NN: <title>

## Verification Evidence (bugfixes only)
**Before fix:** <describe what the user saw — the broken behavior from Phase 2>
**After fix:** <describe the corrected behavior verified in Phase 7>

## Test Plan
- [ ] Unit tests pass (`npm test`)
- [ ] E2E tests pass (`npx playwright test`)
- [ ] Lint + format pass
- [ ] Live UI verified with fix-verified screenshot
- [ ] <Feature-specific verification steps>

## Documentation
- Updated `docs/product-capabilities.md` with UC-XXX-NN
- <Other doc updates if applicable>
```

## Step 5: Cleanup Temporary Screenshots

Delete any temporary screenshots created during the pipeline using shell-appropriate commands.

These files are evidence artifacts — they served their purpose during verification and should not be committed to the repository.

## Step 6: Report to User
Return the PR URL and a summary:
- What was implemented
- UC IDs added/updated
- Test coverage added
- Any follow-up items

## Checklist
- [ ] Only intended files staged (no screenshots, no `.env`)
- [ ] Commit message follows conventions
- [ ] Pushed to feature branch
- [ ] PR created targeting master, or blocker clearly reported if tooling prevents completion
- [ ] **(Bugfixes)** PR body includes verification evidence section
- [ ] Temporary screenshots deleted
- [ ] PR URL returned to user, or blocker clearly reported if the PR could not be created
