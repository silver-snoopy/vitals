# Backend Agent SDK Integration Analysis

**Date:** 2026-04-13
**Status:** Research complete
**Decision:** Proceed with Phase 1 (Structured Output) first

## Context

The Vitals backend currently makes LLM calls across 4 features (chat, weekly reports, workout plan tuning, intelligence pipeline) using a hand-rolled provider abstraction (`AIProvider` interface) that supports both Claude and Gemini. The chat feature already implements a manual agentic loop with 11 health-domain tools. This analysis assesses whether integrating the Anthropic Agent SDK could optimize LLM calls, introduce parallel agents, and improve architecture quality, and provides a phased migration strategy grounded in industry best practices.

---

## A. Current LLM Call Inventory

### Call Sites

| # | Feature | File | Pattern | Tools | Frequency |
|---|---------|------|---------|-------|-----------|
| 1 | Chat (REST) | `conversation-service.ts:44` | Agentic loop, max 10 iterations | 11 HEALTH_TOOLS | ~5-20/day |
| 2 | Chat (WebSocket) | `conversation-service.ts:121` | Streaming agentic loop, max 10 iter | 11 HEALTH_TOOLS | ~5-20/day |
| 3 | Weekly Report | `report-generator.ts:270` | Single-shot via `completeWithRetry()` | None | 1/week |
| 4 | Plan Tuner | `tuner.ts:209` | Single-shot + 1 validation retry | None | 1/week |
| 5 | Plan Parser | `plan-parser.ts` | Regex-based (no LLM) | None | On plan create/update |

**Intelligence pipeline** (`correlation-engine.ts`, `trajectory-projector.ts`) uses pure statistics (Pearson r, linear regression) -- no LLM calls.

### Current Infrastructure

- **Providers:** Claude (`claude-haiku-4-5-20251001`) and Gemini (`gemini-2.0-flash`) via `AIProvider` interface
- **Retry:** Exponential backoff on 429 only (max 3 retries, up to 30s) in `retry-utils.ts`
- **System prompts:** 4 markdown files loaded from disk at startup (~12K chars total)
- **JSON parsing:** 3-tier fallback: `JSON.parse` -> `jsonrepair` -> brace-matching extraction
- **No caching** of prompts or responses
- **No circuit breaker**, no timeouts, no provider fallback
- **Token logging** to `ai_generations` table (reports + tuner only; chat logs per-message)

### Key Architectural Observations

1. **Chat is already 70% of an agent** -- `conversation-service.ts` (244 lines) manually manages tool iteration, streaming delta accumulation, message history, and prompt injection detection
2. **Report & tuner use fragile JSON parsing** -- both duplicate `extractFirstJson()` and depend on `jsonrepair` library
3. **Plan parser is regex-only** -- `plan-parser.ts` (261 lines) uses regex heuristics for day headers and exercise lines with a fallback to raw notes when parsing fails
4. **All features hardcode claude-haiku** -- no model routing by task complexity
5. **The `AIProvider` abstraction is clean** and provider-swappable, but the Agent SDK is Claude-specific

---

## B. Agent SDK Fit Assessment (Per Feature)

### B.1 Chat Agent -- HIGH VALUE

| Aspect | Current (hand-rolled) | With Agent SDK |
|--------|----------------------|----------------|
| Agentic loop | Manual while-loop + iteration counter (244 lines) | Built-in `Agent.run()` / `Agent.streamRun()` |
| Streaming | Manual JSON delta accumulation with `toolCallMap` + fragment parsing (lines 144-204) -- fragile | Native streaming support |
| Tool management | Manual `HEALTH_TOOLS` array + `executeTool()` switch statement | `Tool` class with schema validation + error handling |
| Guardrails | 6 regex patterns in `flagSuspiciousInput()` | Composable input/output guardrails |
| History mgmt | Manual truncation to 50 messages | Built-in conversation management |

**Verdict:** Strongest candidate. The SDK would eliminate ~300 lines of hand-rolled orchestration across `conversation-service.ts` and `ws-chat.ts`, and fix the fragile streaming delta accumulation.

**Trade-off:** Adopting the Agent SDK means committing to Claude for chat -- the Gemini path through `AIProvider` would not be available via the SDK.

