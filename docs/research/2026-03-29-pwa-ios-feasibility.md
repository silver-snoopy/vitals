# Research: PWA + iOS Native Wrapper Feasibility

**Date:** 2026-03-29
**Status:** Research Complete
**Goal:** Evaluate the feasibility of delivering the existing Vitals web UI as a Progressive Web App (PWA) with a native iOS wrapper, as an intermediate step toward full mobile client support.

**Related:** [Architecture (docs/architecture.md)](../architecture.md) · [UI/UX Transformation Plan (2026-03-17)](2026-03-17-ui-ux-transformation-plan.md)

---

## 1. Executive Summary & Recommendation

**Verdict: Highly feasible.** The Vitals frontend is already ~80% mobile-ready and can be enhanced into a PWA with minimal effort. A native iOS wrapper via Capacitor 8 can be added later when native features (HealthKit auto-sync, push notifications) become priorities.

### Recommended Two-Phase Strategy

| Phase | Approach | Effort | Unlocks |
|-------|----------|--------|---------|
| **A — PWA Enhancement** | `vite-plugin-pwa` + offline persistence + iOS meta tags | ~2-3 days | Installable web app, offline dashboard viewing, app-like experience |
| **B — Capacitor Native Wrapper** | Capacitor 8 shell around existing Vite build | ~1-2 weeks | App Store distribution, HealthKit auto-sync, push notifications, Face ID |

**Phase A should be done first** — it delivers immediate value with low risk and serves as the foundation for Phase B. Phase B is only needed when automatic HealthKit sync or reliable push notifications become requirements.

---

## 2. Current Application Assessment

### 2.1 Frontend Architecture

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 19.x |
| Build tool | Vite | 6.x |
| Styling | Tailwind CSS | 4.x |
| UI library | shadcn/ui (Base UI) | 4.x |
| State (server) | TanStack React Query | 5.62+ |
| State (client) | Zustand | 5.x |
| Charts | Recharts | 2.15+ |
| Routing | React Router | 7.x |
| Deployment | Vercel (static SPA) | — |

### 2.2 Mobile Readiness Score

| Aspect | Score | Details |
|--------|-------|---------|
| Responsive layout | ✅ 9/10 | Mobile-first Tailwind, dedicated mobile layout (bottom nav + header) |
| Touch interactions | ✅ 8/10 | Swipeable chart carousel, snap scroll KPI cards, passive listeners |
| Safe area support | ✅ 8/10 | `viewport-fit=cover`, `pb-safe` utility for notch/gesture area |
| Charts on mobile | ✅ 8/10 | `SwipeableCharts` carousel with dot indicators |
| Offline support | ❌ 0/10 | No service worker, no data persistence, no cache strategy |
| PWA metadata | ❌ 0/10 | No manifest, no iOS meta tags, no app icons |
| Install experience | ❌ 0/10 | No install prompt, no A2HS guidance |
| **Overall** | **5.5/10** | Strong UI foundation, zero PWA infrastructure |

### 2.3 Key Files

| File | Relevance |
|------|-----------|
| `packages/frontend/vite.config.ts` | Build config — PWA plugin goes here |
| `packages/frontend/index.html` | Entry point — manifest link, iOS meta tags |
| `packages/frontend/src/main.tsx` | App entry — SW registration |
| `packages/frontend/src/App.tsx` | Router + QueryClient — persistence wraps here |
| `packages/frontend/src/api/client.ts` | Fetch wrapper — offline fallback needed |
| `packages/frontend/src/index.css` | Tailwind theme — already has safe-area support |
| `packages/frontend/src/components/layout/AppShell.tsx` | App shell — offline indicator placement |
| `packages/frontend/src/store/*.ts` | 5 Zustand stores — persistence candidates |

### 2.4 Current Gaps for PWA

1. **No service worker** — zero offline capability
2. **No web app manifest** — not installable
3. **No iOS-specific meta tags** — no standalone mode, no status bar styling
4. **No app icons** — no Home Screen icon or splash screen
5. **All state is ephemeral** — React Query + Zustand are in-memory only
6. **No offline UI indicators** — user has no feedback when connectivity drops
7. **WebSocket features (chat, report progress) have no offline fallback**

