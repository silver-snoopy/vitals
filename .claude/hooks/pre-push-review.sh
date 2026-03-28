#!/usr/bin/env bash
# pre-push-review.sh
#
# PreToolUse hook: intercepts `git push` (non-main branches) and `gh pr create`.
# Collects the branch diff and injects context instructing Claude to automatically
# run pr-review-toolkit:code-reviewer, then ask the user whether to fix issues first.
#
# Input:  JSON on stdin  { "tool_name": "Bash", "tool_input": { "command": "..." } }
# Output: JSON on stdout with hookSpecificOutput.additionalContext

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only intercept push / PR creation
IS_PUSH=false
IS_PR=false
echo "$COMMAND" | grep -qE 'git\s+push' && IS_PUSH=true || true
echo "$COMMAND" | grep -qE 'gh\s+pr\s+create' && IS_PR=true || true

if [ "$IS_PUSH" = false ] && [ "$IS_PR" = false ]; then
  exit 0
fi

# For git push: skip main/master (not a PR workflow)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")
if [ "$IS_PUSH" = true ] && { [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; }; then
  exit 0
fi

# Collect diff context
CHANGED_FILES=$(git diff --name-only master..."$BRANCH" 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo "")
DIFF_STAT=$(git diff --stat master..."$BRANCH" 2>/dev/null || git diff --stat HEAD~1 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# Build the context message injected back into Claude
CONTEXT="AUTOMATIC CODE REVIEW REQUIRED

The user is about to run: $COMMAND
Branch: $BRANCH

Changed files:
$CHANGED_FILES

Diff summary:
$DIFF_STAT

ACTION REQUIRED (do this now, automatically — do not wait for user instruction):
1. Invoke the pr-review-toolkit:code-reviewer agent on the diff for branch '$BRANCH' vs master.
2. After the review completes, present the findings to the user.
3. If issues were found, ask the user: 'The review found [N] issue(s). Would you like me to fix them before pushing?'
4. If the user says yes — fix the issues, then re-run the original command.
5. If the user says no — proceed with the original command immediately."

# Output: allow the command but inject context so Claude runs the review
printf '%s' "$CONTEXT" | jq -Rs '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    additionalContext: .
  }
}'
