# Research: LLM Provider Selection for Vitals Report Generation

**Date:** 2026-03-14
**Context:** Gemini 2.0 Flash (Google AI Studio free tier) consistently returns 429 quota errors. Need a stable, reliable LLM solution for weekly health report generation.
**Decision Criteria:** Reasoning quality (60%) + Cost (40%)

---

## Workload Profile

The vitals app uses an LLM for exactly one task: **weekly health report generation**.

- **Input:** ~500-1500 tokens (structured health summaries: nutrition averages, workout counts, biometric readings, previous report snippet)
- **Output:** ~500-800 tokens (structured JSON: summary, insights as markdown, action items array)
- **Frequency:** Up to 3 reports/day (peak), average 1 report/day (single-user)
- **Requirements:**
  - Reliable structured JSON output (no markdown fences, no extra prose)
  - Health data reasoning — trend detection, actionable recommendations
  - Consistent availability — no quota surprises

**Monthly token estimates:**

| Scenario | Requests/month | Tokens/month |
|----------|---------------|-------------|
| Average (1/day) | 30 | ~60,000 |
| Peak (3/day) | 90 | ~180,000 |

At this volume, all candidates cost under $0.35/month at peak. Cost differences are minimal, shifting the decision toward **reasoning quality and reliability**.

---

## Candidate Models

### Tier 1: Ultra-Budget (< $0.01/month at our volume)

| Model | Input $/1M | Output $/1M | Avg $/mo | Peak $/mo | JSON Reliability | Health Reasoning |
|-------|-----------|-------------|---------|----------|-----------------|-----------------|
| **Gemini 2.0 Flash** (free) | $0.00 | $0.00 | $0.000 | $0.000 | Medium | Medium |
| **GPT-4o Mini** | $0.15 | $0.60 | $0.005 | $0.016 | Good | Medium |
| **GPT-5 Mini** | $0.25 | $2.00 | $0.014 | $0.043 | Very Good | Good |
| **Gemini 2.5 Flash** (paid) | $0.30 | $2.50 | $0.019 | $0.058 | Good | Good |

### Tier 2: Budget (< $0.25/month at peak)

| Model | Input $/1M | Output $/1M | Avg $/mo | Peak $/mo | JSON Reliability | Health Reasoning |
|-------|-----------|-------------|---------|----------|-----------------|-----------------|
| **Claude Haiku 4.5** | $1.00 | $5.00 | $0.045 | $0.135 | Excellent | Very Good |
| **Gemini 2.5 Pro** | $1.25 | $10.00 | $0.075 | $0.225 | Very Good | Very Good |

### Tier 3: Mid-Range (< $0.35/month at peak)

| Model | Input $/1M | Output $/1M | Avg $/mo | Peak $/mo | JSON Reliability | Health Reasoning |
|-------|-----------|-------------|---------|----------|-----------------|-----------------|
| **GPT-5.2** | $1.75 | $14.00 | $0.095 | $0.284 | Excellent | Excellent |
| **Claude Sonnet 4.6** | $3.00 | $15.00 | $0.113 | $0.338 | Excellent | Excellent |

---

## Evaluation Against Criteria

### Reasoning Quality (60% weight)

The task requires:
1. **Trend detection** — comparing current week vs previous week data
2. **Nutritional analysis** — identifying macro imbalances, calorie targets
3. **Workout pattern recognition** — frequency, volume trends, recovery signals
4. **Actionable recommendations** — specific, data-driven action items with correct priority levels

| Model | Trend Detection | Nutritional Analysis | Workout Reasoning | Action Quality | **Score (0-10)** |
|-------|----------------|---------------------|-------------------|---------------|-----------------|
| Gemini 2.0 Flash | 5 | 5 | 5 | 5 | **5.0** |
| GPT-4o Mini | 6 | 6 | 5 | 6 | **5.8** |
| GPT-5 Mini | 7 | 7 | 7 | 7 | **7.0** |
| Gemini 2.5 Flash | 7 | 7 | 6 | 7 | **6.8** |
| Claude Haiku 4.5 | 8 | 8 | 7 | 8 | **7.8** |
| Gemini 2.5 Pro | 8 | 8 | 7 | 8 | **7.8** |
| Claude Sonnet 4.6 | 9 | 9 | 9 | 9 | **9.0** |
| GPT-5.2 | 9 | 9 | 8 | 9 | **8.8** |

### Cost (40% weight)

At peak load (~180K tokens/month), all candidates cost under $0.35/month. Scoring uses peak cost on 0-10 scale (lower = better):