---

## 3. PWA on iOS — Current State (2026)

### 3.1 Safari 26 / iOS 26 (September 2025) — Major PWA Milestone

iOS 26 is the **most significant PWA update Apple has ever shipped**:

- **Every Home Screen website opens as a standalone web app by default** — no manifest required
- **File System WritableStream API** — first time iOS supports writable file access from web
- **Workerless push notifications** — push no longer requires a service worker
- **Major Service Worker debugging improvements** — reliability fixes for ReadableStream and navigation preload

**Source:** [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

### 3.2 Safari 18.4 (March 2025)

- **Declarative Web Push** — simplified push notification setup
- **Screen Wake Lock API** — prevent screen dimming (useful for workout tracking)
- **Cookie Store API** — improved cookie management
- **Brotli compression** — smaller asset delivery

**Source:** [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)

### 3.3 Supported Web APIs

| API | Status | Notes |
|-----|--------|-------|
| Service Workers | ✅ Supported | Since iOS 11.3. Event-driven only, no background execution |
| Web App Manifest | ✅ Supported | Basic support. iOS 26 makes it optional |
| Web Push | ✅ Supported | Since iOS 16.4. Home Screen PWAs only, not Safari tabs |
| Badging API | ✅ Supported | App badge count on Home Screen icon |
| Cache API | ✅ Supported | Full support for offline asset caching |
| IndexedDB | ✅ Supported | Primary offline data storage |
| Persistent Storage | ✅ Supported | Since Safari 17. Requires notification permission |
| Screen Wake Lock | ✅ Supported | Since Safari 18.4 |
| WebSocket | ✅ Supported | Works in PWA mode |
| WebAuthn/Passkeys | ✅ Supported | For biometric auth on web |
| Geolocation | ✅ Supported | Standard Location API |
| Camera/Microphone | ✅ Supported | Via getUserMedia |
| Web Share | ✅ Supported | Native share sheet integration |
| OPFS | ✅ Supported | Origin Private File System |

### 3.4 Missing/Blocked APIs

| API | Status | Impact on Vitals |
|-----|--------|-----------------|
| Background Sync | ❌ Blocked | Cannot sync data when app is closed |
| Periodic Background Sync | ❌ Blocked | Cannot schedule recurring data fetches |
| Background Fetch | ❌ Blocked | Cannot download large files in background |
| `beforeinstallprompt` | ❌ Blocked | Cannot programmatically trigger install prompt |
| Web Bluetooth | ❌ Blocked | Cannot connect to fitness wearables |
| Web NFC | ❌ Blocked | Not relevant |
| Web USB/Serial | ❌ Blocked | Not relevant |
| Battery Status | ❌ Blocked | Not relevant |
| App Shortcuts | ❌ Blocked | Cannot add quick actions to Home Screen icon |
| Fullscreen API | ❌ Blocked | Minor — standalone mode is close enough |
| Contact Picker | ❌ Blocked | Not relevant |

### 3.5 iOS Storage & Eviction

- **Quota:** Up to 60% of device disk per origin (since Safari 17)
- **Eviction policy:** Least Recently Used (LRU) — origins unused for ~7 days may be evicted
- **Persistent Storage API:** Prevents eviction but requires notification permission to be granted
- **Practical limit:** Keep total cached data under ~30MB for safety margin
- **Mitigation:** Re-cache critical assets on every app launch; use `navigator.storage.persist()`

**Source:** [Updates to Storage Policy — WebKit Blog](https://webkit.org/blog/14403/updates-to-storage-policy/)

### 3.6 Web Push on iOS

- Available since **iOS 16.4** (March 2023)
- **Only works in Home Screen PWAs** — not in Safari browser tabs
- Requires HTTPS, VAPID keys, and user gesture for permission
- Safari 18.4 added Declarative Web Push (no service worker needed)
- Safari 26 added workerless push
- **No silent push** — cannot wake the app without user-visible notification
- **Reach limitation:** Estimated 10-15x smaller than native push due to multi-step funnel:
  1. User visits site → 2. Adds to Home Screen → 3. Opens from Home Screen → 4. Grants notification permission

**Source:** [Sending Web Push Notifications — Apple Developer](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

### 3.7 EU Digital Markets Act Impact

- Apple attempted to **remove PWA support in the EU** in February 2024 (iOS 17.4 beta)
- **Reversed after public backlash** in March 2024
- Apple shipped `BrowserEngineKit` for third-party browser engines in the EU
- **Zero browsers have adopted it** after 21 months — regulatory and technical barriers remain
- EU fined Apple €500M (April 2025), UK CMA designated Apple with Strategic Market Status
- **Net impact for developers:** Nothing has materially changed. WebKit remains the only engine on iOS.

**Sources:** [Apple Reverses PWA Decision — TechCrunch](https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/) · [OWA 2025 in Review](https://open-web-advocacy.org/blog/owa-2025-review/)

---

## 4. Native Wrapper Comparison Matrix

### 4.1 Detailed Comparison

| Criteria | Capacitor 8 | Tauri 2.x | PWABuilder | RN WebView | Cordova |
|----------|-------------|-----------|------------|------------|---------|
| **GitHub stars** | 15.4k | 105k | — | — | — |
| **npm weekly downloads** | ~2M | ~100k | — | ~2M (RN) | ~47k |
| **Last release** | v8.3.0 (Mar 2026) | v2.10.3 | Archived Sep 2025 | Active | v13.0.0 (Nov 2025) |
| **Purpose-built for web→native** | ✅ Yes | ❌ Desktop-first | ❌ Archived | ❌ Native-first | ✅ Yes (legacy) |
| **React + Vite support** | ✅ First-class | ⚠️ Vite yes, React partial | ❌ N/A | ❌ Separate runtime | ❌ No Vite |
| **TypeScript support** | ✅ Full | ✅ Full | ❌ N/A | ✅ Full | ⚠️ Partial |
| **iOS WebView engine** | WKWebView | WKWebView | WKWebView | — | WKWebView |
| **HealthKit plugin** | ✅ @capgo/capacitor-health | ❌ None | ❌ None | ✅ react-native-health | ⚠️ Outdated |
| **Push notifications** | ✅ Official plugin | ❌ No iOS support | ❌ None | ✅ Official | ✅ Plugin |
| **Biometrics (Face ID)** | ✅ Official plugin | ❌ No plugin | ❌ None | ✅ Multiple libs | ⚠️ Plugin |
| **Camera** | ✅ Official plugin | ⚠️ Basic | ❌ None | ✅ Native | ✅ Plugin |
| **File system** | ✅ Official plugin | ✅ Native | ❌ None | ✅ Native | ✅ Plugin |
| **Native shell size** | ~2-5 MB | ~3-5 MB | ~1 MB | ~7-15 MB | ~2-5 MB |
| **App Store track record** | ✅ Thousands of apps | ⚠️ Very few iOS apps | ❌ Routine rejections | ✅ Many apps | ✅ Many (declining) |
| **Vite HMR in simulator** | ✅ Yes | ✅ Yes | ❌ N/A | ❌ Separate HMR | ❌ No |
| **Custom plugin language** | Swift/Kotlin | Rust + Swift | N/A | Obj-C/Swift | Obj-C/Swift |
| **Commercial backing** | Ionic (funded) | Crabnebula | Microsoft (abandoned) | Meta | Apache (declining) |
| **OTA updates** | ✅ Capgo / Appflow | ❌ Not available | ❌ N/A | ✅ CodePush | ❌ Limited |

### 4.2 Evaluation Summary

#### Capacitor 8 — **RECOMMENDED**

**Why:** Purpose-built for exactly this use case. Your entire React 19 + Vite 6 + Tailwind 4 + shadcn codebase runs unchanged inside a native shell. HealthKit plugin exists and is actively maintained. Thousands of production App Store apps prove viability.

**Production examples:** Burger King, Lichess, Union Bank of India, Conecte SUS

**Key advantages:**
- Zero code changes to existing web app
- SPM (Swift Package Manager) by default in v8
- Vite HMR works in iOS Simulator for rapid development
- Official plugins for push, camera, biometrics, filesystem, geolocation
- OTA updates via Capgo (bypass App Store for web layer changes)
- Same codebase serves PWA and native targets

#### Tauri 2.x — Not Recommended

**Why:** Mobile support is officially "production ready" but has critical gaps for this use case. No HealthKit plugin, no push notification support on iOS, only 5 plugins with explicit mobile support. Writing custom plugins requires Rust + Swift bridge. Very few documented iOS App Store submissions.

#### PWABuilder — Not Viable

**Why:** Microsoft **archived the iOS packaging repository in September 2025**. Even before archival, apps generated by PWABuilder faced routine App Store rejections under Guideline 4.2 ("not sufficiently different from a mobile web browsing experience"). No native capabilities.

#### React Native WebView — Over-Engineered

**Why:** Adds an entire React Native runtime (~7-15 MB) just to host a WebView. Requires maintaining two build systems (Metro + Vite), two component models, and a stringly-typed `postMessage` bridge. Capacitor achieves the same result with less overhead and complexity.

#### Apache Cordova — Legacy

**Why:** The community has migrated to Capacitor. npm downloads are down to ~47k/week (from millions). No Vite support, no SPM, aging plugin ecosystem. Ionic explicitly positions Capacitor as Cordova's successor.

---

## 5. Recommended Strategy — Two-Phase Approach

### 5.1 Phase A: PWA Enhancement

**Goal:** Make the existing web app installable, offline-capable, and app-like on iOS and Android.

**Scope:**
- Add `vite-plugin-pwa` (v1.2.0) with Workbox service worker
- Create `manifest.json` with app name, icons, theme colors, display mode
- Add iOS-specific meta tags (`apple-mobile-web-app-capable`, status bar style, touch icons)
- Generate app icons (192x192, 512x512 for manifest; 180x180 for Apple touch icon)
- Add TanStack Query persistence to IndexedDB (`@tanstack/react-query-persist-client` + `idb-keyval`)
- Add Zustand persist middleware for `useDateRangeStore` and `useThemeStore`
- Implement offline UI indicator in AppShell
- Add iOS install prompt banner (educational — no `beforeinstallprompt` on iOS)
- Configure Workbox caching strategies (CacheFirst for assets, NetworkFirst for API)

**Libraries:**

| Package | Version | Purpose |
|---------|---------|---------|
| `vite-plugin-pwa` | ^1.2.0 | Service worker generation + manifest |
| `@tanstack/react-query-persist-client` | ^5.x | React Query offline persistence |
| `idb-keyval` | ^6.x | Simple IndexedDB wrapper for persistence |

**Effort estimate:** ~2-3 days

**What this unlocks:**
- App icon on Home Screen with standalone mode
- Offline viewing of previously loaded dashboard data
- Faster repeat visits (cached assets)
- App-like navigation (no browser chrome)
- Theme persistence across sessions

**What this does NOT unlock:**
- Automatic HealthKit data sync (requires native)
- Reliable push notifications (limited reach on iOS PWA)
- Background data collection
- App Store distribution

### 5.2 Phase B: Capacitor Native Wrapper

**Goal:** Wrap the PWA in a native iOS shell for App Store distribution and native feature access.

**Scope:**
- Initialize Capacitor 8 in the frontend package
- Configure Capacitor to use Vite's `dist/` output
- Add official Capacitor plugins: Push Notifications, Biometrics, Camera
- Integrate `@capgo/capacitor-health` for HealthKit read access
- Build minimal native UI additions to satisfy App Store Guideline 4.2
- Configure Xcode project (signing, capabilities, entitlements)
- Set up Capgo for OTA web layer updates
- Submit to App Store

**Libraries:**

| Package | Version | Purpose |
|---------|---------|---------|
| `@capacitor/core` | ^8.x | Core native bridge |
| `@capacitor/ios` | ^8.x | iOS platform support |
| `@capacitor/cli` | ^8.x | Build tooling |
| `@capacitor/push-notifications` | ^8.x | Native push notifications |
| `@capacitor/haptics` | ^8.x | Haptic feedback |
| `@capacitor/status-bar` | ^8.x | Status bar control |
| `@capacitor/splash-screen` | ^8.x | Native splash screen |
| `@capgo/capacitor-health` | ^8.x | HealthKit integration |
| `@capgo/capacitor-updater` | ^8.x | OTA web layer updates |

**Effort estimate:** ~1-2 weeks

**What this unlocks:**
- App Store distribution and discoverability
- Automatic Apple Health data sync (no manual XML export)
- Reliable native push notifications
- Face ID / Touch ID authentication
- Haptic feedback for interactions
- OTA updates (push web changes without App Store review)

**Prerequisites:**
- Apple Developer Account ($99/year)
- macOS with Xcode (for iOS builds)
- Phase A completed (PWA serves as the web layer)

---

## 6. Implementation Details

### 6.1 vite-plugin-pwa Configuration

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // User-controlled updates (recommended)
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Vitals — Health Dashboard',
        short_name: 'Vitals',
        description: 'Personal health data management dashboard',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache API responses with network-first strategy
            urlPattern: /^https:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            // Cache fonts with cache-first strategy
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },
    }),
  ],
});
```

**Update strategy rationale:** `prompt` is recommended over `autoUpdate` because Vitals has form-like interactions (date pickers, filters) that could lose state during an automatic reload. The prompt approach lets the user choose when to update.

### 6.2 iOS-Specific Meta Tags

```html
<!-- index.html additions -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Vitals" />
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

