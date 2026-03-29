# Vitals — Product Capabilities

> Personal health data dashboard that aggregates nutrition, workout, and biometric data
> from multiple sources, with AI-powered weekly insights.

**Target user:** Individual health enthusiast tracking nutrition (Cronometer), workouts (Hevy),
and biometrics (Apple Health) in a single unified dashboard.

---

## 1. Dashboard

| ID | Use Case | Status |
|----|----------|--------|
| UC-DASH-01 | Default dashboard view | Implemented |
| UC-DASH-02 | Custom date range selection | Implemented |
| ~~UC-DASH-03~~ | ~~Widget order customization~~ | Removed (Phase C) |
| UC-DASH-04 | Bento grid layout | Implemented |
| UC-DASH-05 | Insights panel | Implemented |
| UC-DASH-06 | KPI strip with trends | Implemented |
| UC-DASH-07 | Macro split chart | Implemented |
| UC-DASH-08 | Activity heatmap | Implemented |
| UC-DASH-09 | Mobile swipeable charts | Implemented |

### UC-DASH-01: Default dashboard view

**As a** user, **I want to** see an overview of my health data on a single page,
**so that** I can quickly assess my recent trends.

**Behavior:**
- Dashboard displays: KPI strip, insights panel, bento chart grid
- KPI strip: 5 compact metric cards — Avg Calories, Sessions, Weight, Protein, AI Score
- Each KPI card shows value, trend arrow (▲/▼/→), and sparkline where applicable
- Charts: Nutrition Trends, Body Weight, Workout Volume, Macro Split donut, Activity Heatmap
- Default date range: last 14 days
- Loading state shows skeleton placeholders; errors display inline message

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC1

### UC-DASH-02: Custom date range selection

**As a** user, **I want to** change the date range for all dashboard data,
**so that** I can explore trends over different time periods.

**Behavior:**
- Date range picker in top bar (desktop) or mobile header (compact)
- Popover with calendar (2 months desktop, 1 month mobile)
- Quick presets on mobile: 7d, 14d, 30d, 90d
- Selecting a range triggers refetch of all dashboard data
- Range persists across page navigation via Zustand store

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC2

### UC-DASH-04: Bento grid layout

**As a** user, **I want** charts arranged in a dense grid layout,
**so that** I can see all my health data without excessive scrolling.

**Behavior:**
- Desktop (≥1440px): 3-column bento grid — Nutrition spans 2 cols, Weight 1 col, then Volume + Macro Split + Heatmap
- Tablet (768–1439px): 2-column grid — Nutrition full width, rest in pairs
- Mobile (<768px): swipeable horizontal cards (see UC-DASH-09)

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC-DASH: Bento grid layout

### UC-DASH-05: Insights panel

**As a** user, **I want** to see actionable AI insights directly on the dashboard,
**so that** I can immediately understand my focus areas without navigating to Reports.

**Behavior:**
- Score ring: SVG circular indicator showing overall AI score (color-coded: green ≥7, amber ≥5, red <5)
- Full summary text (not truncated), period dates, "View Report →" link
- Top 3 action items: interactive cards with accept/defer/reject actions (pending) or complete/defer (active); progress counter "X/Y done"; "View all actions →" link to `/reports/actions`
- Focus areas: "What's Working" (emerald tint) and "Watch Out" (amber tint) cards with extracted bullet points from report sections; bullet text renders inline markdown (bold labels); cards span full width when only one section has content, side-by-side when both present
- Desktop: 3-column action items grid, 2-column focus areas (when both present)
- Mobile: all sections stack vertically, score ring centered
- If no report: "No report yet — Generate →"
- If generating: spinner with "Generating report…"

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC1

### UC-DASH-06: KPI strip with trends

**As a** user, **I want to** see key metrics with trend indicators at a glance,
**so that** I can quickly assess whether my health data is trending up or down.

**Behavior:**
- 5 KPI cards: Avg Calories, Sessions, Weight, Protein, AI Score
- Trend arrows: compare first half vs second half of date range (▲ up, ▼ down, → stable within ±1%)
- Sparklines for continuous metrics (calories, weight, protein) — not for discrete values (sessions, AI score)
- Desktop: 5 cards in a row; Tablet: 3+2; Mobile: horizontal scroll with snap

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC1

