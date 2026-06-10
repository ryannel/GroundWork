---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-06-09"
---

# GroundWork and BMAD

GroundWork and BMAD solve adjacent problems at different layers. BMAD is a **process framework**: it structures the conversation between a human and a team of AI personas so that planning produces disciplined documents. GroundWork is a **delivery system**: it structures the same upstream conversation, then carries the result all the way to running, tested infrastructure and a contract-gated delivery loop. The document trail is BMAD's product; for GroundWork it is the means to a booted system.

**Verdict: GroundWork should remain standalone.** The full reasoning is in [Standalone or extension](#standalone-or-extension), but the short version: the half of GroundWork that BMAD's extension system could host is the half that is least differentiated, and the two frameworks disagree at the methodological core — agile stories versus contract-first bets. What GroundWork should take from BMAD is not its runtime but its operational maturity: release engineering, customization without forking, shipped quality checklists, and a help surface. That adoption list is the spine of [the quality uplift plan](plans/bmad-quality-uplift.md).

---

## What BMAD is

BMAD (Breakthrough Method for Agile AI-Driven Development) is an open-source framework — 43K+ GitHub stars, MIT licensed, v6.8 as of May 2026 — that models software development as an agile team of named AI personas: Mary the analyst, John the PM, Winston the architect, Sally the UX designer, Amelia the developer, Paige the tech writer. Work flows through four phases (Analysis → Planning → Solutioning → Implementation), each producing a versioned artifact: brief, PRD, architecture, epics and stories, code, tests. The reference clone analyzed for this document (v6.6; kept outside this repo) carries 42 skills, 38 templates, 12 quality checklists, and 89 step files. The v6.6→v6.8 delta is a web-bundle release packager plus fixes — nothing that changes this comparison.

Its operational machinery is its real strength. A three-tier TOML customization hierarchy (base → team → personal) lets users reshape any agent or workflow without forking. A module system (BMM core, test architect, game dev, creative, builder) plus third-party expansion packs extend it into new domains. An interactive installer remembers answers, supports CI, and upgrades cleanly across frequent releases. Web bundles deploy subsets to ChatGPT and Gemini. Every workflow is indexed in a help system that tells the user where they are and what comes next.

Its known weaknesses are the inverse of its discipline: ceremony overhead for small work, context bloat from feeding comprehensive artifacts into every downstream step, prescriptive phases that fit exploratory work poorly, and a planning output that stops at documents — implementation quality depends entirely on the executing agent's environment, because BMAD ships no scaffolding, no generators, no boot harness, and no tests that run against real infrastructure.

---

## How they differ

### Methodology: stories versus bets

BMAD's spine is agile: PRD → epics → stories → sprints, with story-by-story implementation and sprint ceremonies. The embedded assumption is that every unit ships customer value on completion.

GroundWork rejects story-driven development deliberately. Delivery runs on **bets with appetites** (Shape Up lineage): a Milestone is a flag-gated internal proof point, a Slice is a contract-defined API contribution testable before anything consumes it. Architectural context is established once during setup and refined through living documents, instead of being re-derived inside every story. This is not a stylistic difference — it is each framework's answer to the same failure mode (AI context collapse during implementation), and the answers are incompatible.

### Team model: persona troupe versus expert peer

BMAD distributes the methodology across six named personas the user addresses in turn; the handoffs between them are the phase boundaries. GroundWork uses a single expert-peer facilitator that loads the right hidden skill per phase and dispatches isolated subagents only where independence has value (the review panel, the brownfield scan fan-out). One conversation, one stance, no persona switching cost — and no temptation to roleplay the org chart.

### Context economy

GroundWork's two-layer skill architecture registers exactly three skills in the agent toolchain; seventeen methodology skills load on demand and cost nothing until invoked. BMAD installs its full skill surface, and its own community names context bloat as a top criticism. For agent-native tooling, always-on context is the scarcest resource; this is a structural advantage GroundWork should protect.

### Where each one stops

| Dimension | BMAD | GroundWork |
|---|---|---|
| Planning output | PRD, architecture doc, epics, stories | Product brief, design system + brand tokens, architecture, infrastructure map |
| Implementation support | Dev/QA personas guide the user's agent | Nx generators emit compiling services; Docker topology boots and health-checks; system tests run inside it |
| Brownfield | Document-project workflow (describe the codebase) | Full reverse-engineering path: deterministic scan via depwire MCP, four extract phases, additive infra adoption, gap ledger |
| Doc currency | Versioned artifacts, manual upkeep | Living Documents protocol + `groundwork-check` staleness detection in CI |
| Verification of the framework itself | Community usage | Generator/compilation/boot test harness, simulation suites with personas, transcript review + judge rubric |

### Where BMAD is simply ahead

Maturity. BMAD has semver releases at a fast cadence, a changelog, an installer with an upgrade path, a published docs site, a customization system, an extension mechanism, a help index, shipped quality checklists for every major artifact, 19+ elicitation techniques, multi-platform distribution, and a large community. GroundWork has none of these yet — its versioning is a hardcoded `1.0.0`, its CLI `update` command is a stub, and it has no README. None of these gaps are architectural; all of them are work. That work is enumerated in `docs/plans/bmad-quality-uplift.md`. [Update 2026-06-10: the quality-uplift plan closed these gaps — v0.9.0 ships semver + CHANGELOG + a release workflow, a real `update`/`check`, a README, shipped checklists, and a customization surface; see the plan for the ledger.]

---

## Standalone or extension

BMAD's module system is genuinely capable: a module ships agents, workflows, templates, and checklists; the customization hierarchy lets it override core behavior; the installer distributes it. A "GroundWork module for BMAD" is technically constructible. It is still the wrong move, for four reasons.

**1. The extension seam captures the wrong half.** A BMAD module is personas + workflows + templates — instruction files. GroundWork's methodology skills could be translated into that shape. But GroundWork's differentiation is the executable half: generators that emit compiling services, the bundled `./dev` CLI, the Docker boot harness, generated system tests, depwire's deterministic code map, the brownfield adoption machinery. BMAD's module system has no concept of shipping, versioning, or testing code generators. The part that fits the seam is the part BMAD already does well; the part that doesn't fit is the reason GroundWork exists.

**2. The methodological core conflicts.** A module extends its host's mental model; it does not contradict it. GroundWork-as-module would sit inside a framework whose vocabulary is epics, stories, and sprints while teaching users that stories are the failure mode it was built to avoid. Either GroundWork adopts the host's vocabulary (and loses its delivery model) or fights it (and confuses every user who reads both). BMAD's Scale Adaptive Framework routes work in agile terms; GroundWork's orchestrator routes in lifecycle terms. Two routers with different world-models in one project is a coherence failure, not a feature.

**3. Coupling to a fast-moving host.** BMAD shipped v6.6 → v6.8 in a month and has a history of breaking majors. An extension chases that churn forever, on someone else's schedule, through someone else's review process. GroundWork has not yet versioned its own operating contract; chaining it to an external release train compounds the problem instead of solving it.

**4. It doubles the context bill.** Installing BMAD core plus a GroundWork module loads two frameworks' always-on surface. Context bloat is the most-cited BMAD criticism, and context economy is one of GroundWork's structural advantages. An extension spends that advantage to acquire the host's weakness.

### What to do instead: interoperate and adopt

Standalone does not mean isolated. Three moves capture most of the extension's upside at none of its cost:

- **Accept BMAD artifacts as brownfield input.** A repo carrying a BMAD PRD and architecture doc is a brownfield project with unusually good docs. The extract skills' Adopt/Upgrade mode already exists for exactly this shape — ingest the existing document, fill the missing contract sections, re-stamp, review, commit. Naming BMAD explicitly as a supported migration source costs little and gives every BMAD user a path in.
- **Adopt BMAD's proven operational mechanics.** Release engineering, the customization hierarchy, shipped checklists, a help index — these are methodology-neutral and battle-tested at 43K-star scale. The uplift plan adopts each one.
- **Revisit the persona backlog with this lens.** A then-extant TODO list sketched BMAD-style personas (`groundwork-pm`, `groundwork-architect`, …); decision D2 in `docs/plans/bmad-quality-uplift.md` superseded that backlog. The single-facilitator model is a deliberate design bet that has tested well; persona names should only return as labels on subagent dispatches (review panel, scan fan-out) where isolation already exists — not as a user-facing troupe.

A future distribution experiment — packaging GroundWork's facilitation subset as a BMAD-compatible bundle to reach that community — remains possible precisely because the core stays standalone. Build the standalone quality first; a bridge is only worth crossing toward something solid.
