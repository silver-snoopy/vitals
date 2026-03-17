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

**For UI changes (features and bugfixes):** Verification screenshots from Phase 7 must be attached to the PR. After creating the PR, upload screenshots as a PR comment using `gh pr comment` so reviewers can see the visual evidence.

**For bugfixes specifically:** Include a before/after evidence section in the PR body describing what was broken (Phase 2 screenshot) and what it looks like now (Phase 7 screenshot).

Create the PR with `gh pr create` if available. Use a title under 70 characters and a body shaped like:

```markdown
## Summary
- <1-3 bullet points describing what changed>

## Use Cases
- UC-XXX-NN: <title>

## Visual Verification (UI changes)
<screenshots attached as PR comment after creation>

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

## Step 5: Upload Visual Evidence to PR (UI changes)

**Required when:** Phase 7 captured verification screenshots for UI changes.

After the PR is created, upload screenshots as a PR comment:
```bash
gh pr comment <PR_NUMBER> --body "$(cat <<'EVIDENCE'
## Visual Verification

### <Description of state 1>
![<alt text>](<image-url>)

### <Description of state 2>
![<alt text>](<image-url>)
EVIDENCE
)"
```

**Image upload method:** GitHub does not support direct image upload via `gh`. Instead:
1. Commit screenshots to the PR branch in a temporary `e2e/screenshots/` directory before pushing
2. Reference them in the PR comment using their raw GitHub URL
3. After the PR is merged, the screenshots persist in git history as verification evidence

**Alternative:** If committing screenshots is undesirable, describe the verification results textually in the PR comment (what was verified, what was seen on screen, viewport sizes tested).

## Step 6: Cleanup

Delete the temporary visual test file (not the screenshots if they were committed to the branch).

## Step 6: Report to User
Return the PR URL and a summary:
- What was implemented
- UC IDs added/updated
- Test coverage added
- Any follow-up items

## Checklist
- [ ] Only intended files staged (no `.env`)
- [ ] Commit message follows conventions
- [ ] Pushed to feature branch
- [ ] PR created targeting master, or blocker clearly reported if tooling prevents completion
- [ ] **(UI changes)** Visual verification screenshots attached to PR (comment or committed)
- [ ] **(Bugfixes)** PR body includes before/after verification evidence section
- [ ] Temporary visual test file deleted
- [ ] PR URL returned to user, or blocker clearly reported if the PR could not be created