### UC-DASH-07: Macro split chart

**As a** user, **I want to** see my macro nutrient breakdown visually,
**so that** I can assess my protein/carbs/fat balance at a glance.

**Behavior:**
- Donut chart showing protein (blue), carbs (yellow), fat (red) from latest day's data
- Center text shows total calories
- Compact legend below with gram values
- Empty state if no nutrition data or all-zero macros

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC-DASH: Bento grid layout

### UC-DASH-08: Activity heatmap

**As a** user, **I want to** see my workout consistency over time,
**so that** I can identify patterns and maintain my training habit.

**Behavior:**
- GitHub-style SVG heatmap showing workout days for ~13 weeks
- 4 intensity levels based on set count: rest (10% opacity), 1-10 (40%), 11-20 (70%), 21+ (100%)
- Day labels (Mon, Wed, Fri, Sun) on left
- Hover tooltip showing date and set count
- Less/More legend below

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC-DASH: Bento grid layout

### UC-DASH-09: Mobile swipeable charts

**As a** user on mobile, **I want to** swipe between charts,
**so that** each chart gets full screen width for readability.

**Behavior:**
- CSS scroll-snap horizontal carousel with 4 cards: Nutrition, Volume, Weight, Activity
- Dot indicators below showing current position
- Clickable dots to jump to specific chart
- Only visible on viewports < 768px (md breakpoint)

**E2E Coverage:** `e2e/dashboard.spec.ts` — Dashboard Mobile

---

## 2. Reports

| ID | Use Case | Status |
|----|----------|--------|
| UC-RPT-01 | Generate weekly insights (first report) | Implemented |
| UC-RPT-02 | Re-generate weekly insights (with confirmation) | Implemented |
| UC-RPT-03 | View report list and details | Implemented |
| UC-RPT-04 | Generate from dashboard widget | Implemented |
| UC-RPT-05 | Structured 8-section health analysis | Implemented |
| UC-RPT-06 | Add user notes to report generation | Implemented |
| UC-RPT-07 | Pre-collection before report generation | Implemented |
| UC-RPT-08 | Stale data warning on reports page | Implemented |
| UC-RPT-09 | Async report generation with live progress | Implemented |

### UC-RPT-01: Generate weekly insights (first report)

**As a** user, **I want to** generate my first AI-powered weekly report,
**so that** I can get personalized insights about my health data.

**Behavior:**
- Reports page shows empty state: "No reports yet. Click the button above to generate your first weekly insights."
- Refresh icon button next to "Reports" heading with tooltip "Generate Latest Insights"
- Clicking opens a generation dialog with optional notes textarea (same dialog as re-generation)
- Report covers the **7 days ending yesterday** (today excluded) — date window is computed server-side at generation time, independent of the client date range picker; `periodEnd = yesterday UTC`, `periodStart = yesterday − 6 days UTC`
- Button shows spinner while generating; toast on success/error
- Error toasts are context-specific: rate limit (429), AI unavailable (502), not configured (503), or generic failure
- Backend sanitizes all AI provider errors — no internal API details are exposed to the client
- Generated report card appears in the list after completion

**Design decision:** Reports are a snapshot of the user's current week, not a historical trend query.
The date range picker on other pages is irrelevant to report generation.

**E2E Coverage:** `e2e/reports.spec.ts` — UC: Generate report (no existing reports)

### UC-RPT-02: Re-generate weekly insights (with confirmation)

**As a** user, **I want to** re-generate my latest report,
**so that** I can get updated insights reflecting new data.

**Behavior:**
- When reports exist, button tooltip reads "Re-Generate Latest Insights"
- Clicking opens confirmation dialog: "This will generate a new report for the last 7 days, replacing the most recent one." (actual window: yesterday − 6 days to yesterday, server-calculated)
- Cancel dismisses the dialog without triggering generation
- Confirming triggers generation with spinner in the dialog button
- Toast notification on success/error

**E2E Coverage:** `e2e/reports.spec.ts` — UC: Re-generate report (existing report)

### UC-RPT-03: View report list and details

