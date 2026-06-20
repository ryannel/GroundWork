---
name: visual-fidelity-checklist
description: >
  Type-specific failure modes for the Tier-3 fidelity critique — grading captured
  screenshots of a delivered graphical surface against the design system's intent
  and the references it drew from, for craft, not mimicry.
---

# Visual Fidelity Checklist

This checklist grades the **captured screenshots** of a delivered `graphical-ui` surface
(`.groundwork/cache/visual/<bet-slug>/...`), read as images. It answers one question: **is
this as considered as the design system committed to and the references it admired?** Tier 1
(render-smoke + axe) has already proven the page renders and is accessible; this pass grades
craft, which a machine cannot.

Grade craft *dimensions* against the design system's own intent (its visual spec, its `##
Design References`, and the per-screen intent in the bet's `technical-design.md`), with
live-researched reference imagery as calibration only. Each item names a violation; match it
against the screenshots and answer yes/no, citing the screen and state.

## The anti-mimicry guardrail (read first)

- [ ] 🔴 **Similarity scored as quality**: a finding that asks the surface to *resemble* a
  reference ("make it look like Linear") rather than to reach its craft *level*. The references
  calibrate the bar; copying their signature is off-brand and plagiaristic. An on-brand screen
  that looks nothing like any reference is not a finding for that reason alone.

## The quality bar (shallow vs deep)

A finding is only useful if it is specific and calibrated. Match this depth:

- **Shallow (insufficient):** "the spacing feels off." Names no value, no target, no consequence.
- **Deep (required):** "the card grid uses a 12px gutter where the spec's 8-pt rhythm calls for
  16px, so the density reads cramped against the Linear-class restraint the design references set."
  Names the screen, the observed value, the intended target, and why the gap matters.

A finding thinner than the deep example — an adjective with no value, target, or consequence — is
itself downgraded: it does not steer the fix.

## Translation fidelity (did the spec survive to the screen)

- [ ] 🔴 **Drifted to defaults**: a screen renders framework defaults where the design system
  committed otherwise — a flat single-layer shadow, one font weight, a default gradient, a flat
  grey border, system fonts — instead of the specified tokens. Plausible is not the bar.
- [ ] 🔴 **Token not realized**: a colour, type role, radius, or spacing value visibly differs
  from the design system's committed value for that role.
- [ ] 🟡 **Theme realized unevenly**: the dark (or high-contrast) capture is a weaker realization
  than the light one — washed accents, lost elevation, a near-invisible border — rather than a
  considered remap.

## Hierarchy, rhythm, and composition

- [ ] 🔴 **No clear focal point**: the primary action or content does not read first; everything
  competes at one visual weight.
- [ ] 🟡 **Broken spatial rhythm**: spacing is off the system's scale or applied without the
  grouping rule (related elements no closer than unrelated), so the layout reads arbitrary.
- [ ] 🟡 **Misalignment**: elements that should share an edge or baseline do not, across the
  captured viewports.
- [ ] 🟡 **Density mismatch**: the screen reads cramped or sparse against the design system's
  density intent and the references' restraint.

## Legibility and contrast (beyond the axe floor)

- [ ] 🔴 **Unreadable text**: body or control text that is perceptually hard to read despite
  passing the WCAG ratio — the dark-mode / thin-weight case APCA catches and the 2.x ratio misses.
- [ ] 🟡 **Weak typographic craft**: tracking, line-height, or measure that fights readability —
  long lines past ~75ch, headings with default leading, no optical adjustment at display sizes.

## State completeness and polish

- [ ] 🔴 **A state reads as broken**: an empty, loading, or error state that looks like a failure
  rather than a designed state — a blank panel where onboarding belongs, a raw error string.
- [ ] 🟡 **Unfinished polish**: missing depth where the system specifies it, abrupt or absent
  transitions visible in the static frame's start/end states, asset/icon inconsistency.

## Intent coverage

- [ ] 🔴 **Per-screen intent unmet**: the bet's `technical-design.md` stated a specific look/feel
  for this screen ("dense data table in the Linear mold; inviting empty state") and the captured
  screen does not reach it.
- [ ] 🟡 **Reference record unused**: the design system names `## Design References` whose admired
  qualities are plainly relevant to this screen and visibly absent from the realization.
