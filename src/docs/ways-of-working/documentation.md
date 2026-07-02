---
title: Documentation Protocol
description: How GroundWork keeps documentation current — Living Documents, doc hierarchy, and groundwork-check.
status: active
last_reviewed: 2026-07-02
---

# Documentation Protocol

## The Living Documents Protocol

All `docs/` artifacts are living documents. Any phase of any bet that surfaces new information that refines an existing document updates that document immediately, before moving on. This is not optional — stale docs are worse than no docs.

The direction does not matter:

- A bet can update the product brief.
- Architecture can update the design system.
- Delivery can update architecture.
- A user interview can update everything.

Updates are surgical and targeted. Change only what new information warrants. Do not rewrite sections that remain accurate. Do not ask for permission — these are refinements consistent with decisions already made. After updating, report what changed and why.

## The Document Hierarchy

Every GroundWork project contains a defined set of documents. Each has a different ownership model.

**`docs/principles/**` and `docs/ways-of-working/**`** — project-owned from the moment they are deployed. Edit freely to match your team's practices. These documents describe how your team works and what your team values. GroundWork seeds them; your team owns them.

**`docs/product-brief.md`, `docs/design-system.md`, `docs/architecture/index.md`** — owned by the product and architecture. Updated via the relevant GroundWork skill when significant new information surfaces. Do not edit these ad hoc. Changes go through the skill so that discovery notes, operating contract protocols, and downstream consistency checks are applied.

**`docs/architecture/domain/<entity>.md`** — created by the architecture phase, extended by bet planning. Each bet that touches a domain entity updates its stub. Domain stubs are the contract between teams working on different components of the same entity.

**`docs/architecture/decisions/NNNN-<slug>.md`** — append-only. Never edited after acceptance. To revise a decision, write a new ADR that supersedes the old one. The superseded ADR's `status:` field is updated to reference the new one; its content is never changed.

**`docs/bets/<slug>/`** — immutable once a bet is committed. These are historical records. They document what was decided, why, and on what terms. Do not edit committed bet documents.

## How groundwork-check Works

`groundwork-check` detects documentation drift — the state where docs describe the system differently from the code. Run it in CI or on demand.

What it flags:

- Docs that describe the system differently from the code — mismatched API signatures, schema fields, service names.
- `docs/architecture/domain/` entities missing from the codebase, or codebase domain concepts with no corresponding stub.
- `docs/architecture/decisions/` numbering gaps or invalid status values.

What it does not flag:

- `docs/principles/**` and `docs/ways-of-working/**` are not checked for code drift — these are project-stable documents not derived from code. groundwork-check does flag `last_reviewed` ages above 12 months as a low-severity advisory to prompt periodic review.

When groundwork-check flags something: investigate, do not suppress. Fix the doc or fix the code — the mismatch is the bug. Suppressing a drift flag leaves the system in an unverifiable state.

## Docs and Skills

Docs are for humans and project state. Skills are how agents act on them.

Skills read docs to understand the current system. Docs record what the skills have built. They are complementary, not redundant. A skill that writes a bet plan reads `docs/architecture/index.md` to understand service boundaries — that reading depends on the architecture doc being current. A doc that describes a domain entity accurately depends on the architecture skill having updated it after the last bet touched it.

The Living Documents protocol is what keeps this relationship coherent. When it breaks — when a skill writes code that the docs do not reflect — groundwork-check surfaces the gap.

## ADR Conventions

**When to write one**: Any decision a future engineer should not relitigate without a new ADR. Significance test: would someone joining six months from now need to know this to avoid repeating the decision? If yes, write an ADR.

**How to write one**: Use the template at `.groundwork/skills/templates/adr.md`. Number sequentially with zero-padded four digits: 0001, 0002, 0003. The slug is a short hyphenated description of the decision. Store it at `docs/architecture/decisions/NNNN-<slug>.md`.

**How to supersede**: Change `status:` to `superseded by [NNNN](NNNN-slug.md)` and add a note at the bottom explaining what changed and why.

**What goes in the decision record**: the context (what forced the decision), the decision itself, the consequences (what this enables and what it closes off). Do not document options that were not seriously considered — decision records are not design documents.

The doctrine behind *when* a record may be amended in place versus must be superseded — and why the distinction matters — lives at [Architecture Decisions](../principles/system-design/architecture-decisions.md). Read it before touching an accepted record; this page covers mechanics only.