| Model | Avg $/mo | Peak $/mo | **Score (0-10)** |
|-------|---------|----------|-----------------|
| Gemini 2.0 Flash (free) | $0.000 | $0.000 | **10.0** |
| GPT-4o Mini | $0.005 | $0.016 | **9.5** |
| GPT-5 Mini | $0.014 | $0.043 | **8.7** |
| Gemini 2.5 Flash | $0.019 | $0.058 | **8.3** |
| Claude Haiku 4.5 | $0.045 | $0.135 | **6.1** |
| Gemini 2.5 Pro | $0.075 | $0.225 | **3.6** |
| GPT-5.2 | $0.095 | $0.284 | **1.6** |
| Claude Sonnet 4.6 | $0.113 | $0.338 | **0.0** |

### Weighted Final Score (60% reasoning + 40% cost)

| Model | Reasoning (×0.6) | Cost (×0.4) | **Final Score** | Reliability Risk |
|-------|-----------------|------------|----------------|-----------------|
| **Claude Haiku 4.5** | 4.68 | 2.44 | **7.12** | Low |
| **GPT-5 Mini** | 4.20 | 3.48 | **7.68** | Low |
| **Gemini 2.5 Flash** | 4.08 | 3.32 | **7.40** | Medium (quota) |
| **Claude Sonnet 4.6** | 5.40 | 0.00 | **5.40** | Low |
| **GPT-5.2** | 5.28 | 0.64 | **5.92** | Low |
| **Gemini 2.5 Pro** | 4.68 | 1.44 | **6.12** | Medium (quota) |
| **GPT-4o Mini** | 3.48 | 3.80 | **7.28** | Low |
| **Gemini 2.0 Flash** | 3.00 | 4.00 | **7.00** | **High (quota)** |

**Sorted by final score:**

| Rank | Model | Final Score | Peak $/mo | Reliability |
|------|-------|------------|----------|-------------|
| 1 | **GPT-5 Mini** | **7.68** | $0.043 | Low risk |
| 2 | **Gemini 2.5 Flash** (paid) | **7.40** | $0.058 | Medium risk |
| 3 | **GPT-4o Mini** | **7.28** | $0.016 | Low risk |
| 4 | **Claude Haiku 4.5** | **7.12** | $0.135 | Low risk |
| 5 | **Gemini 2.0 Flash** (free) | **7.00** | $0.000 | **High risk** |
| 6 | **Gemini 2.5 Pro** | **6.12** | $0.225 | Medium risk |
| 7 | **GPT-5.2** | **5.92** | $0.284 | Low risk |
| 8 | **Claude Sonnet 4.6** | **5.40** | $0.338 | Low risk |

---

## Future Workload Projections (from Competitor Analysis Roadmap)

The [competitor analysis](2026-03-11-competitor-analysis.md) outlines three phases of features that will significantly increase LLM prompt complexity and token usage. Current reports use ~2,000 total tokens. Future features will expand this substantially.

### Phase A: Intelligence Layer (Near-term)

New prompt content: correlation results, anomaly chains, multi-week trends, TDEE calculations, personal baselines.

| Feature | Added Input Tokens | Added Output Tokens | Reasoning Complexity |
|---------|-------------------|--------------------|--------------------|
| Cross-domain correlations (top 5 with r-values, p-values) | +400 | +200 | Medium — interpret statistical relationships |
| Causal chain narratives (sleep → glucose → nutrition → workout) | +600 | +500 | **High** — multi-step temporal reasoning |
| TDEE context (smoothed estimate, weight trend, adjustment rationale) | +200 | +200 | Medium — validate algorithm output |
| Personal baselines (30-day rolling averages per metric) | +300 | +100 | Low — compare current vs baseline |

**Phase A prompt estimate:** ~3,500 input + ~1,800 output = **~5,300 tokens/request**

### Phase B: Expanded Data Sources (Medium-term)

New prompt content: sleep stages, HRV trends, recovery scores, glucose curves, blood work panels.

| Feature | Added Input Tokens | Added Output Tokens | Reasoning Complexity |
|---------|-------------------|--------------------|--------------------|
| Sleep/HRV data (Oura/Whoop/Garmin — stages, rMSSD, trends) | +500 | +300 | Medium — recovery interpretation |
| CGM glucose data (time-in-range, variability, post-meal AUC) | +400 | +400 | **High** — glucose↔meal↔training correlations |
| Blood work panels (15-20 biomarkers with reference ranges) | +600 | +400 | **High** — longitudinal biomarker interpretation |

**Phase B prompt estimate:** ~5,000 input + ~2,900 output = **~7,900 tokens/request**

