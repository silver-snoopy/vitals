# Research: Web + iOS Delivery Strategy Comparison

**Date:** 2026-03-29
**Status:** Decision Made
**Decision:** PWA + Capacitor 8 (two-phase strategy confirmed)
**Related:** [PWA + iOS Feasibility Research](2026-03-29-pwa-ios-feasibility.md)

---

## 1. Context

The [PWA + iOS Feasibility Research](2026-03-29-pwa-ios-feasibility.md) recommended a two-phase approach (PWA Enhancement + Capacitor 8 native wrapper). This document evaluates whether any alternative approach is better suited for delivering Vitals on both web and iOS with shared functionality.

**Requirements:**
- Web UI (existing React 19 + Vite 6 + Tailwind 4 + shadcn/ui app)
- iOS application
- Shared functionality between both
- HealthKit integration on iOS (currently manual XML upload)

---

## 2. Current Codebase Profile

| Metric | Value |
|--------|-------|
| Frontend files | 98 TS/TSX files (~4,931 LOC) |
| Business logic (API hooks, stores) | ~15-20% of codebase (~1,000 LOC) |
| UI layer (components, layouts, charts) | ~80-85% of codebase (~4,000 LOC) |
| Tailwind className instances | 511 across 57 files |
| Recharts chart components | 7 |
| shadcn/ui components | 17 |
| Zustand stores | 5 (framework-agnostic) |
| API hooks | 15 (React Query dependent) |
| Routes | 6 pages |

**Key characteristic:** The business logic is cleanly separated but only represents 15-20% of the codebase. The vast majority is UI code tightly coupled to React DOM, Tailwind CSS, shadcn/Base UI, and Recharts.

---

## 3. Approaches Evaluated

### 3.1 PWA + Capacitor 8 (Recommended)

Keep the existing React app unchanged. Phase A adds PWA capabilities (service worker, manifest, offline persistence). Phase B wraps it in a Capacitor native shell for App Store distribution and native API access.

| Dimension | Assessment |
|-----------|------------|
| Code reuse | **100%** — zero changes to existing codebase |
| Migration effort | **~2-3 days** (PWA) + **~1-2 weeks** (Capacitor) |
| HealthKit | Via `@capgo/capacitor-health` plugin |
| Charts | Recharts works unchanged |
| Styling | Tailwind + shadcn work unchanged |
| Maintenance | Single codebase for both targets |
| App Store risk | Medium — need 3+ native features for Guideline 4.2 |
| Native feel | Good (WKWebView + native plugins) |
| Production track record | Thousands of Capacitor apps in App Store |

**Verdict:** Lowest effort, highest code reuse, proven path.

### 3.2 React Native + Expo (with web support)

Rewrite frontend in React Native primitives. Use Expo Router for both web and iOS. Web output uses Metro bundler (not Vite).

| Dimension | Assessment |
|-----------|------------|
| Code reuse | **30-38%** — only API hooks and stores transfer |
| Migration effort | **4-8 weeks** (62-70% rewrite) |
| HealthKit | Via `@kingstinct/react-native-healthkit` (requires custom dev client) |
| Charts | **Must replace Recharts** — no RN equivalent without major work |
| Styling | **Must replace Tailwind/shadcn** — NativeWind has ~60% feature parity |
| Web build tool | Metro (not Vite) — different DX |
| Native feel | Excellent (true native components on iOS) |

**Incompatible dependencies:** Recharts, react-router-dom, @base-ui/react, shadcn/ui, next-themes, react-day-picker, sonner

**Verdict:** Enormous migration cost. Only justified if mobile is the primary target — the opposite of Vitals' situation.

### 3.3 Separate Native iOS App (SwiftUI) + Keep Web As-Is

Build a standalone SwiftUI iOS app talking to the same backend API. Web app stays unchanged.

| Dimension | Assessment |
|-----------|------------|
| Code reuse | **0% frontend** (shared backend API only) |
| Migration effort | **4-6 weeks** for feature parity |
| HealthKit | **First-class** — direct Apple framework, background delivery, Watch support |
| Maintenance | **Two separate frontends** — every feature/bugfix done twice |
| Native feel | Perfect |

**Verdict:** Best iOS experience but doubles ongoing maintenance. Only viable with separate web/iOS developers or intentional feature divergence.