### 6.3 TanStack Query Offline Persistence

```typescript
// main.tsx — wrap with PersistQueryClientProvider
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
// OR for IndexedDB:
import { get, set, del } from 'idb-keyval';

const persister = {
  persistClient: async (client) => await set('vitals-query-cache', client),
  restoreClient: async () => await get('vitals-query-cache'),
  removeClient: async () => await del('vitals-query-cache'),
};

// In App.tsx, set gcTime >= maxAge
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // 24 hours — must be >= persister maxAge
      networkMode: 'offlineFirst', // Serve from cache when offline
    },
  },
});
```

**Key configuration:**
- `gcTime` (24h) must be ≥ persister `maxAge` — otherwise queries are garbage-collected before they can be restored
- `networkMode: 'offlineFirst'` serves cached data immediately while refetching in background
- Use `buster` tied to app version for automatic cache invalidation on deploy
- Persistence is throttled to once per second automatically

### 6.4 Zustand Persistence

```typescript
// useDateRangeStore.ts — add persist middleware
import { persist } from 'zustand/middleware';

export const useDateRangeStore = create<DateRangeState>()(
  persist(
    (set) => ({
      startDate: subDays(new Date(), 14),
      endDate: new Date(),
      setRange: (start, end) => set({ startDate: start, endDate: end }),
    }),
    {
      name: 'vitals-date-range', // localStorage key
      // localStorage is fine for small stores (< 5KB)
    }
  )
);
```

