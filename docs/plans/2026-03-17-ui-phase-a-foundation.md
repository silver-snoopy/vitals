# Phase A: Design System Foundation

**Date:** 2026-03-17
**Branch:** `experiment/ui-ux-pro-max-v2`
**Type:** Feature — UI/UX Transformation Phase A
**Research:** `docs/research/2026-03-17-ui-ux-transformation-plan.md`
**Depends on:** Nothing (first phase)

---

## Context

The current frontend uses Geist Variable font, shadcn default gray color tokens (OKLch, achromatic), and generic chart colors. This phase replaces those defaults with a healthcare-themed design system: JetBrains Mono Variable as the single font, healthcare cyan (`#0891B2`) as primary, and semantic color tokens for success/warning states. It also creates two reusable components (KPI Card, Sparkline) that Phase C depends on.

**Critical constraint:** Zero visual regressions allowed — every existing page must still render correctly after these changes. The layout and page structure are NOT changing in this phase.

---

## Tasks

### A1. Replace font: Geist → JetBrains Mono Variable

**Files to modify:**
- `packages/frontend/package.json` — replace `@fontsource-variable/geist` with `@fontsource-variable/jetbrains-mono`
- `packages/frontend/src/index.css` — replace `@import '@fontsource-variable/geist'` with `@import '@fontsource-variable/jetbrains-mono'`
- `packages/frontend/src/index.css` — in `@theme inline`, change `--font-sans` from `'Geist Variable', sans-serif` to `'JetBrains Mono Variable', monospace`

**Install:**
```bash
npm install @fontsource-variable/jetbrains-mono -w @vitals/frontend
npm uninstall @fontsource-variable/geist -w @vitals/frontend
```

**Verification:** All text across the app renders in JetBrains Mono. Numbers in tables and KPI cards should appear with tabular figures (monospace alignment).

### A2. Update color tokens: achromatic → healthcare cyan primary

**File to modify:** `packages/frontend/src/index.css`

Replace the achromatic `--primary` tokens with healthcare cyan OKLch values. Keep all other tokens (background, card, muted, border) unchanged to avoid breaking shadcn components.

**Light mode `:root`:**
| Token | Current (achromatic) | New (healthcare cyan) |
|-------|---------------------|----------------------|
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.59 0.14 200)` — `#0891B2` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` — keep white |

**Dark mode `.dark`:**
| Token | Current | New |
|-------|---------|-----|
| `--primary` | `oklch(0.87 0 0)` | `oklch(0.72 0.14 200)` — lighter cyan for dark bg |
| `--primary-foreground` | `oklch(0.205 0 0)` | `oklch(0.145 0 0)` — dark text on light cyan |

**Add new semantic tokens** (both `:root` and `.dark`):
```css
--success: oklch(0.55 0.16 155);       /* #059669 */
--success-foreground: oklch(0.985 0 0);
--warning: oklch(0.65 0.15 70);        /* #D97706 */
--warning-foreground: oklch(0.145 0 0);
```

**Map them in `@theme inline`:**
```css
--color-success: var(--success);
--color-success-foreground: var(--success-foreground);
--color-warning: var(--warning);
--color-warning-foreground: var(--warning-foreground);
```

**Verification:** Primary buttons, active nav links, and focus rings should appear cyan. Success/warning tokens can be tested by adding `className="text-success"` temporarily.

### A3. Update sidebar tokens to match primary

**File to modify:** `packages/frontend/src/index.css`

Update sidebar-specific tokens so the active nav item uses cyan:

**Light:**
```css
--sidebar-primary: oklch(0.59 0.14 200);          /* match --primary */
--sidebar-primary-foreground: oklch(0.985 0 0);
```

**Dark:**
```css
--sidebar-primary: oklch(0.72 0.14 200);
--sidebar-primary-foreground: oklch(0.985 0 0);
```

### A4. Update chart color constants

**File to modify:** `packages/frontend/src/lib/chart-config.ts`

No changes needed — current chart colors already match the design system spec (calories orange, protein blue, carbs yellow, fat red, fiber green, weight purple, volume cyan). Verify and confirm.

