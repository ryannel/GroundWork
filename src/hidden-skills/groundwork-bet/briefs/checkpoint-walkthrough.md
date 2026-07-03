---
name: checkpoint-walkthrough
description: >
  Walks the owner through the accumulated change at a milestone pause or bet close —
  organized by concern, blast-radius flagged, front-door observations suggested, and the
  pending decisions queue presented for ratification. Read-only; not a gate and not a
  review lens (groundwork-bet/workflows/delivery/step-04-postmortem.md). Only the
  walkthrough flows back.
tier: frontier
---

# Checkpoint Walkthrough

## How This Brief Is Invoked

This brief runs in an **isolated subagent context** (Protocol 9 mechanics), dispatched by
the Delivery driver at a checkpoint pause — a milestone postmortem, the validation Step 4
prelude, or (inline, lightweight) a quick-bet close. It is **read-only** and it is **not a
gate and not a review lens**: the gates beside it (the three per-slice lenses, the
milestone honesty audit, the experience auditor, the deterministic tiers) are unchanged.
Its job is to keep the owner's understanding of the system current as delivery evolves it,
and to surface the batched decisions the default+veto machinery deferred, so the owner
ratifies them with the change in front of them.

Its purpose is comprehension, not judgment. **The walkthrough maintains the owner's system
comprehension as delivery evolves it; it complements the design walk, it never substitutes
for authorship.** A human who walked UI → data flows → API → schema understands the system
they own; this keeps that understanding true after delivery has changed the code.

## Inputs

The driver passes:

- The **accumulated change** since the last checkpoint — the assembled diff for this milestone (or the whole bet at close).
- The **pending decisions queue** — every default+veto decision recorded provisionally in `docs/bets/<bet-slug>/decisions.md` since the last ratification.
- The **open deferred / maturity rows** this change touches (`docs/maturity.md`, discovery notes).
- The **technical design** and the milestone's front-door proof, for orienting the change against what the owner authored.

## The work

Produce a walkthrough — not a review — with five parts:

1. **The change, organized by concern, not file order.** Group the accumulated change by what it does for the product (a capability added, a flow wired, a store introduced), so the owner reads it the way they designed it, not the way git recorded it.
2. **The 2–5 highest-blast-radius spots**, each tagged `[auth]` / `[schema]` / `[contract]` / `[data]` / `[infra]` with one line on why it carries blast radius — where a mistake would cost the most, so the owner's attention lands there first.
3. **2–5 suggested manual observations**, phrased as **front-door actions** — the concrete things to do while driving the running product at the milestone close (open this screen, run this input, watch this happen). This is a script for the owner's own front-door drive the close already mandates, not a substitute for it.
4. **The pending decisions queue, presented for ratification** — each defaulted decision, the recommendation taken, and its one-line rationale, so the owner ratifies or vetoes the batch with the change in view.
5. **The open deferred / maturity rows this change touches** — what was parked, so the owner sees the running debt as well as the delivered work.

## The report

Return the walkthrough itself — the five parts above, tight. Any finding you surface in passing (a bug, a design-system miss) is not yours to adjudicate: hand it to the driver tagged with a suggested bucket `[decision-needed|patch|defer|dismiss]`, and the driver triages it through the existing review buckets. Do not re-run the gates; do not invent findings to look thorough.
