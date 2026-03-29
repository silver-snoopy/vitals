# Phase B: Capacitor Native Wrapper — Implementation Plan

**Date:** 2026-03-29
**Type:** Feature
**Prerequisite:** Phase A complete (PWA Enhancement — service worker, manifest, offline persistence)
**Research:** [PWA + iOS Feasibility Research](../research/2026-03-29-pwa-ios-feasibility.md)
**Estimated scope:** Large (~1-2 weeks)

---

## Context

Phase A transformed the Vitals web app into an installable, offline-capable PWA. Phase B wraps this PWA in a native iOS shell via **Capacitor 8** to unlock:

- **App Store distribution** — discoverability and trust
- **Automatic HealthKit sync** — eliminates manual XML export (the single biggest UX friction)
- **Native push notifications** — reliable delivery without PWA install funnel
- **Biometric authentication** — Face ID / Touch ID app lock
- **Haptic feedback** — native-feel interactions

**Why Capacitor 8:**
- Purpose-built for web → native (your React 19 + Vite 6 codebase runs unchanged)
- 2M+ npm downloads/week, thousands of App Store apps
- SPM (Swift Package Manager) by default in v8
- HealthKit plugin exists (`@capgo/capacitor-health`)
- Vite HMR works in iOS Simulator for rapid development
- OTA web layer updates via Capgo (bypass App Store for web changes)

**What this does NOT change:**
- The existing web PWA continues to work — same codebase serves both targets
- Backend remains unchanged — no new API routes required
- Existing CI/CD (Vercel frontend, Railway backend) unaffected

---

## Prerequisites

Before starting this phase, ensure:

1. **Phase A complete** — PWA service worker, manifest, offline persistence all working
2. **Apple Developer Account** — $99/year enrollment at [developer.apple.com](https://developer.apple.com)
3. **macOS with Xcode 16+** — required for iOS builds (cannot build iOS on Windows/Linux)
4. **CocoaPods** — `sudo gem install cocoapods` (Capacitor uses CocoaPods for some dependencies)
5. **iOS Simulator** — installed via Xcode → Settings → Platforms → iOS

---

## Project Structure After Phase B

```
packages/frontend/
  ├── capacitor.config.ts             # NEW — Capacitor configuration
  ├── ios/                            # NEW — Generated Xcode project
  │   └── App/                        # Xcode workspace (managed by Capacitor)
  ├── src/
  │   ├── native/                     # NEW — Native abstraction layer
  │   │   ├── capacitor.ts            # isNative() helper + platform detection
  │   │   ├── health.ts               # HealthKit authorization + queries
  │   │   ├── haptics.ts              # Haptic feedback wrappers
  │   │   └── push.ts                 # Push notification setup
  │   ├── api/hooks/
  │   │   └── useHealthKitSync.ts     # NEW — Automatic HealthKit sync hook
  │   ├── components/
  │   │   ├── upload/
  │   │   │   └── UploadModal.tsx     # MODIFIED — conditional HealthKit button
  │   │   └── layout/
  │   │       └── AppShell.tsx        # MODIFIED — StatusBar integration
  │   └── App.tsx                     # MODIFIED — push + haptics init
  ├── package.json                    # MODIFIED — new deps + scripts
  └── dist/                           # Vite build output → web layer for Capacitor
```

---

## Dependencies

Run from the **repository root**:

```bash
# Core Capacitor
npm install -w @vitals/frontend @capacitor/core@^8.0.0 @capacitor/ios@^8.0.0
npm install -D -w @vitals/frontend @capacitor/cli@^8.0.0

# Official plugins
npm install -w @vitals/frontend @capacitor/push-notifications@^8.0.0
npm install -w @vitals/frontend @capacitor/haptics@^8.0.0
npm install -w @vitals/frontend @capacitor/status-bar@^8.0.0
npm install -w @vitals/frontend @capacitor/splash-screen@^8.0.0
npm install -w @vitals/frontend @capacitor/app@^8.0.0

# HealthKit (community plugin by Capgo)
npm install -w @vitals/frontend @capgo/capacitor-health@^8.0.0

# OTA updates (optional — set up when ready for production)
# npm install -w @vitals/frontend @capgo/capacitor-updater@^8.0.0
```

### Dependency notes
- `@capacitor/cli` is a **devDependency** — only needed for `cap` commands, not runtime
- `@capacitor/app` is needed for app state change listeners (resume/pause events for HealthKit sync)
- `@capgo/capacitor-health` — community-maintained, actively updated for Capacitor 8
- `@capgo/capacitor-updater` — optional, install when Capgo account is set up

---

## Task 1: Initialize Capacitor Project

### 1.1 Initialize Capacitor

```bash
cd packages/frontend
npx cap init "Vitals" "com.vitals.app" --web-dir dist
```

This creates `capacitor.config.ts` in `packages/frontend/`. **Do NOT run this if the file already exists.**

### 1.2 Verify initialization

Check that `capacitor.config.ts` was created:

```bash
cat packages/frontend/capacitor.config.ts
```

The auto-generated file will be minimal. We'll replace it in Task 2.

### Verification
- `packages/frontend/capacitor.config.ts` exists
- No errors during init

---

## Task 2: Create Capacitor Configuration

### Replace: `packages/frontend/capacitor.config.ts`

Replace the auto-generated file with:

```typescript
/// <reference types="@capacitor/push-notifications" />
/// <reference types="@capacitor/splash-screen" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vitals.app',
  appName: 'Vitals',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Vitals',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
  },
};

// In development, use Vite dev server for HMR
if (process.env.NODE_ENV !== 'production') {
  config.server = {
    url: 'http://localhost:3000',
    cleartext: true,
  };
}

export default config;
```

### Configuration explained

| Setting | Value | Rationale |
|---------|-------|-----------|
| `appId` | `'com.vitals.app'` | Reverse domain notation — must match App Store bundle ID |
| `webDir` | `'dist'` | Vite build output directory |
| `contentInset: 'automatic'` | iOS | Adjusts web content for safe areas automatically |
| `preferredContentMode: 'mobile'` | iOS | Ensures mobile viewport even on iPad |
| `scheme: 'Vitals'` | iOS | Custom URL scheme for deep linking |
| `server.url` (dev only) | `'http://localhost:3000'` | Points to Vite dev server for HMR in Simulator |
| `cleartext: true` (dev only) | iOS | Allows HTTP (not HTTPS) in dev mode |

### Important notes
- The `server` block is **dev-only** — in production, the app loads from the bundled `dist/` assets
- `cleartext: true` adds `NSAllowsArbitraryLoads` to Info.plist in debug builds
- The `/// <reference types>` directives enable TypeScript augmentation for plugin configs

### Verification
- File compiles without TypeScript errors

---

## Task 3: Add iOS Platform

### 3.1 Build the web layer first

Capacitor needs the `dist/` directory to exist before adding a platform:

```bash
cd packages/frontend
npm run build
```

### 3.2 Add iOS platform

```bash
cd packages/frontend
npx cap add ios
```

This creates the `packages/frontend/ios/` directory with a full Xcode project.

### 3.3 Sync web assets to native project

```bash
cd packages/frontend
npx cap sync ios
```

This copies `dist/` contents into the iOS project and installs native plugin dependencies.

### 3.4 Update `.gitignore`

Add to the **root** `.gitignore` (or create `packages/frontend/.gitignore`):

```gitignore
# Capacitor iOS — generated, can be rebuilt with `npx cap add ios`
# Include in git if you need to track Xcode customizations (Info.plist, entitlements)
# Exclude if you prefer to regenerate from scratch
# Decision: INCLUDE in git (we'll modify Info.plist for HealthKit/Push)
```

**Recommendation:** Track `ios/` in git because we need custom Info.plist entries (HealthKit usage descriptions, push notification entitlements). If this bloats the repo, add `ios/Pods/` to `.gitignore` instead.

Add to `.gitignore`:

```gitignore
# Capacitor iOS CocoaPods (can be reinstalled with `npx cap sync`)
packages/frontend/ios/App/Pods/
```

### Verification
- `packages/frontend/ios/App/App.xcworkspace` exists
- `npx cap sync ios` completes without errors
- Running `npx cap open ios` opens Xcode (macOS only)

---

## Task 4: Create Native Abstraction Layer

The abstraction layer provides web-safe wrappers around Capacitor plugins. Every function has a web fallback so the same codebase works on both web and native.

### 4.1 Create: `packages/frontend/src/native/capacitor.ts`

```typescript
import { Capacitor } from '@capacitor/core';

/**
 * Returns true when running inside a native Capacitor shell (iOS/Android).
 * Returns false when running as a web app (PWA or browser).
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the current platform: 'ios', 'android', or 'web'.
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}
```

### 4.2 Create: `packages/frontend/src/native/health.ts`

```typescript
import { isNative, getPlatform } from './capacitor';

// Lazy import to avoid bundling native-only code in web builds
async function getHealthPlugin() {
  const { CapacitorHealth } = await import('@capgo/capacitor-health');
  return CapacitorHealth;
}

export interface HealthDataPoint {
  startDate: string;
  endDate: string;
  value: number;
  unit: string;
  source: string;
}

export interface HealthQueryOptions {
  dataType: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Returns true if HealthKit is available (iOS native only).
 */
export function isHealthKitAvailable(): boolean {
  return isNative() && getPlatform() === 'ios';
}

/**
 * Request HealthKit read authorization for the specified data types.
 * No-op on web.
 */
export async function requestHealthAuthorization(
  readTypes: string[],
): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;

  try {
    const health = await getHealthPlugin();
    await health.requestAuthorization({
      readPermissions: readTypes,
      writePermissions: [],
    });
    return true;
  } catch (error) {
    console.error('HealthKit authorization failed:', error);
    return false;
  }
}

/**
 * Query HealthKit for aggregated data.
 * Returns empty array on web.
 */
export async function queryHealthData(
  options: HealthQueryOptions,
): Promise<HealthDataPoint[]> {
  if (!isHealthKitAvailable()) return [];

  try {
    const health = await getHealthPlugin();
    const result = await health.queryAggregated({
      dataType: options.dataType,
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
      bucket: 'day',
    });
    return (result.data ?? []) as HealthDataPoint[];
  } catch (error) {
    console.error(`HealthKit query failed for ${options.dataType}:`, error);
    return [];
  }
}

/**
 * HealthKit data types relevant to Vitals.
 * Maps to Apple HealthKit type identifiers.
 */
export const HEALTH_TYPES = {
  steps: 'steps',
  heartRate: 'heartRate',
  bodyMass: 'bodyMass',
  activeEnergy: 'activeEnergyBurned',
  bodyFat: 'bodyFatPercentage',
  restingHeartRate: 'restingHeartRate',
  bloodPressureSystolic: 'bloodPressureSystolic',
  bloodPressureDiastolic: 'bloodPressureDiastolic',
} as const;
```

### Design decisions
- **Lazy `import()`** for `@capgo/capacitor-health` — tree-shaking removes it from web builds entirely
- **Web fallbacks return empty data** — features gracefully degrade rather than crash
- **Authorization returns boolean** — simple success/failure, no complex error types for callers
- **`queryAggregated`** preferred over `query` — returns daily summaries, not individual samples

### 4.3 Create: `packages/frontend/src/native/haptics.ts`

```typescript
import { isNative } from './capacitor';

async function getHapticsPlugin() {
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  return { Haptics, ImpactStyle };
}

/**
 * Trigger a light haptic impact. No-op on web.
 */
export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await getHapticsPlugin();
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics not critical — silent fail
  }
}

/**
 * Trigger a medium haptic impact. No-op on web.
 */
export async function hapticMedium(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await getHapticsPlugin();
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Haptics not critical — silent fail
  }
}

/**
 * Trigger a success notification haptic. No-op on web.
 */
export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Haptics not critical — silent fail
  }
}
```

### 4.4 Create: `packages/frontend/src/native/push.ts`

```typescript
import { isNative } from './capacitor';

interface PushToken {
  value: string;
}

interface PushListeners {
  onTokenReceived?: (token: PushToken) => void;
  onNotificationReceived?: (notification: unknown) => void;
  onNotificationActionPerformed?: (action: unknown) => void;
}

/**
 * Register for push notifications and set up listeners.
 * No-op on web (web uses Web Push API from the service worker instead).
 */
export async function initPushNotifications(
  listeners: PushListeners,
): Promise<void> {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    // Register with APNS
    await PushNotifications.register();

    // Set up listeners
    if (listeners.onTokenReceived) {
      PushNotifications.addListener('registration', listeners.onTokenReceived);
    }

    if (listeners.onNotificationReceived) {
      PushNotifications.addListener(
        'pushNotificationReceived',
        listeners.onNotificationReceived,
      );
    }

    if (listeners.onNotificationActionPerformed) {
      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        listeners.onNotificationActionPerformed,
      );
    }
  } catch (error) {
    console.error('Push notification setup failed:', error);
  }
}
```

### Verification for all native modules
- `npm run build -w @vitals/frontend` passes (no import errors)
- Web builds don't include native plugin code (verify via bundle analysis or build size)
- TypeScript compiles without errors

---

## Task 5: Create HealthKit Auto-Sync Hook

### Create: `packages/frontend/src/api/hooks/useHealthKitSync.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  isHealthKitAvailable,
  requestHealthAuthorization,
  queryHealthData,
  HEALTH_TYPES,
} from '@/native/health';
import { apiFetch } from '@/api/client';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Automatically syncs HealthKit data when running in native iOS.
 * Syncs on mount, on app resume, and every 15 minutes while foregrounded.
 *
 * No-op on web — the manual XML upload flow remains available.
 */
