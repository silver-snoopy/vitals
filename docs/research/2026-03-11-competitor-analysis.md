# Research: Competitor Analysis & Market Gap Assessment

**Date:** 2026-03-11
**Status:** Research Complete
**Goal:** Identify where Vitals can differentiate against MacroFactor and peers, focusing on gaps that quantified-self enthusiasts consider unsolved.

---

## 1. Vitals Today — Current Capabilities

Vitals is a self-hosted health data platform that aggregates multiple data sources into a unified PostgreSQL store with AI-powered analysis.

| Capability | Implementation |
|------------|---------------|
| Nutrition tracking | Cronometer provider (scraper) → EAV `measurements` table |
| Workout tracking | Hevy provider (API) → `workout_sets` table |
| Biometrics | Apple Health XML upload → `measurements` table |
| AI weekly reports | Claude via `prompt-builder.ts` → summary, insights, action items |
| Dashboard | React + Recharts — nutrition charts, workout volume, weight trends, weekly KPIs |
| Automation | n8n workflows — daily collection, weekly report generation |
| Data model | EAV pattern (flexible metrics), idempotent batch upserts, materialized aggregates |
| Architecture | Self-hosted, TypeScript monorepo, extensible `DataProvider` interface |

**Key structural advantage:** All health data already lives in one database. The EAV schema means new metric types (HRV, glucose, hormones) require zero schema changes — just new providers.

---

## 2. Competitive Landscape Matrix

| App | Nutrition | Workouts | Sleep/HRV | Biomarkers | CGM | Cross-correlation | AI Coaching | Self-hosted | Open Data |
|-----|:---------:|:--------:|:---------:|:----------:|:---:|:-----------------:|:-----------:|:-----------:|:---------:|
| **Vitals** | Yes | Yes | Partial | Partial | No | No (yet) | Yes (Claude) | Yes | Yes |
| **MacroFactor** | Best-in-class | No | No | No | No | No | Algorithm | No | No |
| **Cronometer** | Strong (micros) | No | No | No | No | No | No | No | Export |
| **MyFitnessPal** | Large DB | Minimal | No | No | No | No | No | No | No |
| **Whoop** | No | Strain score | Yes | No | No | No | Recovery coach | No | No |
| **Oura** | No | Activity | Yes | No | Dexcom | Minimal | Readiness | No | API |
| **Garmin Connect** | No | Yes | Yes | No | No | Minimal | Training status | No | Export |
| **InsideTracker** | No | Integrated | Integrated | Blood work | No | Yes | Yes | No | No |
| **Levels/Stelo** | Meal logging | No | No | No | Yes | Glucose↔meals | Minimal | No | No |
| **RP Diet Coach** | Yes | Phase-aware | No | No | No | No | Periodized macros | No | No |
| **Strong/Hevy** | No | Best UX | No | No | No | No | No | No | CSV |
| **Exist.io** | Integrated | Integrated | Integrated | No | No | Statistical | Correlations | No | API |
| **Gyroscope** | Integrated | Integrated | Integrated | No | No | Dashboard | Score-based | No | No |

**Key takeaway:** No single platform covers all columns. InsideTracker comes closest on cross-correlation but is expensive ($590+/year), closed-source, and requires their blood test kits. Exist.io does statistical correlation but lacks depth — it tells you "when you sleep more, you walk more" without causal analysis or actionable recommendations.

---

## 3. What MacroFactor Does Well (and Where It Stops)

### Strengths
- **Dynamic TDEE algorithm**: Adjusts weekly based on actual weight change vs. calorie intake. The gold standard for adaptive calorie coaching.
- **Fastest food logging**: Barcode scanning, recipe builder, quick-add — users report 3-5 min/day average.
- **Verified food database**: Curated entries reduce the "garbage in" problem that plagues MyFitnessPal.
- **Transparent pricing**: All features available to all subscribers. No freemium upsell.
- **Results**: Users report average 35-pound weight loss over a year of consistent use.

