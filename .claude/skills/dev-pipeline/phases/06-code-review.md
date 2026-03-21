# Phase 6: Code Review

## Purpose
Catch bugs, convention violations, and security issues before testing.

## Preferred: Run pr-review-toolkit

Invoke `/pr-review-toolkit:review-pr` as the primary quality gate. This skill orchestrates
specialized sub-agents (code reviewer, type design analyzer, silent failure hunter, etc.)
across the full diff and returns consolidated findings.

After the skill completes, address all HIGH and MEDIUM findings before moving to Phase 7.

## Supplementary: Launch Targeted Review Agents

After `/pr-review-toolkit:review-pr`, spawn 3 additional agents IN PARALLEL using the Agent
tool with `subagent_type: "feature-dev:code-reviewer"` for project-specific checks not
covered by the toolkit:

### Agent 1: Bugs & Logic
Prompt: "Review the following changed files for bugs, logic errors, edge cases, null/undefined handling, race conditions, and incorrect assumptions. Only report HIGH and MEDIUM confidence findings."

### Agent 2: Conventions & Style
Prompt: "Review the following changed files against the project conventions in CLAUDE.md. Check: import patterns (import type), naming conventions, Fastify plugin pattern, Base UI render prop usage (not asChild), parameterized SQL, proper error handling. Only report violations."

### Agent 3: Security
Prompt: "Review the following changed files for security issues: SQL injection, XSS, command injection, auth bypass, sensitive data exposure, OWASP top 10. Only report confirmed or highly likely issues."

## Provide Context to Agents
Each agent prompt should include:
- List of changed files (use `git diff --name-only`)
- The diff content (use `git diff`)
- The goal/spec from Phase 1

## Fallback: Structured Self-Review

If `/pr-review-toolkit:review-pr` and review agents are unavailable, review the change manually using the same three scopes:
- Bugs and logic
- Conventions and style
- Security

Use the current diff and Phase 1 goal as the review input, and record any HIGH or MEDIUM findings before fixing them.

## Handling Findings

### Fix immediately:
- HIGH confidence bugs or logic errors
- Security vulnerabilities
- Convention violations that affect functionality

### Note but skip:
- LOW confidence suggestions
- Style preferences not in CLAUDE.md
- Refactoring suggestions beyond scope

### After fixes:
- Run `npm run build` again to verify fixes compile
- Re-check only the specific findings that were fixed (no need to re-run full review)

## Checklist
- [ ] `/pr-review-toolkit:review-pr` run and findings reviewed
- [ ] Supplementary agent reviews completed (logic, conventions, security)
- [ ] HIGH/MEDIUM findings addressed
- [ ] Build still passes after fixes
