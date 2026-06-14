# Architecture Skill & Principles — 2026 Refresh

**Status:** EXECUTED — 2026-06-14. Research complete (4-cluster web research, ~80 sources). Full P0–P3 delivered with first-class manifesto pages. 5 new principle pages + references (agentic-systems, evolutionary-architecture, surface-architecture, identity-and-access, durable-execution); AI-ops + 2026 cross-cut woven through 11 existing principle pages + their references; ai-native-architecture narrowed. All gates green (sync anchors, contracts); ships on init. Uncommitted in the working tree. Owed: live greenfield + bet-design sims to confirm the new guidance lands in session.

**Progress log:**
- ✅ **WS-A** (agentic-systems): new `ai-native/agentic-systems.md` principle page + architect reference; `ai-native-architecture.md` reference narrowed (A2A/AG-UI, RAG taxonomy, cost mechanism, topology handed off). Wired (SKILL routing, sync-anchor, llms.txt, CHANGELOG). Gates green; ships on init.
- ✅ **WS-C (part)** (evolutionary-architecture): new `system-design/evolutionary-architecture.md` page + reference (fitness functions, architecture-as-code, strangler-fig, advisory governance). Wired + gated.
- ✅ **WS-B** (AI-ops + 2026 ops cross-cut): reliability (cell-based, living SLOs, AI semantic failure), observability (OTel GenAI, eBPF/OBI, wide events), security (SPIFFE workload identity, Sigstore provenance, AI/prompt-injection/agent security), performance (compute placement/edge/Wasm, KEDA, AI cost lever), platform (OpenTofu/Pulumi, OpenFeature, GitOps, AI gateway, carbon-aware). Both architect references **and** source manifesto pages updated; 7 source pages re-hashed.
- ✅ **WS-C** (enforcement/governance): contract-testing + `can-i-deploy` + Spectral + RFC 9457 + protocol-selection into api-and-contracts (ref + `api-design.md`); advice-process + fitness-function pairing into decision-records (ref + `architecture-decisions.md`).
- **→ P0 COMPLETE.** Gates green; ships on init. CHANGELOG + plan updated.
- ✅ **P1**: `surface-architecture`, `identity-and-access`, `durable-execution` — new pages + references, wired + gated.
- ✅ **P2**: integration (DLQ, jitter, orch-vs-choreo, modern webhooks), data (CDC, AI-era data, registry-enforced schemas, Iceberg), real-time (SSE per-direction default, LLM streaming, CRDT, WebTransport-deferred), boundaries (modular-monolith-default, distributed-monolith smell + consolidation signal, Conway/Team-Topologies). References + source pages; 4 source pages re-hashed. [API improvements folded in WS-C.]
- ✅ **P3**: edge/Wasm + carbon-aware folded into performance/platform/cost (WS-B) — not promoted to standalone, per the research recommendation.
**Audience:** GroundWork contributors working on `groundwork-architect` + `src/docs/principles/`.
**Scope owner:** architecture discipline.

## §0 — Mental model

The architecture guidance is **sound 2022–23 doctrine that predates the AI-operations era**. Across four independent research clusters the verdict was the same: *almost nothing is outdated — the gap is absence and shallow depth, concentrated on three axes.*

1. **AI/agentic is now first-class, and it cross-cuts everything.** The framework treats AI as a feature done responsibly (pre-agentic). The field moved to *agentic systems architecture* (topology, interop protocols, memory, durable execution, guardrails) and to AI-as-an-operational-citizen (LLM reliability, observability, security, cost). For an agent-native framework this is the headline gap.
2. **The field shifted from authoring to enforcement/governance.** "A decision record *documents*; a fitness function *assures*." Contract-first without contract *testing*, ADRs without fitness functions, hexagonal rules without CI dependency checks — all now read as half-done.
3. **Structural blind spots.** The skill is backend/interface-leaning. Whole topics a 2026 reference covers are absent: surface/frontend architecture, identity & access, durable execution, modernization/evolution, multi-tenancy, edge/Wasm, carbon-aware.