### Where MacroFactor Stops
1. **Nutrition-only scope** — Zero awareness of training intensity, sleep quality, recovery status, or biomarkers. Your macros don't change whether you slept 4 hours or 9.
2. **Mobile-only** — No desktop or web access. Power users who want to analyze data on a large screen are stuck.
3. **Black-box algorithm** — The TDEE adjustment is proprietary. Users can't see the formula, validate the math, or understand why their calories changed.
4. **No periodization** — Whether you're in a deload week or peaking for competition, MacroFactor treats you the same. RP Diet Coach addresses this but lacks MacroFactor's algorithm quality.
5. **No recovery awareness** — A hard leg day followed by poor sleep doesn't shift your next day's carb target. It should.
6. **Locked data** — No API, no raw export of the algorithm's internal state. Your historical TDEE estimates are trapped.
7. **Subscription-only, no trial** — 7-day trial widely considered insufficient to evaluate an algorithm that needs 2-3 weeks of data.

---

## 4. The Five Gaps Enthusiasts Are Screaming About

Based on recurring themes from r/quantifiedself, r/macrofactor, r/fitness, r/nutrition, Quantified Self forums, and health-tech blogs (2024–2026).

### Gap 1: The Data Silo Problem

> "I use MacroFactor for food, Whoop for recovery, Strong for lifting, and Cronometer for micros. None of them talk to each other. I manually dump everything into a spreadsheet on Sundays." — r/quantifiedself

**The problem:** Health data is fragmented across 3-5+ apps that don't interoperate. Users who track seriously end up building personal data warehouses in Google Sheets or Notion.

**What exists:** Exist.io and Gyroscope aggregate data from multiple sources but provide only shallow correlation ("you walk more on days you sleep more"). No platform performs deep cross-domain analysis with actionable output.

**What's needed:** A unified store that ingests nutrition, training, sleep/HRV, biomarkers, and glucose into one model — then surfaces non-obvious relationships between them.

**Vitals' position:** Already has the unified store. The `measurements` EAV table + `workout_sets` + `daily_aggregates` materialized view are purpose-built for this. Missing piece: correlation analysis and more data providers.

### Gap 2: Black Box Algorithms

> "MacroFactor lowered my calories by 200 this week. Why? I gained 0.3 lbs but also started creatine. It can't distinguish water retention from fat gain." — r/macrofactor

**The problem:** Every major coaching app uses proprietary algorithms. Users can't understand, validate, or override the reasoning. When the algorithm makes a bad call (and they all do), users are powerless.

**What exists:** MacroFactor shows weight trend smoothing and expenditure graphs but not the underlying formula. Whoop's "recovery score" is completely opaque. Oura's "readiness" weights HRV, temperature, and sleep — but users can't see the weights.

**What's needed:** Explainable recommendations. Show the data points, the formula, the confidence interval, and the research backing each suggestion. Let users override with reason logging.

**Vitals' position:** AI reports via Claude can be made fully transparent — include the data that drove each insight, cite the statistical relationship, reference published research. The prompt and response are both inspectable.

### Gap 3: No Causal Chain Modeling

> "I know my sleep affects my workouts and my workouts affect my appetite. But nothing shows me the chain: bad sleep → high cortisol → glucose spike → overate carbs → poor workout next day." — Quantified Self forum

**The problem:** Even apps that track multiple domains present them as independent dashboards. Sleep is one tab, nutrition is another, workouts is a third. Nobody connects the dots across time.

**What exists:** InsideTracker shows some biomarker correlations longitudinally. Welltory connects HRV to stress events. But nobody builds multi-step causal narratives.

**What's needed:** Temporal cross-domain analysis that identifies chains of cause and effect. "Your sleep quality dropped → next morning glucose was elevated → you consumed 400 more carbs than target → evening HRV was suppressed → next workout RPE was unusually high."

**Vitals' position:** All data is timestamped in one database. The AI layer (Claude) excels at narrative construction from structured data. The `WeeklyDataBundle` interface already bundles nutrition, workouts, and biometrics — extending it with temporal lag analysis is incremental.

### Gap 4: Periodization-Blind Nutrition

> "I'm in a peaking block for powerlifting. My calories should be different than when I'm in an accumulation block. MacroFactor has no concept of training phases." — r/powerlifting

**The problem:** Nutrition coaching apps treat every week the same. But training periodization demands different fueling strategies: accumulation blocks need surplus calories and high protein; deload weeks need maintenance or slight deficit; peaking requires precise carb timing.