**As a** user, **I want to** browse and expand my past reports,
**so that** I can review historical AI insights and action items.

**Behavior:**
- Reports listed as cards, newest first
- Each card shows: date range, data coverage badges (nutrition/workout/biometric days), summary text
- Expand chevron reveals: full AI insights (formatted text) and all action items with priority badges (high=red, medium=yellow, low=gray)

**E2E Coverage:** None

### UC-RPT-04: Generate from dashboard widget

**As a** user, **I want to** generate a report directly from the dashboard,
**so that** I don't have to navigate to the Reports page.

**Behavior:**
- Dashboard "Latest AI Report" widget includes generate/re-generate button
- No report: "Generate Latest Insights" outline button with icon
- Existing report: refresh icon button next to title
- Same confirmation dialog and 7-day logic as Reports page (UC-RPT-01/02)

**E2E Coverage:** None (dashboard E2E covers widget visibility only)

### UC-RPT-05: Structured 8-section health analysis

**As a** user, **I want to** receive a comprehensive structured weekly analysis,
**so that** I can understand cross-domain correlations between my nutrition, training, biometrics, and recovery.

**Behavior:**
- Report generation produces an 8-section structured analysis:
  1. **Biometrics Overview** — body composition and cardiac/autonomic markers with week-over-week comparison and signal indicators
  2. **Nutrition Analysis** — daily macro/micro tables, energy availability calculation (EA = (intake - expenditure) / FFM), micronutrient flags
  3. **Training Load** — per-session detail with exercise-level volume, frequency check vs prescribed program, strength progression tracking
  4. **Cross-Domain Correlation** — synthesis of subjective notes with objective data, cause-effect pattern identification
  5. **What's Working** — 3-5 positive trends worth maintaining
  6. **Hazards & Red Flags** — severity-ranked concerns with physiological mechanisms
  7. **Recommendations** — immediate (specific numbers), monitoring priorities (decision thresholds), medium-term trajectory
  8. **Weekly Scorecard** — 1-10 ratings for nutrition, protein, training adherence, recovery, body composition, and overall risk level
- Multi-metric biometric support: weight, body fat %, HRV, resting HR, SpO2, respiration rate, sleep hours, active calories, steps
- Automatic week-over-week comparison (current week vs previous 7 days)
- Optional user notes input for subjective observations (sleep quality, energy, soreness)
- Optional workout plan reference for program adherence scoring
- 3-file prompt architecture (persona, analysis protocol, output format) for maintainable AI instructions
- Backward compatible: old reports without sections remain readable; `sections` field is nullable
- Action items extracted with category and priority for frontend display

**API:**
- `POST /api/reports/generate` accepts optional `userNotes` and `workoutPlan` in request body
- Response includes `sections` object alongside existing `summary`, `insights`, `actionItems`

**E2E Coverage:** `e2e/reports.spec.ts` — UC: View structured 8-section report (UC-RPT-05)

### UC-RPT-06: Add user notes to report generation

**As a** user, **I want to** add notes and context before generating a report,
**so that** the AI considers my subjective observations (goals, injuries, diet changes) alongside the data.

**Behavior:**
- Both generate and re-generate flows open a dialog before triggering the API call
- Dialog includes an optional textarea labeled "Notes for AI (optional)"
- Placeholder text: "Add any context for your report — goals you're tracking, injuries, diet changes, or anything the AI should consider when analyzing your data."
- Notes are sent as `userNotes` in the POST body; empty notes are omitted
- Notes are cleared when the dialog closes (cancel, X, or Escape)
- Dialog title adapts: "Generate Report" (first time) vs "Re-Generate Report?" (existing reports)
- Confirm button adapts: "Generate" vs "Re-Generate"

**E2E Coverage:** `e2e/reports.spec.ts` — user notes tests in both generate and re-generate sections

### UC-RPT-07: Pre-collection before report generation

**As a** user, **I want** report generation to automatically collect fresh data from all providers,
**so that** my reports aren't empty when the scheduled collection pipeline hasn't run.

**Behavior:**
- Before querying the database, the report generation endpoint calls `runCollection()` with the report's date range
- Collection is best-effort: if any provider fails, the error is logged and report generation continues with existing data
- Collection results (total records, duration) are logged for debugging

