# Research: Actionable Intelligence Features

**Date:** 2026-03-22
**Status:** Research Complete
**Goal:** Evaluate three feature ideas that extend the weekly AI report into actionable tools, compare against market competitors, and recommend a build/reject/modify decision for each.

**Related:** [Competitor Analysis (2026-03-11)](2026-03-11-competitor-analysis.md)

---

## 1. Feature Ideas Under Evaluation

| # | Feature | Original Concept |
|---|---------|-----------------|
| F1 | **Nutrition Plan Tuner** | Distributes macros/nutrients for existing meal plan, or helps user create one |
| F2 | **Workout Plan Tuner** | Modifies existing workout plan or creates a new one using Hevy data |
| F3 | **Actionable Item Tracking** | Tracks action items generated from weekly reports |

All three are tightly coupled to the weekly AI report system, which already generates categorized insights and action items across nutrition, workout, recovery, and general domains.

---

## 2. Current System State (What We Already Have)

### 2.1 AI Report System

The weekly report (`report-generator.ts`) produces structured output:

| Component | Type | Content |
|-----------|------|---------|
| `summary` | string | 1-2 sentence overview |
| `biometricsOverview` | string | Body comp + cardiac/autonomic tables |
| `nutritionAnalysis` | string | Daily averages, energy availability, micronutrient flags |
| `trainingLoad` | string | Session summaries, volume progression |
| `crossDomainCorrelation` | string | Cause-effect patterns across domains |
| `whatsWorking` | string | 3-5 positive trends |
| `hazards` | string | Severity-ranked risk list |
| `recommendations` | string | Immediate + medium-term actions |
| `scorecard` | Record | 6 dimensions scored 1-10 (nutritionConsistency, proteinTarget, trainingAdherence, recovery, bodyCompTrend, overallRiskLevel) |
| **`actionItems`** | ActionItem[] | **3-7 items with category, priority, text** |

The `ActionItem` type:
```typescript
interface ActionItem {
  category: 'nutrition' | 'workout' | 'recovery' | 'general';
  priority: 'high' | 'medium' | 'low';
  text: string;
}
```

**Key observation:** Action items are generated but ephemeral — they exist only in the report JSON. No persistence, no tracking, no follow-up, no outcome measurement.

### 2.2 Conversational AI (Phase 6A)

Fully built agentic chat system with 6 health tools:
- `query_nutrition` — daily nutrition summaries for date range
- `query_workouts` — workout sessions with sets/reps/weight
- `query_biometrics` — biometric measurements
- `query_exercise_progress` — per-exercise progression trends
- `get_latest_report` — most recent weekly report
- `list_available_metrics` — all metric types in DB

WebSocket streaming, conversation persistence, max 10 agentic tool-use iterations. **This infrastructure can be extended to support plan generation and action tracking via new tools.**

### 2.3 Nutrition Data

7 metrics tracked via EAV schema: `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg`. `DailyNutritionSummary` has optional `goalCalories/Protein/Carbs/Fat` fields — **never populated**. `daily_aggregates` materialized view exists but **is not actively queried**.

### 2.4 Workout Data

Per-set data from Hevy: exercise name, type, weight_kg, reps, duration, distance, RPE, set_type (normal/warmup/dropset/failure). Volume pre-calculated. `ExerciseProgress` tracks max weight, total volume, total sets per day. `WorkoutSession` groups sets by date+source.

**Known bugs:** Hevy pagination only fetches page 1 (10 workouts max), exercise name priority issue in normalizer.

### 2.5 WeeklyDataBundle

Already supports `workoutPlan?: string` and `userNotes?: string` — designed for plan awareness but not yet utilized.

---

## 3. Competitive Landscape

### 3.1 Feature 1: Nutrition Plan Tuning — Market Analysis

#### Key Competitors