**What exists:** RP Diet Coach adjusts macros by training phase but requires manual phase selection. No app automatically detects training phase from workout patterns. Nobody accounts for hormonal cycle phase in macro targets.

**What's needed:** Automatic training phase detection from volume/intensity trends, with macro target adjustment. Optional hormonal cycle phase overlay. Recovery-aware daily adjustments based on previous night's sleep and HRV.

**Vitals' position:** Workout data is already captured with sets, reps, and weight. Volume/intensity trend detection is a pure analytics problem. Combined with sleep and biometric data, Vitals could build phase-aware nutrition that no competitor offers.

### Gap 5: Privacy & Data Ownership

> "I stopped using MyFitnessPal when they got breached. 150 million accounts. Under Armour sold the data to Francisco Partners. My food diary is mine." — r/privacy

**The problem:** 80% of popular fitness apps sell user data to third parties. Major breaches (MyFitnessPal 2018: 150M accounts, Strava heatmap military base exposure) have eroded trust. Users who track intimate health data (body composition, menstrual cycles, blood work) are increasingly concerned.

**What exists:** Open-source alternatives exist (wger, OpenTracks, FitoTrack) but are single-domain and lack the analytics layer. No privacy-first platform combines multiple data domains with AI analysis.

**What's needed:** Self-hosted or end-to-end encrypted health platform where the user controls the database, the API keys, and the data lifecycle. Full export capability. No vendor lock-in.

**Vitals' position:** This is Vitals' strongest differentiator. Self-hosted PostgreSQL, user-owned API keys, no third-party data sharing, full SQL access to raw data. No competitor in the "smart health platform" space offers this.

---

## 5. The "Deeper Than MacroFactor" Opportunity

Feature recommendations ranked by impact and feasibility, starting from Vitals' existing architecture.

### Tier 1: High Impact, Builds on Existing Architecture

These features leverage what Vitals already has — unified data store, AI integration, provider pattern.

#### 1.1 Cross-Domain Correlation Engine

**What enthusiasts want:** "Show me how my protein intake affects my workout performance two days later."

**Why existing solutions fail:** Apps operate in silos. MacroFactor doesn't know your sleep. Whoop doesn't know your macros. Exist.io computes correlations but only as trivia ("you sleep more on weekdays") — not actionable intelligence.

**Implementation concept:**
- Query `daily_aggregates` for rolling windows (7d, 14d, 30d)
- Compute Pearson/Spearman correlations between metric pairs with configurable time lags (0–3 days)
- Store significant correlations (p < 0.05) in a `correlations` table
- Surface top correlations in dashboard and feed them into AI report prompts
- Example output: "Over the past 30 days, nights with >7h sleep correlated with +15% higher workout volume the next day (r=0.72, p=0.003)"

**Vitals advantage:** `daily_aggregates` materialized view already pre-computes daily rollups across all metrics. This is a query + stats layer on top of existing data.

#### 1.2 Enhanced AI Reports with Causal Narratives

**What enthusiasts want:** Not "you ate 2400 cal this week" but "your Tuesday sleep dip cascaded into Wednesday's glucose spike and Thursday's missed protein target — here's the chain and here's how to interrupt it next time."

