---
name: domain-entity-checklist
description: >
  Type-specific failure modes for reviewing a domain entity doc — checked
  against the current architecture doc and the accepted (non-superseded) ADRs.
---

# Domain Entity Checklist

This checklist checks a draft `docs/architecture/domain/<entity>.md`. It answers one question: **does this
entity describe the system currently being built — agreeing with `docs/architecture/index.md`
and the accepted ADRs — and is every state, event, and invariant
mechanically enforceable?**

Each item names a violation. Match it against the document text, `docs/architecture/index.md`, and
the ADRs under `docs/architecture/decisions/` (skip any ADR whose `status` is `superseded`). Domain entity
docs carry no Downstream Context file and no summary section — do not flag the absence of either.

## Identity and Ownership

- [ ] 🔴 **Owner from a superseded design**: the `Owner:` line names a service, vendor, or
  mechanism an accepted ADR moved away from — e.g. `Owner: web (via Supabase Auth)` after an ADR
  moved auth to another provider. The doc describes a system no longer being built.
- [ ] 🔴 **Owner not in the architecture**: the `Owner:` service does not exist in the current
  architecture's service topology.
- [ ] 🟡 **No invariant to enforce**: the "What it is" paragraph describes the entity without
  stating the invariant the entity exists to enforce.

## Lifecycle Mechanics

- [ ] 🔴 **Undetectable trigger**: a lifecycle state's transition trigger is backed by no field
  in the Fields table and no emitted event — a state that cannot be mechanically detected cannot
  be enforced and is invalid.
- [ ] 🔴 **Time-based state without its field**: a state reached by the passage of time or
  inactivity ("dormant", "expired") with no timestamp field (e.g. `last_active_at`,
  `expires_at`) that makes it detectable.
- [ ] 🟡 **Phantom field**: the Lifecycle or Invariants section references a field that does not
  appear in the Fields table.
- [ ] 🟡 **Stateless entity with a state table**: the entity is described as immutable or having
  no meaningful state machine, yet a lifecycle table is present anyway — the template requires
  saying so explicitly and removing the table.

## Domain Events

- [ ] 🔴 **Event implies an unprovisioned mechanism**: a domain event is listed as published when
  the architecture provisions no message broker or event bus — it implies a publish channel that
  does not exist. Without a broker, events are in-process domain concepts only, and the doc must
  not suggest otherwise.
- [ ] 🟡 **Event naming drift**: an event does not follow the `<entity>.<verb>` naming form, or
  names a different entity than the one this doc defines.
- [ ] 🟡 **Event without a lifecycle anchor**: an event's trigger corresponds to no state
  transition or field change defined elsewhere in the doc.

## Invariants vs the ADRs

- [ ] 🔴 **Overstated guarantee**: an invariant asserts a guarantee an accepted ADR explicitly
  surrendered or weakened — claiming a pre-screen where the ADR records a monitor, immediate
  consistency where the ADR accepted eventual. The invariant must state the weaker guarantee the
  system actually enforces.
- [ ] 🔴 **Invariant against a superseded mechanism**: an invariant depends on a vendor,
  persistence model, or data-isolation strategy that an accepted ADR replaced.
- [ ] 🟡 **Untestable invariant**: an invariant phrased so that no test or boundary check could
  detect its violation ("bookings are always handled correctly").
- [ ] 🟡 **Invariant duplicating the lifecycle**: an invariant that restates a transition rule
  already in the Lifecycle table rather than constraining validity — noise that will drift from
  its twin.