export function useHealthKitSync() {
  const queryClient = useQueryClient();
  const isSyncing = useRef(false);

  const syncHealthData = useCallback(async () => {
    if (!isHealthKitAvailable() || isSyncing.current) return;

    isSyncing.current = true;
    try {
      // Request authorization (idempotent — iOS only shows prompt once)
      const authorized = await requestHealthAuthorization(
        Object.values(HEALTH_TYPES),
      );
      if (!authorized) return;

      // Query last 7 days of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // Query all health types in parallel
      const queries = Object.entries(HEALTH_TYPES).map(([_key, dataType]) =>
        queryHealthData({ dataType, startDate, endDate }),
      );
      const results = await Promise.all(queries);

      // Flatten results
      const allData = results.flat();
      if (allData.length === 0) return;

      // Send to backend
      await apiFetch('/api/health/native-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'healthkit',
          data: allData,
          syncedAt: new Date().toISOString(),
        }),
      });

      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    } catch (error) {
      console.error('HealthKit sync failed:', error);
      toast.error('Health data sync failed. Will retry automatically.');
    } finally {
      isSyncing.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!isHealthKitAvailable()) return;

    // Sync on mount
    syncHealthData();

    // Sync periodically
    const interval = setInterval(syncHealthData, SYNC_INTERVAL_MS);

    // Sync on app resume
    let appListener: { remove: () => void } | undefined;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) syncHealthData();
      }).then((listener) => {
        appListener = listener;
      });
    });

    return () => {
      clearInterval(interval);
      appListener?.remove();
    };
  }, [syncHealthData]);

  return { syncHealthData, isAvailable: isHealthKitAvailable() };
}
```

### Important notes
- **Backend endpoint `POST /api/health/native-sync` does NOT exist yet** — this needs a corresponding backend route. For now, the hook is wired but the endpoint will 404 on web. Two options:
  1. **Reuse existing** `POST /api/upload/apple-health` by formatting HealthKit data as the expected XML structure (complex, fragile)
  2. **Create new route** (recommended) — accepts structured JSON from the native sync. This is a backend task outside this Phase B scope.
- The hook is designed to be called once at the app root level
- `isSyncing` ref prevents concurrent sync operations
- App resume listener uses `@capacitor/app` — already in dependencies

### Verification
- TypeScript compiles without errors
- On web, the hook returns immediately (no HealthKit calls)
- On native, the hook triggers authorization prompt on first mount

---

## Task 6: Integrate HealthKit Sync into Upload Modal

### Current file: `packages/frontend/src/components/upload/UploadModal.tsx`

```tsx
// CURRENT (before)
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AppleHealthUploader } from './AppleHealthUploader';