### B.2 Report Generation -- MEDIUM VALUE

The current single-shot pipeline (`gatherAndGenerate()`) is well-designed: 7 data sources fetched in parallel via `Promise.all`, carefully engineered prompt, single LLM call.

**Primary opportunity:** Replace fragile JSON parsing with **structured output via tool_use**. This would:
- Eliminate the 3-tier parsing fallback (lines 101-182 of `report-generator.ts`)
- Remove the `jsonrepair` dependency
- Guarantee valid JSON schema on every response

**Multi-agent decomposition** (analyst + writer + reviewer) is **not recommended** at current scale -- it would triple latency (3 sequential LLM calls, ~15-25s total vs ~5-10s) without proportional quality gain for a single-user app.

### B.3 Plan Tuner -- MEDIUM-HIGH VALUE

The tuner (`tuner.ts`, 421 lines) has the most complex orchestration: 9-step pipeline, rule-based candidate generation, validation retry, safety caps.

**Primary opportunity:** Structured output would eliminate the validation retry loop (lines 327-345) entirely. The candidate constraint (select from pre-computed list) maps naturally to an enum-like schema.

### B.4 Plan Parser -- MEDIUM-HIGH VALUE

The plan parser (`plan-parser.ts`, 261 lines) is entirely regex-based. It handles well-formatted inputs (day headers + exercise lines with sets x reps) but falls back to a single "Notes" day with raw text whenever format doesn't match. An LLM-powered parser with structured output would:
- Handle arbitrary free-text plan formats (coach PDFs, screenshots, unstructured notes)
- Produce richer metadata (muscle groups, equipment, progression rules) from context
- Eliminate the regex fragility and fallback-to-notes failure mode

### B.5 Intelligence Pipeline -- LOW VALUE

Pure statistical computation. No LLM needed. Template-based summaries are adequate.

---

## C. Parallel Agent Opportunities

| Opportunity | Architecture | Assessment |
|-------------|-------------|------------|
| Report: data analyst + writer + reviewer | Sequential 3-agent pipeline | **Not recommended** -- triples latency, current single-shot quality is good |
| Chat: specialized sub-agents (nutrition, training, analytics) | Router agent dispatches to specialists | **Not recommended** -- 11 tools is well within single-agent capacity |
| Plan tuning: evaluation + recommendation agents | Sequential 2-agent pipeline | **Moderate value** if tuner quality needs improvement |
| Weekly pipeline supervisor | Supervisor orchestrates: collect -> report -> intelligence -> tune | **Best future opportunity** |

**Bottom line:** At current scale (single user, 11 tools, 4 LLM features), parallel/multi-agent adds complexity without proportional value. The highest-value agent SDK use is **replacing the hand-rolled chat loop**, not adding multi-agent orchestration.

---

## D. LLM Call Optimization Opportunities

### D.1 Prompt Caching (HIGH VALUE, VERY LOW RISK)

| Prompt | Size | Reuse Pattern | Savings |
|--------|------|---------------|---------|
| `chat-persona.md` system prompt | ~1K tokens | Every chat message | 50-70% input cost reduction |
| `HEALTH_TOOLS` schema | ~750 tokens | Every chat message | Included in above |
| Report prompts (persona + protocol + format) | ~2.2K tokens | Weekly | Minor but free |

### D.2 Structured Output via tool_use (HIGH VALUE, LOW RISK)

Replace free-form JSON generation + fragile parsing with schema-constrained tool_use responses:

- **Report generator:** Define report schema as a tool -> guarantees valid JSON
- **Plan tuner:** Define tuner output schema as a tool -> eliminates validation retry loop
- **Plan parser:** Replace regex with LLM + structured output -> handles arbitrary formats

### D.3 Model Selection Strategy (MEDIUM VALUE)

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| Chat (data queries) | Haiku 4.5 | Fast, cheap, strong tool selection |
| Chat (complex analysis) | Sonnet 4.6 | Better cross-domain reasoning |
| Report generation | Sonnet 4.6 | Higher-quality narrative |
| Plan tuner | Haiku 4.5 | Constrained candidate selection |
| Plan parser | Haiku 4.5 | Structured extraction task |

