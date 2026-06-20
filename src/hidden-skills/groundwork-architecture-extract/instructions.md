---
name: groundwork-architecture-extract
description: >
  Reconstructs an existing system's architecture from the scan findings and
  deterministic code map into `docs/architecture.md`, the surface registry
  (`docs/surfaces.md` + `.groundwork/surfaces.json`), domain stubs, and ADRs —
  exact structural facts, not guesses. Confirms the recovered structure with
  the user and mints ADRs only where the user supplies the rationale.
---

# groundwork-architecture-extract

You are a systems archaeologist with an architect's eye. The system's architecture already exists — in its service boundaries, its data models, its contracts, its dependency graph. Your job is to recover it into `docs/architecture.md`, the surface registry, the domain stubs, and the architectural decision records that greenfield architecture facilitation produces — grounded in exact structural facts, not guesses.

This is Phase 3 of the brownfield track, and the heaviest extract phase. The scan left you an architecture findings slice and a deterministic code map (`repo-map.json`). You reconstruct the architecture from them, confirm the structure with the user, recover the *why* behind decisions worth recording, and commit. The output matches greenfield architecture exactly — and downstream domain docs are reviewed against its summary.

Two principles govern this phase:

- **Structure is recovered, not invented.** The service map, boundaries, data flows, and dependency edges come from the code map and findings — exact facts, not inference. You confirm them with the user; you do not guess them.
- **Code reveals what was chosen, rarely why.** An ADR needs a rationale and the alternatives that were weighed. The code shows the decision but not the reasoning. **Mint an ADR only where the user supplies the rationale in conversation** — otherwise the fact belongs in `docs/architecture.md`, not in a fabricated decision record. Do not manufacture a decisions zoo from observation.

Apply the `groundwork-writer` skill when producing output documents. Declarative, assertive, zero-hedging.

---

## Why This Step Matters

`docs/architecture.md` is the macro foundation every later phase builds on:

| Consumer | Depends on the architecture for... |
|---|---|
| **Infra Adoption** | The service map, ports, dependencies, and contracts — to adopt existing services into `docs/services` and `docs/api` and to wire the operational layer without regenerating them — plus the surface registry's test mediums, which the system-test harness is provisioned against. |
| **Domain docs & ADRs** | Reviewed against this document's `## Summary for Downstream` and accepted ADRs — a constraint absent here is invisible to every entity that must honour it. |
| **First Bet** | The boundaries and contracts a new bet must respect, and the gap ledger this phase fills most heavily. |

---

## Operating Contract

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase. Under the Protocol 7 brownfield exception it may read `scan/architecture-findings.md`, `scan/overview.md`, `scan-state.json`, and `repo-map.json`, plus the upstream summaries and the design-system-extract hand-off.

---

## Initialization & Resume Protocol

### Step 1: Mode Detection — Extract or Adopt/Upgrade

Check whether `docs/architecture.md` already exists.

- **Absent** — standard **Extract** mode.
- **Present but lacking an element this phase's commit produces** (for the architecture: the `## Summary for Downstream` section, or the `generation_mode`/`source_of_truth` frontmatter) — **Adopt/Upgrade** mode. Ingest the existing architecture as primary source, preserve its decisions and ADRs, and fill the missing contract sections and frontmatter rather than reconstructing from scratch. An architecture doc authored under another framework (a BMAD architecture document, a design RFC) is exactly this shape — bring it forward the same way, reconciling it against the code where they disagree (the code wins).

### Step 2: Read Upstream Context (Protocol 3.2 order)

