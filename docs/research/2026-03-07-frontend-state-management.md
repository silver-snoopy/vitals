# Research: Frontend State Management for Vitals SPA

**Date:** 2026-03-07
**Context:** Phase 4 frontend — evaluating global state management strategy for a multi-page React SPA with 5 routes (Dashboard, Nutrition, Workouts, Reports, Upload). Server state is already handled by TanStack Query (already in package.json). Question is what to use for client-side UI state (date range, theme, filters, etc.).

---

## The Server State / Client State Divide (Key Insight)

The modern consensus (2025) is that state divides cleanly into two categories:

| State Type | Examples | Tool |
|------------|---------|------|
| **Server state** | API data, loading, errors, caching | TanStack Query (already installed) |
| **Client state** | Date range picker, theme, filter selections, modal open/close | Global state library |

TanStack Query already eliminates the primary historical reason to use Redux (managing async server data). What remains to manage globally is a small surface area of UI state.

---

## Libraries Evaluated

### Redux Toolkit (RTK)
- **Bundle:** ~43KB gzipped
- **Boilerplate:** High — actions, reducers, slices, store setup. ~15 files for a simple counter vs Zustand's 3.
- **Strengths:** Time-travel debugging, strict patterns, mature devtools, action logging middleware, excellent for large teams with 10+ engineers. Reduces bugs by ~25% through enforced conventions in large codebases.
- **Fit for Vitals:** Overengineered. Single-user personal app with small client state surface area.

### Zustand
- **Bundle:** ~1–3KB gzipped (14–43x smaller than RTK)
- **Boilerplate:** Minimal — one `create()` call, no providers, no actions/reducers
- **Strengths:** Hook-based subscriptions (components only re-render on subscribed slice), flexible, incrementally adoptable, no wrapping providers
- **Fit for Vitals:** Strong match — handles date range + UI state with no overhead. Easy to extend if complexity grows.

### Jotai
- **Bundle:** ~3KB gzipped
- **Boilerplate:** None — atomic primitives (`atom()`), composable
- **Strengths:** Most granular re-render control, first-class Suspense support, great for interdependent derived state
- **Fit for Vitals:** Slight overkill — atomic model adds a mental shift for relatively simple shared state

### React Context API
- **Bundle:** 0 (built-in)
- **Boilerplate:** Low for simple cases
- **Strengths:** No dependency
- **Fit for Vitals:** Re-renders every consumer on any context change — performance risk for a data-heavy dashboard. Fine for infrequent state (theme), not for frequently-changing state (date range).

---

## Comparison Table

| Factor | RTK | Zustand | Jotai | Context |
|--------|-----|---------|-------|---------|
| Bundle size | 43KB | ~1-3KB | ~3KB | 0 |
| Boilerplate | High | Low | Very low | Low |
| Re-render control | Good (selectors) | Good (selectors) | Excellent (atomic) | Poor |
| DevTools | Excellent | Good | Moderate | None |
| Learning curve | High | Low | Medium | None |
| Future scalability | Excellent | Good | Good | Poor |
| No provider needed | No | Yes | No | No |
| Team size fit | Large teams | Any | Any | Small apps |

---

## TanStack Query Interaction

TanStack Query (already installed) handles ALL server state in Vitals:
- `/api/nutrition/daily` → `useNutrition` hook
- `/api/workouts` → `useWorkouts` hook
- `/api/reports` → `useReports` hook
- etc.

The global state library handles only the remaining client UI state:
- Selected date range (start/end) — shared across Dashboard, Nutrition, Workouts
- Theme preference (system/light/dark toggle override)
- Any future filters, panel open/close states

This is a **small client state surface area**, which significantly changes the library calculus vs a Redux-era app where all server data also lived in the store.

---

## Sources

- [State Management in 2025: When to Use Context, Redux, Zustand, or Jotai](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [Do You Need State Management in 2025?](https://dev.to/saswatapal/do-you-need-state-management-in-2025-react-context-vs-zustand-vs-jotai-vs-redux-1ho)
- [Zustand vs. Redux Toolkit vs. Jotai — Better Stack](https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux-toolkit-vs-jotai/)
- [Stop Using Redux for Server State](https://www.it-labs.com/stop-using-redux-for-server-state-why-tanstack-query-is-the-better-choice-in-2025/)
- [Redux vs TanStack Query & Zustand: The 2025 Verdict](https://www.bugragulculer.com/blog/good-bye-redux-how-react-query-and-zustand-re-wired-state-management-in-25)
- [Zustand vs Redux Toolkit 2025](https://isitdev.com/zustand-vs-redux-toolkit-2025/)
- [Zustand and TanStack Query: The Dynamic Duo](https://javascript.plainenglish.io/zustand-and-tanstack-query-the-dynamic-duo-that-simplified-my-react-state-management-e71b924efb90)
- [Zustand vs Redux Toolkit: React Native Health Apps](https://www.wellally.tech/blog/zustand-vs-redux-react-native-health-apps)