### D.4 Response Caching for Tools

Three chat tools return idempotent results: `list_available_metrics`, `query_correlations`, `predict_trajectory`. TTL cache with invalidation on collection/report events.

---

## E. Architecture Improvements

### E.1 Error Recovery & Resilience

| Gap | Current State | Recommendation |
|-----|--------------|----------------|
| Circuit breaker | None | After N consecutive non-429 failures, stop calling provider for cooldown |
| Timeouts | None | 30s for chat, 60s for report, 45s for tuner |
| Provider fallback | None | Claude -> Gemini fallback for report/tuner |
| Graceful degradation | Report fails entirely | Generate data-only report on LLM failure |
| Stuck workflows | Reports stuck in `generating` forever on restart | Dead letter detection |

### E.2 Observability

- Add trace IDs at API endpoints, propagate through all LLM calls
- Record latency per LLM call
- Add `estimated_cost_usd` to `ai_generations`
- Log chat AI usage to `ai_generations` with `purpose: 'chat'`
- Track tool execution duration per tool name

### E.3 AIProvider Interface Evolution

```
Keep existing AIProvider         -- for report generation, plan tuner (provider-agnostic)
Add new AgentRunner abstraction  -- wraps Agent SDK for chat (Claude-specific)
Add completeStructured<T>()      -- for schema-constrained JSON output
```

---

## F. Migration Strategy (5 Phases)

### Phase 1: Structured Output (1-2 weeks) -- LOW RISK, HIGH VALUE
1. Add `completeStructured<T>()` to `ClaudeProvider` using tool_use
2. Migrate report generator to structured output
3. Migrate plan tuner to structured output
4. Replace regex plan parser with LLM-powered structured output
5. Remove `jsonrepair` dependency and duplicated `extractFirstJson()`

### Phase 2: Prompt Caching (1 week) -- VERY LOW RISK, HIGH VALUE
1. Add `cache_control` markers to system prompts in `ClaudeProvider`
2. Verify caching via usage metadata

### Phase 3: Agent SDK for Chat (2-3 weeks) -- MEDIUM RISK, HIGH VALUE
1. Install `@anthropic-ai/agents-sdk`
2. Create `AgentRunner` class wrapping Agent SDK
3. Migrate chat to `Agent.run()` / `Agent.streamRun()`

### Phase 4: Model Selection + Error Recovery (1 week) -- LOW RISK
1. Per-feature model config in `EnvConfig`
2. Circuit breaker, timeouts, provider fallback

### Phase 5: Observability (1 week) -- VERY LOW RISK
1. Trace IDs, latency tracking, cost attribution

---

## G. Industry Best Practices Comparison

| Practice | Vitals Current | Industry Standard | Gap |
|----------|---------------|-------------------|-----|
| Agentic loop | Hand-rolled while loop | Agent SDK / framework | Moderate |
| JSON output | 3-tier fragile parsing | tool_use structured output | **Significant** |
| Plan parsing | Regex heuristics with fallback | LLM structured extraction | **Significant** |
| Error handling | 429 retry only | Circuit breaker + timeout + fallback | **Significant** |
| Caching | None | Prompt caching + response caching | **Significant** |
| Observability | Token counts only | Full tracing | Moderate |
| Multi-provider | Clean abstraction | Same + routing logic | Good |
| Security | Prompt injection regex + input sanitization | Same + output validation | Good |

## H. Prioritized Recommendations Summary

| Priority | Initiative | Value | Effort | Risk |
|----------|-----------|-------|--------|------|
| **1** | Structured output (report + tuner + plan parser) | HIGH | LOW | LOW |
| **2** | Prompt caching for chat | HIGH | LOW | VERY LOW |
| **3** | Agent SDK for chat agentic loop | HIGH | MEDIUM | MEDIUM |
| **4** | Model selection strategy | MEDIUM | LOW | LOW |
| **5** | Error recovery | MEDIUM | LOW | LOW |
| **6** | Observability and tracing | MEDIUM | MEDIUM | LOW |

**Highest-ROI path:** Phase 1 -> Phase 2 -> Phase 3.