### UC-RPT-08: Stale data warning on reports page

**As a** user, **I want to** see a warning when my data sources haven't synced recently,
**so that** I know reports may contain incomplete data.

**Behavior:**
- Reports page shows a yellow warning banner when any provider's last successful sync was over 24 hours ago
- Providers that have never been attempted are not flagged (only attempted-but-failed or stale providers)
- Warning lists the affected provider names
- A `GET /api/collect/status` endpoint returns collection metadata per provider
- Raw error messages are sanitized before being returned to the client

### UC-RPT-09: Async report generation with live progress

**As a** user, **I want** report generation to happen asynchronously with real-time progress updates,
**so that** my action feels immediate and I can see the system working without staring at a spinner.

**Behavior:**
- Clicking Generate/Re-Generate returns immediately (HTTP 202) with a pending report ID
- Dialog transitions to "Generating Report..." with a 3-step progress indicator:
  1. Request accepted (pending)
  2. Collecting health data (collecting_data)
  3. Generating AI insights (generating)
- Steps highlight sequentially as the backend progresses
- WebSocket connection (`/ws/reports/:reportId`) streams status updates in real time
- On completion: success toast, dialog auto-closes after 800ms, report list refreshes
- On failure: error message in dialog with retry button
- Dialog cannot be dismissed while generation is in progress
- A skeleton card placeholder appears in the report list during generation
- Backward compatible: `POST /api/reports/generate?sync=true` preserves blocking behavior for n8n workflows

**Technical:**
- Backend: `@fastify/websocket` plugin, `ReportEventBus` (EventEmitter pub/sub), `report-runner.ts` (fire-and-forget background worker)
- Frontend: `useReportWebSocket` hook (reconnect with exponential backoff), `useReportGenerationStore` (Zustand)
- Race condition prevention: WebSocket handler subscribes to EventBus BEFORE reading DB status
- DB: `status` and `error_message` columns on `weekly_reports` table (migration 003)

**E2E Coverage:** `e2e/reports.spec.ts` — async generation flow with simulated WebSocket completion via exposed Zustand store

---

## 3. Action Items (F3)

| ID | Use Case | Status |
|----|----------|--------|
| UC-ACT-01 | View and filter action items on Actions page | Implemented |
| UC-ACT-02 | Accept a pending action item | Implemented |
| UC-ACT-03 | Complete an active action item | Implemented |
| UC-ACT-04 | Defer an action item | Implemented |
| UC-ACT-05 | Reject a pending action item | Implemented |
| UC-ACT-06 | Progress summary on dashboard (InsightsPanel) | Implemented |
| UC-ACT-07 | Outcome measurement on completed items | Implemented |
| UC-ACT-08 | Attribution summary card on Actions page | Implemented |
| UC-ACT-09 | Outcome badges on completed items | Implemented |
| UC-ACT-10 | Action item lifecycle automation (expire/supersede) | Implemented |
| UC-ACT-11 | Chat tools for action items and outcomes | Implemented |
| UC-ACT-12 | Action item follow-up in report generation | Implemented |

### UC-ACT-01: View and filter action items

**As a** user, **I want to** see all my action items grouped by status and filter them,
**so that** I can review what I've committed to and track my progress.

**Behavior:**
- Route: `/reports/actions`
- Progress card at top: "X of Y completed" with progress bar
- Filter tabs: All, Pending, Active, Completed, Deferred
- Items grouped by status: Pending → Active → Deferred (in "All" view)
- Each item shows category, priority badge, text, and context-appropriate action buttons
- Empty state messages per section

**E2E Coverage:** `e2e/action-items.spec.ts` — UC-ACT-01, UC-ACT-03

### UC-ACT-02: Accept a pending action item

**As a** user, **I want to** explicitly accept an action item,
**so that** I consciously commit to the behavior change.

**Behavior:**
- Pending items show: Accept, Defer, Reject buttons
- Accept → `active` status (optimistic UI update)
- Optimistic update reverts on API error with toast notification

**E2E Coverage:** `e2e/action-items.spec.ts` — UC-ACT-01

### UC-ACT-03: Complete an active action item

**As a** user, **I want to** mark an action item as done,
**so that** I can track my adherence over time.

