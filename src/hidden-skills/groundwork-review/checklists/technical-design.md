---
name: technical-design-checklist
description: >
  Type-specific failure modes for reviewing a bet's technical design — the
  contract Decomposition and Delivery execute against.
---

# Technical Design Checklist

This checklist checks a draft `docs/bets/<slug>/technical-design/` directory. It answers one question:
**could a developer implement from this design on the first pass — and could a milestone proof
pass or fail against it unambiguously?**

Each item names a violation. Match it against the document text, the bet's pitch, and the
upstream docs. Bet documents carry no Downstream Context file and no summary section — do not
flag the absence of either.

## Document Shape

- [ ] 🔴 **Implementation code present**: the document contains application logic — the design
  phase is forbidden from writing implementation code; only design documentation, interface
  specifications, contracts, and schemas belong here.
- [ ] 🟡 **Per-milestone organisation**: the design is split by milestone or phase rather than
  covering the entire bet — decomposition has leaked into the design artifact.
- [ ] 🟡 **Section missing without reason**: one of UI Design, Data Flows, API Design,
  or Schema & Data Design is absent and the document does not state why it does not apply to this bet.

## UI Design

UI Design carries one subsection per surface in the pitch's `surfaces:` frontmatter. When
the project has no surface registry (`docs/surfaces.md`), the product has a single implicit
surface — expect exactly one subsection in the project's interface medium, and do not flag the
absence of surface ceremony.

- [ ] 🔴 **In-scope surface undesigned**: a surface in the pitch's `surfaces:` scope has no
  UI Design subsection — that surface's milestone tests will have nothing to assert
  against, and delivery will improvise the experience.
- [ ] 🔴 **Untestable interface**: a view, command, or interaction is described too vaguely for a
  test to pass or fail against it — surface milestone tests assert against these subsections, so
  "the user can manage their notifications" specifies nothing.
- [ ] 🔴 **Missing states**: a view or command defines its happy path but not its loading, empty,
  error, or degraded states — the states are where implementations diverge silently.
- [ ] 🟡 **Wireframe missing**: a `graphical-ui` surface's key view defines states but carries no
  wireframe — neither an ASCII sketch nor a linked mockup — so its layout and hierarchy are left
  for the build to improvise. The ASCII wireframe is the always-present baseline; a mockup image
  supplements but does not replace it.
- [ ] 🟡 **Wrong medium vocabulary**: a surface's subsection does not use the vocabulary of that
  surface's interface type in `docs/design-system.md` — screens and states for graphical UI,
  commands and output for CLI, request/response turns for agentic protocol. Each subsection
  speaks its own surface's vocabulary; a CLI subsection describing "screens" is a violation even
  when the bet also scopes a graphical surface.
- [ ] 🟡 **Organised by service, not by interaction**: a surface subsection is structured by
  feature or service instead of by view, command, or interaction — the user-observable surface
  is the unit milestones prove.

## API Design

- [ ] 🔴 **Vague shape**: a prose API entry in `03-api-design.md` says "returns the entity" or
  "accepts the standard payload" instead of giving the full request and response shapes with
  field types inline. The prose design is the bet's only contract — Delivery materializes proofs
  and builds the implementation from these shapes, so what is not here will not be in the
  implementation, and a proof cannot rest on a shape the design never spelled out.
- [ ] 🔴 **State change without a shape**: a bet changes persistent state but the affected store
  carries no field shapes in `04-data-design.md` — column names, types, and nullability. A
  persisted effect a proof observes traces to this store; an undefined store cannot be
  implemented or proven against.
- [ ] 🔴 **No error cases**: an endpoint in the API design defines no error responses, or lists
  status codes without caller guidance — the caller's recovery behaviour is part of the contract.
- [ ] 🔴 **Contract shaped for one consumer**: an interface in the API design only one in-scope
  surface can consume — it presumes web session state, returns markup where data belongs,
  paginates by viewport, or encodes one surface's rendering concerns. The contract serves every
  in-scope surface and presumes none; when only one surface is in scope, the latent agentic
  surface is the second consumer — a programmatic caller with no UI and no session must find the
  contract complete.
- [ ] 🟡 **Untyped field**: a request or response field appears without a type, nullability, or
  allowed values where they matter (enums, cursors, identifiers).
- [ ] 🟡 **Auth unstated**: a contract does not state its authentication requirement, on a
  boundary where the architecture defines one.
- [ ] 🟡 **Rationale-free surprise**: a non-obvious contract decision (pagination model,
  idempotency rule, versioning) is asserted with no design rationale — the next reader will
  relitigate it.

## Data Flows & Data Design

- [ ] 🔴 **Flow without a trigger or a sink**: a data path does not state what initiates it,
  which services handle it, or what persists at the end — an arrow with a missing end.
- [ ] 🟡 **Flow without a diagram**: a non-trivial cross-service or routing flow is described in
  prose with no `sequenceDiagram` or `flowchart` — ordering and service boundaries that a diagram
  makes legible are left to the reader to reconstruct.
- [ ] 🟡 **Domain doc duplicated**: the schema section restates an entity already defined in
  `docs/architecture/domain/` instead of referencing the entity doc and describing only what this bet adds or
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
- [ ] 🔴 **Architecture contradiction**: a contract or flow contradicts `docs/architecture/index.md`
  or an accepted ADR — a sync call across a boundary the architecture made async, a store a
  service does not own.
- [ ] 🟡 **Pitch topology missing or stale**: the design establishes the services and components
  this bet touches, but the pitch's Solution carries no topology graph — or still shows the
  template placeholder — so a reader of the pitch cannot see the system the bet plays in. A
  trivial single-component bet may carry a one-line note instead of a graph; silence is the
  violation.