**Which stores to persist:**
- `useDateRangeStore` → **Yes** (user preference, small)
- `useThemeStore` → **Yes** (user preference, small)
- `useChatStore` → **Optional** (message history, could be large)
- `useReportGenerationStore` → **No** (transient state)
- `useActionItemsStore` → **No** (optimistic cache, should match server)

### 6.5 Workbox Caching Strategy

| Resource | Strategy | Cache Name | TTL | Rationale |
|----------|----------|-----------|-----|-----------|
| JS/CSS bundles | `CacheFirst` | `static-assets` | 1 year | Vite content-hashes filenames |
| HTML (app shell) | `StaleWhileRevalidate` | `app-shell` | — | Always fresh, fast fallback |
| Fonts (woff2) | `CacheFirst` | `font-cache` | 1 year | Rarely change |
| API responses | `NetworkFirst` | `api-cache` | 24h | Fresh data preferred, cache as fallback |
| WebSocket | N/A | — | — | Cannot cache; show offline banner |

**iOS-specific considerations:**
- Keep total cache under ~30MB to stay well within iOS quotas
- Re-cache critical assets on every launch (guard against 7-day eviction)
- Call `navigator.storage.persist()` early to request persistent storage

### 6.6 Capacitor Setup with Vite + React

```bash
# Phase B — Initialize Capacitor in frontend package
cd packages/frontend
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Vitals" "com.vitals.app" --web-dir dist

# After vite build
npx cap sync ios
npx cap open ios  # Opens Xcode project
```