| App | Adaptive TDEE | Meal Plan Gen | Workout-Aware Macros | Micronutrients | Self-Hosted | Price/yr |
|-----|:---:|:---:|:---:|:---:|:---:|---:|
| **MacroFactor** | Best-in-class | No | No | Partial | No | $72 |
| **RP Diet Coach** | Partial | Per-meal targets | **Yes** (carb modulation) | No | No | $120 |
| **Eat This Much** | No | **Yes** (full meals) | No | Partial | No | $60 |
| **Carbon Diet** | Yes | No | No | No | No | $80-100 |
| **MyFitnessPal** | No | **Yes** (new, AI) | Crude (+cals) | Partial | No | $100 |
| **Cronometer Gold** | No | Food suggestions | No | **Best** | No | $50 |
| **Hexis** | Partial | **Yes** | **Yes** (endurance) | Partial | No | ~$120 |
| **Strongr Fastr** | Partial | **Yes** | Partial | Partial | No | ~$60 |

#### The Gap

**No platform connects actual strength training data (sets/reps/volume/progressive overload from Hevy) to nutrition plan generation for strength athletes.**

- RP Diet adjusts carbs by workout count/intensity but uses crude heuristics, not actual training data
- Hexis translates endurance training calendars (TrainingPeaks) to nutrition but doesn't support strength training
- MacroFactor has the best adaptive TDEE but is completely blind to training data
- Eat This Much generates real meals but with static targets — no adaptation from any data source

**Market size:** AI in personalized nutrition: $1.59B (2025) → $17.72B by 2035 (27.4% CAGR).

#### Recommendation: MODIFY and BUILD

**Don't** try to be Eat This Much (full meal generation from recipe database). That's a different product requiring a food database, recipe engine, and grocery list — massive scope.

**Do** build a "macro intelligence layer" that:
1. Classifies training days by type/intensity from actual Hevy data (leg day, push day, rest day, deload week)
2. Adjusts daily macro targets based on training day type and body composition goals
3. Shows current intake vs. adjusted targets with gap analysis
4. Uses AI chat to suggest specific food swaps to close macro gaps
5. Over time, learns which macro distributions correlate with best training performance for this specific user

This is differentiated because it uses **real training data** (not self-reported activity level) and **real nutrition data** (not estimated intake) — a combination no competitor has.

### 3.2 Feature 2: Workout Plan Tuning — Market Analysis

#### Key Competitors

| App | AI Adapts Per-Session | Uses Weight History | Sleep/Nutrition Input | Public API | Price/yr |
|-----|:---:|:---:|:---:|:---:|---:|
| **Hevy** | Limited (Trainer) | Yes | No | **Full REST** | $60 |
| **JuggernautAI** | Yes (multi-timescale) | Yes | Yes (self-reported) | No | $350 |
| **RP Hypertrophy** | Yes (RPE-driven) | Yes | No | No | $225-300 |
| **Fitbod** | Yes (muscle freshness) | Yes (150M+ workouts) | No | No | $96 |
| **Dr. Muscle** | Yes (3 overload methods) | Yes | Fatigue trigger only | No | $400 |
| **JEFIT** | Yes (4 AI engines) | Yes | No | No | $40-70 |

#### The Gap

**No competitor combines actual workout data + actual nutrition data for programming decisions.**

- JuggernautAI ($350/yr) comes closest but uses self-reported check-in ratings for sleep/nutrition, not actual data
- Fitbod has the most mature single-domain AI (trained on 150M+ workouts) but no nutrition/sleep awareness
- **Hevy has a full REST API with routine CRUD endpoints** — meaning Vitals could potentially READ workout history AND WRITE optimized routines back to Hevy

#### Critical Discovery: Hevy API Two-Way Bridge

Hevy's API (Swagger docs at `api.hevyapp.com/docs/`) includes:
- `GET/POST/PUT` workouts
- `GET/POST/PUT` routines and routine folders
- `GET` exercise templates
- Webhook subscriptions

This means Vitals could:
1. Read the user's current routine structure from Hevy
2. Analyze it alongside nutrition/recovery data
3. Push modified routines back to Hevy

