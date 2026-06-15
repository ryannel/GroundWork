---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-06-12"
---

# GroundWork and BMAD

GroundWork and BMAD solve the same problem — disciplined AI-driven development from idea to working code — with different delivery models and different executable layers. BMAD models development as an agile team of named AI personas and **does deliver**: its implementation phase runs story-by-story through a complete workflow suite — per-story context assembly, a test-first dev loop with definition-of-done gates, three-layer parallel code review, sprint-status tracking, retrospectives. GroundWork runs the same upstream conversation, then delivers through contract-locked bets against generated, booted, health-checked infrastructure. The real differences are the **unit of delivery** (stories versus bets with locked designs) and the **executable layer** (BMAD ships instruction workflows only; GroundWork additionally ships generators, a dev CLI, and a system-test harness the delivered code must run inside).

> **Correction (2026-06-10):** an earlier revision of this document claimed BMAD is a "process framework" whose output "stops at documents." That was a research error — the analyzed v6.6 clone carries a full implementation phase (`src/bmm-skills/4-implementation/`: sprint planning, story creation, dev-story, code review, correct-course, retrospectives). The comparison throughout this document reflects the corrected reading, and the delivery-loop mechanics worth adopting are folded into [the contract-grade delivery plan](plans/contract-grade-delivery.md).

