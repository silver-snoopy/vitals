# Design System Foundation (Phase A)

**Date:** 2026-03-17
**Branch:** `experiment/ui-ux-pro-max`
**Spec:** `docs/research/2026-03-17-ui-ux-transformation-plan.md` — Phase A

---

## Context

Implement the design system foundation for the UI/UX transformation. This is the first phase that all subsequent phases (mobile nav, dashboard redesign, page improvements) will build on.

**User decisions:**
- Primary color: Healthcare cyan `#0891B2`
- Typography: JetBrains Mono (numbers/headings) + Fira Sans (body)
- Update shadcn/ui component colors now (not deferred)

---

## Tasks (ordered)

### 1. Install fonts
- `npm install -w @vitals/frontend @fontsource-variable/jetbrains-mono @fontsource/fira-sans`
- Remove `@fontsource-variable/geist` dependency
- Update `index.css` imports

### 2. Update CSS color tokens in `index.css`
Replace the current monochrome oklch palette with the new healthcare/analytics palette.

**Light mode (:root):**
| Token | Value | Hex source |
|-------|-------|------------|
| --background | `#F8FAFC` | slate-50 |
| --foreground | `#1E293B` | slate-800 |
| --card | `#FFFFFF` | white |
| --card-foreground | `#1E293B` | slate-800 |
| --primary | `#0891B2` | cyan-600 |
| --primary-foreground | `#FFFFFF` | white |
| --secondary | `#3B82F6` | blue-500 |
| --secondary-foreground | `#FFFFFF` | white |
| --muted | `#F1F5F9` | slate-100 |
| --muted-foreground | `#64748B` | slate-500 |
| --accent | `#F97316` | orange-500 |
| --accent-foreground | `#FFFFFF` | white |
| --destructive | `#DC2626` | red-600 |
| --border | `#DBEAFE` | blue-100 |
| --input | `#DBEAFE` | blue-100 |
| --ring | `#0891B2` | cyan-600 |
| --success | `#059669` | emerald-600 |
| --warning | `#D97706` | amber-600 |

**Dark mode (.dark):** Adjusted variants of each token for dark backgrounds.

### 3. Update `@theme inline` in `index.css`
- Change `--font-sans` to `'Fira Sans', sans-serif`
- Add `--font-mono: 'JetBrains Mono Variable', monospace`
- Add `--color-success` and `--color-warning` mappings

### 4. Update `chart-config.ts`
Already close — just fix `weight` from `#a855f7` to `#8B5CF6`.

### 5. Create `src/components/ui/kpi-card.tsx`
Compact KPI card with:
- Large monospace number (JetBrains Mono 600, text-2xl)
- Small muted label (Fira Sans 500, text-xs)
- Trend indicator: colored arrow (▲/▼/→) with delta text
- Optional children slot for sparkline
- Uses shadcn Card as base

### 6. Create `src/components/charts/Sparkline.tsx`
Tiny inline chart:
- Recharts LineChart, 80×40px, no axes/grid/tooltip
- Single `<Line>` with configurable color
- `data` prop: `Array<{ value: number }>`
- ResponsiveContainer wrapper

---

## Files to modify

| File | Change |
|------|--------|
| `packages/frontend/package.json` | Swap font dependencies |
| `packages/frontend/src/index.css` | Font imports, all CSS variables, @theme inline |
| `packages/frontend/src/lib/chart-config.ts` | Update weight color |
| `packages/frontend/src/components/dashboard/NutritionChart.tsx` | No change (already uses chart-config) |
| `packages/frontend/src/components/dashboard/WeightChart.tsx` | No change (already uses chart-config) |

## Files to create

| File | Purpose |
|------|---------|
| `packages/frontend/src/components/ui/kpi-card.tsx` | Reusable KPI card with trend indicator |
| `packages/frontend/src/components/charts/Sparkline.tsx` | Tiny inline sparkline chart |

---

## Dependencies

- `@fontsource-variable/jetbrains-mono` (new)
- `@fontsource/fira-sans` (new, weights 300-700)
- Remove: `@fontsource-variable/geist`

---

## Test strategy

- **Unit tests:** KpiCard render test (number, label, trend arrow), Sparkline render test
- **Build:** `npm run build` must pass
- **Lint/format:** `npm run lint && npm run format:check` must pass
- **Visual:** Live screenshot verification of dashboard with new colors/fonts

---

## Risks

- OKLch conversion: Need accurate hex→oklch for WCAG compliance in dark mode
- Font weight availability: JetBrains Mono Variable supports 100-800, Fira Sans needs explicit weights
- shadcn/ui components reference `primary`, `secondary`, `accent` etc. — changing these affects all UI globally
