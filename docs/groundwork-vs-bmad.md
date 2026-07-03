---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-07-03"
---

# GroundWork and BMAD

GroundWork and BMAD solve the same problem — disciplined AI-driven development from idea to working code — with different answers to three questions: **where the human's judgment is spent**, **what the unit of delivery is**, and **what the framework itself executes**. BMAD models development as an agile team of AI personas working through document contracts; the human coaches at phase gates and reviews what agents produce. GroundWork puts the human at every design altitude of every bet, locks what they approved as the execution contract, and delivers into generated, booted, health-checked infrastructure the framework itself ships.

This document compares the two as they stand: BMAD v6.9 (read from a reference clone kept outside this repo) and GroundWork 0.13.0 (this repo, `main`).

**Verdict: GroundWork remains standalone.** BMAD's extension system could host GroundWork's instruction half — but that is the least differentiated half, and the two frameworks disagree at the methodological core. The full reasoning is in [Standalone or extension](#standalone-or-extension); what GroundWork takes from BMAD instead is its operational maturity and the strongest mechanics of its context machinery.

---

## What BMAD is

BMAD (Breakthrough Method of Agile AI-Driven Development) is an open-source, MIT-licensed framework — v6.9 as of June 2026, on a roughly monthly minor-release cadence, with a sizeable community and a third-party module ecosystem. It models software development as an agile team of named AI personas (analyst, PM, UX designer, architect, developer, tech writer) working through four phases — Analysis → Planning → Solutioning → Implementation — each producing a versioned artifact: brief or PRFAQ, PRD, UX spines, architecture spine, epics and stories, code, tests. The suite spans 13 core skills and 31 method-module skills, plus five official external modules (test architecture, agent builder, automation, creative, game dev).

Its design philosophy is **elicit and ratify, not impose**. The PRD scales its depth to stakes. The UX phase produces two peer contracts — `DESIGN.md` (visual identity tokens, per the Google Labs spec) and `EXPERIENCE.md` (information architecture, flows, states, interactions, accessibility) — distilled from an elicitation memlog rather than authored top-down. The architecture workflow produces a deliberately minimal "spine of invariants": it fixes only the decisions that would let independently-built units diverge (paradigm, boundaries, dependency rules, state mutation, shared-data ownership) and explicitly treats everything structural as seed — in its own words, *"everything structural (stack, tree, full data shape) is seed: true at cold-start, owned by the code once it exists."*

Its context machinery is genuinely engineered. Every workflow is a SKILL.md-based skill with step-file just-in-time loading (one step in context at a time, sequence enforced). Append-only memlogs (`memlog.py`, atomic writes, no edit or delete by design) carry working memory across sessions, and deliverables are derived from the memlog rather than hand-patched. Subagents write full artifacts to files and return compact summaries, so the parent never holds their text. A three-layer TOML customization hierarchy (skill defaults → team → personal, merged by `resolve_customization.py`) reshapes any skill without forking, with a guided `bmad-customize` authoring skill on top.

The implementation phase is a complete story loop: `sprint-planning` parses epics into a machine-tracked `sprint-status.yaml` state machine; `create-story` assembles a per-story context capsule (requirements, Given/When/Then acceptance criteria, task breakdown, baseline commit) designed for zero user intervention; `dev-story` runs the story to completion in a single unattended execution against a definition-of-done; `code-review` runs parallel adversarial lenses (blind hunter, edge-case hunter, acceptance auditor) and triages findings; `checkpoint-preview` walks a human through the change afterwards; `retrospective` feeds action items back into the sprint state. A `quick-dev` express lane handles small work, and `dev-auto` runs one full iteration with no human present.

Where machines enforce and where instructions do: the memlog's append-only property, the spine linter (`lint_spine.py` — placeholders, duplicate decision IDs, unpinned versions), the customization merge, and a 12-check skill validator are deterministic. Test-first discipline, definition-of-done, and whether review findings get applied are instruction-enforced — checklists the implementing agent fills in, backstopped by adversarial review rather than tooling.

Its structural boundary is the executable layer: BMAD ships no scaffolding, no code generators, no dev CLI, and no boot or test harness. The dev workflow implements into whatever environment the user's agent provides, and nothing machine-verifies that the delivered code runs, boots, or stays inside the architecture's contracts.

---

## What GroundWork is

GroundWork is an npm-installed method (`groundwork-method`, v0.13.0, pre-1.0, published via OIDC trusted publishing with provenance) that registers exactly two always-on skills in the agent toolchain — an orchestrator that routes on project state, and a drift checker — plus 23 hidden methodology skills loaded on demand and five per-stack engineer skills promoted into a project only when its stack needs them.

Setup runs one of two converging paths. Greenfield: product brief → design system (brand tokens plus one design track per interface type) → architecture → scaffolding → first-bet pitch. Brownfield: a deterministic scan (tree-sitter structural map with import graph and centrality ranking, LSP-backed symbol queries via Serena) followed by three extract phases that distill the brief, design system, and architecture from code, then additive infrastructure adoption that wires existing services into the dev tooling and records a maturity baseline. Both paths land in the same delivery loop, with three lanes sized at intake: **patch** (one goal, no contract change, one stamped commit), **quick bet** (compressed single-milestone lifecycle), and **bet**.

A bet runs five phases, each locking the one before: discovery (pitch with problem, appetite, success signal, and stakes), design foundations (an ordered technical-design contract — detailed below), decomposition (a milestone ladder where every rung is a user-visible front-door proof, with only the first milestone sliced), delivery (slice-by-slice execution by isolated workers under independent review lenses, one commit per slice, postmortem at each milestone boundary authoring the next rung from what was learned), and validation (canonical API specs captured from running code, living documents updated, retrospective). Three invariants govern delivery: the **front-door proof** (milestones are proven by driving the real product through the real surface on the real pipeline), **honest green** (the suite passes for the right reason; any fake a proof leans on needs a real test behind it), and the **recorded amendment** (changing what a slice proves is an owner-approved commit with a reason, ratcheting the approved tag — never silent drift).

The executable layer is the half BMAD doesn't have. Eleven Nx generators emit compiling services and surfaces (Go, Python, Next.js, Flutter, Electron, CLI, docs site, test runner, dev CLI, capability port). A bundled `./dev` CLI runs the topology (start/stop/status with Docker health checks), quality gates (test, lint, format, and a security `audit` combining gitleaks and osv-scanner), and bet/surface status. A generated system-test harness boots the composed topology and runs proofs inside it. A deterministic `repo-map` (tree-sitter, 40+ languages) and a Serena MCP registration give every phase a code map that is parsed, not hallucinated. The framework tests itself the same way: generation → contract → compilation → boot-and-health-check e2e layers, plus full-lifecycle simulation suites.

Delivery also carries an explicit **model-tier policy**: planning and every review gate run at the frontier tier (the host's strongest model, set explicitly on every dispatch), while gated execution workers run a tier down — cheap execution is only safe because the gate is never the weak link. Review lenses per slice include a context-starved blind reviewer, an edge-case tracer, a coverage auditor, and an acceptance auditor, with a designer-persona experience auditor judging each assembled milestone against the design system.

What GroundWork does not have, honestly: a community, a published docs site, a module marketplace, multi-platform web distribution, an unattended delivery lane, or BMAD's depth of customization surface (GroundWork has config plus tiered carry-forward on update; BMAD has a three-layer per-skill override hierarchy with an authoring skill). It is pre-1.0 with no backward-compatibility guarantees.

---

## How they differ

### Design altitude: where the human's judgment is spent

Both frameworks put experience design before backend design at the coarse grain — BMAD's UX phase precedes solutioning, and its two UX spines are real contracts. The divergence is everything below that.

BMAD deliberately minimizes what humans lock. Its architecture spine fixes only cross-unit invariants; API shapes, schemas, and data flows are "seed" — decided by the implementing agent when the story runs, reviewed afterwards through code review and checkpoint walkthroughs. Its context machinery is engineered so *agents* never need to re-read upstream docs. The human's deep engagement ends at the phase gates; from there the system's actual shape emerges from the dev loop.

GroundWork inverts this. Every bet gets an ordered technical design the human walks outside-in — four files whose sequence is the design's logic: **UI design first** (*"because the contract must serve the experiences — never the other way around"*), then the headless core beneath it — **data flows and business logic** (how the system works), then **API design** (the interfaces), then **schema and data design** (how data is stored). Each file is a separately reviewable artifact; the whole directory is locked before decomposition and becomes the contract delivery executes verbatim.

The ordering is not ceremony — it is a claim about where human attention is most effective. A human is a strong judge of whether a screen serves the user, whether a flow makes sense, whether an API is honest about its errors; they are a weak reviewer of a 400-line diff. So GroundWork spends the human at the altitudes where their judgment is decisive and lets gated agents own the code level. The second-order effect is the one that compounds: a human who walked UI → flows → API → schema *understands the system they now own* — how it works, where data lives, what talks to what — and can support it in production. BMAD engineers context so agents don't need the docs; GroundWork additionally engineers the design walk so humans understand the product. Nothing in BMAD serves that goal; its checkpoint-preview helps a human review what was built, which is comprehension after the fact rather than authorship before it.

### Unit of delivery: stories versus bets

BMAD's spine is agile: PRD → epics → stories → sprints, with a machine-tracked story state machine and the story file as spec, work tracker, review record, and completion log in one. Every story ships customer value; the dev loop runs each one to completion unattended.

GroundWork delivers **bets with appetites** (Shape Up lineage). A milestone is a thin, user-visible step proven through the product's real front door; a slice is a vertical, independently deployable cut through one service with falsifiable required capabilities. Later milestones are deliberately not sliced up front — each postmortem authors the next rung from what delivery actually taught. Scope integrity is git-native: the approved decomposition is a tag, amendments re-point it with a recorded reason, and one slice is one conventional commit on the bet's branch.

This is each framework's answer to the same failure mode — AI context collapse during implementation — and the answers are incompatible: BMAD re-derives context inside every story; GroundWork establishes the contract once per bet and makes delivery execute it.

### Test discipline: who writes the proof, and when

In BMAD, the implementing agent writes tests during implementation — Given/When/Then acceptance criteria inside each story, gated by a definition-of-done checklist the same agent fills in, backstopped by adversarial review after the fact. In GroundWork, the proof is authored *before* implementation: decomposition writes prose proof-of-work per milestone and slice, reviewed as its own artifact at a fail-closed gate; delivery then implements red-first to turn the pre-agreed proofs green, and the milestone closes only when the driver drives the real product through the real pipeline. BMAD trusts the dev loop and audits it; GroundWork treats the dev loop as untrusted until the pre-agreed suite passes on real infrastructure.

### The executable layer

BMAD's determinism lives at the document and workflow layer — an append-only memory log, a spine linter, a customization resolver, a skill validator. It ships nothing that generates, boots, or verifies code; delivery discipline at the code level is instruction-enforced.

GroundWork's determinism extends into the product: generators emit compiling services, `./dev` boots and health-checks the topology, system tests run inside it, `audit` scans for secrets and vulnerable dependencies, `repo-map` gives agents a parsed (not hallucinated) code map, and `groundwork-check` fails CI when code-coupled docs go stale. The delivered code must run inside a harness the framework provisioned — that is the part of the discipline no instruction file can fake.

### Team model: persona troupe versus expert peer

BMAD distributes the methodology across named personas the user addresses in turn; handoffs between them are the phase boundaries, and party mode makes the troupe explicit. GroundWork uses a single expert-peer facilitator that loads the right hidden skill per phase; personas exist (architect, product, designer) but as decision disciplines the facilitator and dispatched subagents carry — not as a user-facing cast. One conversation, one stance, no roleplay of the org chart.

### Context economy

Both frameworks now engineer context seriously, in different places. BMAD's strength is *within* a workflow: step-file JIT loading, memlog-derived artifacts, subagents that return summaries. Its cost is the always-on surface — a full install registers the entire skill suite. GroundWork's strength is the *toolchain* surface: two registered skills, everything else invisible until routed, phase contracts that are torn down when setup graduates, and subagent dispatch capsules that carry pointers to contracts rather than paraphrases of them. For agent-native tooling, always-on context is the scarcest resource, and GroundWork's two-skill register remains the structural advantage to protect.

### Multi-surface products

GroundWork models every product as one capability core plus zero or more **surfaces** — the deployed artifacts consumers touch (web app, CLI, mobile app, MCP server). The model is load-bearing across the lifecycle: a surface registry with a machine-readable twin, one design track per interface type, one generated app per surface, surface-typed milestones, and a capability ledger recording per capability and surface `delivered`/`planned`/`omitted`/`n/a` — no empty cells, so a feature shipping on web but not mobile is a decision on record, not silent drift. A dedicated activation flow adds a surface to a live product, and `./dev surface` renders the parity picture.

BMAD has no equivalent: its PRD, spine, and stories describe one application, and nothing tracks which clients a capability reached. For a single-interface product the difference is invisible; for a product with three surfaces it is the difference between parity being tracked and parity being presumed.

### Brownfield

BMAD documents an existing codebase (`document-project`, `generate-project-context`) to give agents a knowledge base, and its architecture workflow ratifies conventions the code already shows. GroundWork reverse-engineers one: a deterministic structural scan, three extract phases that produce the same canonical artifacts a greenfield project gets, and additive infrastructure adoption that leaves a maturity baseline and an ownership-gap ledger. BMAD describes the codebase to the agents; GroundWork brings the codebase under the method.

### Model policy

GroundWork ships an explicit model-tier contract: frontier-class models for planning and every review gate (set explicitly on each dispatch — never inherited), execution-class workers under those gates, upward-only overrides, and a mid-slice escalation path to a frontier advisor. BMAD is silent on model selection; every skill runs on whatever model the session provides. As delivery loops go unattended, an explicit answer to "which judgment runs on which class of model" stops being an optimization and becomes part of the safety story.

### Where each one stops

| Dimension | BMAD v6.9 | GroundWork 0.13.0 |
|---|---|---|
| Planning output | Brief/PRFAQ, PRD (+addendum), `DESIGN.md` + `EXPERIENCE.md`, architecture spine (invariants only), epics + stories | Product brief, design system + brand tokens, architecture with binding constraints, infrastructure map, per-bet ordered technical design (UI → data flows → API → schema) |
| Human design depth | Phase-gate coaching; API/schema/data-flow shapes decided by agents in-story | Human authors and locks every design altitude per bet; contract executed verbatim |
| Delivery loop | Story state machine, per-story context capsule, unattended dev-story with DoD, three-lens adversarial review, checkpoint walkthrough, retrospective | Five-phase bet loop, pre-written reviewed proofs, slice workers under four frontier-tier lenses + milestone experience audit, front-door milestone proof, postmortem-authored next rung |
| Execution environment | Whatever the user's agent provides | Generated services, Docker topology booted and health-checked, system tests inside it, security audit |
| Machine enforcement | Memlog, spine linter, customization resolver, skill validator — document-layer | All of the code layer: compilation, boot, health, system tests, secret/dependency scan, doc-drift CI |
| Multi-surface | None | Surface registry + capability ledger, gated activation flow |
| Brownfield | Describe the codebase for agents | Scan, extract canonical artifacts, adopt infrastructure, maturity baseline |
| Model policy | None | Frontier gates / execution workers, explicit per-dispatch |
| Customization | Three-layer TOML per skill + authoring skill | Config + tiered carry-forward on update (narrower) |
| Distribution | Installer with channels/pinning, module marketplace, web bundles (Gemini Gems, Custom GPTs) | npm + migrations registry + reconcile-based update lane; no marketplace, no web bundles |
| Unattended operation | `dev-auto` one-iteration loop, `quick-dev` express lane | None shipped |

### Where BMAD is ahead

Operational maturity and reach: a large community and module ecosystem, multi-platform web distribution, the three-layer customization hierarchy with a guided authoring skill, a help index with phase routing (`preceded-by`/`followed-by` per skill), a 100+-technique elicitation catalog, party mode as a genuinely useful multi-perspective device, an unattended dev lane, and checkpoint-preview as a polished human-review walkthrough. None of these are architectural advantages GroundWork cannot build — several are methodology-neutral mechanics worth adopting outright — but as of today they are real, shipped, and battle-tested at community scale.

---

## Standalone or extension

BMAD's module system could technically host a "GroundWork module": modules ship skills, templates, and checklists, and the customization hierarchy can override core behavior. It is still the wrong move, for four reasons.

1. **The extension seam captures the wrong half.** A BMAD module is instruction files. GroundWork's methodology skills could be translated into that shape — but its differentiation is the executable half: generators, the `./dev` CLI, the boot harness, system tests, repo-map, the brownfield machinery. BMAD's module system has no concept of shipping, versioning, or testing code generators. The half that fits the seam is the half BMAD already does well.
2. **The methodological core conflicts.** GroundWork-as-module would teach that stories are the failure mode it was built to avoid, inside a framework whose vocabulary is epics, stories, and sprints. Two routers with different world-models in one project is a coherence failure, not a feature.
3. **Coupling to a fast-moving host.** BMAD ships minors roughly monthly and has a history of breaking majors. An extension chases that churn forever, on someone else's schedule.
4. **It doubles the always-on context bill.** Installing BMAD core plus a GroundWork module loads two frameworks' surface, spending GroundWork's structural context advantage to acquire the host's weakness.

### Interoperate and adopt instead

- **Accept BMAD artifacts as brownfield input.** A repo carrying a BMAD PRD, UX spines, and an architecture spine is a brownfield project with unusually good docs; the extract skills' adopt/upgrade mode ingests them directly. Naming BMAD as a supported migration source gives every BMAD user a path in.
- **Adopt its proven mechanics, not its model.** BMAD's context bookkeeping (step-file loading, append-only memlogs, capsule-based dispatch, subagent output discipline) and customization surface are methodology-neutral and translate into bet vocabulary without importing the story model. [The GroundWork V2 plan](plans/groundwork-v2.md) carries the mechanic-by-mechanic adoption verdicts — and the deliberate deviations, such as context packs that compress pointers and learnings but never copy contracts.
- **Keep the persona line.** The single-facilitator model is a deliberate design bet that has tested well; persona names return only as labels on isolated subagent dispatches (review lenses, scan fan-out), never as a user-facing troupe.

A distribution experiment — packaging GroundWork's facilitation subset as a BMAD-compatible bundle to reach that community — remains possible precisely because the core stays standalone.

---

## Direction

The comparison above is as-is. Where GroundWork is heading next is written up in [the GroundWork V2 plan](plans/groundwork-v2.md) (proposed, not yet executed): a deterministic fact engine so status is generated rather than attested, machine-readable bet state with prose reserved for judgment, adversarial review as the only review framing, and runtime verification of the running product — the layer neither framework has today, and the intended leap past this comparison.
