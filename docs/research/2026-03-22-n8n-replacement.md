# Research: Replacing n8n with Code-Based Workflow Orchestration

**Date:** 2026-03-22
**Status:** Research / Proposal
**Supersedes:** [2026-03-07-workflow-orchestration.md](./2026-03-07-workflow-orchestration.md)

## Context

The Vitals project currently uses **n8n Cloud** for 3 scheduled workflows:

| Workflow | Schedule | Action |
|----------|----------|--------|
| Daily Collection | `0 6 * * *` (06:00 UTC) | POST /api/collect (yesterday's data) |
| Weekly Report | `0 8 * * 1` (Mon 08:00 UTC) | POST /api/reports/generate (prev week) |
| Health Monitor | `*/30 * * * *` (every 30 min) | GET /health |

All three follow the same trivial pattern: **cron trigger → build params → HTTP call → check result**. No complex branching, fan-out, human-in-the-loop, or conditional logic.

### Why Revisit the Decision

The original [2026-03-07 decision](./2026-03-07-workflow-orchestration.md) chose n8n for its visual builder, community ecosystem, and 500+ integrations. In practice, after 2 weeks of use:

1. **None of the 500+ integrations are used** — all 3 workflows are simple HTTP requests
2. **Visual builder adds no value** — workflows are 4-5 nodes doing what 10 lines of code can do
3. **Separate deployment** — manual JSON import via REST API, not part of CI/CD
4. **Credential duplication** — API keys stored in both n8n Cloud and backend env
5. **No testability** — workflow logic cannot be unit-tested
6. **No type safety** — workflow definitions are untyped JSON

---

## Can n8n Be Fully Replaced?

**Yes, completely.** The current workflows contain zero logic that requires a workflow engine. They are cron-triggered HTTP calls — the simplest possible automation pattern.

---

## Approach 1: In-Process Cron Scheduler

### How It Works

A lightweight cron library runs inside the Fastify backend process. Jobs call internal functions directly (no HTTP round-trip needed).

### Scheduler Library Comparison

| Feature | **Croner** | **node-cron** | **Bree** | **BullMQ** |
|---------|-----------|-------------|---------|----------|
| TypeScript native | ✅ | ❌ | ❌ | ✅ |
| DST / Timezone | ✅ (best) | Basic | Basic | ✅ |
| Worker threads | ❌ | ❌ | ✅ | ✅ (Redis) |
| Persistence | ❌ | ❌ | Optional | ✅ |
| External deps | None | None | None | Redis |
| Weekly downloads | ~600K | ~3M | ~50K | ~800K |
| Complexity | Low | Lowest | Medium | High |

**Best fit: Croner** — TypeScript-native, DST-aware, zero dependencies, production-proven (used by PM2, Uptime Kuma). node-cron is simpler but lacks proper timezone handling. Bree and BullMQ are overkill for 3 simple jobs on a single Railway instance.

### Architecture

```
┌──────────────────────────────────────────────┐
│ Fastify Backend (single process)             │
│                                              │
│  plugins/scheduler.ts (Croner)               │
│  ├── daily-collection  → runCollection()     │
│  ├── weekly-report     → generateReport()    │
│  └── health-check      → selfCheck()         │
│                                              │
│  Observability:                              │
│  ├── scheduler_runs table (history)          │
│  ├── GET /api/scheduler/status               │
│  └── Structured JSON logs                    │
└──────────────────────────────────────────────┘
```

### Pros

- **Zero external dependencies** — no SaaS, no Redis, no separate service
- **Type-safe, testable** — unit test job logic, integration test schedules
- **Unified deployment** — deploys with backend, no manual JSON imports
- **Direct function calls** — jobs call `runCollection()` directly instead of HTTP → faster, simpler
- **Single credential store** — all config in backend env vars
- **Observable** — `scheduler_runs` table tracks every execution with duration, status, errors
- **Free** — no SaaS cost, no infrastructure add-ons
- **Debuggable** — standard Node.js debugging, breakpoints, stack traces

### Cons

- **Single instance** — if Railway process dies, jobs don't run until restart (but Railway auto-restarts; jobs are idempotent and catch up on next tick)
- **No visual builder** — schedule changes require code changes + deploy (but schedules rarely change)
- **No built-in alerting** — must implement notification logic for failures (e.g., email/Slack on error)
- **Memory** — cron library + job state lives in process memory (negligible for 3 jobs)
- **Missed runs on deploy** — during deployment restarts (~10s), a 30-min health check might be delayed (inconsequential)

### Verdict

✅ **Excellent fit** for the current use case. The workflows are too simple to justify an external orchestration system.

---

## Approach 2: AI Agent-Based Orchestration

### How It Works

Instead of static cron schedules, an AI agent (via [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) v0.2.71) decides **what** to run and **when**. The agent has tools to trigger collection, check data quality, generate reports, and monitor health.

### Architecture

```
┌──────────────────────────────────────────────┐
│ Fastify Backend                              │
│                                              │
│  Scheduler (Croner) triggers agent:          │
│  └── Every N hours → invoke Claude Agent     │
│                                              │
│  Claude Agent (Haiku for cost):              │
│  ├── Tool: trigger_collection(dateRange)     │
│  ├── Tool: check_data_quality(date)          │
│  ├── Tool: generate_report(dateRange)        │
│  ├── Tool: get_collection_status()           │
│  ├── Tool: check_health()                    │
│  └── Tool: send_notification(message)        │
│                                              │
│  Agent decides:                              │
│  "Yesterday has 0 nutrition rows → re-run    │
│   collection. Last report was 8 days ago →   │
│   generate weekly report. Health OK."        │
└──────────────────────────────────────────────┘
```

### Claude Agent SDK Capabilities

The [Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) (`@anthropic-ai/claude-agent-sdk`) provides:

- **Agent loop**: context → action → verify → repeat (same loop powering Claude Code)
- **Sub-agents**: isolated context windows, parallel execution, model selection per agent
- **Built-in tools**: Bash, Read, Write, Edit, Glob, Grep, Task (sub-agents)
- **Custom tools**: define with JSON schema, agent calls them autonomously
- **Streaming**: real-time output for long-running agent tasks
- **Model flexibility**: Haiku for cheap tasks, Sonnet for complex reasoning

### What Agents Could Do That Cron Can't

| Capability | Cron | Agent |
|-----------|------|-------|
| Run job at fixed time | ✅ | ✅ |
| Skip collection if data already exists | ❌ (runs anyway) | ✅ (checks first) |
| Retry with different strategy on failure | ❌ (fixed retry) | ✅ (diagnose + adapt) |
| Adjust schedule based on data patterns | ❌ | ✅ |
| Generate report early if significant event | ❌ | ✅ |
| Flag anomalies (0 calories, missing days) | ❌ | ✅ |
| Correlate across providers | ❌ | ✅ |
| Natural language schedule changes | ❌ | ✅ |
| Self-diagnose auth failures | ❌ | ✅ |

### Pros

- **Intelligent decision-making** — agent can reason about whether to run, skip, retry, or alert
- **Adaptive** — learns patterns (e.g., "data arrives late on weekends, wait until noon")
- **Self-healing** — agent can diagnose failures and attempt recovery
- **Extensible** — new capabilities by adding tools, not rewriting control flow
- **Natural language config** — "check data quality after each collection"
- **Future-proof** — aligns with 2026 trend of AI-native automation

### Cons

- **Cost** — every agent invocation = API call. Haiku is cheap (~$0.001/1K tokens) but not free
  - Estimated: 3 invocations/day × ~2K tokens each = ~$0.18/month (Haiku)
  - With health checks (48/day): ~$3/month (Haiku) or ~$15/month (Sonnet)
- **Latency** — agent takes 1-5 seconds to "think" vs instant cron trigger
- **Non-deterministic** — agent *might* decide differently on identical inputs (prompt engineering mitigates but doesn't eliminate)
- **Debugging** — "why did the agent skip Tuesday's report?" requires reading agent traces
- **Dependency on AI API** — if Anthropic API is down, no jobs run (vs cron which works offline)
- **Complexity** — Agent SDK + tool definitions + prompt engineering vs 50 lines of cron code
- **Overkill for current use case** — the 3 existing workflows have zero decision-making; they always run on schedule

### Verdict

⚠️ **Premature for current use case.** The existing workflows are deterministic — they always run at the same time doing the same thing. Adding an AI agent to execute `runCollection()` at 6am is like hiring a PhD to flip a light switch. However, this becomes compelling when workflows need **reasoning** (data quality, adaptive scheduling, anomaly detection).

---

## Approach 3: Hybrid (Recommended)

### How It Works

Use **Croner for deterministic scheduling** (the 3 existing jobs) and **optionally add agent-based jobs later** when a use case genuinely benefits from reasoning.

### Architecture

```
┌──────────────────────────────────────────────────┐
│ Scheduler Plugin (Croner)                         │
│                                                   │
│  Deterministic jobs (now):                        │
│  ├── 0 6 * * *    → runDailyCollection()          │
│  ├── 0 8 * * 1    → runWeeklyReport()             │
│  └── */30 * * * * → runHealthCheck()              │
│                                                   │
│  Agent-enhanced jobs (future, when needed):        │
│  ├── 0 7 * * *    → agent: checkDataQuality()     │
│  ├── 0 9 * * 1    → agent: reviewWeeklyTrends()   │
│  └── on-demand    → agent: diagnoseFailure()      │
└──────────────────────────────────────────────────┘
```

### Decision Framework: When to Use Which

```
Is the job deterministic? (same time, same action, every time)
  YES → Use cron + direct function call
  NO  → Does it need reasoning about what/when/how to act?
    YES → Use Claude Agent (Haiku for simple, Sonnet for complex)
    NO  → Use cron with conditional logic in code
```

### Migration Path

**Phase 1 — Replace n8n with Croner (immediate value)**
1. Add `croner` to backend dependencies
2. Create `plugins/scheduler.ts` Fastify plugin
3. Implement 3 job functions (direct internal calls, no HTTP)
4. Add `scheduler_runs` table for observability
5. Add `GET /api/scheduler/status` endpoint
6. Deploy alongside n8n for 1 week, validate parity
7. Disable n8n, remove `packages/workflows/`

**Phase 2 — Add agent-based jobs (when needed)**
1. Add `@anthropic-ai/claude-agent-sdk` to backend
2. Create agent tool definitions for health data operations
3. Implement data quality check as first agent job
4. Track agent costs in existing `ai_generations` table

### Pros

- **Right tool for each job** — no over-engineering, no under-engineering
- **Incremental** — start simple, add intelligence when the use case demands it
- **Cost-efficient** — deterministic jobs cost $0, only agent jobs incur API costs
- **Testable** — cron jobs unit-testable, agent jobs testable with mocked tool responses
- **Single codebase** — everything in `packages/backend`, deploys together

### Cons

- **Two patterns** — developers need to understand both cron and agent patterns (but team size = 1, so this is fine)
- **Phase 2 is speculative** — agent jobs may never be needed if the system works well with cron alone

---

## Comparison Summary

| Criteria | n8n Cloud | Croner Only | Agents Only | Hybrid |
|----------|-----------|-------------|-------------|--------|
| **Monthly cost** | $0 (free tier) | $0 | ~$3-15 | $0 + future agent cost |
| **Setup effort** | Already done | ~1-2 days | ~3-5 days | ~1-2 days (Phase 1) |
| **Maintenance** | Separate system | In codebase | In codebase | In codebase |
| **Testability** | ❌ None | ✅ Full | ✅ Full | ✅ Full |
| **Type safety** | ❌ JSON | ✅ TypeScript | ✅ TypeScript | ✅ TypeScript |
| **Deployment** | Manual import | Auto (git push) | Auto (git push) | Auto (git push) |
| **Reliability** | n8n Cloud SLA | Backend uptime | Backend + API | Backend + optional API |
| **Intelligence** | ❌ Static | ❌ Static | ✅ Adaptive | ✅ Where needed |
| **Debugging** | n8n UI | Node.js debugger | Agent traces | Both available |
| **Future-ready** | Limited | Add agent later | Already there | Designed for it |

---

## Recommendation

**Go with the Hybrid approach (Phase 1 first):**

1. **Immediately:** Replace n8n with Croner-based in-process scheduling. This is a clear, unambiguous win — simpler, cheaper, testable, and unified with the backend deployment. ~200 lines of TypeScript replaces an entire external SaaS dependency.

2. **Later (when justified):** Add agent-based jobs for use cases that genuinely need reasoning. The first good candidate will likely be **data quality checking** — "did yesterday's collection actually capture meaningful data, or did it silently return empty results?"

The current workflows are too simple for AI orchestration. But the architecture should make it trivial to add an agent job alongside cron jobs when the need arises.

---

## References

- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Agent SDK GitHub](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Croner — npm](https://www.npmjs.com/package/croner)
- [Node.js Scheduler Comparison (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/)
- [node-cron vs node-schedule vs Croner (PkgPulse)](https://www.pkgpulse.com/blog/node-cron-vs-node-schedule-vs-croner-task-scheduling-nodejs-2026)
- [n8n Alternatives 2026 (DEV)](https://dev.to/lightningdev123/top-5-n8n-alternatives-in-2026-choosing-the-right-workflow-automation-tool-54oi)
- [Claude Code Scheduled Tasks](https://code.claude.com/docs/en/scheduled-tasks)