**Behavior:**
- Active items show: Done, Defer buttons
- Done → `completed` status with `completed_at` timestamp
- Completed items show "✓ Completed [date]" (read-only)

**E2E Coverage:** `e2e/action-items.spec.ts` — UC-ACT-01

### UC-ACT-04–05: Defer and Reject

**As a** user, **I want to** defer or reject items I can't or won't do,
**so that** my active list stays focused.

**Behavior:**
- Defer: `pending/active → deferred`; deferred items show Re-accept button
- Reject: `pending → rejected` (terminal state)
- Status transitions validated server-side; invalid transitions return 400

**E2E Coverage:** `e2e/action-items.spec.ts` — UC-ACT-03

### UC-ACT-06: Dashboard progress integration

**As a** user, **I want to** see my action item progress on the dashboard,
**so that** I'm reminded of my commitments without navigating away.

**Behavior:**
- InsightsPanel "This Week's Focus" section shows top 3 pending/active items with interactive buttons
- Progress counter: "X/Y done"
- "View all actions →" link to `/reports/actions`

**E2E Coverage:** `e2e/action-items.spec.ts` — UC-ACT-02, `e2e/dashboard.spec.ts`

### UC-ACT-07: Outcome measurement on completed items

**As a** user, **I want to** see whether my completed action items led to measurable improvement,
**so that** I know which recommendations actually work for me.

**Behavior:**
- When a report is generated, all completed items with `targetMetric` are measured
- Baseline: 7-day average before item creation; Outcome: 7-day average after completion
- Outcome classified as improved/stable/declined based on `targetDirection`
- Confidence: high (>10% + 5+ points), medium (2-10%), low (<3 points)
- Uses correlation language, never causation

### UC-ACT-08: Attribution summary card on Actions page

**As a** user, **I want to** see a monthly impact summary at the top of my Actions page,
**so that** I can understand how effective my health actions have been overall.

**Behavior:**
- `GET /api/action-items/attribution?period=week|month|quarter`
- Card shows: completion rate bar, outcome breakdown (improved/stable/declined), top improvements
- Renders only when `totalItems > 0`

**E2E Coverage:** `e2e/action-item-outcomes.spec.ts` — UC-ACT-05

### UC-ACT-09: Outcome badges on completed items

**As a** user, **I want to** see outcome indicators on my completed action items,
**so that** I can quickly identify which actions had the most impact.

**Behavior:**
- OutcomeBadge: green "↑ Improved", amber "— Stable", red "↓ Declined"
- Shows confidence level in parentheses
- Displayed on InteractiveActionItemCard in completed state
- Visible in both Actions page and InsightsPanel

**E2E Coverage:** `e2e/action-item-outcomes.spec.ts` — UC-ACT-05

### UC-ACT-10: Action item lifecycle automation

**As the system,** during report generation, stale items are expired and replaced items are superseded,
**so that** the user's action list stays current without manual cleanup.

**Behavior:**
- Expire: `pending/active` items past `due_by` → `expired`
- Supersede: `pending` items with >70% keyword overlap to new report items → `superseded`
- Only `pending` items superseded (never `active` — user committed to those)
- Runs before new report AI call

### UC-ACT-11: Chat tools for action items and outcomes

**As a** user, **I want to** ask the AI about my action items and their outcomes,
**so that** I can get personalized insights about my progress in conversation.

**Behavior:**
- `query_action_items`: filter by status/category, default shows active items
- `query_action_outcomes`: attribution summary or on-demand measurement for specific item
- AI uses correlation language per chat-persona guidelines

### UC-ACT-12: Action item follow-up in report generation

**As the system,** the AI report includes context about previous action items,
**so that** recommendations build on what worked and adjust what didn't.

**Behavior:**
- `WeeklyDataBundle.actionItemFollowUp` added to prompt: completed items with outcomes, deferred items, expired items
- AI Step 6 (analysis-protocol): review outcomes, calibrate recommendations
- Output format: action items include `targetMetric` and `targetDirection` fields

---

## 5. Nutrition

| ID | Use Case | Status |
|----|----------|--------|
| UC-NUT-01 | View daily nutrition breakdown | Implemented |
| UC-NUT-02 | View macro distribution | Implemented |