**Capacitor config:**
```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vitals.app',
  appName: 'Vitals',
  webDir: 'dist',
  server: {
    // In development, point to Vite dev server for HMR
    url: 'http://localhost:3000',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
};

export default config;
```

**Development workflow:**
1. `npm run dev` — starts Vite dev server on port 3000
2. `npx cap sync ios` — copies web assets + updates native project
3. `npx cap run ios` — builds and runs on simulator (uses Vite HMR via `server.url`)
4. For production: `npm run build && npx cap sync ios && npx cap open ios`

---

## 7. Challenges & Risk Mitigation

### 7.1 Critical Challenges

| # | Challenge | Severity | Mitigation |
|---|-----------|----------|------------|
| 1 | **No HealthKit web API** | High | Phase A: Continue XML upload. Phase B: `@capgo/capacitor-health` for auto-sync |
| 2 | **iOS 7-day storage eviction** | High | Call `navigator.storage.persist()`, re-cache on launch, keep cache < 30MB |
| 3 | **No background sync on iOS** | High | Sync only when app is in foreground; Phase B: native background fetch |
| 4 | **App Store Guideline 4.2** | High | Add 3+ native features (push, Face ID, HealthKit) before submission |
| 5 | **PWA push notification reach** | Medium | Phase A: Educational install banner. Phase B: Native push (guaranteed delivery) |
| 6 | **WebSocket offline** | Medium | Show offline banner, queue messages, reconnect on network restore |
| 7 | **No `beforeinstallprompt` on iOS** | Low | Build custom install banner with iOS detection logic |
| 8 | **Dual build maintenance** | Low | Capacitor uses same Vite build output; no code forking |

