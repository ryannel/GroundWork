---
name: architecture-checklist
description: >
  Type-specific failure modes for reviewing a draft architecture document — the
  macro-level foundation every service design and bet builds on.
---

# Architecture Checklist

This checklist checks a draft `docs/architecture/index.md`. It answers one question: **could a
downstream engineer design services and contracts from this document without coming back to ask
"why this technology?" or "what does this service actually own?"**

Each item names a violation. Match it against the document text plus the upstream docs;
answer yes/no.

## Document Hygiene

- [ ] 🟡 **Leftover downstream summary**: the published doc still carries a `## Summary for
  Downstream` section. The cross-phase contract now lives in `.groundwork/context/architecture.md`,
  not in the published doc; an old-template summary section is residue and should be removed.
- [ ] 🔴 **Service count disagrees with the service list**: a "N services" claim that does not
  match the number of services actually named, e.g. counting an `infrastructure`/Terraform
  partition as a service. State the count and the named set consistently.

## Technology Decisions

- [ ] 🔴 **Shopping-list technology**: a database, queue, cache, auth provider, or other
  technology is named with no rationale and no downstream obligations — the document says what
  to install but not why it was chosen or what it requires of service design.
- [ ] 🔴 **LLM provider unnamed**: the system calls an LLM but the document does not name the
  provider and the specific model with rationale and downstream obligations — scaffolding maps
  the provider to a generator flag, so an unnamed provider becomes a silent mismatch at code
  generation.
- [ ] 🟡 **Obligation without an owner**: a downstream obligation is stated ("handlers must be
  idempotent") but no Service-Level Requirements row or service section assigns it to a service.
- [ ] 🟡 **Capability area unaddressed**: a capability the product plainly needs (persistence,
  auth, file storage, background processing, search) has no technology decision and no explicit
  deferral.

## Service Boundaries and Ownership

- [ ] 🔴 **Service without ownership**: a service appears in the topology with no statement of
  what it owns and what it explicitly does not own.
- [ ] 🔴 **Unowned data**: an entity or data store is named that no service claims, or two
  services are each described as owning the same concept with the conflict unresolved.
- [ ] 🟡 **Boundary without reasoning**: a service boundary is drawn with no statement of why it
  sits there — what signal (mental model, runtime profile, deployment cadence) justifies the
  split.
- [ ] 🟡 **Contract format unstated**: a service interface is described with no contract format
  committed (REST → OpenAPI, async events → AsyncAPI, agent capability → MCP schema).

## Surfaces and the Capability Core

- [ ] 🔴 **Registry ↔ service-map disagreement**: a component the topology presents as a surface
  app (a web client, a CLI, a mobile app, an MCP server) is missing from the Surfaces &
  Capability Core section — or from `docs/surfaces.md` where it exists — or a listed surface maps
  to no component in the service map. The scaffold derives its targets from the registry, so a
  desync ships the wrong set of apps.
- [ ] 🔴 **Core deployment undecided**: the document does not state whether the capability core
  is hosted (services reached over a network) or embedded (a library in-process with its single
  surface) — the contract spec format follows this decision, so leaving it open blocks every
  contract definition downstream.
- [ ] 🔴 **Independently deployed surfaces without a compatibility stance**: two or more surfaces
  deploy independently, and no Binding Constraint states what the system promises about
  published contract fields — a client fleet that lags releases turns the first contract change
  into an incident.
- [ ] 🟡 **Surface without an access path or auth model**: a surface is listed without how it
  reaches the core (direct, gateway, BFF) or which auth model it uses — both are registry fields
  the commit step cannot fill from an undecided document.

## Data Flow and Communication

- [ ] 🔴 **Mechanism implied but not provisioned**: a flow depends on infrastructure the document
  never provisions — events published with no broker or bus, scheduled work with no scheduler,
  real-time delivery with no channel.
- [ ] 🟡 **Sync/async without trade-off**: a communication pattern is asserted with no reasoning
  — sync coupling accepted or eventual consistency introduced without the consequence stated.
- [ ] 🟡 **Stateful service without storage**: a service that plainly persists data has no
  storage decision — no data shape, no access pattern, no store named.
- [ ] 🟡 **Flow with one end**: a data flow names a producer with no consumer, or a consumer with
  no source — the arrow starts or ends nowhere.

## Upstream Contract

- [ ] 🔴 **Budget without an answer**: a performance budget or availability target from
  `docs/design-system.md` has no architectural mechanism that could meet it — the number was
  inherited but nothing here serves it.
- [ ] 🔴 **Capability silently dropped**: a capability or user type committed in
  `docs/product-brief.md` maps to no service, flow, or explicit deferral in this document.
- [ ] 🟡 **Constraint relaxed without record**: the document quietly weakens an upstream
  constraint (a residency rule applied to some data, a budget restated with a looser number)
  instead of honouring it or escalating it.