**No other tool does this bidirectionally.** The user trains with Hevy's familiar UI → Vitals analyzes → Vitals pushes an adapted routine back.

#### Recommendation: MODIFY and BUILD (Phase 2)

**Don't** try to be Fitbod/JuggernautAI (full autonomous program generation). That requires deep periodization domain expertise and a training ML model — massive scope.

**Do** build a "training intelligence layer" that:
1. Reads current Hevy program structure via API (routines, exercise selection, set/rep schemes)
2. Analyzes volume/intensity trends over rolling windows to detect training phase
3. Flags issues using cross-domain data: "Your training volume increased 40% but calories are in a 500kcal deficit — recovery risk is high"
4. Makes specific, data-backed adjustment recommendations via AI report and chat
5. (Future) Offers to push modifications back to Hevy via routine CRUD API

This is differentiated because it's the only tool that provides **nutrition-aware training intelligence** while letting users keep their preferred workout tracker (Hevy).

### 3.3 Feature 3: Action Item Tracking — Market Analysis

#### How Existing Apps Handle Follow-Through

| Approach | Examples | How It Works | Limitation |
|----------|---------|-------------|-----------|
| **Passive loop** | Whoop, Oura, Garmin | Device recommends → passively measures outcome → adjusts | No conscious user engagement |
| **Algorithmic loop** | MacroFactor | Measures actual data → algorithm adjusts targets weekly | No explicit action tracking — "adherence-neutral" |
| **Coaching loop** | Noom (Welli + human coaches) | AI handles info → humans handle accountability | Expensive, unscalable |
| **Checklist loop** | Gyroscope ($39/mo) | Fixed 12-step protocol → wearable verification | Not dynamic or personalized |

#### The Universal Gap

**No product in the market currently:**
1. Generates **personalized** action items from a user's **specific data** (not generic protocols)
2. Lets the user explicitly **accept/track/complete** them
3. **Measures** whether completing them moved the needle on the target metric
4. Shows the **causal chain**: "You followed 4/5 sleep recommendations → average sleep quality improved from 72 to 81"
5. **Feeds back** into the next report cycle

This is "Tier 5" of the closed-loop hierarchy — dynamic AI-generated action items with outcome verification. It doesn't exist yet.

#### Key Design Insights from Research

1. **MacroFactor's "adherence-neutral" principle** — Don't guilt users for not following advice. Adapt from reality.
2. **Streak anxiety is real** — Users are 2.3x more engaged after 7+ day streaks but fear of breaking streaks creates negative emotions. Prefer milestones over streaks.
3. **Noom's finding on AI accountability** — "People feel accountability to humans in a way they don't to AI." The action item system should feel like a personal tool, not a nagging coach.
4. **Exist.io's wisdom** — Correlations describe relationships but can't determine cause. Be honest about confidence levels.

#### Recommendation: BUILD (Highest Priority)

Action item tracking is the **connective tissue** that makes Features 1 and 2 meaningful. Without it, nutrition and workout intelligence are just more report text that gets read and forgotten.

**Build a closed-loop action item system that:**
1. Promotes report action items to persistent, trackable entities in the database
2. User can accept, defer, reject, or complete each item
3. Each item has a target metric and expected direction (e.g., "protein_g should increase")
4. System automatically measures whether the target metric improved after completion
5. Attribution report: "Of 12 completed items this month, 8 correlated with positive metric changes"
6. Incomplete items feed back into next report context (adherence-neutral)
7. Action items have lifecycle: active → completed/expired/superseded

---

## 4. Synthesis: Recommended Feature Architecture

### The Insight → Action → Outcome Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    WEEKLY AI REPORT                          │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │Nutrition │ │ Training │ │ Recovery │ │Cross-Domain   │   │
│  │Analysis  │ │  Load    │ │ Metrics  │ │Correlation    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘   │
│       └──────────┬──┴───────────┘               │            │
│                  ▼                               │            │
│          ┌──────────────┐                        │            │
│          │ ACTION ITEMS │◄───────────────────────┘            │
│          │ (F3 - Core)  │                                     │
│          └──────┬───────┘                                     │
└─────────────────┼───────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌─────────┐  ┌──────────┐
│Nutrition│  │Workout  │  │Recovery/ │
│Actions  │  │Actions  │  │General   │
│         │  │         │  │Actions   │
└────┬────┘  └────┬────┘  └────┬─────┘
     │            │            │
     ▼            ▼            ▼
