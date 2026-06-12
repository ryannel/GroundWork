# Visual Language & Surfaces

## Table of Contents
- [Colour Architecture (OKLCH)](#colour-architecture-oklch)
- [Typography (Geist)](#typography-geist)
- [Spatial Architecture (8pt Grid)](#spatial-architecture-8pt-grid)
- [Bento Layout Grid](#bento-layout-grid)
- [Surface Dynamics](#surface-dynamics)
- [Ambient Mesh Textures](#ambient-mesh-textures)
- [Liquid Glass Cards](#liquid-glass-cards)

---

## Colour Architecture (OKLCH)

All colours in the Next.js application are defined using the OKLCH colour space. OKLCH provides perceptually uniform lightness, which means a colour at `L=0.7` looks equally bright regardless of hue. This is superior to HSL, where "50% lightness" produces wildly different perceived brightness across hues.

**Hexadecimal, RGB, and HSL are strictly forbidden.**

### CSS Custom Properties

Define the colour system in `globals.css` using CSS custom properties:

```css
:root {
  /* Core brand */
  --color-accent:           oklch(0.68 0.16 250);      /* Electric Blue */
  --color-accent-subtle:    oklch(0.68 0.16 250 / 0.10);

  /* Surfaces */
  --color-surface:          oklch(0.98 0.005 250);      /* Near-white for light mode */
  --color-surface-elevated: oklch(0.96 0.005 250);

  /* Text */
  --color-text-primary:     oklch(0.15 0 0);            /* Near-black */
  --color-text-secondary:   oklch(0.45 0 0);

  /* Semantic */
  --color-success:          oklch(0.72 0.10 158);       /* Sage Green — calm, not stoplight */
  --color-error:            oklch(0.65 0.12 15);        /* Muted Rose — not harsh red */
  --color-warning:          oklch(0.78 0.12 75);        /* Warm Amber */
}

.dark {
  --color-surface:          oklch(0.17 0.005 250);      /* Deep charcoal */
  --color-surface-elevated: oklch(0.21 0.005 250);
  --color-text-primary:     oklch(0.93 0 0);            /* Near-white */
  --color-text-secondary:   oklch(0.65 0 0);
}
```

### Dynamic Opacity with OKLCH

Adjust opacity without creating additional colour variables. Use the `oklch(from ...)` relative colour function:

```css
/* Derive a transparent version of any OKLCH variable */
.glass-surface {
  background-color: oklch(from var(--color-surface) l c h / 0.72);
}

.overlay-backdrop {
  background-color: oklch(from var(--color-surface) l c h / 0.50);
}
```

This maintains a single source of truth for each colour while allowing per-component opacity adjustments.

### Semantic Colour Usage

| Variable | Purpose | Never Use For |
|----------|---------|---------------|
| `--color-success` (Sage Green) | Completed states, positive confirmations, growth indicators | Generic "green" highlights |
| `--color-error` (Muted Rose) | Validation errors, destructive actions, failure states | Attention-grabbing alerts |
| `--color-warning` (Warm Amber) | Non-critical warnings, approaching limits | Decorative accents |
| `--color-accent` (Electric Blue) | Interactive elements, active states, primary CTAs | Status indicators |

---

## Typography (Geist)

The Next.js application uses Geist as its sole typeface family, loaded via `next/font` (see `references/performance-and-deployment.md` for font loading setup).

### Typographic Scale

| Level | Size | Weight | Line Height | Tracking | Use Case |
|-------|------|--------|-------------|----------|----------|
| **Display** | 2.25rem (36px) | 700 | 1.1 | -0.025em | Hero headings, page titles |
| **Title** | 1.5rem (24px) | 600 | 1.2 | -0.02em | Section headings, card titles |
| **Body** | 1rem (16px) | 400 | 1.5 | 0 | Paragraph text, descriptions |
| **Label** | 0.875rem (14px) | 500 | 1.4 | 0.01em | Form labels, table headers, metadata |
| **Caption** | 0.75rem (12px) | 400 | 1.4 | 0.02em | Timestamps, footnotes, helper text |

### Application

```css
/* Apply via Tailwind utilities or direct CSS */
.text-display { font-size: 2.25rem; font-weight: 700; line-height: 1.1; letter-spacing: -0.025em; }
.text-title   { font-size: 1.5rem;  font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
.text-body    { font-size: 1rem;    font-weight: 400; line-height: 1.5; }
.text-label   { font-size: 0.875rem; font-weight: 500; line-height: 1.4; letter-spacing: 0.01em; }
.text-caption { font-size: 0.75rem; font-weight: 400; line-height: 1.4; letter-spacing: 0.02em; }
```

Never invent ad-hoc font sizes. If content doesn't fit within the five-level scale, the component layout needs adjustment — not a custom font size.

---

## Spatial Architecture (8pt Grid)

All spacing derives from an 8px base unit. This ensures consistent vertical rhythm and predictable layout behaviour.

| Step | Value | CSS | Use Case |
|------|-------|-----|----------|
| Sub-grid | 4px | `0.25rem` | Fine adjustments (icon alignment, border offsets) |
| Base | 8px | `0.5rem` | Minimum spacing between elements |
| Standard | 16px | `1rem` | Default gap between components |
| Macro | 32px | `2rem` | Section separation, page-level padding |

### Application

```css
/* Padding */
.p-base     { padding: 0.5rem; }     /* 8px — tight elements */
.p-standard { padding: 1rem; }       /* 16px — cards, sections */
.p-macro    { padding: 2rem; }       /* 32px — page containers */

/* Gaps */
.gap-base     { gap: 0.5rem; }       /* 8px — between icons and labels */
.gap-standard { gap: 1rem; }         /* 16px — between cards in a list */
.gap-macro    { gap: 2rem; }         /* 32px — between sections */
```

Only use 4px (`0.25rem`) for sub-grid adjustments — optical alignment of icons, badge positioning, or fine border adjustments. It is not a general-purpose spacing value.

---

## Bento Layout Grid

The Next.js application uses a 12-column CSS Grid for dashboard and overview layouts. Visual importance is communicated through surface area — more important items span more grid columns and rows.

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 90px;
  gap: 1rem;        /* Standard gap (16px) */
  padding: 2rem;    /* Macro padding (32px) */
}
```

### Card Sizing by Importance

| Importance | Columns | Rows | Surface Area |
|-----------|---------|------|-------------|
| Primary (hero metrics, key insight) | 6-8 | 3-4 | Largest — draws eyes first |
| Secondary (lists, charts) | 4-6 | 2-3 | Medium |
| Tertiary (status indicators, metadata) | 3-4 | 1-2 | Smallest |

```tsx
// Hero card — spans 8 columns, 3 rows
<div className="col-span-8 row-span-3">
  <HeroInsightCard data={topInsight} />
</div>

// Secondary card — spans 4 columns, 2 rows
<div className="col-span-4 row-span-2">
  <MeetingListCard meetings={upcoming} />
</div>

// Tertiary card — spans 4 columns, 1 row
<div className="col-span-4 row-span-1">
  <StatusCard status={systemHealth} />
</div>
```

---

## Surface Dynamics

### Subtle Border Illusion

Cards use a transparent white stroke that creates the illusion of a border without a hard edge:

```css
.glass-border {
  border: 1px solid oklch(1 0 0 / 0.08);  /* Light mode */
}

.dark .glass-border {
  border: 1px solid oklch(1 0 0 / 0.12);  /* Slightly more visible in dark */
}
```

### Concentric Corner Radii

When nesting rounded elements (e.g., a card inside a card), use the concentric radii formula to maintain visual harmony:

```
Inner Radius = Outer Radius − Padding
```

```css
.card-outer {
  border-radius: 16px;
  padding: 8px;
}

.card-inner {
  border-radius: 8px;  /* 16px − 8px = 8px */
}
```

### 4-Layer Shadow Stack

Surfaces use a four-layer shadow stack to simulate realistic material depth:

```css
.glass-shadow {
  box-shadow:
    0 1px 2px oklch(0 0 0 / 0.06),      /* 1. Ambient occlusion — contact shadow */
    0 4px 8px oklch(0 0 0 / 0.04),       /* 2. Direct shadow — primary depth cue */
    0 12px 24px oklch(0 0 0 / 0.03),     /* 3. Penumbra — soft spread */
    0 24px 48px oklch(0 0 0 / 0.02);     /* 4. Diffuse scatter — atmospheric distance */
}
```

### Inset Rim Lighting

A subtle inner glow on the top edge simulates a light source above the surface:

```css
.glass-rim {
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.06);  /* Top-edge highlight */
}
```

Combine the rim with the 4-layer stack for full surface depth:

```css
.glass-surface {
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.06),
    0 1px 2px oklch(0 0 0 / 0.06),
    0 4px 8px oklch(0 0 0 / 0.04),
    0 12px 24px oklch(0 0 0 / 0.03),
    0 24px 48px oklch(0 0 0 / 0.02);
}
```

---

## Ambient Mesh Textures

Mesh textures add visual warmth to large glass surfaces. They use radial gradients with **no hard edges** — always fade to transparent.

### Rules

- Gradients fade between **50-70%** radius
- Opacity never exceeds **0.15** — the texture should be barely perceptible
- Always layer over a solid fallback background
- Use `background-blend-mode: normal` by default

```css
.mesh-aurora {
  background:
    radial-gradient(ellipse at 20% 30%, oklch(0.68 0.16 250 / 0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 70%, oklch(0.72 0.10 158 / 0.06) 0%, transparent 55%),
    var(--color-surface);
}
```

---

## Liquid Glass Cards

Five card variants define the visual system. Each has a specific use case — do not mix attributes across variants.

### 1. Standard Glass Surface

The default card style. Used for all regular content cards.

```css
.glass-surface {
  background: oklch(from var(--color-surface) l c h / 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.06),
    0 1px 2px oklch(0 0 0 / 0.06),
    0 4px 8px oklch(0 0 0 / 0.04),
    0 12px 24px oklch(0 0 0 / 0.03),
    0 24px 48px oklch(0 0 0 / 0.02);
}
```

### 2. Elevated Overlay

Heavy blur and deeper shadows. Used for modals, dialogs, command palette, and floating overlays.

```css
.glass-elevated {
  background: oklch(from var(--color-surface-elevated) l c h / 0.82);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid oklch(1 0 0 / 0.12);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.10),
    0 2px 4px oklch(0 0 0 / 0.08),
    0 8px 16px oklch(0 0 0 / 0.06),
    0 24px 48px oklch(0 0 0 / 0.05),
    0 48px 96px oklch(0 0 0 / 0.03);
}
```

### 3. Hero Insight Card

Diagonal aurora mesh with dual radial gradients. Used for primary dashboard metrics and key insights.

```css
.glass-hero {
  background:
    radial-gradient(ellipse at 20% 30%, oklch(0.68 0.16 250 / 0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 70%, oklch(0.72 0.10 158 / 0.06) 0%, transparent 55%),
    oklch(from var(--color-surface) l c h / 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.06),
    0 1px 2px oklch(0 0 0 / 0.06),
    0 4px 8px oklch(0 0 0 / 0.04),
    0 12px 24px oklch(0 0 0 / 0.03),
    0 24px 48px oklch(0 0 0 / 0.02);
}
```

### 4. Action Required Card

Top-down spotlight gradient using the warning colour. Used for items needing user attention (pending approvals, due tasks).

```css
.glass-action {
  background:
    radial-gradient(ellipse at 50% 0%, oklch(0.78 0.12 75 / 0.10) 0%, transparent 65%),
    oklch(from var(--color-surface) l c h / 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.06),
    0 1px 2px oklch(0 0 0 / 0.06),
    0 4px 8px oklch(0 0 0 / 0.04),
    0 12px 24px oklch(0 0 0 / 0.03),
    0 24px 48px oklch(0 0 0 / 0.02);
}
```

### 5. Positive State Card

Bottom-up ambient glow using the success colour. Used for completed items, positive metrics, growth indicators.

```css
.glass-positive {
  background:
    radial-gradient(ellipse at 50% 100%, oklch(0.72 0.10 158 / 0.10) 0%, transparent 65%),
    oklch(from var(--color-surface) l c h / 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.06),
    0 1px 2px oklch(0 0 0 / 0.06),
    0 4px 8px oklch(0 0 0 / 0.04),
    0 12px 24px oklch(0 0 0 / 0.03),
    0 24px 48px oklch(0 0 0 / 0.02);
}
```

### Variant Selection Guide

| You're Building | Use |
|----------------|-----|
| Regular content card, list item, panel | `.glass-surface` |
| Modal, dialog, command palette, popover | `.glass-elevated` |
| Dashboard hero metric, key insight, primary KPI | `.glass-hero` |
| Pending approval, due task, action needed | `.glass-action` |
| Completed item, positive metric, success state | `.glass-positive` |