### 7.2 HealthKit Access Strategy

**Current approach (web):** User manually exports Apple Health XML → uploads via `AppleHealthUploader` component → backend parses with `apple-health/parser.ts`.

**Phase B approach (native):** `@capgo/capacitor-health` reads HealthKit directly:
```typescript
import { CapacitorHealth } from '@capgo/capacitor-health';

// Request authorization
await CapacitorHealth.requestAuthorization({
  readPermissions: ['steps', 'heartRate', 'bodyMass', 'activeEnergyBurned'],
});

// Query data
const steps = await CapacitorHealth.queryAggregated({
  dataType: 'steps',
  startDate: startOfWeek,
  endDate: endOfWeek,
  bucket: 'day',
});
```

This eliminates the manual XML export workflow entirely — the single biggest UX improvement for iOS users.

### 7.3 WebSocket Offline Handling

The chat (`useChat.ts`) and report progress (`useReportWebSocket.ts`) hooks use WebSocket connections. Strategy:

1. **Detect offline state:** `navigator.onLine` + `online`/`offline` events
2. **Show offline banner** in AppShell when disconnected
3. **Queue outgoing messages** in `useChatStore` when offline
4. **Reconnect automatically** on network restore (existing exponential backoff logic already handles this)
5. **Disable AI features** gracefully — report generation and chat require server connectivity

---

## 8. App Store Compliance Strategy

### 8.1 Apple Guideline 4.2 — Minimum Functionality

> "Your app should include features, content, and UI that elevate it beyond a repackaged website."

Apps that are primarily WebView wrappers face rejection. Apple requires **meaningful native functionality** that justifies distribution through the App Store.

### 8.2 Native Features for Compliance

To pass review, add **3+ native features** that cannot be achieved through Safari:

| Feature | Plugin | Justification |
|---------|--------|---------------|
| **HealthKit integration** | `@capgo/capacitor-health` | Reads data unavailable to web apps |
| **Push notifications** | `@capacitor/push-notifications` | Reliable native delivery |
| **Biometric auth** | `@capacitor/biometrics` | Face ID / Touch ID for app lock |
| **Haptic feedback** | `@capacitor/haptics` | Native-feel interactions |
| **Native splash screen** | `@capacitor/splash-screen` | App-quality launch experience |

### 8.3 Submission Checklist

- [ ] HealthKit integration working and demonstrated in review notes
- [ ] Push notifications functional with backend APNS integration
- [ ] Face ID prompt on app launch
- [ ] Native splash screen (not a web loading screen)
- [ ] Privacy Nutrition Labels filled out (HealthKit data usage)
- [ ] `NSHealthShareUsageDescription` in Info.plist
- [ ] App Review notes explaining native features beyond web
- [ ] Screenshots on iPhone 15 Pro and iPhone SE

---

## 9. Sources & References

### Apple / WebKit Official
- [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) — iOS 26 PWA changes
- [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) — Declarative push, wake lock
- [News from WWDC25: Web Technology in Safari 26 Beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- [Updates to Storage Policy — WebKit Blog](https://webkit.org/blog/14403/updates-to-storage-policy/) — iOS storage quotas
- [Sending Web Push Notifications — Apple Developer](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [Apple DMA and Apps in the EU](https://developer.apple.com/support/dma-and-apps-in-the-eu/)

### PWA Guides & Analysis
- [PWA iOS Limitations 2026 — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [PWAs on iOS — MobileLoud 2026 Guide](https://www.mobiloud.com/blog/progressive-web-apps-ios)
- [PWA on iOS — Brainhub 2025](https://brainhub.eu/library/pwa-on-ios)
- [iOS PWA Compatibility — firt.dev](https://firt.dev/notes/pwa-ios/)
- [Web Apps in iOS 26 — Michael Tsai](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/)

### Libraries & Tools
- [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) — v1.2.0, Vite PWA integration
- [Vite PWA Guide](https://vite-pwa-org.netlify.app/guide/) — Official documentation
- [Vite PWA React Framework](https://vite-pwa-org.netlify.app/frameworks/react) — React-specific setup
- [@capgo/capacitor-health](https://github.com/Cap-go/capacitor-health) — Capacitor 8 HealthKit plugin
- [@perfood/capacitor-healthkit](https://github.com/perfood/capacitor-healthkit) — Alternative HealthKit plugin
- [TanStack Query persistQueryClient](https://www.mintlify.com/tanstack/query/plugins/persist-client) — Offline persistence
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/reference/middlewares/persist) — State persistence
- [Workbox Strategies — Chrome Developers](https://developer.chrome.com/docs/workbox/modules/workbox-strategies)

### Native Wrapper Comparisons
- [Capacitor GitHub](https://github.com/ionic-team/capacitor) — 15.4k stars
- [Tauri GitHub](https://github.com/tauri-apps/tauri) — 105k stars
- [App Store WebView Rejection Guide — MobileLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)

### Regulatory
- [Apple Reverses PWA Decision in EU — TechCrunch](https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/)
- [Apple's Browser Engine Ban Persists — Open Web Advocacy](https://open-web-advocacy.org/blog/apples-browser-engine-ban-persists-even-under-the-dma/)
- [OWA 2025 in Review](https://open-web-advocacy.org/blog/owa-2025-review/)
- [Japan: Apple Must Lift Engine Ban — OWA](https://open-web-advocacy.org/blog/japan-apple-must-lift-engine-ban-by-december/)

### Offline Architecture
- [PWA Offline Storage Strategies — dev.to](https://dev.to/tianyaschool/pwa-offline-storage-strategies-indexeddb-and-cache-api-3570)
- [Offline-First PWA Architecture — Beefed.ai](https://beefed.ai/en/offline-first-pwa-architecture)
- [Storage Quotas — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [react-ios-pwa-prompt](https://github.com/chrisdancee/react-ios-pwa-prompt) — iOS install banner
