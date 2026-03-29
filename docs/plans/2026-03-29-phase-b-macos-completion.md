# Phase B Completion — macOS Agent Plan

**Date:** 2026-03-29
**Type:** Feature continuation
**Prerequisite:** PR #56 merged (`feat: Capacitor 8 iOS native wrapper`)
**Estimated scope:** Medium (~half day on macOS)

---

## Context

Phase B TypeScript/JS work is complete and merged (PR #56). This plan covers everything
that requires macOS + Xcode to finish: generating the Xcode project, configuring native
capabilities, verifying on the iOS Simulator, and implementing the backend route that the
`useHealthKitSync` hook calls.

**What is already done (do not redo):**
- `packages/frontend/capacitor.config.ts` — written
- `packages/frontend/src/native/` — all 4 files (capacitor.ts, health.ts, haptics.ts, push.ts)
- `packages/frontend/src/api/hooks/useHealthKitSync.ts`
- `UploadModal.tsx` and `App.tsx` modifications
- `package.json` Capacitor scripts (`cap:sync`, `cap:open`, `cap:run`, `build:ios`)
- `.gitignore` excludes `ios/App/Pods/`

---

## Prerequisites

Before starting, verify on the Mac:

1. **macOS with Xcode 16+** — `xcode-select --print-path` should return a valid path
2. **CocoaPods** — `pod --version` should return 1.x+; install with `sudo gem install cocoapods` if missing
3. **iOS Simulator** — Xcode → Settings → Platforms → iOS (at least iOS 17)
4. **Apple Developer Account** — enrolled at developer.apple.com ($99/year); needed for signing
5. **Repo cloned and on latest master** — `git pull origin master`
6. **Dependencies installed** — `npm install` from repo root

---

## Task 1: Generate iOS Xcode Project

### 1.1 Build the web layer first

Capacitor needs `dist/` to exist before adding the iOS platform:

```bash
npm run build -w @vitals/frontend
```

### 1.2 Add iOS platform

```bash
cd packages/frontend
npx cap add ios
```

This creates `packages/frontend/ios/` with a full Xcode workspace. Expected output:
```
✔ Adding native xcode project in ios in 91.72ms
✔ add in 91.74ms
✔ Copying web assets from dist to ios/App/App/public in 157ms
✔ Creating capacitor.config.json in ios/App/App in 1.19ms
✔ Installing CocoaPods (may take a few minutes)...
✔ Pod install in X.Xs
✔ Syncing Gradle and CocoaPods in Xms
✔ copy in Xs
✔ Updating iOS plugins in Xms
✔ update in Xms
```

### 1.3 Sync web assets

```bash
npx cap sync ios
```

### Verification

- `packages/frontend/ios/App/App.xcworkspace` exists
- No errors in `pod install` step

---

## Task 2: Edit Info.plist — HealthKit Usage Description

**File:** `packages/frontend/ios/App/App/Info.plist`

Add inside the top-level `<dict>` (before the closing `</dict>`):

```xml
<key>NSHealthShareUsageDescription</key>
<string>Vitals reads your health data to display trends and generate weekly health reports.</string>
```

This is required by App Store Review — the app will crash on launch if HealthKit is requested
without this key.

### Verification

- File contains `NSHealthShareUsageDescription` key
- String describes why HealthKit data is needed

---

## Task 3: Create App.entitlements — HealthKit + Push Capabilities

Create or edit `packages/frontend/ios/App/App/App.entitlements`:

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

**Note:** `aps-environment` must be `development` for Simulator/TestFlight testing.
Change to `production` only when submitting to the App Store.

---

## Task 4: Configure Xcode Capabilities (manual — requires Xcode UI)

Open the Xcode project:

```bash
cd packages/frontend
npx cap open ios
```

In Xcode:

1. In the Project Navigator, select the **App** project (top item)
2. Select the **App** target (not the project)
3. Go to **Signing & Capabilities** tab
4. Under **Signing**, select your Apple Developer team
5. Click **+ Capability** and add each of the following:
   - **HealthKit** — enables `com.apple.developer.healthkit` entitlement
   - **Push Notifications** — enables `aps-environment` entitlement
   - **Background Modes** → check **Remote notifications**

Xcode will add these to `App.entitlements` automatically. If the file already exists
(from Task 3), Xcode will merge — verify the result matches the Task 3 content.

### Verification

- `Signing & Capabilities` shows HealthKit, Push Notifications, Background Modes
- No "Missing entitlement" warnings in the capability panel
- Team is set and signing certificate resolves without errors

---

## Task 5: App Icon

The Xcode asset catalog is at `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.

**Option A (recommended for now):** Use Xcode 15+ single-icon generation
1. Open Assets.xcassets in Xcode
2. Select AppIcon
3. In Attributes inspector, set **Single Size** to a 1024×1024 PNG
4. Drag `packages/frontend/public/icons/icon-512.png` (scale up to 1024) into the catalog

**Option B:** Use the existing `icon-512.png` directly
- Copy `packages/frontend/public/icons/icon-512.png` to the asset catalog
- Update `Contents.json` to reference it as the 512pt icon

For now, any valid 1024×1024 icon is sufficient to build and test. A polished icon
is needed before App Store submission.

---

## Task 6: Simulator Build and Verification

### 6.1 Run on iOS Simulator

```bash
cd packages/frontend
npx cap run ios
```

Or from Xcode: select an iPhone simulator → Product → Run.

### 6.2 Verification checklist

Work through this list in the Simulator:

| # | Check | Expected |
|---|-------|----------|
| 1 | App launches | Splash screen (#0a0a0a background) shows briefly |
| 2 | Web content loads | Dashboard page visible, no blank screen |
| 3 | HealthKit prompt | System dialog: "Vitals Would Like to Access Your Health Data" |
| 4 | Push notification prompt | System dialog: "Vitals Would Like to Send You Notifications" |
| 5 | Navigate to Nutrition | Page loads without crash |
| 6 | Navigate to Workouts | Page loads without crash |
| 7 | Open Upload modal | Shows "Sync from Apple Health" button (not XML uploader) |
| 8 | Status bar | Matches app theme (dark background → dark style) |
| 9 | No console errors | Xcode console shows no JS exceptions |

### 6.3 Dev mode HMR (optional but useful)

Start the Vite dev server on the Mac:

```bash
npm run dev -w @vitals/frontend
```

`capacitor.config.ts` points `server.url` to `http://localhost:3000` in development, so
the Simulator will load from the running Vite process with hot module replacement.

---

## Task 7: Backend — Native Health Sync Route

The `useHealthKitSync` hook calls `POST /api/health/native-sync` which doesn't exist yet.
Until it does, the hook will get a 404 and show an error toast on each sync attempt
(on native only — silent on web).

### 7.1 Route spec

**Endpoint:** `POST /api/health/native-sync`
**Auth:** API key (`preHandler: apiKeyMiddleware`)

**Request body:**
```typescript
{
  source: 'healthkit';
  data: Array<{
    startDate: string;   // ISO 8601
    endDate: string;     // ISO 8601
    value: number;
    unit: string;        // HealthUnit from @capgo/capacitor-health
    source: 'healthkit';
  }>;
  syncedAt: string;      // ISO 8601
}
```

**Response:** `{ message: string; inserted: number }`

### 7.2 Implementation approach

Map the incoming HealthKit data types to the existing `measurements` table schema.
The `useHealthKitSync` hook sends aggregated daily samples. Map each to a measurement row:

| HealthKit `dataType` | `category` | `metric` | `unit` |
|----------------------|------------|----------|--------|
| `steps` | `biometric` | `steps` | `count` |
| `heartRate` | `biometric` | `heart_rate_bpm` | `bpm` |
| `weight` | `biometric` | `weight_kg` | `kg` |
| `calories` | `biometric` | `active_calories_kcal` | `kcal` |
| `bodyFat` | `biometric` | `body_fat_pct` | `%` |
| `restingHeartRate` | `biometric` | `resting_heart_rate_bpm` | `bpm` |
| `bloodPressure` | `biometric` | `blood_pressure_systolic_mmhg` | `mmHg` |

Use the same idempotent upsert pattern as the existing ingest layer:

```sql
INSERT INTO measurements (user_id, source, category, metric, value, unit, measured_at)
VALUES ($1, 'healthkit', $2, $3, $4, $5, $6)
ON CONFLICT (user_id, source, metric, measured_at) DO UPDATE
SET value = EXCLUDED.value, unit = EXCLUDED.unit
```

### 7.3 File to create

`packages/backend/src/routes/native-health.ts` — Fastify plugin pattern:

```typescript
import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { apiKeyMiddleware } from '../middleware/api-key.js';

export async function nativeHealthRoutes(app: FastifyInstance, opts: { env: EnvConfig }) {
  app.post(
    '/api/health/native-sync',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      // ... implementation
    }
  );
}
```

Register in `app.ts`:
```typescript
await app.register(nativeHealthRoutes, { env });
```

### 7.4 Tests required

Add `packages/backend/src/routes/__tests__/native-health.test.ts` — mock the query
module, test:
- Valid payload returns `{ inserted: N }`
- Empty data array returns `{ inserted: 0 }`
- Invalid body (missing `source`) returns 400
- Missing API key returns 401

---

## Task 8: Commit ios/ Directory

After Tasks 1–6 complete successfully on macOS:

```bash
git add packages/frontend/ios/
git commit -m "feat: add Capacitor iOS Xcode project

Generated by npx cap add ios + cap sync. Includes:
- HealthKit usage description in Info.plist
- HealthKit + Push entitlements in App.entitlements
- Excludes ios/App/Pods/ (in .gitignore, reinstalled via cap sync)"
```

Push to a branch and open a PR targeting master.

---

## Task 9: E2E Tests for Native Sync UI

Add to `e2e/upload.spec.ts` (or create `e2e/native-sync.spec.ts`):

- Web-only test: upload modal opens and shows XML uploader (no HealthKit button)
  — this already works on web, add it to the permanent E2E suite

**Note:** True native HealthKit E2E (iOS Simulator + real data) is not testable via
Playwright on web. The web regression tests are sufficient for CI; native behavior
is verified manually in the Simulator per Task 6.

---

## Files Summary

| Action | File | Task |
|--------|------|------|
| Generate | `packages/frontend/ios/` | Task 1 (`npx cap add ios`) |
| Edit | `packages/frontend/ios/App/App/Info.plist` | Task 2 |
| Create/edit | `packages/frontend/ios/App/App/App.entitlements` | Task 3 |
| Manual (Xcode) | Signing & Capabilities | Task 4 |
| Create | `packages/backend/src/routes/native-health.ts` | Task 7 |
| Edit | `packages/backend/src/app.ts` | Task 7 (register route) |
| Create | `packages/backend/src/routes/__tests__/native-health.test.ts` | Task 7 |
| Add | `e2e/upload.spec.ts` or `e2e/native-sync.spec.ts` | Task 9 |

---

## Risk Areas

| Risk | Mitigation |
|------|------------|
| `pod install` fails (CocoaPods version mismatch) | Update CocoaPods: `sudo gem install cocoapods` |
| Signing certificate missing | Enroll Apple Developer account; use automatic signing in Xcode |
| HealthKit prompt doesn't appear in Simulator | Add sample data to Simulator's Health app first |
| `cap add ios` fails because `dist/` missing | Run `npm run build -w @vitals/frontend` first (Task 1.1) |
| `@capgo/capacitor-health` pod not found | Run `npx cap sync ios` after `cap add` to install pods |
| Backend 404 on native sync | Expected until Task 7 is done; error toast shown, not a crash |

---

## Verification Checklist Before Closing This Plan

- [ ] `packages/frontend/ios/App/App.xcworkspace` committed to git
- [ ] `Info.plist` contains `NSHealthShareUsageDescription`
- [ ] `App.entitlements` contains `com.apple.developer.healthkit: true`
- [ ] Xcode builds for Simulator without errors
- [ ] All 6 Simulator checks in Task 6.2 pass
- [ ] `POST /api/health/native-sync` route implemented and tested
- [ ] All backend tests pass (`npm test -w @vitals/backend`)
- [ ] E2E test for upload modal web behavior added to permanent suite