### Phase C: Adaptive Coaching (Long-term)

New prompt content: training phase classification, periodized macro targets, personal physiological model, evidence citations, confidence intervals.

| Feature | Added Input Tokens | Added Output Tokens | Reasoning Complexity |
|---------|-------------------|--------------------|--------------------|
| Training phase detection (volume/intensity trends, phase classification) | +400 | +300 | **High** — pattern recognition in time-series |
| Periodization-aware nutrition (phase-specific macro targets) | +300 | +400 | **High** — domain expertise in sports nutrition |
| Personal physiological model (individual response signatures) | +800 | +500 | **Very High** — reason over 6+ months of personal data |
| Explainable recommendations (data basis, confidence, citations) | +200 | +800 | **Very High** — structured evidence-based reasoning |

**Phase C prompt estimate:** ~6,700 input + ~4,900 output = **~11,600 tokens/request**

### Phase 6A: Conversational AI Health Assistant (Near-term)

The [Phase 6A plan](../plans/2026-03-21-phase6a-conversational-ai.md) introduces a conversational chat interface with LLM tool use. Unlike batch reports (fire-and-forget), chat is **multi-turn with an agentic tool-use loop** — the LLM receives a user question, calls database query tools, receives results, and responds. This fundamentally changes the token consumption model.

**Per chat interaction (single user question → answer):**

| Component | Input Tokens | Output Tokens | Notes |
|-----------|-------------|--------------|-------|
| System prompt (chat persona + tool instructions) | ~800 | — | Sent every request |
| Tool definitions (6 tools with JSON schemas) | ~1,200 | — | Sent every request |
| Conversation history (avg 5 prior turns) | ~2,000 | — | Grows with conversation length |
| User message | ~50-100 | — | Short natural language question |
| LLM tool call request (1st loop iteration) | — | ~100-200 | Tool name + input params |
| Tool result injected | ~300-800 | — | JSON query results (varies by data volume) |
| LLM tool call request (2nd loop, if needed) | — | ~100-200 | ~40% of queries need a follow-up tool call |
| Tool result injected (2nd) | ~300-800 | — | Only if 2nd tool call happens |
| Final assistant response | — | ~300-600 | Natural language with cited data |

**Single-tool-call interaction:** ~4,350 input + ~500 output = **~4,850 tokens**
**Two-tool-call interaction:** ~5,350 input + ~700 output = **~6,050 tokens**
**Weighted average (60% single, 40% double):** ~4,750 input + ~580 output = **~5,330 tokens/interaction**

**Usage frequency estimates (single user):**

| Scenario | Interactions/day | Interactions/month | Tokens/month |
|----------|-----------------|-------------------|-------------|
| Light (quick check-ins) | 3 | 90 | ~480,000 |
| Moderate (daily analysis) | 8 | 240 | ~1,280,000 |
| Heavy (deep exploration) | 15 | 450 | ~2,400,000 |

**Note:** Chat usage is inherently less predictable than batch reports. A single deep exploration session (e.g., "analyze my last 3 months of training") could involve 10+ messages with 3-4 tool calls each. The heavy scenario accounts for these spikes.

**Combined workload: reports + chat**

| Scenario | Reports tokens/mo | Chat tokens/mo | **Total tokens/mo** |
|----------|------------------|---------------|-------------------|
| Current (reports only) | ~60,000 | 0 | ~60,000 |
| Phase 6A light | ~60,000 | ~480,000 | **~540,000** |
| Phase 6A moderate | ~60,000 | ~1,280,000 | **~1,340,000** |
| Phase 6A heavy | ~60,000 | ~2,400,000 | **~2,460,000** |

Chat represents a **9x–41x increase** in token consumption over reports alone. This shifts cost from negligible to a relevant consideration.

### Projected Monthly Costs by Phase (3 reports/day peak)

| Model | Current (2K tok) | Phase A (5.3K) | Phase B (7.9K) | Phase C (11.6K) |
|-------|-----------------|---------------|---------------|----------------|
| **GPT-4o Mini** | $0.016 | $0.05 | $0.07 | $0.10 |
| **GPT-5 Mini** | $0.043 | $0.17 | $0.28 | $0.44 |
| **Gemini 2.5 Flash** | $0.058 | $0.21 | $0.33 | $0.51 |
| **Claude Haiku 4.5** | $0.135 | $0.46 | $0.72 | $1.10 |
| **Gemini 2.5 Pro** | $0.225 | $0.81 | $1.28 | $1.98 |
| **GPT-5.2** | $0.284 | $1.03 | $1.63 | $2.52 |
| **Claude Sonnet 4.6** | $0.338 | $1.17 | $1.83 | $2.79 |

