# Phase B: Mobile Navigation

**Date:** 2026-03-17
**Branch:** `experiment/ui-ux-pro-max-v2`
**Type:** Feature — UI/UX Transformation Phase B
**Research:** `docs/research/2026-03-17-ui-ux-transformation-plan.md`
**Depends on:** Phase A (design system tokens, font must be in place)

---

## Context

The current mobile experience uses a hamburger menu (`MobileHeader.tsx` + `MobileDrawer.tsx`) that requires 2 taps to navigate: open drawer → tap destination. This is the single biggest mobile UX issue identified in the research screenshots.

This phase replaces the hamburger drawer with a fixed bottom tab bar (iOS-style), which is the standard mobile navigation pattern for apps with 4-5 primary destinations. The desktop sidebar stays unchanged.

**Key constraint:** The bottom nav must coexist with the desktop sidebar — `AppShell.tsx` switches between them at the `md` breakpoint (768px). Upload and theme toggle currently in the drawer need new homes.

---

## Tasks

### B1. Create BottomNav component

**File to create:** `packages/frontend/src/components/layout/BottomNav.tsx`

A fixed bottom navigation bar with 4 tabs matching the existing `navItems` from `nav-items.ts`:

```
┌──────────────────────────────────────┐
│  🏠       🥗       💪       📊      │
│ Home   Nutrition Workouts Reports    │
└──────────────────────────────────────┘
```

**Implementation details:**
- Fixed to bottom: `fixed bottom-0 left-0 right-0 z-50`
- Height: `h-16` (64px) — standard iOS tab bar height
- Background: `bg-background/95 backdrop-blur-sm border-t border-border`
- Uses `NavLink` from react-router-dom (same as Sidebar/MobileDrawer)
- Active state: primary color icon + label, inactive: muted-foreground
- Each tab: flex column, icon (20px) + label (10px text)
- Import icons and routes from existing `nav-items.ts`
- Safe area padding for iOS notch: `pb-safe` or `env(safe-area-inset-bottom)`

**Props:** None — reads nav config from `nav-items.ts`.

**Accessibility:**
- `role="navigation"` + `aria-label="Main navigation"`
- Each tab is a `NavLink` (already accessible)
- Active tab: `aria-current="page"` (provided by NavLink)

### B2. Update AppShell layout

**File to modify:** `packages/frontend/src/components/layout/AppShell.tsx`

Current structure:
```tsx
<div className="flex h-screen">
  <Sidebar className="hidden md:flex" />
  <MobileDrawer />
  <div className="flex flex-1 flex-col">
    <MobileHeader className="md:hidden" />
    <Topbar className="hidden md:flex" />
    <main>
      <Outlet />
    </main>
  </div>
</div>
```

New structure:
```tsx
<div className="flex h-screen">
  <Sidebar className="hidden md:flex" />
  <div className="flex flex-1 flex-col">
    <MobileHeader className="md:hidden" />
    <Topbar className="hidden md:flex" />
    <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
      <Outlet />
    </main>
    <BottomNav className="md:hidden" />
  </div>
</div>
```

**Key changes:**
1. Remove `<MobileDrawer />` import and usage
2. Add `<BottomNav className="md:hidden" />` after `<main>`
3. Add `pb-20` (80px) to `<main>` on mobile to prevent content being hidden behind the fixed bottom nav. Use `pb-20 md:pb-6` to only apply on mobile.

### B3. Update MobileHeader (simplify)

**File to modify:** `packages/frontend/src/components/layout/MobileHeader.tsx`

The hamburger button that opens the drawer is no longer needed since BottomNav handles navigation.

Keep the MobileHeader but simplify it:
- Remove the hamburger menu button
- Keep the "Vitals" title/logo
- Add theme toggle button (moved from MobileDrawer)
- Optionally add Upload button (small icon, top-right)

This gives MobileHeader a clean purpose: branding + quick actions on mobile.

### B4. Relocate Upload action

Currently the Upload button lives in `MobileDrawer.tsx`. With the drawer removed, it needs a new home on mobile.

