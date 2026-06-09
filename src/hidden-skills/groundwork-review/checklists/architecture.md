---
name: architecture-checklist
description: >
  Type-specific failure modes for reviewing a draft architecture document — the
  macro-level foundation every service design and bet builds on.
---

# Architecture Checklist

This checklist checks a draft `docs/architecture.md`. It answers one question: **could a downstream engineer design services and contracts from this document without coming back to ask "why this technology?" or "what does this service actually own?"**

Each item names a violation. Match it against the document text plus the upstream summaries; answer yes/no.

## Summary Contract

- [ ] 🔴 **Summary absent or displaced**: the `## Summary for Downstream` section is missing, empty, or not the first section after the frontmatter.
- [ ] 🔴 **Summary omits a structural decision**: a technology choice, service boundary, or communication pattern the body commits to has no bullet under `### Key Decisions` — domain entities and bets are reviewed against this summary, so the omission makes the decision invisible.
- [ ] 🔴 **Inherited constraint dropped from summary**: a binding user-facing constraint from the product brief or design system (consent gating, confirmation rules, data-handling limits) is absent from `### Binding Constraints` here — downstream docs are reviewed against this summary, never against the brief.

## Technology Decisions

- [ ] 🔴 **Shopping-list technology**: a database, queue, cache, auth provider, or other technology is named with no rationale and no downstream obligations — the document says what to install but not why it was chosen or what it requires of service design.
- [ ] 🔴 **LLM provider unnamed**: the system calls an LLM but the document does not name the provider and the specific model with rationale and downstream obligations — scaffolding maps the provider to a generator flag, so an unnamed provider becomes a silent mismatch at code generation.
- [ ] 🟡 **Obligation without an owner**: a downstream obligation is stated ("handlers must be idempotent") but no Service-Level Requirements row or service section assigns it to a service.
- [ ] 🟡 **Capability area unaddressed**: a capability the product plainly needs (persistence, auth, file storage, background processing, search) has no technology decision and no explicit deferral.

## Service Boundaries and Ownership

- [ ] 🔴 **Service without ownership**: a service appears in the topology with no statement of what it owns and what it explicitly does not own.
- [ ] 🔴 **Unowned data**: an entity or data store is named that no service claims, or two services are each described as owning the same concept with the conflict unresolved.
- [ ] 🟡 **Boundary without reasoning**: a service boundary is drawn with no statement of why it sits there — what signal (mental model, runtime profile, deployment cadence) justifies the split.
- [ ] 🟡 **Contract format unstated**: a service interface is described with no contract format committed (REST → OpenAPI, async events → AsyncAPI, agent capability → MCP schema).

## Data Flow and Communication

- [ ] 🔴 **Mechanism implied but not provisioned**: a flow depends on infrastructure the document never provisions — events published with no broker or bus, scheduled work with no scheduler, real-time delivery with no channel.
- [ ] 🟡 **Sync/async without trade-off**: a communication pattern is asserted with no reasoning — sync coupling accepted or eventual consistency introduced without the consequence stated.
- [ ] 🟡 **Stateful service without storage**: a service that plainly persists data has no storage decision — no data shape, no access pattern, no store named.
- [ ] 🟡 **Flow with one end**: a data flow names a producer with no consumer, or a consumer with no source — the arrow starts or ends nowhere.

## Upstream Contract

- [ ] 🔴 **Budget without an answer**: a performance budget or availability target from the design system's summary has no architectural mechanism that could meet it — the number was inherited but nothing here serves it.
- [ ] 🔴 **Capability silently dropped**: a capability or user type committed in the product brief's summary maps to no service, flow, or explicit deferral in this document.
- [ ] 🟡 **Constraint relaxed without record**: the document quietly weakens an upstream constraint (a residency rule applied to some data, a budget restated with a looser number) instead of honouring it or escalating it.
