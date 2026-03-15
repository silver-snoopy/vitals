# Phase 9: Commit # Phase 8: Commit & PR PR

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

Commit with conventional message:
```bash
git commit -m "$(cat <<'EOF'
<type>: <summary in imperative mood, max 72 chars>

<Body: what changed and why. Reference UC IDs.>

UC: UC-XXX-NN
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

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

```bash
gh pr create --title "<type>: <concise summary>" --body "$(cat <<'EOF'
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

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Step 5: Cleanup Temporary Screenshots

Delete any temporary screenshots created during the pipeline:
```bash
rm -f bug-repro.png fix-verified.png
```

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
- [ ] PR created targeting master
- [ ] **(Bugfixes)** PR body includes verification evidence section
- [ ] Temporary screenshots deleted
- [ ] PR URL returned to user