**Why existing solutions fail:** Every AI health chatbot (Noom's Welli, Fitia, CalAI) generates generic advice. None have access to multi-domain personal data to construct individualized causal stories.

**Implementation concept:**
- Extend `WeeklyDataBundle` with cross-domain correlation results and multi-week trend data
- Upgrade `prompt-builder.ts` to include:
  - Top 5 significant correlations from the past 30 days
  - Detected anomaly chains (e.g., sleep dip → glucose spike → calorie overshoot)
  - Comparison to personal baselines (not population averages)
- Ask Claude for structured causal narrative with confidence levels and citations
- Include the data and reasoning in the report (transparent, not black-box)

**Vitals advantage:** The `AIProvider` interface and `prompt-builder.ts` are already in place. This is a prompt engineering + data enrichment task.

#### 1.3 Transparent Adaptive TDEE Engine

**What enthusiasts want:** MacroFactor's algorithm, but open and explainable.

**Why existing solutions fail:** MacroFactor's TDEE is proprietary. Users report frustration when it adjusts incorrectly (creatine loading misread as fat gain, water weight from sodium, menstrual cycle fluctuations).

**Implementation concept:**
- Exponentially-weighted moving average of daily calorie intake vs. weight trend
- Adaptive smoothing factor based on data consistency
- Formula and intermediate values exposed in dashboard ("Your 14-day smoothed TDEE is 2,650 kcal. Weight trend: -0.15 kg/week. Adjustment: +50 kcal to slow loss rate.")
- Allow manual override with reason logging ("started creatine", "sodium-heavy meals", "menstrual cycle")
- Open-source the algorithm — publish the formula in docs

**Vitals advantage:** Weight and calorie data already in the database. The algorithm is well-documented in research literature (Lyle McDonald's approach, NIDDK body weight planner math). Building it transparently is a differentiator, not a technical challenge.

### Tier 2: Medium Impact, New Integrations Required

#### 2.1 Wearable Sleep/HRV Integration (Oura, Whoop, Garmin)

**What enthusiasts want:** Recovery data that feeds into nutrition and training recommendations.

**Why existing solutions fail:** Whoop deliberately limits data export. Oura has an API but nobody consumes it for nutrition adjustment. Garmin exports to Garmin Connect only.

**Implementation concept:**
- New `DataProvider` implementations: `oura/`, `whoop/`, `garmin/`
- Ingest sleep stages, HRV (rMSSD), respiratory rate, skin temperature into `measurements`
- New `BiometricMetric` values: `hrv_rmssd`, `sleep_deep_min`, `sleep_rem_min`, `sleep_latency_min`, `respiratory_rate`, `skin_temp_deviation`
- Feed into correlation engine and AI reports

**API availability (as of 2026):**
- Oura: Full REST API, OAuth2, well-documented. Sleep stages, HRV, activity, readiness.
- Whoop: API v2 exists but limited. Core metrics available. Rate-limited.
- Garmin: Health API available through developer program. Sleep, HRV, stress, body battery.

**Vitals advantage:** `DataProvider` interface is designed for exactly this. Adding a new provider is a self-contained module with `collect(startDate, endDate)` returning a `CollectionResult`.

#### 2.2 CGM / Glucose Data Integration

**What enthusiasts want:** "Show me how my post-workout meal affects my glucose curve, and whether that varies by sleep quality the night before."

**Why existing solutions fail:** Levels and Stelo show glucose but only correlate with manually logged meals. No integration with structured nutrition data (macros, micros) or training load.

**Implementation concept:**
- Provider for Dexcom Clarity API or LibreLink (via LibreLinkUp)
- Ingest 5-minute glucose readings into `measurements` (metric: `glucose_mg_dl`)
- Compute derived metrics: time-in-range, glucose variability (CV), post-meal AUC
- Correlate with meal composition (from Cronometer data), workout timing, and sleep quality
- Example insight: "Your glucose spike after high-GI carbs is 40% smaller when consumed within 2 hours of resistance training"

**Vitals advantage:** Nutrition data with macronutrient breakdown already exists. Overlaying glucose on meal timing is a join + time-window analysis.

#### 2.3 Blood Work / Biomarker Import

**What enthusiasts want:** "Track my testosterone, cortisol, ferritin, and thyroid alongside my training volume over 12 months. Show me if my cut is tanking my hormones."

**Why existing solutions fail:** InsideTracker does this but costs $590+/year, requires their test kits, and is a closed platform. No self-hosted option exists.

**Implementation concept:**
- CSV import for lab results (common lab report format)
- FHIR R4 endpoint for structured health record ingestion (future-proof)
- New metric categories: `hormone`, `lipid`, `metabolic`, `hematologic`
- Longitudinal trending with reference ranges and personal baselines
- AI report enrichment: "Your ferritin has dropped 30% over 3 months of caloric deficit. Consider iron-rich foods or supplementation."

**Vitals advantage:** EAV schema handles arbitrary metrics. A blood panel is just 15-20 new `(metric, value, unit)` rows per test date. No schema changes needed.

### Tier 3: High Impact, Requires Research

#### 3.1 Periodization-Aware Nutrition

**What enthusiasts want:** "My macros should automatically shift when I enter a deload week or switch from hypertrophy to strength."

**Why existing solutions fail:** RP Diet Coach requires manual phase selection. MacroFactor ignores training phase entirely. No app detects phase from workout data.

**Implementation concept:**
- Analyze `workout_sets` for volume/intensity trends over rolling 4-week windows
- Classify training phase: accumulation (high volume, moderate intensity), intensification (moderate volume, high intensity), peaking (low volume, max intensity), deload (reduced across board)
- Adjust macro targets by phase:
  - Accumulation: higher calories (+10-15%), high carb for recovery
  - Intensification: maintenance calories, high protein, moderate carb
  - Peaking: slight surplus, precision carb timing around sessions
  - Deload: slight deficit opportunity, maintenance protein
- Optional hormonal cycle overlay: follicular phase (higher carb tolerance, higher training capacity) vs. luteal phase (increased metabolic rate, lower carb tolerance)

**Research required:** Training phase detection heuristics from set/rep/weight data. Validated macro adjustment ranges by phase. Cycle phase interaction effects.

#### 3.2 Explainable Recommendation Engine

**What enthusiasts want:** "Don't just tell me to eat more protein. Tell me which data points led to that recommendation, how confident you are, and what research supports it."

**Why existing solutions fail:** Every health app AI is a black box. Noom's Welli uses "behavioral psychology" but doesn't cite sources. MacroFactor's algorithm is proprietary. Whoop's recovery score is unexplained.

**Implementation concept:**
- Each AI recommendation includes:
  - **Data basis**: The specific measurements that triggered it (with values and dates)
  - **Correlation strength**: r-value and p-value from the correlation engine
  - **Confidence level**: High (>30 days of data, r>0.7), Medium (14-30 days, r>0.5), Low (<14 days or r<0.5)
  - **Research citation**: Link to relevant study or meta-analysis
  - **Override option**: User can mark as "not applicable" with reason (logged for model improvement)
- Structured output format in `ActionItem` type (extend with `evidence` field)

**Vitals advantage:** Claude excels at structured reasoning with citations. The prompt can require evidence-based output format. All underlying data is available in the prompt context.

#### 3.3 Personal Physiological Model

**What enthusiasts want:** "After 6 months of tracking, the app should know my body. How I respond to high-carb days, how quickly I recover from heavy squats, what my glucose looks like after different meal compositions."

**Why existing solutions fail:** No app builds a persistent individual response model. MacroFactor's TDEE adapts but doesn't model individual nutrient responses. InsideTracker compares to population ranges, not personal baselines.

**Implementation concept:**
- Build a rolling individual profile from accumulated data:
  - Glucose response signatures by meal type
  - Recovery timeline by workout type and intensity
  - Sleep quality predictors (training timing, meal timing, calorie level)
  - Weight response dynamics (water retention patterns, deficit adherence curves)
  - Performance predictors (which metrics best predict next-day training quality)
- Store as a structured profile document updated weekly
- Feed into AI reports as "personal context" alongside weekly data
- Example: "Based on your 4-month profile: you recover from heavy lower-body sessions in 56 hours (vs. 48h population average). Your optimal pre-workout carb window is 60-90 minutes. High-fat evening meals predict 15% worse deep sleep."

**Research required:** Statistical methods for individual response modeling with limited longitudinal data. Minimum viable data requirements per insight type.

---

## 6. Vitals' Structural Advantages

| Advantage | Why It Matters | Competitor Gap |
|-----------|---------------|----------------|
| **Unified data store** | EAV `measurements` + `workout_sets` in PostgreSQL — one query can correlate sleep with nutrition with workout performance | Every competitor siloes data by domain |
| **Self-hosted / privacy-first** | User owns the database, the API keys, the data lifecycle. No third-party access. | 80% of fitness apps sell data. InsideTracker, MacroFactor, Whoop are all cloud-locked |
| **AI-native architecture** | Claude integration built into the core via `AIProvider` interface and `prompt-builder.ts`. Adding richer context to prompts is incremental | Competitors bolt on chatbots. Vitals was built with AI analysis as a first-class feature |
| **Extensible provider pattern** | `DataProvider` interface: `collect(startDate, endDate) → CollectionResult`. Adding Oura/Whoop/Dexcom is one new module | Most apps are monolithic — adding new data sources requires core refactoring |
| **Schema flexibility** | EAV pattern means new metrics (HRV, glucose, hormones) need zero schema migration | Competitors with rigid schemas can't easily expand to new health domains |
| **Open data** | Direct PostgreSQL access, SQL queries, materialized views. User can build their own analytics | Competitors lock data behind proprietary APIs or provide limited CSV exports |
| **Transparent algorithms** | Every recommendation can show its reasoning — the prompt, the data, the AI response | MacroFactor, Whoop, Oura all use opaque scoring |

---

## 7. Suggested Phased Roadmap

### Phase A: Intelligence Layer (Near-term)
**Goal:** Make Vitals' existing data substantially more valuable without new integrations.

| Feature | Effort | Impact |
|---------|--------|--------|
| Cross-domain correlation engine | Medium | High — immediate differentiation |
| Enhanced AI reports with causal narratives | Low | High — prompt engineering on existing infra |
| Transparent TDEE engine | Medium | High — directly competes with MacroFactor's core |
| Correlation dashboard widget | Low | Medium — makes correlations visible |

**Outcome:** Vitals goes from "health data warehouse" to "health intelligence platform." The AI reports become uniquely valuable because they connect domains that no competitor connects.

### Phase B: Expanded Data Sources (Medium-term)
**Goal:** Feed more signal into the intelligence layer.

| Feature | Effort | Impact |
|---------|--------|--------|
| Oura Ring provider | Medium | High — sleep/HRV is the missing recovery signal |
| Garmin provider | Medium | Medium — training metrics, body battery |
| Blood work CSV import | Low | Medium — high value per data point but infrequent |
| Whoop provider | Medium | Medium — recovery score, strain |

**Outcome:** Vitals becomes the only platform correlating nutrition + training + sleep + HRV + biomarkers in one self-hosted system.

### Phase C: Adaptive Coaching (Long-term)
**Goal:** Move from passive analytics to proactive, personalized guidance.

| Feature | Effort | Impact |
|---------|--------|--------|
| Periodization-aware nutrition | High | Very high — no competitor does this |
| Explainable recommendation engine | High | High — trust differentiator |
| CGM integration | Medium | High — glucose is the next frontier |
| Personal physiological model | Very high | Very high — ultimate differentiation |

**Outcome:** Vitals becomes a personal health intelligence system — not just tracking, but understanding and advising based on an individual's unique physiology.

---

## 8. Competitive Positioning Summary

```
                    Data Depth
                        ▲
                        │
             Vitals     │    InsideTracker
            (Phase C)   │    ($590+/yr, closed)
                        │
                        │
             Vitals     │
            (Phase A-B) │    MacroFactor
                        │    (nutrition only)
                        │
    Exist.io ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ►
    Gyroscope           │                    Cross-Domain
                        │                    Coverage
         Apple Health   │
         Google Fit     │    Cronometer
                        │    MyFitnessPal
                        │
          Whoop/Oura    │    Strong/Hevy
         (single domain)│
                        │
```

**Vitals' trajectory:** Move up and right — deeper analytics across more domains, while maintaining the self-hosted, transparent, open-data advantages that no competitor offers.

---

## 9. Key Takeaways

1. **The biggest unsolved problem in health tracking is cross-domain intelligence.** Everyone tracks; nobody connects. Vitals' unified data store is the foundation for solving this.

2. **MacroFactor's moat is its TDEE algorithm.** Building a transparent, open alternative that also considers sleep, HRV, and training phase would be a strict superset of what MacroFactor offers.

3. **Privacy is an underserved wedge.** The market is moving toward health data regulation (EU AI Act, US HTI-1 Rule). Being self-hosted and transparent is increasingly a competitive advantage, not just a niche preference.

4. **AI is the enabling technology, not the product.** Competitors bolt on chatbots. Vitals should use AI to synthesize cross-domain data into causal narratives — something only possible when all the data is in one place.

5. **Start with the intelligence layer (Phase A).** The data is already there. Correlation analysis + enriched AI reports transform Vitals from a data warehouse into something no competitor offers — without needing any new integrations.