### 3.4 Flutter (Web + iOS)

Complete rewrite in Dart. Web renders to Canvas (no DOM).

| Dimension | Assessment |
|-----------|------------|
| Code reuse from existing | **0%** — complete rewrite in Dart |
| Migration effort | **10-16 weeks** |
| Web rendering | Canvas-based — no DOM, zero SEO, limited accessibility |
| iOS Safari issue | WasmGC bug blocks Wasm renderer → falls back to slower JS |

**Verdict:** Not viable. Different language, canvas-based web rendering, active Safari compatibility bug.

### 3.5 Kotlin Multiplatform (KMP) + Compose Multiplatform

Complete rewrite in Kotlin. Web target via Kotlin/Wasm (Canvas-based, beta).

| Dimension | Assessment |
|-----------|------------|
| Code reuse from existing | **0%** — complete rewrite in Kotlin |
| Migration effort | **10-16 weeks** |
| Web target | Beta, Canvas-based |

**Verdict:** Not viable. Different language, beta web target. Production users (Netflix, Cash App) use KMP for shared business logic only, not UI.

### 3.6 React Native for Web (react-native-web)

Rewrite to React Native, then use `react-native-web` to compile back to web.

| Dimension | Assessment |
|-----------|------------|
| Code reuse | **30-38%** (same as Expo) |
| Migration effort | **6-10 weeks** |
| Web experience | **Worse than standard React DOM** for dashboards |

**Verdict:** Going web -> React Native -> web is fighting the grain. Designed for mobile-first apps adding web, not the reverse.

---

## 4. Decision Matrix

| Approach | Code Reuse | Migration Effort | HealthKit | Web Quality | iOS Quality | Maintenance | **Score** |
|----------|:----------:|:----------------:|:---------:|:-----------:|:-----------:|:-----------:|:---------:|
| **PWA + Capacitor** | 100% | 2-3 weeks | Plugin | Unchanged | Good | Single | **4.75/5** |
| SwiftUI native | 0% frontend | 4-6 weeks | First-class | Unchanged | Perfect | Double | **3.85/5** |
| Expo | 30-38% | 4-8 weeks | Plugin | Degraded | Excellent | Single | **3.20/5** |
| React Native Web | 30-38% | 6-10 weeks | Plugin | Worse | Excellent | Single | **2.45/5** |
| Flutter | 0% | 10-16 weeks | Plugin | Canvas-only | Excellent | Single | **2.40/5** |
| KMP/Compose | 0% | 10-16 weeks | Wrappers | Beta/Canvas | Good | Single | **2.20/5** |

---

## 5. Decision & Rationale

**PWA + Capacitor 8 confirmed** because:

1. **100% code reuse** — the only approach that doesn't require rewriting the frontend
2. **80-85% of the codebase is web-coupled UI** — Tailwind, Recharts, shadcn are incompatible with every non-web framework
3. **HealthKit gap is solved by Capacitor plugins** — no need to rewrite the app for native API access
4. **Web quality preserved** — alternatives (Expo, Flutter, RNW) all produce worse web output

### When to Reconsider

- **Choose SwiftUI native** if: HealthKit background delivery, Apple Watch complications, Widgets, or intentional iOS feature divergence become requirements
- **Choose Expo** if: starting a new project from scratch where mobile is the primary target
- **Stay with PWA + Capacitor** if: maximizing leverage from existing codebase with minimum effort

---

## 6. Next Steps

1. **Phase A: PWA Enhancement** (~2-3 days) — `vite-plugin-pwa`, offline persistence, iOS meta tags
2. **Phase B: Capacitor Native Wrapper** (deferred) — when HealthKit auto-sync or App Store distribution become priorities

---

## 7. Sources

- [PWA + iOS Feasibility Research](2026-03-29-pwa-ios-feasibility.md) — original research document
- [Expo Web Support](https://docs.expo.dev/guides/customizing-metro/) — Metro bundler documentation
- [NativeWind](https://www.nativewind.dev/) — Tailwind CSS for React Native
- [Compose Multiplatform](https://www.jetbrains.com/compose-multiplatform/) — KMP UI framework
- [Flutter Web Rendering](https://docs.flutter.dev/platform-integration/web/renderers) — Canvas vs HTML renderers
- [react-native-web](https://necolas.github.io/react-native-web/) — React Native components for web