**Verdict: GroundWork should remain standalone.** The full reasoning is in [Standalone or extension](#standalone-or-extension), but the short version: the half of GroundWork that BMAD's extension system could host is the half that is least differentiated, and the two frameworks disagree at the methodological core — agile stories versus contract-first bets. What GroundWork should take from BMAD is its operational maturity (release engineering, customization without forking, shipped quality checklists, a help surface — the spine of [the quality uplift plan](plans/bmad-quality-uplift.md)) and the strongest mechanics of its delivery loop (machine-tracked story status, per-story context capsules, triage-based review, retrospective follow-through — adopted in [the contract-grade delivery plan](plans/contract-grade-delivery.md)).

---

## What BMAD is

BMAD (Breakthrough Method for Agile AI-Driven Development) is an open-source framework — 43K+ GitHub stars, MIT licensed, v6.8 as of May 2026 — that models software development as an agile team of named AI personas: Mary the analyst, John the PM, Winston the architect, Sally the UX designer, Amelia the developer, Paige the tech writer. Work flows through four phases (Analysis → Planning → Solutioning → Implementation), each producing a versioned artifact: brief, PRD, architecture, epics and stories, code, tests. The reference clone analyzed for this document (v6.6; kept outside this repo) carries 42 skills, 38 templates, 12 quality checklists, and 89 step files. The v6.6→v6.8 delta is a web-bundle release packager plus fixes — nothing that changes this comparison.

Its operational machinery is its real strength. A three-tier TOML customization hierarchy (base → team → personal) lets users reshape any agent or workflow without forking. A module system (BMM core, test architect, game dev, creative, builder) plus third-party expansion packs extend it into new domains. An interactive installer remembers answers, supports CI, and upgrades cleanly across frequent releases. Web bundles deploy subsets to ChatGPT and Gemini. Every workflow is indexed in a help system that tells the user where they are and what comes next.

Its known weaknesses are the inverse of its discipline: ceremony overhead for small work (partially answered by its own `bmad-quick-dev` lane and stakes-calibrated PRD depth), context bloat from feeding comprehensive artifacts into every downstream step, and prescriptive phases that fit exploratory work poorly. Its structural gap is the executable layer: BMAD ships no scaffolding, no generators, and no boot harness — the dev workflow implements into whatever environment the user's agent provides, and its generated QA tests run against that environment rather than a framework-provisioned, health-checked topology. Delivery discipline is enforced by instructions and checklists, not by tooling: nothing machine-verifies that tests existed before code, that the implementation stayed inside the architecture's contracts, or that the story file's claims (file lists, completion notes) match the repo.

---

## How they differ

### Methodology: stories versus bets

BMAD's spine is agile: PRD → epics → stories → sprints. Delivery is genuinely worked out: `sprint-planning` parses the epics file into a machine-tracked `sprint-status.yaml` state machine (backlog → ready-for-dev → in-progress → review → done); `create-story` assembles a per-story context capsule (epic requirements, architecture guardrails, the previous story's learnings, git history, just-in-time web research); `dev-story` implements red-green-refactor with a fail-closed definition-of-done; `code-review` runs three parallel adversarial layers (a blind diff-only hunter, an edge-case path tracer, an acceptance auditor checking the diff against the story's criteria) and triages findings into decision-needed / patch / defer / dismiss buckets. The embedded assumption is that every unit ships customer value on completion, and that the story file — spec, work tracker, review record, and completion log in one — is the contract.

GroundWork rejects story-driven development deliberately. Delivery runs on **bets with appetites** (Shape Up lineage): a Milestone is a flag-gated internal proof point, a Slice is a contract-defined API contribution testable before anything consumes it. Architectural context is established once during setup and refined through living documents, instead of being re-derived inside every story. This is not a stylistic difference — it is each framework's answer to the same failure mode (AI context collapse during implementation), and the answers are incompatible.

The test discipline divides the same way. In BMAD, the implementing agent writes tests *during* implementation — red-green-refactor inside each story task, gated by a definition-of-done checklist the same agent fills in. In GroundWork, the proof suite is written *before* implementation in a separate Decomposition phase, reviewed as its own artifact, and the Delivery phase implements only to turn it green. BMAD locks scope per story and trusts the dev loop; GroundWork locks the design and the tests, and treats the dev loop as untrusted until the pre-agreed suite passes.

### Team model: persona troupe versus expert peer

BMAD distributes the methodology across six named personas the user addresses in turn; the handoffs between them are the phase boundaries. GroundWork uses a single expert-peer facilitator that loads the right hidden skill per phase and dispatches isolated subagents only where independence has value (the review panel, the brownfield scan fan-out). One conversation, one stance, no persona switching cost — and no temptation to roleplay the org chart.

### Context economy

GroundWork's two-layer skill architecture registers exactly two skills in the agent toolchain (the orchestrator and the drift checker); eighteen methodology skills load on demand and cost nothing until invoked. BMAD installs its full skill surface, and its own community names context bloat as a top criticism. For agent-native tooling, always-on context is the scarcest resource; this is a structural advantage GroundWork should protect.

### Multi-surface delivery

GroundWork models every product as one capability core plus zero or more **surfaces** — the deployed artifacts consumers interact with (web app, CLI binary, mobile app, MCP server). The model is load-bearing across the lifecycle: architecture commits a surface registry (`docs/surfaces.md` with a machine-readable twin), the design system runs one track per interface type in use, scaffolding generates one app per surface, bets declare surface scope and type their milestones (capability proofs at the contract, surface proofs per medium), and validation fills a capability ledger that records, per capability and surface, `delivered`/`planned`/`omitted`/`n/a` — so a feature shipping on web but not mobile is a decision on record, not silent drift. A dedicated activation flow (`groundwork-surface-activation`) handles adding a surface to a live product, and `./dev surface status` renders the parity picture on demand.

BMAD has no equivalent concept: its PRD, architecture, and stories describe one application, and nothing in its workflow suite tracks which clients a capability reached or gates a story's completion on deciding the question. For a single-interface product the difference is invisible — GroundWork's registry holds one entry and adds no ceremony. For a product with a web app, a CLI, and a mobile client, it is the difference between parity being tracked and parity being presumed.

### Where each one stops

| Dimension | BMAD | GroundWork |
|---|---|---|
| Planning output | PRD, architecture doc, epics, stories | Product brief, design system + brand tokens, architecture, infrastructure map |
| Delivery loop | Story workflow suite: per-story context capsule, test-first dev loop with definition-of-done gates, three-layer parallel code review with triage, sprint-status tracking, retrospectives | Five-phase bet loop: locked technical design, pre-written reviewed proof suite, slice-by-slice delivery to green, validation with Living Documents updates |
| Execution environment | Whatever the user's agent provides — no scaffolding, generators, or boot harness ship with the framework | Nx generators emit compiling services; Docker topology boots and health-checks; system tests run inside it |
| Multi-surface products | No surface model — epics and stories carry no per-client scope or parity record | Surface registry + capability ledger (`docs/surfaces.md` and its JSON twin), per-type design tracks, capability/surface milestone typing, ledger-gated bet validation, surface-activation flow |
| Brownfield | Document-project workflow (describe the codebase) + project-context generation | Full reverse-engineering path: semantic scan via Serena MCP, four extract phases, additive infra adoption, gap ledger |
| Doc currency | Versioned artifacts, decision logs, manual upkeep | Living Documents protocol + `groundwork-check` staleness detection in CI |
| Verification of the framework itself | Headless evals (artifact-correctness + process-discipline patterns), deterministic skill validator, installer test suite | Generator/compilation/boot test harness, simulation suites with personas, transcript review + judge rubric |

### Where BMAD is simply ahead

Maturity. BMAD has semver releases at a fast cadence, a changelog, an installer with an upgrade path, a published docs site, a customization system, an extension mechanism, a help index, shipped quality checklists for every major artifact, 19+ elicitation techniques, multi-platform distribution, and a large community. GroundWork has none of these yet — its versioning is a hardcoded `1.0.0`, its CLI `update` command is a stub, and it has no README. None of these gaps are architectural; all of them are work. That work is enumerated in `docs/plans/bmad-quality-uplift.md`. [Update 2026-06-10: the quality-uplift plan closed these gaps — v0.9.0 ships semver + CHANGELOG + a release workflow, a real `update`/`check`, a README, shipped checklists, and a customization surface; see the plan for the ledger.]

---

## Standalone or extension

BMAD's module system is genuinely capable: a module ships agents, workflows, templates, and checklists; the customization hierarchy lets it override core behavior; the installer distributes it. A "GroundWork module for BMAD" is technically constructible. It is still the wrong move, for four reasons.

**1. The extension seam captures the wrong half.** A BMAD module is personas + workflows + templates — instruction files. GroundWork's methodology skills could be translated into that shape. But GroundWork's differentiation is the executable half: generators that emit compiling services, the bundled `./dev` CLI, the Docker boot harness, generated system tests, Serena's LSP code map, the brownfield adoption machinery. BMAD's module system has no concept of shipping, versioning, or testing code generators. The part that fits the seam is the part BMAD already does well; the part that doesn't fit is the reason GroundWork exists.

**2. The methodological core conflicts.** A module extends its host's mental model; it does not contradict it. GroundWork-as-module would sit inside a framework whose vocabulary is epics, stories, and sprints while teaching users that stories are the failure mode it was built to avoid. Either GroundWork adopts the host's vocabulary (and loses its delivery model) or fights it (and confuses every user who reads both). BMAD's Scale Adaptive Framework routes work in agile terms; GroundWork's orchestrator routes in lifecycle terms. Two routers with different world-models in one project is a coherence failure, not a feature.

**3. Coupling to a fast-moving host.** BMAD shipped v6.6 → v6.8 in a month and has a history of breaking majors. An extension chases that churn forever, on someone else's schedule, through someone else's review process. GroundWork has not yet versioned its own operating contract; chaining it to an external release train compounds the problem instead of solving it.

**4. It doubles the context bill.** Installing BMAD core plus a GroundWork module loads two frameworks' always-on surface. Context bloat is the most-cited BMAD criticism, and context economy is one of GroundWork's structural advantages. An extension spends that advantage to acquire the host's weakness.

### What to do instead: interoperate and adopt

Standalone does not mean isolated. Three moves capture most of the extension's upside at none of its cost:

- **Accept BMAD artifacts as brownfield input.** A repo carrying a BMAD PRD and architecture doc is a brownfield project with unusually good docs. The extract skills' Adopt/Upgrade mode already exists for exactly this shape — ingest the existing document, fill the missing contract sections, re-stamp, review, commit. Naming BMAD explicitly as a supported migration source costs little and gives every BMAD user a path in.
- **Adopt BMAD's proven operational mechanics.** Release engineering, the customization hierarchy, shipped checklists, a help index — these are methodology-neutral and battle-tested at 43K-star scale. The uplift plan adopts each one. The same applies to its delivery-loop mechanics: machine-tracked status, per-unit context capsules, baseline-commit capture, triage-based review with a deferred-work ledger, and retrospective follow-through translate cleanly into bet vocabulary without importing the story model — `plans/contract-grade-delivery.md` Workstream H carries that adoption.
- **Revisit the persona backlog with this lens.** A then-extant TODO list sketched BMAD-style personas (`groundwork-pm`, `groundwork-architect`, …); decision D2 in `docs/plans/bmad-quality-uplift.md` superseded that backlog. The single-facilitator model is a deliberate design bet that has tested well; persona names should only return as labels on subagent dispatches (review panel, scan fan-out) where isolation already exists — not as a user-facing troupe.

A future distribution experiment — packaging GroundWork's facilitation subset as a BMAD-compatible bundle to reach that community — remains possible precisely because the core stays standalone. Build the standalone quality first; a bridge is only worth crossing toward something solid.