┌────────┐  ┌─────────┐  ┌──────────┐
│F1:Macro│  │F2:Train │  │Track &   │
│Tuner   │  │Intel    │  │Measure   │
│(deeper │  │(deeper  │  │          │
│ tools) │  │ tools)  │  │          │
└────┬────┘  └────┬────┘  └────┬─────┘
     │            │            │
     └──────────┬─┴────────────┘
                ▼
     ┌─────────────────┐
     │OUTCOME TRACKING │
     │Did metrics move? │
     │Attribution report│
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │NEXT WEEK REPORT │
     │(includes action  │
     │ item follow-up)  │
     └─────────────────┘
```

### Recommended Build Order

| Priority | Feature | Rationale | Effort | Dependencies |
|:---:|---------|-----------|:---:|-------------|
| **1** | **F3: Action Item Tracking** | Foundation layer. Makes all other features meaningful. Extends existing `ActionItem` type. | Medium | None — extends existing report system |
| **2** | **F1: Nutrition Macro Tuner** | Largest market gap. Uses existing nutrition + workout data. Extends AI chat with new tools. | Medium-High | F3 (for tracking nutrition actions) |
| **3** | **F2: Workout Training Intel** | High differentiation (Hevy two-way bridge). More complex domain. | High | F3 (for tracking workout actions), Hevy API research |

### Why This Order

1. **F3 first** because it's the connective tissue. Without tracking, F1 and F2 generate insights that get forgotten.
2. **F1 second** because the nutrition gap is the largest in the market and Vitals already has both data streams needed (Cronometer + Hevy).
3. **F2 third** because it has the highest ceiling (Hevy two-way bridge is unique) but also the highest complexity and an external API dependency that needs validation.

---

## 5. Detailed Feature Specifications

### 5.1 Feature 3: Action Item Tracking System

**What it is:** A persistent, closed-loop system that promotes ephemeral report action items into trackable entities with outcome measurement.

**Core capabilities:**
1. **Persistence** — Action items stored in DB with lifecycle states (active, completed, expired, deferred, superseded)
2. **User interaction** — Accept, defer, reject, complete, snooze action items
3. **Target metrics** — Each action item optionally linked to a measurable metric and expected direction
4. **Outcome measurement** — Automatic comparison of target metric before vs. after action completion
5. **Attribution** — Monthly rollup: "Of N completed items, X correlated with positive metric changes"
6. **Report integration** — Next week's report receives action item follow-up context: what was completed, what was deferred, what improved
7. **Chat integration** — New AI tool: `query_action_items` — chat can reference active/completed items

**UX patterns (informed by research):**
- Adherence-neutral (MacroFactor principle): no guilt, just adaptation
- Milestones over streaks (avoid streak anxiety)
- Low friction: accept with one tap, complete with one tap
- Transparent confidence: show correlation strength, not certainty

**Data model (conceptual):**
```
action_items table:
  id, user_id, report_id (source), category, priority, text,
  target_metric, target_direction (increase/decrease/maintain),
  baseline_value, outcome_value,
  status (active/completed/expired/deferred/superseded),
  created_at, due_by, completed_at, outcome_measured_at