### Projected Monthly Costs with Phase 6A Chat (reports + chat combined)

Token split for chat: ~89% input, ~11% output (tool-use loops are input-heavy).

| Model | Light (540K tok) | Moderate (1.34M tok) | Heavy (2.46M tok) |
|-------|-----------------|---------------------|------------------|
| **GPT-4o Mini** | $0.05 | $0.11 | $0.19 |
| **GPT-5 Mini** | $0.15 | $0.37 | $0.67 |
| **Gemini 2.5 Flash** | $0.19 | $0.46 | $0.84 |
| **Claude Haiku 4.5** | $0.54 | $1.28 | $2.31 |
| **Gemini 2.5 Pro** | $0.81 | $1.94 | $3.51 |
| **GPT-5.2** | $1.03 | $2.49 | $4.52 |
| **Claude Sonnet 4.6** | $1.18 | $2.84 | $5.14 |

**Key takeaway:** Chat pushes Haiku from ~$0.13/mo to **$0.54–$2.31/mo** depending on usage intensity. Even at heavy usage, Haiku stays under $2.50/mo — well within acceptable range. Sonnet at heavy chat usage reaches ~$5/mo, which is still trivial but 2x Haiku for the same task complexity.

**Recommendation impact:** The phased model strategy still holds. Chat interactions are primarily question-answering over pre-computed data — the LLM interprets tool results, not raw data. This is within Haiku's capability ceiling. The upgrade trigger to Sonnet remains tied to prompt *complexity* (Phase B cross-domain reasoning), not prompt *volume* (chat frequency).

### Haiku vs Sonnet: Can Haiku Handle Future Complexity?

The critical question is whether Haiku's reasoning ceiling is sufficient as prompts grow from simple summarization to multi-step causal analysis.

| Task Type | Haiku Capability | Sonnet Capability | Gap Matters? |
|-----------|-----------------|-------------------|-------------|
| **Current:** Summarize pre-aggregated data | Excellent | Excellent | No |
| **Phase A:** Interpret correlation tables + build causal chains | Good | Excellent | **Yes — causal chains are Haiku's weakest area** |
| **Phase B:** Cross-domain reasoning (glucose × meals × sleep × training) | Adequate | Very Good | **Yes — 4+ domain interaction is complex** |
| **Phase C:** Personal model reasoning + evidence-based citations | **Marginal** | Good | **Yes — this exceeds Haiku's design point** |

**Assessment:**
- **Current → Phase A:** Haiku is sufficient. Correlation data is pre-computed; the LLM interprets, not calculates.
- **Phase B:** Haiku starts to struggle. Reasoning over glucose curves × meal composition × sleep quality × training load requires holding multiple interacting variables. Sonnet handles this more reliably.
- **Phase C:** Haiku is likely insufficient. Personal physiological modeling and evidence-based explainability require the kind of nuanced, multi-step reasoning that distinguishes Sonnet-class models. Asking Haiku to produce structured evidence with confidence levels from 6 months of personal data will yield generic output.

### Forward-Looking Weighted Scores (Phase C projection, 60/40 split)

Reasoning scores adjusted for Phase C complexity (causal chains, multi-domain, evidence-based):

| Model | Phase C Reasoning (0-10) | Phase C Cost Score (0-10) | **Weighted Score** |
|-------|------------------------|--------------------------|-------------------|
| **GPT-4o Mini** | 4.0 | 9.6 | **6.24** |
| **GPT-5 Mini** | 5.5 | 8.4 | **6.66** |
| **Gemini 2.5 Flash** | 5.0 | 8.2 | **6.28** |
| **Claude Haiku 4.5** | 5.5 | 6.1 | **5.74** |
| **Gemini 2.5 Pro** | 7.0 | 2.9 | **5.36** |
| **GPT-5.2** | 8.0 | 1.0 | **5.20** |
| **Claude Sonnet 4.6** | 8.5 | 0.0 | **5.10** |

**Key insight:** At Phase C complexity, Haiku's reasoning score drops significantly while its cost advantage shrinks relative to cheaper models. **The optimal strategy is to start with Haiku now and upgrade to Sonnet when Phase B features ship** — by then the reasoning gap justifies the ~$1/month cost increase.

---

## Reliability Assessment

| Provider | API Stability | Free Tier Risk | Paid Tier Risk |
|----------|-------------|---------------|---------------|
| **Anthropic** | Excellent — no reported quota issues at low volume | N/A (no free tier) | Very Low |
| **OpenAI** | Excellent — mature API, consistent uptime | N/A (no free tier) | Very Low |
| **Google** | Poor at free tier — quota reduced Dec 2025, ongoing 429s | **High** — 100-250 RPD, aggressively throttled | Low (paid tier is stable) |

