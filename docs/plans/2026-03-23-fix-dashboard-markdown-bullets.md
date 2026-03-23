# Fix: Dashboard "What's Working" Card — Markdown Not Rendering

**Date:** 2026-03-23
**Type:** bugfix
**Scope:** small

## Context

The `InsightsPanel` dashboard card shows "What's Working" and "Watch Out" bullet lists extracted
from AI-generated report sections. `extractBullets()` strips the leading `- ` prefix but preserves
inline markdown (e.g. `**bold text:**`). The `FocusAreaCard` component renders bullets as raw React
text (`{bullet}`), so `**...**` appears literally instead of as bold.

`ReportPanel.tsx` already uses `react-markdown` + `remark-gfm` for collapsible report sections, so
no new dependencies are needed.

## Tasks

1. Import `Markdown` from `react-markdown` and `remarkGfm` from `remark-gfm` in `InsightsPanel.tsx`
2. In `FocusAreaCard`, replace `{bullet}` with a `<Markdown>` render that overrides the `p`
   component to render a fragment (suppressing the block wrapper) — inline-only rendering

## Files to Modify

- `packages/frontend/src/components/dashboard/InsightsPanel.tsx`
  - Add imports: `Markdown` from `react-markdown`, `remarkGfm` from `remark-gfm`
  - In `FocusAreaCard` bullet `<li>`, replace `{bullet}` with:
    ```tsx
    <Markdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>
      {bullet}
    </Markdown>
    ```

## Dependencies

None — `react-markdown` and `remark-gfm` are already installed.

## Test Strategy

- Run `npm run lint` and `npm run format:check`
- Run `npm test` (unit tests)
- Live visual verification via Playwright screenshot

## Risks

- None significant. The change is additive and contained to one component.
