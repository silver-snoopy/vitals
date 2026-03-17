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
| UC-DASH-03 | Widget order customization | Implemented |

### UC-DASH-01: Default dashboard view

**As a** user, **I want to** see an overview of my health data on a single page,
**so that** I can quickly assess my recent trends.

**Behavior:**
- Dashboard displays five widgets: Nutrition Trends, Workout Volume, Body Weight, Weekly Summary, Latest AI Report
- Nutrition Trends: line chart with calories, protein, carbs, fat over time
- Workout Volume: bar chart showing total volume (weight x reps) per session
- Body Weight: line chart with auto-scaled Y axis
- Weekly Summary: three stat cards — Avg Daily Calories (kcal), Workout Sessions (count), Avg Weight (kg)
- Latest AI Report: preview with summary text and top 3 action items with priority badges
- Default date range: last 30 days
- Loading state shows skeleton placeholders; errors display inline message

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC1

### UC-DASH-02: Custom date range selection

**As a** user, **I want to** change the date range for all dashboard data,
**so that** I can explore trends over different time periods.

**Behavior:**
- Date range picker in top bar (desktop) or mobile header (compact)
- Popover with calendar (2 months desktop, 1 month mobile)
- Quick presets on mobile: 7d, 30d, 90d
- Selecting a range triggers refetch of all dashboard data
- Range persists across page navigation via Zustand store

**E2E Coverage:** `e2e/dashboard.spec.ts` — UC2

### UC-DASH-03: Widget order customization

**As a** user, **I want to** reorder my dashboard widgets,
**so that** the most important data is at the top.

**Behavior:**
- Settings gear icon in dashboard header opens widget order panel
- Move up/down buttons per widget
- Reset to default button
- Order persisted in localStorage

**E2E Coverage:** None

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
- Report always covers the **last 7 days** — computed at call time, independent of the date range picker
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
- Clicking opens confirmation dialog: "This will generate a new report for the last 7 days, replacing the most recent one."
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

## 3. Nutrition

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

## 4. Workouts

| ID | Use Case | Status |
|----|----------|--------|
| UC-WRK-01 | View workout sessions | Implemented |
| UC-WRK-02 | Track exercise progression | Implemented |

### UC-WRK-01: View workout sessions

**As a** user, **I want to** see my workout sessions as cards,
**so that** I can review what I did on each training day.

**Behavior:**
- One card per session showing: title, date, duration, total volume (kg), set count
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

## 5. Data Upload

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

## 6. Appearance

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

## Cross-Cutting Concerns

### Responsive Design
- Mobile breakpoint: `< 768px` (md)
- Mobile: drawer navigation, compact date picker (1 month + presets), single-column layout
- Desktop: sidebar navigation, full topbar, 2-column grid for dashboard widgets

### Loading & Error States
- All pages show skeleton placeholders during loading
- Inline error messages on fetch failure
- Toast notifications for mutations (upload, report generation)

### Data Freshness
- TanStack Query with 5-minute stale time
- Query cache invalidated after mutations (upload, report generation)
- Date range changes trigger automatic refetch
