---
title: Layout & Space
description: Spatial systems, modern intrinsic layout, container-driven responsiveness, fluid sizing, and density as a first-class axis.
status: active
last_reviewed: 2026-06-20
---
# Layout & Space

## TL;DR

Space is a designed material, governed by a consistent scale rather than ad-hoc numbers. Layout is intrinsic — sized from content and the space a component is given, not from device dimensions — which is why responsiveness now belongs to the container, not the viewport. Type and space flow fluidly between anchor points, density is an explicit axis, and the whole system is authored in logical, internationalisable properties.

## Why this matters

Inconsistent spacing is the most common reason an interface feels amateur even when its colour and type are fine: a 7px here and a 13px there break the rhythm the eye uses to group and separate. And the device-era model of responsiveness — viewport media queries snapping a layout between fixed breakpoints — produces components that cannot be reused, because the same card needs a different layout in a wide column and a narrow sidebar *at the same viewport width*. Modern CSS resolved both: a tokenised spatial scale gives rhythm, and container queries plus intrinsic sizing make components carry their own responsive logic.

## Our principles

### 1. Space comes from one tokenised scale

Every margin, padding, and gap is a step on a single spacing scale, expressed in `rem` and generated from one base variable, so the whole system rescales and themes from one place and honours user font-size. We use a 4px base unit with 8px as the dominant cadence — 8 divides cleanly, stays whole at 2× and 3× density, and 4 supplies the half-steps dense UI genuinely needs — and a non-linear scale (4, 8, 12, 16, 24, 32, 48, 64, 96) so steps stay perceptually proportional instead of wasting tokens on imperceptible large-end jumps. Tokens name intent where it helps (`inset`, `stack`, `inline`), never a raw pixel value in a component.

### 2. The grid is rhythm, and relatedness is spacing

Spacing is how the interface communicates structure: related elements sit closer than unrelated ones, so internal spacing is always less than the spacing that separates groups. Equal spacing everywhere erases grouping and forces the user to work out relationships the layout should have shown. The grid is expressed in code as margins and padding in scale multiples, not as a snapped overlay to fight — a soft grid bends to content where a hard grid produces brittle layouts.

### 3. Layout is intrinsic: Grid for structure, Flexbox for flow

We let layout be intrinsic to content — sized from `minmax()`, `min()`, `fr`, `ch`, and `auto-fit`/`auto-fill` — rather than forcing content into fixed columns. Grid handles two-dimensional structure; Flexbox handles one-dimensional flow; matching the tool to the layout's dimensionality makes the alignment hacks disappear. Subgrid aligns content across sibling cards without fixed heights or JavaScript. The responsive-grid default is the RAM pattern with its overflow guard — `repeat(auto-fill, minmax(min(100%, 16rem), 1fr))` — because the bare `minmax(16rem, 1fr)` overflows its container below the floor.

### 4. Responsiveness belongs to the container

A reusable component does not know the viewport; it knows the space its slot gives it. We make every reusable component a container (`container-type: inline-size`) and write its internal breakpoints with `@container`, reserving `@media` for true page-level chrome like global navigation. This is what makes a component portable — the same card lays out correctly in a wide main column and a narrow sidebar with no knowledge of the page. Container queries are Baseline across evergreen browsers; a section that needed seven viewport breakpoints collapses to two container queries.

### 5. Type and space scale fluidly between anchor points

Rather than redefining sizes at each breakpoint, we ship generated fluid scales — type and space as `clamp()` custom properties interpolating between a small-viewport and large-viewport anchor — so the system scales smoothly and stays internally consistent from one declaration. Every fluid font-size includes a `rem` term in its preferred value, never pure `vw`, because pure-viewport text does not respond to zoom and fails WCAG resize-text. Container units (`cqi`) drive component-scaled type where the container, not the viewport, is the right reference.

### 6. Density is a first-class axis

The same viewport demands different compactness by user, input modality, and data load, so density is an explicit, named mode (default and compact) driven by tokenised deltas — 4px steps of element height plus tighter line-height — not by hand-shrinking components one at a time. A single switch keeps the whole UI consistent and reversible. Density is applied where it serves (dense data regions) and withheld where it harms (focused inputs and primary actions), and never compresses touch targets below the accessible minimum.

### 7. Author in logical, internationalisable properties

We write layout in flow-relative logical properties — `margin-inline`, `padding-block`, `inset-inline-end`, `text-align: start` — by default, because one stylesheet then internationalises to right-to-left and vertical writing modes for free, with no parallel `[dir="rtl"]` override sheet to maintain. Media reserves its space with `aspect-ratio` plus `object-fit: cover` (and intrinsic `width`/`height` on images) to prevent layout shift as content loads.

### 8. Breakpoints follow content, and density is designed for both ends

Where discrete breakpoints are still needed for macro column-count shifts, they are placed in `em` at the widths where *the content* breaks — a measure growing past comfort, cards becoming cramped — not at device dimensions that churn every hardware cycle. We author mobile-first but design an explicit desktop information-density target, because a single-column mobile layout naïvely stretched to a wide screen produces a low-density, high-scroll, low-trust desktop experience.

## How we apply this

- [Visual Design](visual-design.md) — the spatial scale carries the visual rhythm colour and type sit on.
- [Interaction & Motion](interaction-and-motion.md) — layout transitions and the View Transitions API depend on a stable spatial model.
- [Design Systems & Tokens](design-systems-and-tokens.md) — spacing, breakpoints, and density become tokens in the system contract.

## Anti-patterns we reject

- **Magic-number spacing.** `padding: 7px`, `top: 13px` — values off the scale that break the rhythm grouping depends on.
- **Viewport media queries inside components.** `@media` in a reusable component couples it to the page and kills portability; the container is the right reference.
- **Faking 2D with Flexbox.** Ragged pseudo-columns and magic margins where Grid (and subgrid) would align cleanly.
- **The unguarded RAM pattern.** `minmax(16rem, 1fr)` without the `min(100%, …)` guard, overflowing its container on narrow screens.
- **Pure-`vw` fluid type.** `font-size: 4vw` or a `clamp()` whose preferred value omits a `rem` term, breaking zoom.
- **Physical properties.** `margin-left` and `text-align: left` that land on the wrong side in right-to-left languages.
- **Stretched mobile layout.** A single-column phone layout shipped unchanged to desktop, low-density and untrustworthy on a wide screen.

## Further reading

- Jen Simmons, *Intrinsic Web Design* — sizing layout from content rather than device width.
- Ahmad Shadeed, *A Guide to CSS Container Queries* — the shift from viewport to container responsiveness.
- *Utopia* (utopia.fyi) — fluid type and space scales from two anchor points.
- Nathan Curtis, *Space in Design Systems* — spacing scales and intent-named space tokens.
