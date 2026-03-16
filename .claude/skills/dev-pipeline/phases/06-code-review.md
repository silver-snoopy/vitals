# Phase 6: Code Review

## Purpose
Catch bugs, convention violations, and security issues before testing.

## Preferred: Launch Review Agents

Spawn 3 review agents IN PARALLEL using the Agent tool with `subagent_type: "feature-dev:code-reviewer"`:

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

If review agents or helper skills are unavailable, review the change manually using the same three scopes:
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
- [ ] Review completed across logic, conventions, and security
- [ ] HIGH/MEDIUM findings addressed
- [ ] Build still passes after fixes