interface Props {
  trigger: React.ReactElement;
}

export function UploadModal({ trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Base UI uses render prop instead of asChild */}
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Apple Health Data</DialogTitle>
        </DialogHeader>
        <AppleHealthUploader onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
```

### Required changes

Replace the entire file with:

```tsx
// AFTER
import { useState } from 'react';
import { Heart, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppleHealthUploader } from './AppleHealthUploader';
import { isNative } from '@/native/capacitor';
import { isHealthKitAvailable } from '@/native/health';
import { useHealthKitSync } from '@/api/hooks/useHealthKitSync';
import { toast } from 'sonner';

interface Props {
  trigger: React.ReactElement;
}

export function UploadModal({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const { syncHealthData } = useHealthKitSync();

  const handleHealthKitSync = async () => {
    toast.info('Syncing health data...');
    await syncHealthData();
    toast.success('Health data synced successfully');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Base UI uses render prop instead of asChild */}
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNative() ? 'Sync Health Data' : 'Upload Apple Health Data'}
          </DialogTitle>
        </DialogHeader>

        {isHealthKitAvailable() ? (
          <div className="flex flex-col gap-3">
            <Button onClick={handleHealthKitSync} className="gap-2">
              <Heart className="h-4 w-4" />
              Sync from Apple Health
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Automatically reads your latest health data from Apple Health.
            </p>
          </div>
        ) : (
          <AppleHealthUploader onSuccess={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Changes explained
- When running natively on iOS (`isHealthKitAvailable()` returns true):
  - Shows a "Sync from Apple Health" button instead of the XML file uploader
  - Calls `syncHealthData()` directly — no file export needed
- When running as PWA/web:
  - Shows the existing `AppleHealthUploader` (XML file upload) — behavior unchanged
- Dialog title changes to "Sync Health Data" on native

### Verification
- On web: modal shows same XML upload UI as before (no visual change)
- On native: modal shows "Sync from Apple Health" button
- TypeScript compiles without errors

---

## Task 7: Integrate StatusBar and Push into App Root

### Current file: `packages/frontend/src/App.tsx` (after Phase A changes)

The Phase A version has `PersistQueryClientProvider`, `PwaUpdatePrompt`, etc.

### Required changes

Add to the **imports** section:

```typescript
import { useHealthKitSync } from '@/api/hooks/useHealthKitSync';
import { isNative } from '@/native/capacitor';
import { initPushNotifications } from '@/native/push';
```

Add a new component before the `App` function:

```tsx
function NativeInitializer() {
  useHealthKitSync();

  useEffect(() => {
    if (!isNative()) return;

    // Initialize push notifications
    initPushNotifications({
      onTokenReceived: (token) => {
        // TODO: Send token to backend for push notification targeting
        console.log('Push token:', token.value);
      },
      onNotificationReceived: (notification) => {
        console.log('Push notification received:', notification);
      },
    });

    // Configure status bar
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      const isDark = document.documentElement.classList.contains('dark');
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    });
  }, []);

  return null;
}
```

Add `<NativeInitializer />` inside the `App` return, **inside** `PersistQueryClientProvider` but **outside** `BrowserRouter`:

```tsx
export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister }}
    >
      <ThemeProvider>
        <NativeInitializer />
        <BrowserRouter>
          {/* ... routes ... */}
        </BrowserRouter>
        <PwaUpdatePrompt />
        <Toaster richColors />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
```

### Changes explained
- `NativeInitializer` is a behavior-only component (returns `null`)
- On web, it's a no-op — `useHealthKitSync` and `initPushNotifications` both bail early
- On native:
  - Starts HealthKit auto-sync
  - Registers for push notifications (prompts user on first launch)
  - Sets status bar style to match current theme
- Placed inside `ThemeProvider` so it can read the dark mode class

### Verification
- Web app unchanged — `NativeInitializer` is a no-op
- TypeScript compiles
- On iOS Simulator: push permission prompt appears, status bar matches theme

---

## Task 8: Add Build Scripts to package.json

### Modify: `packages/frontend/package.json`

Add these scripts to the `"scripts"` section:

```json
{
  "scripts": {
    "dev": "vite --port 3000",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist",
    "cap:sync": "cap sync ios",
    "cap:open": "cap open ios",
    "cap:run": "cap run ios",
    "build:ios": "npm run build && cap sync ios"
  }
}
```

### New scripts explained
| Script | Purpose |
|--------|---------|
| `cap:sync` | Copies `dist/` to iOS project + installs native dependencies |
| `cap:open` | Opens Xcode workspace for the iOS project |
| `cap:run` | Builds and runs on iOS Simulator |
| `build:ios` | Full pipeline: Vite build → sync to iOS |

### Development workflow

```bash
# Start Vite dev server (existing)
npm run dev -w @vitals/frontend

# In another terminal — run on iOS Simulator with HMR
npm run cap:run -w @vitals/frontend

# For production build + Simulator test
npm run build:ios -w @vitals/frontend
npm run cap:open -w @vitals/frontend  # → Build in Xcode
```

### Verification
- `npm run build:ios -w @vitals/frontend` completes without errors

---

## Task 9: Configure Xcode Project

These changes must be made in the Xcode project or via file edits to the generated `ios/` directory.

### 9.1 Info.plist — HealthKit Usage Description

Edit `packages/frontend/ios/App/App/Info.plist` — add inside the top-level `<dict>`:

```xml
<key>NSHealthShareUsageDescription</key>
<string>Vitals reads your health data to display trends and generate weekly health reports.</string>
```

### 9.2 Entitlements — HealthKit Capability

Edit or create `packages/frontend/ios/App/App/App.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.healthkit</key>
    <true/>
    <key>com.apple.developer.healthkit.access</key>
    <array/>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>
```

### 9.3 Xcode Capabilities (manual step)

Open Xcode via `npx cap open ios`, then:

1. Select the **App** target
2. Go to **Signing & Capabilities**
3. Click **+ Capability** and add:
   - **HealthKit**
   - **Push Notifications**
   - **Background Modes** → check **Remote notifications**
4. Under **Signing**, select your Apple Developer team and certificate

### 9.4 App Icon (Xcode Asset Catalog)

The Xcode project uses an asset catalog at `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.

Option A: Use the same icons from Phase A `public/icons/`:
- Copy `icon-512.png` to the asset catalog and update `Contents.json`

Option B: Use Xcode's automatic icon generation (Xcode 15+):
- Provide a single 1024x1024 PNG and Xcode generates all sizes

### Verification
- Xcode project opens without errors
- Build for Simulator succeeds (Product → Build)
- HealthKit permission prompt appears on launch in Simulator
- Push notification permission prompt appears

---

## Task 10: App Store Compliance — Native Feature Checklist

Apple Guideline 4.2 requires that App Store apps provide meaningful native functionality beyond a WebView wrapper. The following native features satisfy this requirement:

| # | Feature | Plugin | Status After Phase B |
|---|---------|--------|---------------------|
| 1 | **HealthKit auto-sync** | `@capgo/capacitor-health` | Implemented |
| 2 | **Push notifications** | `@capacitor/push-notifications` | Implemented (registration; backend APNS integration needed separately) |
| 3 | **Haptic feedback** | `@capacitor/haptics` | Implemented (wrappers ready; add to specific interactions) |
| 4 | **Native splash screen** | `@capacitor/splash-screen` | Configured |
| 5 | **Status bar integration** | `@capacitor/status-bar` | Implemented |

### App Store Review Notes

When submitting, include these notes for the reviewer:

> Vitals is a personal health dashboard that reads data from Apple Health to display nutrition, workout, and biometric trends. Key native features:
>
> 1. HealthKit integration — automatically syncs health data (steps, heart rate, body weight, workouts)
> 2. Push notifications — alerts for weekly health report generation
> 3. Haptic feedback — native touch response for interactive elements
> 4. Native splash screen — app-quality launch experience
>
> Demo account: [provide test credentials if applicable]

---

## Task 11: Future Integration Points (Out of Scope)

These tasks are documented for follow-up but are NOT part of this Phase B implementation:

### 11.1 Backend: Native Health Sync Endpoint

A new `POST /api/health/native-sync` route is needed to accept structured JSON from the HealthKit sync hook. This route should:
- Accept `{ source: 'healthkit', data: HealthDataPoint[], syncedAt: string }`
- Map HealthKit data types to existing measurements/workout_sets schema
- Use the same idempotent upsert pattern as the XML upload route

### 11.2 Backend: Push Notification Token Storage

A new table or field to store device push tokens sent by the frontend:
- `device_tokens(id, user_id, token, platform, created_at)`
- `POST /api/push/register` route

### 11.3 Backend: APNS Integration

Send push notifications via Apple Push Notification Service:
- Use `apn` npm package or `@parse/node-apn`
- Trigger after weekly report generation completes

### 11.4 Haptic Integration Points

Add `hapticLight()` calls to:
- Bottom nav tab switches
- Date range picker selection
- Theme toggle
- Action item status changes

Add `hapticSuccess()` to:
- Report generation complete
- Upload success
- HealthKit sync success

### 11.5 OTA Updates (Capgo)

When ready for production:
1. Install `@capgo/capacitor-updater`
2. Create Capgo account at [capgo.app](https://capgo.app)
3. Configure updater in `capacitor.config.ts`
4. Deploy web updates without App Store review

---

## Task 12: Final Verification Checklist

### 12.1 Build

```bash
npm run build -w @vitals/shared && npm run build -w @vitals/frontend
```

Must pass with zero errors.

### 12.2 Lint & Format

```bash
npm run lint
npm run format:check
```

Both must pass.

### 12.3 Unit Tests

```bash
npm test -w @vitals/frontend
```

All tests pass. No regressions from new native imports (they're all behind `isNative()` guards).

### 12.4 Capacitor Sync

```bash
cd packages/frontend && npx cap sync ios
```

Must complete without errors.

### 12.5 Xcode Build (macOS only)

```bash
cd packages/frontend && npx cap open ios
```

In Xcode: Product → Build for Simulator. Must succeed.

### 12.6 Simulator Testing (macOS only)

```bash
cd packages/frontend && npx cap run ios
```

1. App launches in Simulator
2. Splash screen shows briefly, then web content loads
3. HealthKit permission prompt appears (tap Allow)
4. Push notification permission prompt appears
5. Navigate between all pages — no crashes or blank screens
6. Dashboard loads with data (from Vite dev server in dev mode)

### 12.7 Web Regression

Open `http://localhost:3000` in browser:
1. All features work identically to before Phase B
2. No console errors related to Capacitor plugins
3. Upload modal shows XML uploader (not HealthKit button)
4. E2E tests pass: `npm run test:e2e`

---

## Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| `@capgo/capacitor-health` API breaks between versions | High | Pin exact version, test on each Capacitor upgrade |
| HealthKit authorization denied by user | Medium | Graceful fallback — keep XML upload available even on native (`isHealthKitAvailable()` checks authorization status) |
| App Store rejection (Guideline 4.2) | High | 5 native features documented; include detailed review notes |
| `POST /api/health/native-sync` doesn't exist yet | Medium | Hook will 404 — implement backend route before testing e2e sync flow |
| Capacitor plugin version mismatch | Medium | All `@capacitor/*` plugins pinned to `^8.0.0` — keep in sync |
| iOS Simulator doesn't have HealthKit data | Low | Use Health app in Simulator to manually add sample data for testing |
| Push token not sent to backend | Medium | Token logging only in Phase B — backend integration is a follow-up task |
| `ios/` directory size in git | Low | Exclude `ios/App/Pods/` (reinstalled via `cap sync`), keep rest tracked |

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `packages/frontend/capacitor.config.ts` | Capacitor configuration |
| Create | `packages/frontend/ios/` | Xcode project (generated by `cap add ios`) |
| Create | `packages/frontend/src/native/capacitor.ts` | Platform detection helpers |
| Create | `packages/frontend/src/native/health.ts` | HealthKit authorization + queries |
| Create | `packages/frontend/src/native/haptics.ts` | Haptic feedback wrappers |
| Create | `packages/frontend/src/native/push.ts` | Push notification setup |
| Create | `packages/frontend/src/api/hooks/useHealthKitSync.ts` | Automatic HealthKit sync hook |
| Modify | `packages/frontend/src/components/upload/UploadModal.tsx` | Conditional HealthKit sync button |
| Modify | `packages/frontend/src/App.tsx` | NativeInitializer component |
| Modify | `packages/frontend/package.json` | Capacitor build scripts |
| Modify | `packages/frontend/ios/App/App/Info.plist` | HealthKit usage description |
| Modify | `packages/frontend/ios/App/App/App.entitlements` | HealthKit + Push capabilities |
| Modify | `.gitignore` | Exclude `ios/App/Pods/` |
