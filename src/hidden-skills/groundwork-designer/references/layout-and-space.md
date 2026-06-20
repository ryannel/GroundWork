# Layout & Space

When you advise on layout, treat space as a designed material and let the layout be intrinsic to its content. The two decisions that separate a portable, rhythmic interface from a brittle one are a single tokenised spacing scale and putting responsiveness in the container rather than the viewport.

## Space comes from one scale; relatedness is spacing

Every margin, padding, and gap is a step on one spacing scale, in `rem`, generated from a single base variable so the whole system rescales from one place and honours user font-size. Use a 4px base with 8px as the dominant cadence and a non-linear scale (4, 8, 12, 16, 24, 32, 48, 64, 96), because steps should stay perceptually proportional rather than waste tokens on imperceptible large-end jumps. Spacing communicates structure: related elements sit closer than unrelated ones, so internal spacing is always less than the spacing between groups — equal spacing everywhere erases grouping the user then has to reconstruct.

## Layout is intrinsic: Grid for structure, Flexbox for flow

Let layout size from content — `minmax()`, `min()`, `fr`, `ch`, `auto-fit`/`auto-fill` — rather than forcing fixed columns. Grid handles two dimensions, Flexbox one; matching the tool to the dimensionality makes the alignment hacks disappear. Subgrid aligns content across sibling cards without fixed heights or JavaScript. The responsive-grid default is the RAM pattern *with its guard* — `repeat(auto-fill, minmax(min(100%, 16rem), 1fr))` — because the bare `minmax(16rem, 1fr)` overflows below the floor.

## Responsiveness belongs to the container

A reusable component knows the space its slot gives it, not the viewport. Make every reusable component a container (`container-type: inline-size`) and write its internal breakpoints with `@container`, reserving `@media` for page-level chrome, because that is what makes the same card lay out correctly in a wide column and a narrow sidebar at one viewport width. A `@media` query inside a component couples it to the page and kills portability.

## Type and space scale fluidly; density is an axis

Ship generated fluid scales — type and space as `clamp()` tokens interpolating between a small- and large-viewport anchor — so the system scales smoothly and stays consistent from one declaration; every fluid font-size carries a `rem` term, never pure `vw`. Treat density as an explicit named mode (default and compact) driven by tokenised 4px height deltas plus tighter line-height, not by hand-shrinking components — applied to dense data regions, withheld from focused inputs, never below the accessible touch-target minimum.

## Author in logical properties; place breakpoints by content

Write layout in flow-relative logical properties (`margin-inline`, `padding-block`, `inset-inline-end`, `text-align: start`) by default, because one stylesheet then internationalises to right-to-left and vertical writing for free. Reserve media its space with `aspect-ratio` + `object-fit: cover` to prevent layout shift. Where discrete breakpoints remain, place them in `em` at the widths your *content* breaks, author mobile-first, and design an explicit desktop density target — a single-column mobile layout stretched to a wide screen reads as low-density and untrustworthy.

## Antipatterns to catch

- **Magic-number spacing.** `padding: 7px`, off-scale values that break the rhythm grouping needs.
- **`@media` inside a component.** Couples it to the page; the container is the right reference.
- **Faking 2D with Flexbox.** Ragged pseudo-columns where Grid or subgrid would align.
- **The unguarded RAM pattern.** `minmax(16rem, 1fr)` without `min(100%, …)`, overflowing on narrow screens.
- **Pure-`vw` fluid type.** A `clamp()` preferred value with no `rem` term, breaking zoom.
- **Physical properties.** `margin-left`/`text-align: left` landing on the wrong side in RTL.
- **Stretched mobile layout.** A phone single-column shipped unchanged to desktop.