```

### 5.2 Feature 1: Nutrition Macro Tuner

**What it is:** An AI-powered macro intelligence layer that adjusts daily nutrition targets based on actual training data and body composition goals.

**Core capabilities:**
1. **Training day classification** — Automatically classify each day from Hevy data: heavy lower, heavy upper, moderate, light/cardio, rest, deload
2. **Dynamic macro targets** — Adjust calorie and macro targets per day type:
   - Heavy training days: +10-15% calories, higher carbs for recovery
   - Rest days: maintenance or slight deficit, standard protein
   - Deload weeks: slight deficit opportunity
3. **Gap analysis** — Compare actual intake (Cronometer) vs. adjusted targets, highlight shortfalls
4. **AI food suggestions** — Via chat: "I need 40g more protein and 60g carbs for today — what should I eat?" with context-aware suggestions
5. **Personal response modeling** — Over time, correlate specific macro distributions with training performance to build individual nutrition profiles
6. **Goal integration** — Populate the currently-empty `goalCalories/Protein/Carbs/Fat` fields in `DailyNutritionSummary`

**What it is NOT:**
- Not a meal planner (no recipe database, no grocery lists)
- Not a food tracker (Cronometer handles that)
- The intelligence layer that makes existing tracking data more actionable

**New AI chat tools:**
- `get_macro_targets` — returns today's adjusted targets based on training schedule
- `analyze_nutrition_gaps` — compares recent intake vs. targets, suggests corrections

### 5.3 Feature 2: Workout Training Intelligence

**What it is:** A cross-domain training analysis layer that uses nutrition, recovery, and workout data to provide intelligent programming recommendations.

**Core capabilities:**
1. **Hevy program analysis** — Read current routine structure via API (exercises, set/rep schemes, frequency)
2. **Volume/intensity trend detection** — Rolling 4-week analysis to detect: accumulation, intensification, peaking, deload phases
3. **Cross-domain flags** — Detect mismatches:
   - High volume + caloric deficit + poor sleep → recovery risk alert
   - Plateau detected + protein below target → nutrition-related stall flag
   - Deload week + caloric surplus → opportunity flag
4. **Exercise-specific insights** — "Your bench press progresses better on weeks with >2200 cal intake and >150g protein"
5. **Adjustment recommendations** — Specific, data-backed suggestions via report and chat
6. **Hevy routine push** (future) — Offer to modify routines in Hevy via API

**Prerequisites to validate:**
- Hevy API routine read/write endpoints — test availability and rate limits
- Exercise template mapping completeness
- Fix existing Hevy pagination bug first (currently only fetches 10 workouts)

**New AI chat tools:**
- `analyze_training_phase` — returns detected phase with supporting data
- `get_workout_nutrition_correlation` — returns how nutrition metrics correlate with training performance

---

## 6. Competitive Positioning

### What No Competitor Can Do (That Vitals Can)

| Capability | Closest Competitor | Why They Can't |
|------------|-------------------|----------------|
| Nutrition targets from actual training data | RP Diet (crude heuristics) | No access to Hevy/workout log data |
| Training recs from actual nutrition data | JuggernautAI (self-reported) | No access to Cronometer/nutrition data |
| Closed-loop action tracking with outcome measurement | Gyroscope (fixed protocol) | Generic protocol, not personalized from multi-domain data |
| Cross-domain causal narratives | Exist.io (correlations only) | No actionable recommendations, no follow-through tracking |
| Self-hosted, data-sovereign AI health intelligence | None | Every competitor is SaaS with no self-hosting option |
| Two-way Hevy bridge (analyze → push routines) | None | No competitor integrates with Hevy's API bidirectionally |

### Positioning Statement

**Vitals is the only self-hosted health intelligence platform that connects what you eat (Cronometer), what you lift (Hevy), and how you recover (Apple Health/wearables) into a single AI engine that generates personalized, trackable action items with measurable outcome verification.**

No subscription. No data sharing. Your data, your infrastructure, your intelligence.

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|:---:|:---:|-----------|
| Hevy API changes/breaks | Medium | High (F2) | Abstract behind DataProvider interface; fallback to CSV import |
| LLM generates poor nutrition/training advice | Medium | High | Strong prompt engineering, evidence-based constraints, confidence levels, "not medical advice" disclaimers |
| Action item fatigue (users ignore them) | Medium | Medium | Limit to 3-5 active items, adherence-neutral design, auto-expire stale items |
| Scope creep into meal planning/recipe generation | High | Medium | Clear boundary: macro intelligence, not meal planning. Food suggestions via chat only. |
| Hevy pagination bug masks training history | High | High | **Must fix before F2.** Currently only 10 workouts fetched. |

---

## 8. Open Questions for User Decision

1. **Hevy API validation** — Should we investigate the Hevy routine CRUD endpoints before committing to F2's two-way bridge?
2. **Nutrition goal source** — Where should macro targets come from initially? User-configured? AI-recommended based on body comp goals? Both?
3. **Action item UI** — Dashboard widget? Dedicated page? Chat-integrated? All three?
4. **Build all three or start with one?** — F3 is recommended first, but should we plan all three as phases of one initiative, or treat them as separate features?

---

## Sources

### Nutrition Competitors
- MacroFactor: macrofactor.com, outlift.com/macrofactor-review, nutriscan.app
- RP Diet: rpstrength.com, feastgood.com
- Eat This Much: eatthismuch.com, wellnesspulse.com
- Carbon Diet: joincarbon.com, feastgood.com
- Cronometer: cronometer.com/gold, cronometer.com/blog
- Hexis: hexis.live, trainingpeaks.com/partners/hexis
- Strongr Fastr: strongrfastr.com
- AI Startups: PlanEat AI, MealThinker, Ollie (Washington Post Aug 2025)
- Market Size: insightaceanalytic.com ($1.59B → $17.72B by 2035)

### Workout Competitors
- Hevy: hevyapp.com, api.hevyapp.com/docs (Swagger)
- JuggernautAI: juggernautai.app, garagegymreviews.com, powerliftingtechnique.com
- RP Hypertrophy: rpstrength.com/pages/hypertrophy-app
- Fitbod: fitbod.me (150M+ workouts trained)
- Dr. Muscle: dr-muscle.com
- JEFIT: jefit.com
- Smart Rabbit: smartrabbitfitness.com (Claude 4.5 Sonnet, 3000+ line expert prompt)
- Hevy MCP Server: github.com/chrisdoc/hevy-mcp

### Action Item Tracking
- Whoop: whoop.com (passive loop, strain coach)
- MacroFactor: macrofactor.com (adherence-neutral algorithm)
- Noom/Welli: medium.com/noom-engineering (AI delegates accountability to humans)
- Gyroscope: gyrosco.pe ($39/mo, 12-step fixed protocol)
- Exist.io: exist.io (correlations without recommendations)
- Beeminder: beeminder.com (commitment contracts)
- Academic: PMC articles on AI coaching effectiveness, streak psychology

---

## Implementation Update — 2026-04-11

F2 "Workout Training Intelligence" has been sliced: its first concrete deliverable — the **Workout Plan Fine Tuner** — has shipped as a standalone feature. See:
- Use cases: `docs/product-capabilities.md` §7 (UC-PLAN-01 through UC-PLAN-05)
- ADE task artifacts: `.ade/tasks/workout-plan-tuner/` (intent, research, plan, verification, retro)
- Migration: `packages/backend/src/db/migrations/011_workout_plans.sql`

The v1 scope is a **fine tuner** (modifies an existing plan) rather than the full F2 "training intelligence layer". Key architectural decisions that emerged during implementation:
- **Rule-first candidate generation** — backend code emits the legal candidate set per exercise (hold / progress / deload / swap), LLM picks one and writes rationale. Eliminates hallucinated unsafe loads.
- **Structural evidence requirement** — every LLM selection must cite ≥1 evidence reference or the tuner retries once then errors.
- **Plan-level safety caps** — ±10% load per exercise, ≤1.3× weekly volume (ACWR), max 40% of exercises changed per batch. Hard-coded, not prompt-level.
- **Prompt-injection defense** — PR #58's `flagSuspiciousInput` is applied to all user-pasted plan fields before LLM prompting.

F2 items still open for future phases: full program generation, Hevy routine two-way bridge (needs pagination bug fix first), training-phase detection, F3 action-item coupling.