### A5. Create KPI Card component

**File to create:** `packages/frontend/src/components/ui/kpi-card.tsx`

A compact card that displays:
- Large monospace number (JetBrains Mono, font-semibold, text-2xl)
- Small label below (text-xs, text-muted-foreground)
- Trend indicator: green `▲ +N`, red `▼ -N`, or gray `→ stable`
- Optional sparkline slot (ReactNode) rendered below the number

**Props interface:**
```typescript
interface KpiCardProps {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'stable'; delta: string };
  sparkline?: ReactNode;
  className?: string;
}
```

**Styling:** Use existing `Card` component as base. Padding should be compact (`p-3`) to allow 5 cards in a horizontal strip. Trend colors: `text-success` for up, `text-destructive` for down, `text-muted-foreground` for stable.

**Unit test:** `packages/frontend/src/components/ui/__tests__/kpi-card.test.tsx`
- Renders label and value
- Renders trend arrow with correct color
- Renders without trend (optional prop)

### A6. Create Sparkline component

**File to create:** `packages/frontend/src/components/charts/Sparkline.tsx`

A tiny inline chart using Recharts `LineChart` with no axes, grid, or labels.

**Props interface:**
```typescript
interface SparklineProps {
  data: number[];
  color?: string;       // defaults to CSS variable --color-primary
  width?: number;       // defaults to 80
  height?: number;      // defaults to 32
  className?: string;
}
```

**Implementation notes:**
- Uses `ResponsiveContainer` or fixed dimensions
- Single `Line` with `dot={false}`, `strokeWidth={1.5}`
- No `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`
- Transform `number[]` to `{ value: number }[]` for Recharts data format

**Unit test:** `packages/frontend/src/components/charts/__tests__/Sparkline.test.tsx`
- Renders SVG element
- Renders with empty data without crashing
- Applies custom color

### A7. Verify dark mode

Ensure all new tokens work in dark mode:
1. Toggle theme to dark
2. Verify primary cyan is readable on dark backgrounds
3. Verify success/warning tokens have sufficient contrast
4. Verify KPI card and Sparkline render correctly in dark mode

### A8. Run full validation suite

```bash
npm run build -w @vitals/shared
npm run build -w @vitals/frontend
npm run lint
npm run format:check
npm test
npm run test:e2e
```

All must pass with zero errors.

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `packages/frontend/package.json` |
| Modify | `packages/frontend/src/index.css` |
| Modify | `packages/frontend/src/lib/chart-config.ts` (verify only) |
| Create | `packages/frontend/src/components/ui/kpi-card.tsx` |
| Create | `packages/frontend/src/components/ui/__tests__/kpi-card.test.tsx` |
| Create | `packages/frontend/src/components/charts/Sparkline.tsx` |
| Create | `packages/frontend/src/components/charts/__tests__/Sparkline.test.tsx` |

## Dependencies

```bash
npm install @fontsource-variable/jetbrains-mono -w @vitals/frontend
npm uninstall @fontsource-variable/geist -w @vitals/frontend
```

## Test Strategy

- **Unit tests:** KPI Card (3 tests), Sparkline (3 tests) — ~6 new tests
- **Existing tests:** All 24 frontend + 184 backend must still pass
- **E2E:** No new E2E tests (no interactive behavior changes), existing E2E must pass
- **Visual verification:** Take before/after screenshots using `docs/screenshots/screenshot-ui.mjs` to confirm font and color changes

## Risks

1. **OKLch conversion accuracy** — the hex `#0891B2` to OKLch conversion must be exact. Use oklch.com to verify. Wrong values will produce a different hue.
2. **shadcn component contrast** — some shadcn components (Badge, Button) derive from `--primary`. Changing it from dark gray to cyan may reduce contrast in some states. Check all button variants.
3. **Monospace readability for body text** — JetBrains Mono for body paragraphs (e.g., report summaries) may feel wide. If readability is poor, consider reducing `font-size` or `letter-spacing` for prose blocks. This is an aesthetic judgment to make during implementation.
