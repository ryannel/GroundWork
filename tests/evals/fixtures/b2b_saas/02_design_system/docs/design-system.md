# Design System: StoreLens Analytics

## 1. Product Personality

StoreLens is a professional-grade operations tool. Its personality is **calm, precise, and authoritative** — like a well-designed control room. It never hides information behind unnecessary clicks, never uses animation for its own sake, and never trades clarity for visual flair. The UI exists to serve the data, not to impress.

Tone: Direct. Informative. Efficient. No marketing language in UI copy.

## 2. Non-Functional Requirements

- **Accessibility:** WCAG 2.1 AA. All interactive elements keyboard-navigable. Colour is never the sole indicator of status.
- **Density:** Information-dense by default. Users are professionals on large monitors. Compact table rows. No excessive whitespace.
- **Responsiveness:** Desktop-first (1280px+). Tablet support (768px+) for management review. Not designed for mobile.
- **Performance:** First contentful paint under 1.5s. Table renders of up to 1,000 rows must complete in under 300ms.
- **Dark mode:** Not in MVP. Neutral palette is designed to work in well-lit office environments.

## 3. Colour Tokens

**Primary palette:**
- `--color-navy-900`: `#0F1929` — page backgrounds, sidebar
- `--color-navy-800`: `#162236` — card backgrounds on dark sections
- `--color-slate-700`: `#2E3F55` — borders, dividers
- `--color-slate-200`: `#E4EAF1` — muted text, secondary labels
- `--color-white`: `#FFFFFF` — primary content backgrounds

**Brand:**
- `--color-brand-500`: `#2563EB` — primary actions, active states, links

**Status:**
- `--color-success-500`: `#16A34A` — on-track, healthy
- `--color-warning-500`: `#D97706` — at-risk, approaching threshold
- `--color-danger-500`: `#DC2626` — breached SLA, critical alert

**Neutral:**
- `--color-gray-50` through `--color-gray-900` — standard gray scale for text hierarchy

## 4. Typography

- **Font family:** Inter (system fallback: -apple-system, sans-serif)
- **Tabular numbers:** `font-variant-numeric: tabular-nums` applied globally on data cells to prevent layout shift during live updates.
- **Scale:** 12px (label/caption), 14px (body/table), 16px (section heading), 20px (page heading), 28px (KPI metric)
- **Weight:** 400 regular, 500 medium (table headers), 600 semibold (page headings, KPIs)

## 5. Spacing System

4px base unit. Scale: 4, 8, 12, 16, 24, 32, 48, 64px. Tables use 12px vertical padding per row. Cards use 24px internal padding.

## 6. Component Patterns

**Data tables:** Sticky header, sortable columns, row hover highlight (`--color-gray-50`), optional row selection for bulk actions. Pagination at 50 rows. Virtualised for 1,000+ rows.

**KPI cards:** Large metric, label below, trend indicator (▲▼ with percentage). Status colour on the metric when threshold breached. Used on main dashboard.

**Status badges:** Pill shape, 12px text. Semantic variants: `success`, `warning`, `danger`, `neutral`. Always paired with a text label — never badge alone.

**Alert banner:** Full-width, dismissible. Anchored below the top nav. Used for system-wide notices, not per-row exceptions.

**Empty states:** Illustration + 2-sentence explanation + primary action. Never a blank space or raw "No data" text.

## 7. Navigation

Top navigation bar (64px height): logo left, primary nav links centre, tenant switcher and user avatar right. Left sidebar appears on sub-pages for drill-down navigation. No nested menus beyond two levels.

## 8. Interaction States

All interactive elements have explicit focus rings (2px `--color-brand-500` outline, 2px offset). Hover states on table rows and buttons. Loading states use a neutral skeleton loader, never a spinner on the primary content area. Error states use inline messages below the offending field, never toast-only for form errors.
