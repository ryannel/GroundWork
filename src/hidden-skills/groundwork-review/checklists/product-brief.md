---
name: product-brief-checklist
description: >
  Type-specific failure modes for reviewing a draft product brief — the half-page
  orientation and boundary record every gate and newcomer reads first.
---

# Product Brief Checklist

This checklist checks a draft `docs/product-brief.md`. The brief is a half-page orientation
and boundary record: what problem the system solves, for whom, through what surfaces, and
what it will never do. It answers two questions: **can someone opening the project cold
orient from this page**, and **can the scope gates judge a pitch against its boundaries?**
The discovery's depth is carried by the Downstream Context file and the hand-off, not this
document — a brief that tries to be the specification has failed the shape, not exceeded it.

Each item names a violation. Match it against the document text; answer yes/no. A matched 🔴 item
means a gate or a newcomer starts from wrong foundations; a matched 🟡 item is advisory.

## Shape

- [ ] 🔴 **Specification creep**: the brief carries a capability inventory, feature detail,
  per-user success narratives, or journey walkthroughs. That content belongs to the hand-off
  and the Downstream Context file (and, once delivery begins, the `docs/surfaces.md` ledger) —
  in the brief it is the fast-drifting layer that goes stale and misleads.
- [ ] 🟡 **Leftover downstream summary**: the published doc still carries a `## Summary for
  Downstream` section. The cross-phase contract lives in `.groundwork/context/`, not the doc.
- [ ] 🟡 **Over budget**: the brief runs well past half a page. Length is not depth — every
  section has a distilled form, and growth signals content that belongs to a carrier.

## Purpose & Problem

- [ ] 🔴 **Marketing voice**: the paragraph pitches ("revolutionary", "seamless",
  "delightful") instead of declaring what the system is, who it serves, and what it enables.
- [ ] 🔴 **Unobservable signal**: the closing success signals cannot be observed in
  practice — "users find it valuable" instead of "a user completes a booking within their
  first session".
- [ ] 🟡 **Problem missing its people**: what is broken is stated, but not who feels it —
  the paragraph describes a gap in the world with nobody standing in it.

## Audience

- [ ] 🔴 **Label without a job**: a user type is named with no job-to-be-done — "busy
  professionals" is a label; two lines must still say who they are and what they hire the
  system to do.
- [ ] 🟡 **Phantom audience**: a user type appears in Purpose & Problem or Surfaces but is
  absent from Audience, or vice versa.

## Surfaces

- [ ] 🔴 **Experience without a medium**: a surface entry (or the purpose paragraph) implies
  user interaction without naming the deployed artifact and its interface type — screen-based
  app, command-line tool, API/protocol, voice, or physical device. Downstream design and
  infrastructure decisions branch on it.
- [ ] 🟡 **Horizon missing**: a surface carries no MVP / later / aspirational marker, so MVP
  planning cannot tell commitment from roadmap.

## Non-goals & Hard Rules

- [ ] 🔴 **Boundary a reviewer cannot judge**: an entry too vague for the bet-pitch
  out-of-scope gate to detect a violation — "keep it simple" is not a boundary; "no
  multi-tenant accounts" is.
- [ ] 🔴 **Ungrounded constraint**: a hard rule reads as a generic disclaimer ("the system
  must be secure", "data must be handled responsibly") rather than a specific commitment
  grounded in this product's context.
- [ ] 🔴 **Inferred boundary**: an entry the user never explicitly stated or confirmed —
  boundaries bind future pitches, so an invented one silently narrows the product.
- [ ] 🟡 **MVP deferral posing as a non-goal**: an entry that is really "not in the first
  release" — deferrals belong to MVP planning and pitches, not the permanent boundary record.

## Altitude

- [ ] 🔴 **Technology in the brief**: the document names databases, frameworks, vendors, or
  hosting choices. Technology decisions belong to architecture.
- [ ] 🟡 **Design-depth leakage**: the brief specifies interaction mechanics, edge-case
  handling, or permission rules — later phases' questions.
