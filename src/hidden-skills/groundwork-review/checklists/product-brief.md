---
name: product-brief-checklist
description: >
  Type-specific failure modes for reviewing a draft product brief — the vision
  document every downstream phase reads first.
---

# Product Brief Checklist

This checklist checks a draft `docs/product-brief.md`. It answers one question: **can a
designer, architect, and MVP planner each start their work from this document without asking
"but what is this product, exactly?"**

Each item names a violation. Match it against the document text; answer yes/no. A matched 🔴 item
means downstream phases start from wrong foundations; a matched 🟡 item is advisory.

## Document Hygiene

- [ ] 🟡 **Leftover downstream summary**: the published doc still carries a `## Summary for
  Downstream` section. The cross-phase contract now lives in `.groundwork/context/product-brief.md`,
  not in the published doc; an old-template summary section is residue and should be removed.

## Users

- [ ] 🔴 **Label without a person**: a user type is named but carries no job-to-be-done or
  success definition — a designer could not design a journey for them. "Busy professionals" is a
  label; a mental model of why they hire the system is the standard.
- [ ] 🔴 **Success without an observable**: a user type's "success looks like" cannot be observed
  in practice — sentiment ("they feel confident") with no behaviour attached.
- [ ] 🟡 **Phantom user**: a user type appears in the Capabilities or Experience sections but is
  absent from Target Users, or vice versa.

## Capabilities and Experience

- [ ] 🔴 **Feature name without function**: a capability is a noun phrase ("smart scheduling",
  "unified inbox") with no statement of what it does for the user, why it matters to the vision,
  or how it connects to other capabilities.
- [ ] 🔴 **Experience without a medium**: the Experience section describes what happens without
  naming the interaction medium — screen-based app, command-line tool, API/protocol, voice, or
  physical device. Downstream design and infrastructure decisions depend on it.
- [ ] 🟡 **Steps without texture**: the Experience is a bare step list ("sign up, create a
  booking, get a confirmation") that a reader cannot picture the shape of — no entry point, no
  outcome, no sense of pacing.
- [ ] 🟡 **MVP masquerading as vision**: the Capabilities section reads as a first-release scope
  rather than the full vision — scoping belongs to MVP planning, and a pre-shrunk brief starves
  it.

## Altitude and Boundaries

- [ ] 🔴 **Technology in the brief**: the document names databases, frameworks, vendors, or
  hosting choices. Technology decisions belong to architecture; a brief that pre-commits them
  contaminates that conversation.
- [ ] 🟡 **Design-depth leakage**: the brief specifies interaction mechanics, edge-case handling,
  or permission rules — "what happens when two users edit the same booking" is a later phase's
  question.
- [ ] 🔴 **Ungrounded constraint**: a Domain Constraint reads as a generic disclaimer ("the
  system must be secure", "data must be handled responsibly") rather than a specific rule
  grounded in this product's context.
- [ ] 🟡 **Marketing voice**: the System Purpose paragraph pitches ("revolutionary", "seamless",
  "delightful") instead of declaring what the system is, who it serves, and what it enables.

## Success Indicators

- [ ] 🔴 **Unobservable indicator**: a success indicator no designer or engineer could observe in
  practice — "users find it valuable" instead of a concrete signal like "a user completes a
  booking within their first session".
- [ ] 🟡 **Indicator without a tie to the problem**: an indicator that could be satisfied while
  the stated Problem remains unsolved — it measures activity, not the value the brief claims to
  deliver.