Two cross-cutting reframes thread through everything: **records-plus-assurance** (pair every authored artifact with an automated check) and **AI-as-first-class** (every operational concern has an AI variant).

## Findings (stable IDs)

### The AI/agentic cross-cut (flagged by 3 of 4 clusters — highest priority)
| ID | Finding |
|---|---|
| F-AG1 | **Agent topology absent.** "Agents are distributed systems" gives no topology guidance. 2026 canon: single agent owning context + *stateless* read-only sub-agents for fan-out; **naive multi-agent** (parallel agents on shared state) is THE anti-pattern. Supervisor/worker vs swarm/handoff catalog. ([LangChain](https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems), [Cognition vs Anthropic debate](https://snrspeaks.medium.com/inside-the-multi-agent-debate-why-cognition-labs-says-dont-and-anthropic-says-do-carefully-7b8a253e0b1e)) |
| F-AG2 | **Interop stack is MCP-only.** 2026 reference architecture is two-layer: **MCP (tools/data) + A2A (agent-to-agent) + AG-UI (agent↔UI events)**. 100+ enterprises on MCP+A2A by Feb 2026. ([interop protocols](https://zylos.ai/research/2026-03-26-agent-interoperability-protocols-mcp-a2a-acp-convergence/)) |
| F-AG3 | **Context engineering / memory under-developed.** "Context is the interface" is a one-liner; 2026 has concrete machinery — **compaction**, tool-result clearing, **memory tiers** (working/long-term/vector). ([Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)) |
| F-AG4 | **Durable execution / checkpointing for agents absent.** The dominant 2026 production pattern for long-running agents that survive failure and resume; OpenAI Agents SDK + Temporal GA Mar 2026. ([durable agents](https://agentmarketcap.ai/blog/2026/04/10/durable-agent-execution-production-temporal-modal-event-sourced)) |
| F-AG5 | **Prompt-injection threat model output-only.** Missing indirect/RAG injection, tool poisoning, cross-agent propagation (~48% of co-running agents), gateway-layer defense. OWASP **LLM01** three years running. ([prompt injection 2026](https://www.getmaxim.ai/articles/prompt-injection-defense-for-production-ai-agents-a-complete-2026-guide/), [MS: prompts become shells](https://www.microsoft.com/en-us/security/blog/2026/05/07/prompts-become-shells-rce-vulnerabilities-ai-agent-frameworks/)) |
| F-AG6 | **AI gateway absent** as an architectural layer (token-aware L7 proxy: routing, fallback, budgets, semantic caching, guardrails, audit). ([AI gateway](https://jimmysong.io/blog/ai-gateway-in-depth/)) |
| F-AG7 | **RAG taxonomy thin.** "Retrieval > model" is right but flat; 2026 expects naive→advanced(hybrid/re-rank)→agentic→adaptive + **GraphRAG** (−62% hallucination). ([RAG patterns 2026](https://ailearningguides.com/rag-production-patterns-2026/)) |
| F-AG8 | **AI ops cross-cut:** LLM **reliability** (semantic failures return 200-OK; parallel error budgets per SLI), **observability** (OTel **GenAI semantic conventions** — token usage, prompt/response, eval traces, MCP spans), **cost** (model routing ≤190× delta, semantic caching ~73%, output≈4× input token cost). ([OTel GenAI](https://opentelemetry.io/blog/2026/genai-observability/), [LLM cost](https://www.getmaxim.ai/articles/reduce-llm-cost-and-latency-a-comprehensive-guide-for-2026/)) |

### Enforcement / governance shift
| ID | Finding |
|---|---|
| F-GOV1 | **Fitness functions / architecture-as-code absent.** The 2025–26 reframe: ADRs and the hexagonal inward-dependency rule need CI-enforced checks (ArchUnit family, Spectral, dependency tests). "Record documents; fitness function assures." Natural partner to our just-shipped `decision-records`. ([Evolutionary Architectures 2e](https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/ch04.html), [fitness functions](https://developersvoice.com/blog/architecture/architectural-fitness-functions-automating-governance/)) |
| F-GOV2 | **Contract *testing* absent.** Contract-first authoring without consumer-driven/bi-directional contract tests + a `can-i-deploy` gate + Spectral lint is half the loop. Biggest API gap. ([contract testing](https://totalshiftleft.ai/blog/what-is-api-contract-testing)) |
| F-GOV3 | **Governance operating model unstated.** "Governed ADRs" risks implying a centralized review board; 2026 moved to **advice process / guild / lightweight RFCs**. ([advice process](https://www.infoq.com/articles/decentralized-architecture-advice-process)) |

### Structural blind spots (whole topics absent)
| ID | Finding |
|---|---|
| F-STR1 | **Surface/frontend architecture absent** — the skill is backend-only. BFF, micro-frontends, islands/RSC (RSC-as-BFF), design-system-as-architecture, AG-UI surfaces. (Coordinate with existing design-system + surface-engineer skills — own the *architectural seam*, not UI impl.) ([BFF/RSC](https://dailydevpost.com/blog/backend-for-frontend-rsc-guide)) |
| F-STR2 | **Identity & access architecture absent** (only passing OAuth/tenant mentions). OIDC/OAuth 2.1, **SPIFFE/SPIRE workload identity** (short-lived SVIDs, secretless mTLS), non-human/**agent identity** + delegation. ([SPIFFE](https://www.redhat.com/en/topics/security/spiffe-and-spire), [agent identity](https://stacklok.com/blog/agentic-identity-explained-how-to-apply-spiffe-and-relationship-based-authorization-to-ai-agents-in-2026/)) |
| F-STR3 | **Durable execution / workflow-as-code absent** as a general integration primitive (Temporal/Restate/DBOS-on-Postgres) — replaces hand-rolled saga+outbox+retry glue; shared substrate with F-AG4. ([durable execution](https://www.kai-waehner.de/blog/2025/06/05/the-rise-of-the-durable-execution-engine-temporal-restate-in-an-event-driven-architecture-apache-kafka/)) |
| F-STR4 | **Modernization / evolution absent** — Strangler Fig / brownfield (glaring: GroundWork runs brownfield sims). Pairs with evolutionary architecture. ([strangler fig](https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one)) |
| F-STR5 | **Multi-tenancy / cell-based isolation** only a passing mention. Shared-DB→schema→silo; **cell-based architecture** is the 2026 blast-radius term of art. ([multi-tenant](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)) |
| F-STR6 | **Edge & WebAssembly / compute placement absent.** "Where code runs" is a first-class 2026 decision; Wasm for edge/FaaS/plugins (1–5ms cold start); KEDA/Karpenter event-driven scale-to-zero. ([Wasm 2026](https://platform.uno/blog/the-state-of-webassembly-2025-2026/)) |

### Topic-level improvements to existing references
| ID | Finding |
|---|---|
| F-INT1 | **Integration:** add **dead-letter/poison-message** primitive; modernize **webhooks** (stable event-id idempotency, timestamp replay-window, **rotating keys/JWKS**, CloudEvents); make **backoff *with jitter*** + "retry storm" explicit; add orchestration-vs-choreography step-count rule. ([webhooks 2026](https://www.digitalapplied.com/blog/webhook-reliability-idempotency-retries-engineering-reference-2026)) |
| F-DATA1 | **Data:** add **CDC** (contrast with outbox; no-Kafka direct-ingest), the **AI-era data layer** (vector/embedding stores, RAG pipelines, feature stores, re-embedding/backfill), schema-**registry-enforced** compatibility, and a one-line lakehouse/mesh/**Iceberg** stance. ([CDC](https://factorhouse.io/articles/kafka-cdc-change-data-capture), [vector DBs](https://www.instaclustr.com/education/vector-database/how-vector-databases-enable-rag-and-9-tools-to-know-in-2026/)) |
| F-RT1 | **Real-time:** demote **"WebSockets-default"** to a per-direction rule (**SSE** for server→client incl. LLM token streaming; WS for bidirectional); add the **SSE data-plane / WS-or-gRPC control-plane** LLM streaming pattern; add **CRDTs/local-first** (Yjs/Automerge); mention but **defer WebTransport** (no Safari in 2026). ([SSE vs WS](https://websocket.org/comparisons/), [LLM streaming](https://zylos.ai/research/2026-03-28-llm-output-streaming-token-delivery-architectures/)) |
| F-API1 | **API/contracts:** bind error model to **RFC 9457** (obsoletes 7807) + `Idempotency-Key` header by name; add **protocol-selection** rule (REST edge / gRPC internal / GraphQL-federation composition / tRPC TS-monorepo); sharpen agent-readiness to the canon (token-budget pagination, field selection, MCP **Resources vs Tools**, don't 1:1-wrap endpoints). ([RFC 9457](https://www.rfc-editor.org/info/rfc9457/), [Anthropic tools](https://www.anthropic.com/engineering/writing-tools-for-agents)) |
| F-BND1 | **Boundaries:** state **modular-monolith-default** + a **distributed-monolith smell checklist** + a **consolidation ("merge it back") signal** to balance the split test; map "capability core" to bounded contexts and "converging-signals" to **Team Topologies / Reverse Conway**. ([modular monolith 2026](https://enqcode.com/blog/rethinking-microservices-in-2026-when-modular-monolith-architecture-actually-win)) |
| F-REL1 | **Reliability:** name **cell-based** isolation; SLOs as **living/burn-reviewed** hypotheses w/ multi-window multi-burn-rate; chaos→**continuous verification with automated blast-radius policy**; add LLM/AI reliability. |
| F-PERF1 | **Performance:** multi-tier/CDN/**edge** caching with hit-ratio target; **KEDA/Karpenter** event-driven scale-to-zero; compute-placement axis; token-proportional latency. |
| F-OBS1 | **Observability:** **eBPF/OTel OBI** + profiling as signals; **wide-events / "observability 2.0"** vocabulary; **OTel GenAI** conventions (see F-AG8). |
| F-SEC1 | **Security:** **SPIFFE/workload identity** (see F-STR2); supply chain past SBOM → **Sigstore/cosign + signed provenance** as SLSA levels; **OWASP LLM Top 10 / prompt injection / MCP security** (see F-AG5). |
| F-PLAT1 | **Platform/delivery:** name **OpenTofu/Terraform/Pulumi** + the OpenTofu↔Terraform divergence; **OpenFeature** as the flag standard; **GitOps** (Argo Rollouts vs Flagger) explicit; buy-vs-build IDP reality; **AI gateway** as a control-plane (see F-AG6). |
| F-COST1 | **Cost & sustainability:** add **AI/token cost + AI gateway/semantic caching**; add **carbon-aware / green software** (SCI metric) — best expressed as demand-shaping for carbon, extending the existing demand-shape principle, and a fitness function. ([FinOps for AI](https://www.cloudzero.com/blog/finops-for-ai/), [carbon-aware](https://core.cz/en/blog/2026/carbon-aware-computing-2026/)) |

## Workstreams (each = new/edited principle page in `src/docs/principles/` + distilled architect `references/` + sync-anchor + llms.txt + CHANGELOG, per the `decision-records` pattern)

### P0 — the AI/agentic cross-cut + enforcement
- **WS-A — Split AI into interface + agentic-systems.** Narrow `ai-native-architecture.md` to agent-consumable interfaces + AI-feature principles; add a new **`agentic-systems`** principle page + architect reference: topology (single-agent + stateless subagents; supervisor/worker; anti-pattern naive-multi-agent), **MCP+A2A+AG-UI** stack, context/memory tiers + compaction, durable execution/checkpointing for agents, prompt-injection threat model + guardrails, HITL patterns. (F-AG1–7)
- **WS-B — AI ops cross-cut into existing refs.** reliability (semantic failures, per-SLI budgets), observability (OTel GenAI conventions, token/eval traces), security (OWASP LLM, injection, MCP), performance/platform (AI gateway, semantic caching, model routing). (F-AG8, F-OBS1, F-SEC1, F-PLAT1, F-COST1)
- **WS-C — Enforcement layer.** New **`evolutionary-architecture`** page+reference (fitness functions, architecture-as-code, strangler-fig modernization); add contract-testing + `can-i-deploy` + Spectral to `api-and-contracts`; add the advice-process governance note to `decision-records`. (F-GOV1–3, F-STR4)

### P1 — structural blind spots
- **WS-D — `surface-architecture`** page+reference: BFF, micro-frontends, islands/RSC, design-system-as-architecture, AG-UI (architectural seam only; coordinate with design-system + surface-engineer skills). (F-STR1)
- **WS-E — `identity-and-access`** page+reference (or major `security-and-trust` expansion): OIDC/OAuth2.1, SPIFFE/workload identity, agent/non-human identity. (F-STR2)
- **WS-F — `durable-execution`** page+reference: workflow-as-code, sagas, checkpointing; cross-linked from integration + agentic-systems. (F-STR3, F-AG4)

### P2 — targeted improvements
- **WS-G — integration/data/real-time/API/boundary improvements** (F-INT1, F-DATA1, F-RT1, F-API1, F-BND1): DLQ, webhooks, jitter; CDC + AI-era data; SSE/CRDT/WebTransport; RFC 9457 + protocol selection + agent-readiness; modular-monolith-default + distributed-monolith smell.
- **WS-H — ops improvements** (F-REL1, F-PERF1): cell-based, living SLOs, continuous verification; edge/KEDA/Karpenter/compute placement.
- **WS-I — multi-tenancy** (F-STR5): expand security-and-trust or small new reference; cell-based.

### P3 — emerging / fold-in-first
- **WS-J** — edge & **WebAssembly** + **carbon-aware** folded into performance-and-scale / platform-and-delivery first; promote to standalone only if they earn it. (F-STR6, F-COST1)

## Decisions
**Settled (research-backed):**
- **Nothing is removed.** All 12 references map to durable 2026 concerns. "Remove" = reframes only (WebSockets-default → per-direction; don't imply WebTransport-ready / centralized-ADR-gatekeeper / authoring-without-enforcement; stop overloading ai-native-architecture).
- Each add ships as the `decision-records` pattern did: principle page in `src/docs/principles/` (canonical) → distilled, self-contained architect `references/` (sync-anchored) → llms.txt + CHANGELOG.
- The architect stays advisory; it *advises* fitness functions / contract tests / durable execution — it does not implement them (engineer skills do).

**Open (need your call):**
- Sequence/scope: do P0 only first, or P0+P1? (P0 alone is already ~3 new pages + edits to 4 references.)
- `surface-architecture` (WS-D): new architect reference vs deferring to the design-system + surface-engineer skills — risk of overlap.
- `identity-and-access` (WS-E): standalone page vs expanding `security-and-trust`.
- Depth of the manifesto changes: how many of these become new first-class `src/docs/principles/` pages vs architect-reference-only additions.

## Gates / sequencing
P0 → P1 → P2 → P3. Each WS is independently shippable and self-verifying: `./dev test contracts` (sync-anchor + llms/changelog), fresh-`init` install check, and the Sandbox-Problem read-back (no domain leakage). Live greenfield + bet-design sims after P0 to confirm the agentic guidance lands.