### UC-NUT-01: View daily nutrition breakdown

**As a** user, **I want to** see my daily nutrition data in a table,
**so that** I can track calories and macros day by day.

**Behavior:**
- Table with columns: Date, Calories, Protein (g), Carbs (g), Fat (g), Fiber (g)
- One row per day in the selected date range
- Values rounded to nearest integer
- Empty state: "No nutrition data for this period."

**E2E Coverage:** None

### UC-NUT-02: View macro distribution

**As a** user, **I want to** see my average macro breakdown as a pie chart,
**so that** I can assess my protein/carb/fat ratio.

**Behavior:**
- Pie chart showing average daily macros as caloric percentage (protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g)
- Hidden on mobile to save screen space

**E2E Coverage:** None

---

## 6. Workouts

| ID | Use Case | Status |
|----|----------|--------|
| UC-WRK-01 | View workout sessions | Implemented |
| UC-WRK-02 | Track exercise progression | Implemented |

### UC-WRK-01: View workout sessions

**As a** user, **I want to** see my workout sessions as cards,
**so that** I can review what I did on each training day.

**Behavior:**
- One card per session showing: title, date, duration, total volume (kg), set count
- Title uses the workout title from the source (e.g., "Upper") with fallback to "{Source} Workout"
- Total volume uses pre-calculated `volume_kg` from the database (computed at ingest time)
- For `weighted_bodyweight` exercises (e.g., Pull Up Weighted), volume includes user's bodyweight
- All sets (including warmups) are included in volume calculations
- Exercise name badges for each unique exercise in the session
- Ordered by date
- Empty state: "No workouts in this period."

**E2E Coverage:** None

### UC-WRK-02: Track exercise progression

**As a** user, **I want to** see my strength progress for a specific exercise,
**so that** I can verify I'm progressively overloading.

**Behavior:**
- Dropdown to select exercise from all exercises in the date range
- Line chart showing max weight per session for the selected exercise
- Updates when exercise selection changes
- Empty state: "No data for this exercise."

**E2E Coverage:** None

---

## 7. Data Upload

| ID | Use Case | Status |
|----|----------|--------|
| UC-UPL-01 | Upload Apple Health export | Implemented |

### UC-UPL-01: Upload Apple Health export

**As a** user, **I want to** upload my Apple Health XML export,
**so that** biometric and health data is imported into the system.

**Behavior:**
- "Upload Data" button in sidebar (desktop) or mobile drawer
- Opens modal dialog: "Upload Apple Health Data"
- Drag-and-drop zone or "Browse file" button
- Accepts `.xml` files only; rejects other formats with error toast
- Shows "Uploading..." state during upload
- Success toast: "Imported X records"
- Error toast: "Upload failed. Check that the file is a valid Apple Health export."
- Modal closes on successful upload
- Invalidates nutrition, measurements, and dashboard query caches

**E2E Coverage:** None

---

## 8. Appearance

| ID | Use Case | Status |
|----|----------|--------|
| UC-APP-01 | Toggle theme | Implemented |

### UC-APP-01: Toggle theme

**As a** user, **I want to** switch between light, dark, and system themes,
**so that** the app matches my preference or environment.

**Behavior:**
- Theme button in topbar (desktop) or mobile drawer
- Cycles: system (monitor icon) → light (sun icon) → dark (moon icon)
- System mode follows OS `prefers-color-scheme`
- Applied via `.dark` class on `<html>` element

**E2E Coverage:** None

---

## 9. Conversational AI Chat (Phase 6A)

| ID | Use Case | Status |
|----|----------|--------|
| UC-CHAT-01 | Send a natural language health question | Implemented |
| UC-CHAT-02 | AI uses tools to fetch real health data | Implemented |
| UC-CHAT-03 | Stream AI response in real time | Implemented |
| UC-CHAT-04 | Persist and reload conversation history | Implemented |
| UC-CHAT-05 | Manage multiple conversations | Implemented |

### UC-CHAT-01: Send a natural language health question

**As a** user, **I want to** ask questions about my health data in plain English,
**so that** I can get insights without navigating charts manually.