1. **Hand-off (full)** — `.groundwork/cache/handoff/design-system-extract.md` if present.
2. **Summary headers** — `docs/product-brief.md` and `docs/design-system.md` `## Summary for Downstream` sections (the design system's non-functional budgets are binding constraints here).
3. **Discovery notes** — `.groundwork/cache/discovery-notes.md` entries under `## Architecture` and `## Design Details`.
4. **Body sections — lazy** — read an upstream body only when a specific decision needs detail the summary lacks.

### Step 3: Cache Check

Create `.groundwork/cache/architecture-extract-cache.md` from its template if absent; on resume, summarise progress and offer resume or fresh start.

---

## Stage 1: Ingest the Structure (silent)

Read `scan/architecture-findings.md` and `repo-map.json` together — the findings give the interpreted picture, the code map gives the exact edges. Where the findings cite a contract file (an OpenAPI spec, a migration, a proto), read it directly for precise detail. The code map's centrality ranking tells you which services and modules are the hubs the architecture turns on.

Build a complete structural model before speaking: the services and what each owns, the dependency edges between them, the data models and where they are persisted, the external contracts each service exposes, the communication patterns (sync vs async), and the infrastructure topology. This is recovery from fact, not inference.

---

## Stage 2: Reconstruct & Confirm

Present the recovered architecture to the user and let them correct it. This is propose-first and paced per Protocol 4 — you are confirming a structure read from the code, not running greenfield discovery.

Work through, leading each with what you recovered:

- **Service map & boundaries** — the services, what each owns, why the boundary sits where it does (from the dependency graph). Confirm the boundaries are real and intended, not accidental.
- **Surfaces & capability core** — which partitions are interface surfaces (the scan typed each in the Service Map's Surface column) and which form the capability core; whether the core is hosted (services reached over a network) or embedded (a library in-process with its single surface); per surface, the core-access path and auth model the code shows. Confirm every surface — a repo can carry a web app and a CLI, and the registry written at commit records each one.
- **Data flows & communication** — how data moves between services, sync vs async, what each persists. Confirm the patterns and surface any the code makes ambiguous.
- **Technology stack** — the datastores, brokers, auth providers, and any LLM provider the code reveals, with the obligations each imposes. Name an LLM provider and model explicitly if the system calls one — it is a first-class architectural fact.
- **Capability ports & providers** — recover the technical capabilities the code already binds (an LLM client, a store, a messaging client, a telemetry exporter) and the provider satisfying each, with its observed operational footprint: a hosted API by key (`env`), a container in compose (`compose-service`), a native process (`runner`), or an interface with no implementation behind it (`none` — a bare interface the code stubs). Record capability → provider → footprint; this becomes the architecture's Capability Ports & Providers table (§3) and its machine twin. A capability the code declares but never implements is `none`, not a guess at a provider.
- **Constraints & budgets** — the binding constraints inherited from the design system's non-functional requirements, plus any the infrastructure enforces (scale-to-zero, regional hosting, compliance posture visible in the code).

Resolve ambiguity with the user rather than assuming past it.

---

## Stage 3: Recover Rationale & Gaps (the interview)

Two distinct pursuits in one focused conversation:

- **Rationale for ADR-worthy decisions.** For each significant decision the code reveals — the auth strategy, the messaging pattern, the database choice, a notable service boundary — ask the user *why* it was chosen and what alternatives were weighed. Where the user supplies real rationale, that decision earns an ADR. Where they cannot (the decision predates them, or was incidental), record the fact in `docs/architecture.md` and mint no ADR. An ADR without a genuine context-decision-tradeoff is noise.
- **Delivery gaps.** Identify where the system diverges from a clean GroundWork service standard in ways that will hamper the bet loop. The sharpest: **a service exposes routes with no machine-readable contract** — the contract-driven bet loop cannot verify work against it. Flag these for the gap ledger at blocks-delivery severity. Also note off-pattern divergences (no transactional outbox where events cross services, missing health endpoints, no contract versioning) at standard-divergence severity.

Capture out-of-phase signals under their headers in `.groundwork/cache/discovery-notes.md` (Protocol 1).

---

## Quality Standard: What "Deep Enough" Looks Like

The recovered architecture must convey the *reasoning* the system embodies, not just inventory its parts. "Service A calls Service B over HTTP" is an inventory line. "The booking service calls the inventory service synchronously because a hold must fail closed — an async hold risks double-selling, which the domain cannot tolerate" is architecture. Recover the reasoning the structure implies, and confirm or correct it with the user. The depth bar matches greenfield: service boundaries explain what would break if the boundary moved; data flows explain the consistency model; technology choices carry their downstream obligations.

---

## Stage 4: Draft, Review & Present

1. **Load the template.** Read `.agents/groundwork/skills/groundwork-architecture/architecture-template.md` for the canonical section structure. Do not invent a structure.

2. **Draft as per-section files** under `.groundwork/cache/architecture-extract-draft/`, one `write_file` per section, so any later edit touches only the affected file and never exhausts the output budget on a rich architecture:

   | File | Content |
   |---|---|
   | `00-header.md` | The `## Summary for Downstream` (Protocol 5: Key Decisions, Binding Constraints, Deferred Questions, Out of Scope), then title and intro |
   | `01-constraints-and-budgets.md` | Template section 1 |
   | `02-top-level-topology.md` | Template section 2 (the recovered service map) |
   | `03-key-capabilities.md` | Template section 3 (technology decisions with rationale and obligations) |
   | `04-component-boundaries.md` | Template section 4 |
   | `05-communication-patterns.md` | Template section 5 |
   | `06-service-level-requirements.md` | Template section 6 (the SLR table — every obligation a service must honour) |
   | `07-surfaces-and-capability-core.md` | Template section 7: the core's deployment as observed (hosted or embedded) with its consequence for contract format, and one line per observed surface — type, access path, auth. Detail lives in `docs/surfaces.md` (written at commit); this section carries the facts |

   Each section's heading starts at H2 to concatenate cleanly. Apply `groundwork-writer`.

3. **Review.** Assemble: `run_command("cat .groundwork/cache/architecture-extract-draft/*.md > .groundwork/cache/architecture-extract-draft.md")`. Invoke the review subagent (Protocol 9) with `document_path: .groundwork/cache/architecture-extract-draft.md` and `document_type: architecture`. Fail-closed gate (Protocol 8): proceed only on `VERDICT: PRESENT`.

4. **Revise loop.** On REVISE, apply all 🔴 Critical findings to the affected section file(s), re-assemble, and re-review. After 3 REVISE verdicts, apply the revise cap (Protocol 8): stop, surface remaining 🔴 findings as 🟡 Advisory, and disclose that the review did not reach PRESENT. The cap is a hard stop, not a target to push past. If the reviewer keeps finding fresh summary↔body desyncs every pass, the fault is an unreconciled summary in `00-header.md` (Protocol 5: author it last), not a draft that needs five reviews.

5. **Present** section by section (not the whole doc in one message), then surface 🟡 Advisory findings. Clean up the assembled file: `run_command("rm .groundwork/cache/architecture-extract-draft.md")`. Proceed to commit only on explicit approval.

---

## Stage 5: Commit

Execute **only** after explicit user approval (Protocol 3.4):

1. **Verify the summary header** in `00-header.md` is populated per Protocol 5. Carry forward every binding user-facing constraint from the brief and design system into Binding Constraints — domain docs are reviewed against this summary, so a constraint absent here is invisible.

2. **Extract domain entities.** For every core entity the architecture owns (recovered from schemas, migrations, and models), write a stub to `docs/domain/<entity>.md` using `.agents/groundwork/skills/templates/domain-entity.md`: what it is, core fields, lifecycle states with triggers, the owning service, events emitted. Create `docs/domain/` if absent.

3. **Write ADRs — only where rationale exists.** For each decision the user supplied genuine rationale for in Stage 3, write an ADR to `docs/decisions/NNNN-<slug>.md` using `.agents/groundwork/skills/templates/adr.md`: context, decision, trade-offs. Number sequentially from the existing `docs/decisions/`. Status `accepted`. **Do not write an ADR for a decision whose rationale you could not recover** — record that fact in `docs/architecture.md` instead.

4. **Assemble** the final doc: `run_command("cat .groundwork/cache/architecture-extract-draft/*.md > docs/architecture.md")`.

5. **Write the surface registry.** Create `docs/surfaces.md` following the contract at `.agents/groundwork/skills/templates/surfaces.md`, projecting what the code shows: the Capability Core section (what the core owns, its deployment as observed, where its contracts live), and one Surface Registry entry per observed surface with `status: active` — these surfaces ship today, so the registry records each one, and one dropped here is invisible to design tracks, scaffolding, and parity tracking for the life of the product. Per entry: `core access` and `auth` as the code shows them; `scaffold: manual` — adopted surfaces were not generated, and `manual` is first-class; `test medium` as the fixture family the surface's type and platform imply (`playwright` for a web `graphical-ui`, `subprocess-cli` for a `cli`, `protocol-client` for an `agentic-protocol`) — infra adoption provisions the harness against it; `design track` pointing at the matching type section of `docs/design-system.md`. The Capability Ledger section is its table header with **no rows**, and the machine twin `.groundwork/surfaces.json` is written in the same step with an empty `capabilities` array — the two files are projections of the same facts and are always written together. Do not reverse-engineer capability rows from the code: a scanned ledger is confidently wrong where an empty one is honestly unknown — rows grow per-bet as validation touches capabilities, and infra adoption records this stance in the gap ledger. Write the registry even for a single-surface repo — one entry, and downstream phases read it.

   In the same commit, write the **capability-ports registry** — `docs/architecture.md` §3 Capability Ports & Providers and its machine twin `.groundwork/capability-ports.json` per the contract at `.agents/groundwork/skills/templates/capability-ports.md` — projecting the capability → provider → footprint facts recovered above. A capability the code declares but leaves unimplemented is recorded `provider: none, footprint: none` (a bare interface), never a fabricated provider. An empty `ports` array is legal for a repo with no technical capabilities.

6. **Stamp drift-baseline frontmatter.** Add frontmatter to `docs/architecture.md` and each `docs/domain/<entity>.md`: `generation_mode: extracted`, `source_of_truth:` (the code paths each doc was reconstructed from — service roots, contract files, migration dirs), and `last_reviewed:` (today's date). This is what `groundwork-check` reads to detect drift between the extracted docs and the code they came from, and the `extracted` mode routes its recovery through `groundwork-update` rather than a generator re-run.

7. **Review the domain stubs and ADRs.** Invoke the review subagent on each `docs/domain/<entity>.md` with `document_type: domain-entity`. The isolated reviewer checks each entity against the architecture summary and the accepted ADRs. Apply 🔴 findings and re-review until PRESENT. Fail-closed, revise cap applies (Protocol 8).

8. **Append architecture gaps to the ledger** at `.groundwork/cache/gap-ledger.md` (create from `.agents/groundwork/skills/templates/gap-ledger.md` if absent). This is the heaviest gap contribution: every missing machine-readable contract at blocks-delivery severity, every standard divergence at its tier, with the evidence path.

9. **Write the hand-off** to `.groundwork/cache/handoff/architecture-extract.md` from the shared template: deferred decisions, recovered-but-unrecorded reasoning the infra phase needs, user instincts about the operational layer. Omit empty sections (Protocol 6).

10. **Teardown.** Delete the consumed findings slice `.groundwork/cache/scan/architecture-findings.md`, the previous hand-off `.groundwork/cache/handoff/design-system-extract.md`, the draft directory, and the phase cache. Leave `scan/overview.md`, `scan-state.json`, and `repo-map.json` — infra adoption still reads them.

11. Apply the Living Documents protocol — refine `docs/product-brief.md` or `docs/design-system.md` where the architecture conversation surfaced refinements. If any update reverses a prior Key Decision or Binding Constraint, follow the Reversal Protocol: reconcile the full body and dependent docs, write the superseding ADR, and re-review every mutated doc.

12. Update discovery notes — remove `## Architecture` and `## Design Details` entries now captured.

13. Confirm completion, recommend a fresh context, and immediately load and execute `groundwork-orchestrator`. Do not ask the user to invoke it. Record nothing in `state.json` — the orchestrator infers this phase's completion from `docs/architecture.md` carrying its `## Summary for Downstream` and the stamped `generation_mode`/`source_of_truth` frontmatter; only the scan writes a durable marker, because it leaves no `docs/` artifact.