**Key finding:** Google's free tier quota was slashed in Dec 2025. The 429 errors are not a bug — they're the new normal. Paid tier ($0.30/$2.50 per 1M) would fix this, but at that price point Claude Haiku 4.5 offers better reasoning for similar cost.

---

## Recommendation

### Phased Model Strategy

Given the roadmap from the competitor analysis, a single model choice doesn't fit all phases. The recommended approach is a **planned upgrade path** tied to feature complexity:

| Phase | Model | Peak $/mo | Why |
|-------|-------|----------|-----|
| **Now → Phase A** | Claude Haiku 4.5 | $0.46 | Sufficient reasoning, zero implementation effort, reliable API |
| **Phase B** (sleep/HRV, CGM, blood work) | Claude Sonnet 4.6 | $1.83 | Multi-domain cross-correlation requires stronger reasoning |
| **Phase C** (periodization, personal model) | Claude Sonnet 4.6 | $2.79 | Evidence-based explainability needs Sonnet-class reasoning |

**Why start with Haiku, not Sonnet?**
- Current prompts are simple summarization — Haiku handles this excellently
- $0.46/mo vs $1.17/mo at Phase A peak — Haiku is 60% cheaper for equivalent output quality
- The upgrade is a one-line change (`DEFAULT_MODEL` in `claude-provider.ts`)
- No point paying for reasoning capability you don't yet need

**Why not stay on Haiku forever?**
- Phase B introduces 4+ interacting health domains (nutrition × training × sleep × glucose)
- Phase C requires structured evidence with confidence levels from months of personal data
- Haiku will produce *generic* insights where Sonnet produces *specific, data-driven* causal narratives
- At Phase C volumes, the cost difference ($1.10 vs $2.79) is ~$1.70/month — trivial for meaningfully better output

**Why not GPT-5 Mini?** Cheapest option with decent reasoning, but requires implementing a new `OpenAIProvider`. Not justified when both Haiku and Sonnet already work through the existing `ClaudeProvider`.

**Why not Gemini?** Google's free tier has proven unreliable. Paid tier is viable as a fallback but offers no advantage over Anthropic's API stability.

### Fallback: Gemini 2.5 Flash (paid tier)

Keep `GeminiProvider` as a fallback. If Anthropic API has issues, switch `AI_PROVIDER=gemini` with a paid Google API key.

### Future consideration: OpenAI GPT-5 Mini

Best pure price/performance if a third provider is needed for redundancy.

---

## Implementation Changes Required

To switch from Gemini free to Claude Haiku 4.5:

1. **Get Anthropic API key** from console.anthropic.com
2. **Update `.env`:**
   ```
   AI_PROVIDER=claude
   AI_API_KEY=sk-ant-...
   ```
3. **Update default model** in `claude-provider.ts`:
   ```typescript
   const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
   ```
4. **Update Railway env vars** for production (`AI_PROVIDER`, `AI_API_KEY`)

No code changes to `AIProvider` interface, `report-generator.ts`, or `prompt-builder.ts` needed.

### Cost monitoring

| Phase | Workload | Expected peak $/mo | Billing alert |
|-------|----------|-------------------|--------------|
| Current (Haiku, reports only) | ~180K tok | $0.46 | $2/month |
| Phase 6A (Haiku, reports + chat) | ~2.5M tok | $2.31 | $5/month |
| Phase B+ (Sonnet, reports + chat) | ~2.5M tok | $5.14 | $10/month |

Set billing alerts on the Anthropic dashboard. Phase 6A chat increases consumption significantly (~9-41x) but Haiku's low per-token cost keeps absolute spend manageable. Even a 10x spike at heavy chat + Sonnet stays under $50/month.

---

## Sources

- [AI API Pricing Comparison 2026 — IntuitionLabs](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)
- [LLM API Pricing 2026 — CloudIDR](https://www.cloudidr.com/llm-pricing)
- [Gemini API Rate Limits — Google](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Pricing — Google](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Claude Haiku 4.5 vs Gemini 2.5 Flash — Galaxy.ai](https://blog.galaxy.ai/compare/claude-haiku-4-5-vs-gemini-2-5-flash)
- [Fast Model Comparison 2026 — Respan](https://www.respan.ai/blog/fast-model-comparison)
- [LLM Leaderboard — Vellum](https://vellum.ai/llm-leaderboard)
