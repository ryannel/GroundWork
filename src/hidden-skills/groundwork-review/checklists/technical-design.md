---
name: technical-design-checklist
description: >
  Type-specific failure modes for reviewing a bet's technical design — the
  contract Decomposition and Delivery execute against.
---

# Technical Design Checklist

This checklist checks a draft `docs/bets/<slug>/technical-design.md`. It answers one question:
**could a developer implement from this document on the first pass — and could a milestone test
pass or fail against it unambiguously?**

Each item names a violation. Match it against the document text, the bet's pitch, and the
upstream summaries. Bet documents carry no `## Summary for Downstream` — do not flag its
absence.

## Document Shape

- [ ] 🔴 **Implementation code present**: the document contains application logic — the design
  phase is forbidden from writing implementation code; only design documentation, interface
  specifications, contracts, and schemas belong here.
- [ ] 🟡 **Per-milestone organisation**: the design is split by milestone or phase rather than
  covering the entire bet — decomposition has leaked into the design artifact.
- [ ] 🟡 **Section missing without reason**: one of Surface Design, Data Flows, API Contracts,
  or Data Schema is absent and the document does not state why it does not apply to this bet.

## Surface Design

Surface Design carries one subsection per surface in the pitch's `surfaces:` frontmatter. When
the project has no surface registry (`docs/surfaces.md`), the product has a single implicit
surface — expect exactly one subsection in the project's interface medium, and do not flag the
absence of surface ceremony.

- [ ] 🔴 **In-scope surface undesigned**: a surface in the pitch's `surfaces:` scope has no
  Surface Design subsection — that surface's milestone tests will have nothing to assert
  against, and delivery will improvise the experience.
- [ ] 🔴 **Untestable interface**: a view, command, or interaction is described too vaguely for a
  test to pass or fail against it — surface milestone tests assert against these subsections, so
  "the user can manage their notifications" specifies nothing.
- [ ] 🔴 **Missing states**: a view or command defines its happy path but not its loading, empty,
  error, or degraded states — the states are where implementations diverge silently.
- [ ] 🟡 **Wrong medium vocabulary**: a surface's subsection does not use the vocabulary of that
  surface's interface type in `docs/design-system.md` — screens and states for graphical UI,
  commands and output for CLI, request/response turns for agentic protocol. Each subsection
  speaks its own surface's vocabulary; a CLI subsection describing "screens" is a violation even
  when the bet also scopes a graphical surface.
- [ ] 🟡 **Organised by service, not by interaction**: a surface subsection is structured by
  feature or service instead of by view, command, or interaction — the user-observable surface
  is the unit milestones prove.

## API Contracts

- [ ] 🔴 **Missing spec files**: the bet touches a core boundary but `docs/bets/<slug>/contracts/`
  carries no spec for it, or it changes persistent state with no `schema.sql` — a contract that
  exists only as prose cannot generate a client, validate a response, or fail a drift check.
- [ ] 🔴 **Spec format disagrees with the core's deployment**: the format does not match
  `docs/surfaces.md` — a hosted HTTP boundary without `openapi.yaml` (events without
  `asyncapi.yaml`, gRPC without `.proto`), or an embedded core whose contract is not a typed
  public API definition in the project's language. When no registry exists, hosted HTTP is the
  default and OpenAPI is expected.
- [ ] 🔴 **Prose↔spec drift**: an endpoint, field, channel, or table appears in the prose sections
  but not in the spec files, or vice versa — the two describe different contracts and Delivery
  will implement one while Decomposition tests the other.
- [ ] 🔴 **Vague shape**: a spec schema or prose entry says "returns the entity" or "accepts the
  standard payload" instead of the full request and response shapes with field types — vague
  shapes cannot drive correct implementation, and what is not here will not be in the
  implementation.
- [ ] 🔴 **No error cases**: an endpoint defines no error responses, or lists status codes
  without caller guidance — the caller's recovery behaviour is part of the contract.
- [ ] 🔴 **Contract shaped for one consumer**: a contract shape only one in-scope surface can
  consume — it presumes web session state, returns markup where data belongs, paginates by
  viewport, or encodes one surface's rendering concerns. The contract serves every in-scope
  surface and presumes none; when only one surface is in scope, the latent agentic surface is
  the second consumer — a programmatic caller with no UI and no session must find the contract
  complete.
- [ ] 🟡 **Untyped field**: a request or response field appears without a type, nullability, or
  allowed values where they matter (enums, cursors, identifiers).
- [ ] 🟡 **Auth unstated**: a contract does not state its authentication requirement, on a
  boundary where the architecture defines one.
- [ ] 🟡 **Rationale-free surprise**: a non-obvious contract decision (pagination model,
  idempotency rule, versioning) is asserted with no design rationale — the next reader will
  relitigate it.

## Data Flows and Schema

- [ ] 🔴 **Flow without a trigger or a sink**: a data path does not state what initiates it,
  which services handle it, or what persists at the end — an arrow with a missing end.
- [ ] 🟡 **Domain doc duplicated**: the schema section restates an entity already defined in
  `docs/domain/` instead of referencing the entity doc and describing only what this bet adds or
  changes — the copies will drift.
- [ ] 🟡 **Schema without lifecycle**: a table or store that carries a status field defines no
  state machine for it, and no reference to where one is defined.

## Chain Integrity

- [ ] 🔴 **Pitched capability undesigned**: a capability or outcome the pitch commits to has no
  interface element, flow, or contract covering it — Delivery will discover the hole mid-bet.
- [ ] 🔴 **Silent scope growth**: an interface element or flow traces to nothing in the pitch —
  the design has quietly expanded the bet beyond its appetite.
- [ ] 🟡 **Stakes mismatch**: the design's actual blast radius or reversibility is graver than
  the pitch's stakes read — it touches a one-way door, a load-bearing path, or a wider surface
  than the pitch sized for — yet no rigour (deeper review, a flag, a smaller increment) answers it.
- [ ] 🔴 **Architecture contradiction**: a contract or flow contradicts the architecture summary
  or an accepted ADR — a sync call across a boundary the architecture made async, a store a
  service does not own.