**Option chosen:** Add an Upload icon button to `MobileHeader.tsx` (top-right corner, next to theme toggle). This keeps upload accessible with a single tap.

**Files to modify:**
- `packages/frontend/src/components/layout/MobileHeader.tsx` — add Upload button that opens `UploadModal`

The desktop Sidebar already has an Upload button — no changes needed there.

### B5. Remove MobileDrawer (or deprecate)

**File:** `packages/frontend/src/components/layout/MobileDrawer.tsx`

After B2-B4, MobileDrawer is unused. Options:
- **Delete** the file entirely (preferred — clean codebase)
- Also remove `useSidebarStore` import from any remaining files (check if desktop Sidebar still uses it for its own collapse state)

**Check before deleting:**
- `useSidebarStore` — grep to see if anything else imports `isOpen`/`close`/`open`
- If `Sidebar.tsx` uses `useSidebarStore` for desktop collapse, keep the store but remove mobile-specific logic

### B6. Add safe-area padding for iOS

**File to modify:** `packages/frontend/src/index.css`

Add safe area support for devices with home indicator (iPhone X+):

```css
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

Apply `pb-safe` to the BottomNav component so it doesn't overlap the iOS home indicator.

Also add to `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### B7. Write E2E tests for mobile navigation

**File to create:** `e2e/mobile-navigation.spec.ts`

Using Playwright with mobile viewport (390×844):

1. **Bottom nav renders on mobile** — verify 4 tabs visible at bottom
2. **Bottom nav hidden on desktop** — verify not visible at 1440px
3. **Navigate via bottom tabs** — tap each tab, verify correct page loads
4. **Active tab highlights** — verify active tab has primary color
5. **Upload accessible from mobile header** — tap upload icon, verify modal opens
6. **Content not hidden behind nav** — verify last element on page is visible above the bottom bar

**Viewport setup:**
```typescript
test.use({ viewport: { width: 390, height: 844 } });
```

### B8. Run full validation suite

```bash
npm run build -w @vitals/shared
npm run build -w @vitals/frontend
npm run lint
npm run format:check
npm test
npm run test:e2e
```

All must pass. Verify no existing E2E tests break from the layout change.

---

## Files Summary

| Action | File |
|--------|------|
| Create | `packages/frontend/src/components/layout/BottomNav.tsx` |
| Modify | `packages/frontend/src/components/layout/AppShell.tsx` |
| Modify | `packages/frontend/src/components/layout/MobileHeader.tsx` |
| Delete | `packages/frontend/src/components/layout/MobileDrawer.tsx` |
| Modify | `packages/frontend/src/index.css` (safe area) |
| Modify | `packages/frontend/index.html` (viewport-fit) |
| Create | `e2e/mobile-navigation.spec.ts` |

## Dependencies

None — no new npm packages required.

## Test Strategy

- **Unit tests:** No new unit tests (BottomNav is a thin navigation wrapper, best tested via E2E)
- **E2E tests:** 6 new tests in `e2e/mobile-navigation.spec.ts`
- **Existing tests:** All must pass — verify `MobileDrawer` is not referenced in any test
- **Visual verification:** Take mobile screenshots before/after to confirm bottom nav renders correctly and content is accessible

## Risks

1. **Existing E2E tests may depend on MobileDrawer** — grep for `MobileDrawer`, `hamburger`, `sheet`, or drawer-related selectors in `e2e/` before deleting. If found, update those tests first.
2. **useSidebarStore coupling** — the store's `isOpen`/`open`/`close` may be used by desktop Sidebar for collapse behavior. Verify before removing the store.
3. **Fixed bottom nav z-index conflicts** — the BottomNav uses `z-50`. Verify it doesn't overlap with Sheet/Dialog portals (typically `z-[100]` in shadcn). If it does, lower to `z-40`.
4. **Safe area insets on Android** — `env(safe-area-inset-bottom)` is primarily iOS. On Android, the system nav bar is outside the viewport. Test on both if possible.
5. **Main content padding-bottom** — the `pb-20` value (80px) should be enough for `h-16` (64px) nav + safe area. If content still hides behind nav, increase to `pb-24`.