**Behavior:**
- `/chat` route with two-panel layout: conversation sidebar (desktop) and chat area
- Auto-resize textarea input, Enter to send, Shift+Enter for newline
- Input disabled while AI is responding
- New conversation created automatically on first message
- Empty state shows example prompts to guide the user

**E2E Coverage:** `e2e/chat.spec.ts` — UC-CHAT-01

### UC-CHAT-02: AI uses tools to fetch real health data

**As a** user, **I want to** get answers grounded in my actual data,
**so that** responses are accurate and not generic.

**Behavior:**
- AI can call 6 health tools: `query_nutrition`, `query_workouts`, `query_biometrics`, `query_exercise_progress`, `get_latest_report`, `list_available_metrics`
- Tool calls are transparent — collapsible badge shows tool name and parameters
- Agentic loop: up to 10 tool-call iterations before answering (prevents infinite loops)
- Tool errors are returned to the AI as structured `{ error: message }` objects

**E2E Coverage:** `e2e/chat.spec.ts` — UC-CHAT-02 (tool badge visibility test)

### UC-CHAT-03: Stream AI response in real time

**As a** user, **I want to** see the AI response appear word by word,
**so that** the experience feels responsive even for long answers.

**Behavior:**
- WebSocket connection at `/ws/chat` (token auth via query param)
- Text chunks stream to the UI as received; markdown rendered in real-time
- Streaming bubble shows `…` placeholder until first chunk arrives
- `done` event triggers finalization (streaming bubble → permanent assistant message)
- Errors from AI provider are shown inline in the chat thread

**E2E Coverage:** `e2e/chat.spec.ts` — UC-CHAT-03

### UC-CHAT-04: Persist and reload conversation history

**As a** user, **I want to** return to previous conversations,
**so that** I don't lose context between sessions.

**Behavior:**
- All messages persisted to `conversations` + `messages` tables after each exchange
- Conversation auto-titled from the first user message (truncated to 60 chars)
- Selecting a conversation loads its full message history from the DB
- Tool-only messages (`role: 'tool'`) filtered from display

**E2E Coverage:** `e2e/chat.spec.ts` — UC-CHAT-04

### UC-CHAT-05: Manage multiple conversations

**As a** user, **I want to** start new conversations and delete old ones,
**so that** I can keep my chat history organized.

**Behavior:**
- Sidebar lists all conversations sorted by last activity
- "+ New conversation" button resets to empty state
- Delete button (hover-reveal) removes conversation and refreshes list
- Mobile: header "New" button replaces sidebar (drawer not shown on mobile)

**E2E Coverage:** `e2e/chat.spec.ts` — UC-CHAT-05

---

## Cross-Cutting Concerns

### Responsive Design
- Mobile breakpoint: `< 768px` (md)
- Mobile: drawer navigation, compact date picker (1 month + presets), single-column layout
- Desktop: sidebar navigation, full topbar, 2-column grid for dashboard widgets

### Mobile Navigation

| ID | Use Case | Status |
|----|----------|--------|
| UC-NAV-01 | Bottom tab navigation on mobile | Implemented |

#### UC-NAV-01: Bottom tab navigation on mobile

**As a** mobile user, **I want to** navigate between pages with a single tap,
**so that** I don't need to open a hamburger menu for every navigation action.

**Behavior:**
- Fixed bottom tab bar with 5 tabs: Dashboard, Nutrition, Workouts, Reports, Chat
- Active tab highlighted in primary (cyan) color with icon + label
- Hidden on desktop (md+ breakpoint) — desktop uses sidebar
- MobileHeader shows branding, date picker, upload, and theme toggle
- iOS safe-area padding for notch devices via `viewport-fit=cover`
- Main content has bottom padding to prevent overlap with tab bar

**E2E coverage:** `e2e/mobile-navigation.spec.ts` — 6 tests (render, hide on desktop, navigate, active state, upload, content visibility)

### Loading & Error States
- All pages show skeleton placeholders during loading
- Inline error messages on fetch failure
- Toast notifications for mutations (upload, report generation)

### Data Freshness
- TanStack Query with 5-minute stale time
- Query cache invalidated after mutations (upload, report generation)
- Date range changes trigger automatic refetch
