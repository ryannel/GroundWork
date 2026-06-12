# Implementation Plan: Surfaces & the Capability Core (Multi-Frontend Restructure)

**Status:** IN EXECUTION 2026-06-12 — WS-A (A1–A5), WS-B (B1–B6), WS-C (C1–C6), WS-D, WS-E (E1–E2), WS-F (F1–F3), and WS-H's H1/H5/H9 executed. E found and fixed a latent repo bug: the brownfield fixture's services/ were gitignored and never tracked. B2 finding: tracks' Phases 1+3 were type-specific in content (not duplicated as the plan assumed) — the foundation extraction kept Phase 3 per-type inside the foundation pass; Phase 6 commit merged into the foundation. B6's surfaces fixture shape: slug → `{slug, medium, reach}`. Remaining: WS-C–WS-G, WS-H generators/skills/H9. (Plan PROPOSED earlier same day.)
**Audience:** An engineer or agent implementing this change. Each slice names its files and acceptance check; judgment calls that remain are listed as open decisions in §11.
**Scope owner:** The setup-phase skills (`groundwork-product-brief`, `groundwork-design-system`, `groundwork-architecture`, `groundwork-scaffold`, `groundwork-mvp`), the `groundwork-bet` loop, the brownfield extract skills, and the `system-test-runner` / `workspace-dev-cli` generators — with coupled changes to review checklists, the maturity model, framework lifecycle docs, and (WS-H) the new `flutter-app` / `electron-app` generators and their engineer skills.

---

## 0. Read this first — the mental model

GroundWork currently assumes **one product = one interface type**. The design-system phase detects a single `interface_type`, loads a single track, and every downstream artifact inherits the assumption: the architecture's service map carries no frontend/backend distinction, the scaffold passes one `--interfaceMedium` flag, the bet's technical design has one Interface Design section in one medium's vocabulary, and the test fixtures expose one `frontend_base_url`.

Real products do not stay in that box. A product can be a self-contained CLI, a hosted web app, a desktop or mobile app, or a hosted service fleet with four independent clients. Features land on one client and silently never reach the others. The framework cannot currently express "this capability shipped on web, is planned for mobile, and is deliberately omitted from the CLI" — and what cannot be expressed cannot be tracked, reviewed, or kept honest.

**The restructure is built on one reframe: the split is not backend vs frontend — it is capability core vs surfaces.**

- The **capability core** is the product's domain logic, data, and contracts. Every product has one, including a self-contained CLI — its command layer calls an internal core the same way a web app calls an API. The core is always designed, assessed, and validated **headless**, against its contracts, with no surface in the loop.
- A **surface** is a deployed artifact a consumer interacts with: a web app, a mobile app, a CLI binary, an MCP server. Surfaces are adapters over the core. A product has zero or more of them (zero is legal: a headless API product's only surface *is* its protocol).
- Whether the core is **hosted** (services over a network) or **embedded** (a library in-process with its single surface) is an architecture-phase deployment decision, **not a methodology branch**. The five product shapes — self-contained CLI, self-contained desktop/mobile app, single-frontend web app, multi-frontend service fleet, headless API — are all the same model with different registry contents and one deployment answer.

This reframe is what keeps the restructure from forking the lifecycle per product shape. The phases stay the same; their artifacts gain a core/surface spine.

**The organizing ideas:**

1. **Prove logic once, headless; prove wiring per surface.** Capability behaviour is validated against the core's contract exactly once. Surface tests assert rendering, interaction, and wiring — never business logic. Without this principle, N surfaces multiply the entire test pyramid; with it, surface count scales only the thin adapter layer.
2. **Parity is tracked, not presumed — and divergence is a decision, not a gap.** A capability-by-surface ledger records where each capability is delivered, planned, deliberately omitted (with rationale), or not applicable. The ledger makes omission a recorded choice; it never nags toward 100% parity, because admin tooling belongs on web only and offline mode belongs on mobile only.
3. **Every product has a latent agentic surface.** A headless core with promoted contracts means an API/MCP surface costs almost nothing to expose. The headless capability milestone the bet loop gains in this plan is, in embryo, that surface's proof. As agents become first-class product consumers, this stops being a side effect and becomes a selling point of the methodology.

---

## 1. What the current model assumes — findings this plan responds to

| ID | Finding | Where |
|---|---|---|
| S1 | Design system detects a single `interface_type` and loads exactly one track; tracks are mutually exclusive complete flows (Phases 1–6 each) | `groundwork-design-system/instructions.md` Steps 2–3, `tracks/*.md` |
| S2 | Brand tokens support one Tier 2 block; a product cannot carry a terminal block *and* a visual block | `groundwork-design-system/templates/brand-tokens.md`, instructions commit contract |
| S3 | Product brief names one interaction medium; ambiguity resolves to a single answer | `groundwork-product-brief/instructions.md` depth threshold |
| S4 | Architecture has no surface/core taxonomy — services are listed uniformly; frontend-ness is implicit in names and stack | `groundwork-architecture/architecture-template.md`, `phases/03-service-design.md` |
| S5 | Scaffold passes one `--interfaceMedium` to `system-test-runner`; fixtures expose one `frontend_base_url` | `groundwork-scaffold/phases/01-ingestion-service-mapping.md`, `bet-progress-test.md` template |
| S6 | Bet technical design has one Interface Design section in one track's vocabulary; the contract is designed against one consumer | `groundwork-bet/templates/technical-design.md`, `workflows/02-design.md` |
| S7 | Decomposition's two test layers (interface-level + API-level) exist but the interface layer assumes one medium; milestones must all be "user-visible," which a headless capability cannot satisfy | `workflows/03-decomposition.md` Steps 3–5 |
| S8 | Validation promotes contracts but records nothing about which surfaces a capability reached; no artifact can express deliberate divergence | `workflows/05-validation.md` |
| S9 | Contract specs are mandated as `openapi.yaml`/`asyncapi.yaml` — formats that presume a hosted HTTP core; an embedded core has no honest place to put its contract | `workflows/02-design.md` Step 2.2 |
| S10 | Brownfield scan/extract detect one interface type; a repo containing a web app and a CLI loses one of them | `groundwork-design-system-extract/instructions.md` Stage 1 |
| S11 | Maturity model has no dimension for surface parity or contract compatibility across independently deployed clients | `maturity-model.md` |
| S12 | No generator or affordance for mobile/desktop surfaces (already tracked as remaining work in `contract-grade-delivery.md`); no manifest ties multiple frontend apps to one product | `src/generators/` |
| S13 | No lifecycle event for adding a surface to an existing product — the moment most likely to create silent divergence has no flow | orchestrator routing table |

**Strengths this plan must not regress:** the five-phase bet loop and its sealed-test mechanics (contract-grade-delivery, executed); contracts-first design with spec promotion to `docs/api/<service>/`; the two-layer test split in decomposition — it is the seed of the core/surface split and gets generalized, not replaced; the design-system track files — per-type modularity already exists and gets composed, not rewritten; the three-type interface taxonomy (`graphical-ui`, `cli`, `agentic-protocol`) — it survives as the *type* axis of the surface model.

---

## 2. The conceptual model

### Surface: type vs instance

The existing taxonomy conflates two things this plan separates:

- **Interface type** (`graphical-ui`, `cli`, `agentic-protocol`) — the design vocabulary. Types own design tracks, test mediums, and vocabulary. The taxonomy is unchanged.
- **Surface** (instance) — a named, deployed artifact: `web-app`, `ios-app`, `admin-cli`, `mcp-server`. Each surface has exactly one type; a product can have several surfaces of the same type (web and mobile are both `graphical-ui`). Surfaces own registry entries, scaffold targets, parity ledger columns, and test fixtures.

Design tracks run **per type in use**; scaffolding, testing, and parity tracking run **per surface**.

### The capability core

The core is the set of services (hosted) or modules (embedded) that own domain logic, persistence, and contracts. Its defining property: **everything it does is assessable and validatable with no surface running.** For a hosted core that means HTTP/event contracts and API-level system tests — exactly what the bet loop already produces. For an embedded core it means a typed public module API with the same contract discipline in the language's own terms (S9's fix). The architecture phase decides the core's deployment; nothing downstream branches on it except the contract spec format and the capability-test transport.

### The two canonical artifacts

**`docs/surfaces.md` — the surface registry.** One entry per surface: slug, interface type, platform (web / mobile / desktop / terminal / protocol), status (`active`, `planned`, `dormant`, `retired`), how it reaches the core (HTTP via gateway, gRPC, in-process), scaffold target, test medium, design-track reference. Plus one section describing the capability core and its deployment. Written at architecture commit (greenfield) or architecture-extract (brownfield); maintained by Living Documents.

**The capability ledger** — the parity tracking mechanism, living inside `docs/surfaces.md` as a capability × surface matrix, mirrored machine-readably at `.groundwork/surfaces.json` (the contract-grade rule applies: every reviewed artifact gains a machine-checkable twin). Rows are user-meaningful capabilities named at bet validation (typically 1–3 per bet — coarse enough to stay readable, never per-endpoint). Cells carry one of four states:

| State | Meaning | Required payload |
|---|---|---|
| `delivered` | Shipped on this surface | bet slug |
| `planned` | Will ship; not yet | bet ref or discovery-notes pointer |
| `omitted` | Deliberate decision not to ship here | one-line rationale |
| `n/a` | Capability does not apply to this surface | — |

`omitted` and `n/a` are distinct on purpose: `n/a` is structural (offline sync has no meaning on a stateless web client), `omitted` is a product choice that a future bet may revisit. An empty cell is the only illegal state once a capability row exists — validation fills every column or the bet does not close.

---

## 3. Workstream A — Canon & vocabulary (do first; everything else references it)

**A1 — Surface registry template + ledger contract.**
New template at `src/hidden-skills/templates/surfaces.md` defining the registry entry shape, the core section, and the ledger table with its four states. Companion contract for `.groundwork/surfaces.json` (schema in the template's appendix, the way `brand-tokens.md` documents its JSON). The template also states the **retired-column rule**: when a surface's status moves to `retired`, its ledger column freezes — existing cells keep their last state as history, new capability rows fill the retired column `n/a` automatically, and tooling (F1/F2) excludes it from sync-backlog counts. *Accept:* template exists; a hand-written example for a two-surface product validates against the schema; the example includes a retired surface exercising the rule.

**A2 — Concepts documentation.**
`docs/principles/` (or `docs/lifecycle/`) gains the capability-core/surfaces model: the reframe, the five product shapes as registry contents, the prove-once-headless testing principle, the divergence-is-a-decision ledger stance. `docs/product.md` updated to name multi-surface support. *Accept:* docs read coherently against the five shapes; `llms.txt` indexes the new page.

**A3 — Contract spec format generalization (S9).**
`workflows/02-design.md` Step 2.2 reframed: the spec format follows the core's deployment as recorded in `docs/surfaces.md` — `openapi.yaml`/`asyncapi.yaml` for hosted HTTP/event boundaries (unchanged, the common case), proto for gRPC, and for an embedded core a typed public API definition in the project's language plus `schema.sql` where state persists. The invariant is unchanged and stated as such: *a shape that exists only in prose is an unfinished contract.* *Accept:* design workflow names the format rule; review checklist updated to check format-vs-deployment agreement rather than hardcoding OpenAPI.

**A4 — Operating contract touch.**
Discovery-notes headers stay as they are (`## Design System`, `## Architecture` …) — entries name their surface inline when relevant; new headers per surface would fragment the parking lot. Confirm no protocol changes are needed beyond Living Documents listing `docs/surfaces.md` as a scannable target. *Accept:* contract diff is zero-or-tiny; no version bump.

**A5 — Surface stack-selection principle.**
New `docs/principles/surface-stack-selection.md` recording how GroundWork picks the standard stack for a surface platform. Three axes, in priority order: **training-set fluency** (the model's prior — how much working code in this stack the agent has absorbed), **the agent-closable loop** (can the agent run generate → boot → test → observe end-to-end without a human driving an IDE — the axis GroundWork's sealed-test methodology lives or dies on), and **the platform capability ceiling** (what UX the stack can reach, counting native escape hatches). The doc states the era-shift explicitly: AI labor devalues write-once portability as a selection criterion — maintaining platform-specific code is cheap now — and makes native escape hatches (platform channels, native modules) nearly free, so the ceiling axis is measured *with* them. Names the standard picks per platform: Next.js (web), Flutter (mobile), Electron (desktop), `cli-app` (terminal), MCP server (agentic). *Accept:* doc exists and reads generically (no sandbox leakage); `llms.txt` indexes it; every WS-H generator slice cites it as rationale.

---

## 4. Workstream B — Setup phases learn surfaces (greenfield)

**B1 — Product brief enumerates surfaces.**
The experience phase asks not "what is the medium" but "through what surfaces do users meet this product, now and on the roadmap." The brief's Summary for Downstream carries the surface set with horizon markers (MVP / later / aspirational). The single-medium clarification rule (S3) becomes: each described experience names its surface. *Accept:* `groundwork-product-brief/instructions.md` updated; a single-surface product reads exactly as before (one entry, no ceremony added).

**B2 — Design system: shared foundation + per-type tracks.**
The largest setup change, and the track files make it tractable:

- Phases 1–4 (mood, personality, interaction philosophy, language) run **once, at brand level** — they are surface-independent and currently duplicated into each track. Extract them into a shared foundation flow in `instructions.md` or a `tracks/_foundation.md`.
- Phase 5 (translation) and 5b (review) run **once per interface type in the MVP horizon**. Types outside the horizon run lazily at surface activation (WS-D).
- Output: `docs/design-system.md` carries the shared foundation plus one titled section per active type. (Open decision O1 covers splitting into per-type files if the doc grows past usefulness.)
- `brand-tokens.json` (S2): Tier 1 stays singular (identity is brand-level); Tier 2 becomes a keyed map of per-type blocks — `terminal` block from the cli track, visual block from graphical-ui — so a product can carry both. `workspace-dev-cli`'s projection reads the terminal block by key. *Accept:* a web+CLI product produces one design-system doc with two type sections and a brand-tokens file with two Tier 2 blocks; a single-type product's output is byte-compatible with today's (modulo the section title).

**B3 — Architecture owns the registry.**
Service-design and boundaries phases (`phases/03`, `05`) gain the surface/core taxonomy: classify every component as core service or surface app; decide the core's deployment; per surface, settle the access path (direct, gateway, BFF — the BFF question is asked, not presumed) and auth model. Once two or more surfaces deploy independently, the constraints phase must extract a contract-compatibility stance (mobile fleets lag releases by months; "we never break a published contract field" is an architecture commitment, not a delivery afterthought). Commit phase (`phases/07`) writes `docs/surfaces.md` from the template. *Accept:* architecture template carries a Surfaces & Capability Core section; commit writes the registry; review checklist checks registry ↔ service-map agreement.

**B4 — Scaffold reads the registry.**
Phase 1 (S5) derives scaffold targets and test mediums from `docs/surfaces.md` instead of a single interface type: one generator invocation per surface with a generator (`nextjs-app`, `cli-app`), `scaffold: manual` honored for surfaces without one (mobile/desktop until those generators exist — registry never blocks on tooling). `system-test-runner` invocation passes the full medium set (B6). `docs/infrastructure.md` lists surfaces as a distinct group with their core-access path. *Accept:* a web+CLI registry scaffolds both apps and an infra doc that groups them; a registry that adds a `scaffold: manual` mobile surface produces its infra-doc entry, fixture registration, and operational-expectations runbook with no generator invoked — the bridge path F3 leans on is exercised, not just promised; single-surface output unchanged.

**B5 — MVP scopes surfaces explicitly.**
MVP planning names which surfaces ship in the first bet (usually one, plus the headless core) and marks the rest `planned`/`dormant` in the registry. The first pitch's surface scope (C1) is seeded from this. *Accept:* `groundwork-mvp/instructions.md` carries the scoping step; the handoff pitch declares surface scope.

**B6 — `system-test-runner` goes multi-medium.**
Accept a set of mediums (or read the registry): scaffold per-surface fixtures — `page` (playwright) per graphical web surface, subprocess/pexpect runner per CLI surface, protocol client per agentic surface — and replace `frontend_base_url` with a `surfaces` fixture mapping slug → base URL/binary/endpoint. Keep `frontend_base_url` as a deprecated alias when exactly one graphical surface exists. *Accept:* generated conftest for a two-surface product exposes both fixtures; existing single-surface generation is unchanged via the alias; `./dev test generation` covers the new combination.

---

## 5. Workstream C — The bet loop splits core from surface

The five phases survive; each gains the core/surface spine. This workstream is the heart of the plan.

**C1 — Pitch declares surface scope.**
Pitch frontmatter gains `surfaces:` — the surfaces this bet delivers to. The no-gos section gains surface no-gos: surfaces the capability will *not* reach in this bet, each marked deferred (with intent) or omitted (with rationale). Discovery reads `docs/surfaces.md` so scope is chosen against the real registry. *Accept:* pitch template + `workflows/01-discovery.md` updated; a bet pitched against a single-surface product carries one entry and zero added ceremony.

**C2 — Technical design: Capability Design + Surface Design.**
`templates/technical-design.md` and `workflows/02-design.md` restructure the document:

- **§Capability Design** — data flows, API contracts, data schema: surface-neutral and headless. New explicit check the review enforces: *the contract serves every in-scope surface and presumes none* — designing the contract against N consumers at once is the cheapest moment to catch a web-shaped API a mobile client cannot use. When only one surface is in scope, the latent agentic surface stands in as the second consumer: would a programmatic caller find this contract complete?
- **§Surface Design** — one subsection per in-scope surface, each in its type's vocabulary (the existing track-vocabulary table becomes per-subsection instead of per-document). Each subsection anchors that surface's interface-level tests.

Ordering stays experience-first: surface designs are drafted before the contract is locked, because the contract must serve them; the contract is then written once beneath all of them. *Accept:* template restructured; design review checklist gains the neutrality check; a single-surface bet's document is today's document with two heading levels adjusted.

**C3 — Decomposition: capability milestones and surface milestones.**
`workflows/03-decomposition.md` retypes milestones:

- A **capability milestone** proves core behaviour headless — its demonstrable state is a contract exercised end-to-end against running services (or the embedded core's API): curl-able, scriptable, observable. This amends the "every milestone is user-visible" rule honestly instead of bending it: a capability milestone is *consumer-visible at the contract*, and the decomposition records who that consumer is (the in-scope surfaces; failing that, the latent agentic one).
- A **surface milestone** proves a surface delivers the capability to its users — asserted in that surface's medium, bounded to wiring, rendering, and interaction. Surface-milestone tests never re-prove core logic (the prove-once principle, stated in the workflow and enforced by the review checklist: a surface test that re-asserts a business rule already proven at the contract is a finding).
- **Structural rule:** a bet introducing new capability opens with its capability milestone; surface milestones follow and depend on it. A bet may legitimately *end* at the capability milestone with all surface milestones deferred — that is a headless delivery, and the ledger records the deferral.
- Slices gain a `surface` field (`core` or a surface slug) in both `decomposition.md` specs and `decomposition.json`; the existing owner-service field is unchanged. Milestone test files keep their naming; slice files already carry the owning component in the name.

*Accept:* workflow + both templates + manifest schema updated; decomposition review checklist checks milestone typing, capability-first ordering, and the no-relitigating rule; the quality-standard example reworked to show a capability milestone followed by two surface milestones.

**C4 — Delivery sequencing.**
`workflows/04-delivery.md` needs only the sequencing consequence: core slices merge before the surface slices that consume them, and the slice context capsule for a surface slice includes the capability milestone's test file (the contract proof it builds on). Everything else — sealed suite, amendment protocol, change navigation — applies unchanged. *Accept:* two paragraphs in the workflow; no mechanical changes.

**C5 — Validation updates the ledger.**
`workflows/05-validation.md` gains a step between contract promotion (2.5) and the Living Documents scan: for each capability this bet delivered, write its ledger row — every surface column filled with `delivered`/`planned`/`omitted`/`n/a`, deferred cells cross-posted to discovery notes `## Bets` so the next discovery sees them. Update `.groundwork/surfaces.json` to match. The Living Documents scan list gains `docs/surfaces.md`. *Accept:* workflow updated; the deep-output quality example shows a ledger update; a bet cannot reach `delivered` status with an empty ledger cell.

**C6 — Review checklists.**
`groundwork-review` checklist updates bundled across C2/C3/C5: contract neutrality, milestone typing, prove-once enforcement, ledger completeness in the implementation-readiness and validation gates. *Accept:* checklist diffs land with their owning slices; a seeded violation fixture (surface test re-proving core logic) is caught in a review dry-run.

---

## 6. Workstream D — Surface activation: the missing lifecycle event (S13)

Adding a surface to a live product — the mobile app eighteen months in — is the moment silent divergence is born, and today no flow exists for it. New hidden skill `groundwork-surface-activation` (routed from the orchestrator's anytime table).

**Registry bootstrap for pre-restructure products.** A product that adopted GroundWork before this plan is neither greenfield (B3 never ran for it) nor brownfield-extract (E1 is for un-adopted repos) — without a bridge it degrades gracefully forever and never gains a registry. The activation skill owns the bridge: invoked on a product with GroundWork docs but no `docs/surfaces.md`, its first move is bootstrap — backfill the registry from `docs/architecture.md` and the existing scaffold (every current surface entered as `active`, ledger empty per D7's honesty stance), then proceed to the steps below for the new surface. `groundwork-check` surfaces the nudge (F2).

1. **Register** — add the surface to `docs/surfaces.md` with the user: type, platform, core-access path, auth model. If the architecture lacks a compat stance and this surface deploys independently (it now must — see B3), establish one and update `docs/architecture.md` (Living Documents, reversal protocol if it overturns a decision).
2. **Design** — run the design-system track for the surface's type if no section for that type exists yet (the lazy half of B2).
3. **Scaffold** — generate the app where a generator exists; `scaffold: manual` otherwise, with the operational expectations (health, `./dev` integration, test fixture registration) stated either way.
4. **Triage the ledger** — the step that earns the skill its existence: walk every existing capability row with the user and fill the new surface's column — `planned` (seeding the surface's bet backlog), `omitted`, or `n/a`. The triage *is* the sync decision the user asked this restructure to make deliberate, made once, recorded, and inherited by every future bet.
5. **Hand off** — the `planned` cells become discovery-notes entries; ordinary bets deliver them.

*Accept:* skill ships hidden; orchestrator routes it; activating a CLI surface on a web-only sandbox produces a registry entry, a cli design section, a scaffolded app, and a fully-triaged ledger column; run against a pre-restructure fixture (GroundWork docs, no registry) it bootstraps the registry first; the hardcoded "seventeen hidden methodology skills" count (in `docs/product.md`, `getting-started.md`, `host-support.md`, `groundwork-vs-bmad.md`) is bumped to eighteen in the same slice — the slice that adds the skill owns the count.

---

## 7. Workstream E — Brownfield detects all surfaces (S10)

**E1 — Scan + extracts.** The scan records every interface surface it finds, not a single candidate. `groundwork-design-system-extract` recovers a design section per detected type; `groundwork-architecture-extract` writes `docs/surfaces.md` (registry entries with `status: active`, core deployment as observed). *Accept:* the brownfield fixture extended with a small CLI alongside its services; extraction produces a two-surface registry.

**E2 — Ledger seeding stance.** The ledger starts **empty** at adoption — rows grow per-bet, as capabilities are touched. Reverse-engineering full capability-parity from an existing codebase is expensive and fuzzy; an empty ledger is honest ("parity unknown until a bet touches it") where a scanned one would be confidently wrong. The adoption gap-ledger notes the stance so it reads as a decision, not an omission. *Accept:* `groundwork-infra-adopt` notes the stance; no scan-time ledger synthesis.

---

## 8. Workstream F — Tooling & status surfaces

**F1 — `./dev surface status`.** Renders the registry and ledger from `.groundwork/surfaces.json`: surfaces with status, capability matrix, counts of `planned` cells per surface (the sync backlog at a glance). Sibling of `./dev bet status`; same bundle (`workspace-dev-cli`, rebuild via `npm run build:dev-cli`). *Accept:* command renders the example from A1.

**F2 — `groundwork-check` reads the ledger.** Staleness signals: a `planned` cell older than N bets with no referencing pitch; `docs/surfaces.md` diverging from `.groundwork/surfaces.json`; an `active` surface absent from test fixtures; a product with GroundWork docs but no registry at all (pre-restructure adoption — check points at the WS-D bootstrap, advisory not blocking). Retired surfaces are excluded from all staleness counting per A1's retired-column rule. *Accept:* check report includes a surfaces section; seeded drift fixtures turn it red.

**F3 — Generator roadmap folded in.** Mobile/desktop generators were the deferred "new solution types" bucket in `contract-grade-delivery.md`; this plan now commits them as **WS-H**, sequenced behind B4/B6 so each generator plugs into the registry-driven scaffold and multi-medium test runner rather than the single-`interfaceMedium` flag it replaces. `scaffold: manual` remains the bridge — a mobile/desktop surface participates fully in design, bets, ledger, and tests before its generator lands. *Accept:* `contract-grade-delivery.md` status header points its mobile/desktop bullet here.

---

## 9. Workstream G — Maturity, evals, and framework docs

**G1 — Maturity dimensions.** Two additions to `maturity-model.md` (numbering per its scheme): **surface parity discipline** — ledger current, no empty cells, `planned` backlog actively drawn down or consciously re-triaged; **contract compatibility** — once ≥2 surfaces deploy independently, a versioning/compat stance exists and `./dev check contracts` drift gates honor it. *Accept:* model + `templates/maturity.md` updated; validation's maturity re-assessment step references both.

**G2 — Eval coverage.** Two new suites in `tests/evals/scenarios/`: a **multi-surface persona** (product with web + CLI at MVP, plus a `planned` mobile surface on `scaffold: manual` — so the registry, ledger triage, and the manual-scaffold bridge are all exercised without an emulator in the loop; probes that design runs both tracks once each, the bet's contract is neutrality-checked, validation fills the ledger including the mobile column) and a **headless-API persona** (zero graphical surfaces; probes that nothing in the flow demands a UI and the capability milestone carries the bet alone). A surface-activation probe rides the multi-surface suite as a follow-on session. *Accept:* suites seeded; one live simulation run per suite reviewed via `./dev sandbox review` + `/judge`.

**G3 — Framework docs sweep.** `docs/lifecycle/*`, `docs/getting-started.md`, `docs/groundwork-vs-bmad.md` (multi-surface delivery is a genuine differentiator — BMAD has no surface-parity concept) updated to the new model. *Accept:* docs mention surfaces wherever they currently say "frontend" or assume one interface; `llms.txt` current.

---

## 10. Workstream H — Surface solution types: Flutter and Electron (generators, principles, engineer skills)

The stack picks are settled (D9/D10): **Flutter** for mobile surfaces, **Electron** for desktop, both built in this plan. Each stack ships the full chain the existing stacks already have — `docs/principles/stack/<stack>/` principle files → shipped into the generator's docs → mirrored into a hidden engineer skill with `references/` and a hash-pinned `sync-anchor.md`. A generator without its principles and engineer skill is half a solution type; the chain is the unit of delivery.

**The research mandate (applies to H1 and H5).** Principles are authored from a dated survey of where each ecosystem's leaders are converging *now*, not from the model's static prior — the prior lags, and these stacks move fast. For Flutter: the Flutter team's current official architecture guidance, the engineering practice of the leading Flutter consultancies and production apps (state management, navigation, and testing patterns the ecosystem is actually converging on). For Electron: the Electron project's own security checklist and process-model guidance, and the architecture of the flagship desktop apps built on it (editor-class and messaging-class apps — process isolation, `contextBridge`, sandboxed renderers, typed IPC, auto-update discipline). Each principles index records its survey date and sources, so a future refresh knows what it is superseding. Forward-looking means: when the ecosystem is mid-migration, document the destination pattern and name the legacy one as legacy — never codify the pattern that is being abandoned.

**The verification contract (applies to H2/H3/H6/H7).** The existing scaffold harness's definition of "boots" — Docker Compose up + health checks — does not transfer to these stacks: a mobile app has no Docker boot, Electron needs a display server, and the iOS simulator exists only on macOS. Each stack therefore gets an explicit per-tier definition instead of inheriting the web one:

| Tier | Flutter | Electron |
|---|---|---|
| Generation | Generator output snapshot — runs everywhere, no SDK required | Same |
| Compilation | `flutter analyze` + `flutter test` (widget tests, headless, CI-cheap) | `tsc` + lint, renderer and main both |
| Boot | `integration_test` against a headless Android emulator — CI-feasible on Linux, the canonical loop; iOS simulator is a local-only macOS lane, never a CI gate | Playwright `_electron` launch + smoke under `xvfb` on Linux CI |

Toolchain is a declared prerequisite, not an assumption: the generator's scaffold step runs detection first (`flutter doctor` / Electron's node toolchain), and a missing SDK degrades the way a missing Docker daemon already does in `./dev` — the affected tier reports **skipped-with-reason, never silently green**. CI runners that lack a toolchain run the generation tier only; the repo's CI installs the Flutter SDK and `xvfb` for the rest.

**H1 — Flutter stack principles.**
`docs/principles/stack/flutter/` mirroring the structure of the go/python sets — named for the framework, not the language, by the same rule that names the Electron set (O6): the knowledge is platform knowledge; language-named directories (go, python, typescript) are for stacks where the language *is* the stack. Files: `index.md` (survey date + sources), `architecture.md` (layering, feature organization, the core-access seam to the capability core), `state-management.md`, `widgets-and-composition.md`, `testing.md` (the unit/widget/integration taxonomy, mirroring the nextjs testing-taxonomy treatment), `platform-channels.md` (the native escape hatch — when and how to drop to Swift/Kotlin, per A5's ceiling axis), `releases-and-distribution.md` (signing, store distribution, versioning, update/forced-upgrade strategy — the mobile mechanism behind B3/G1's contract-compat stance, and the analog of the Electron set's `packaging-and-updates.md`). *Accept:* files exist, read generically, `llms.txt` indexed; each cites A5's axes where it makes a trade.

**H2 — `flutter-app` generator.**
Nx generator producing a Flutter app wired to the workspace: `brand-tokens.json` projected into a Dart theme module (the Tier 2 visual block, the way `workspace-dev-cli` projects the terminal block), `./dev` targets for run/build/analyze/test, core access via a typed client over the promoted contracts (tooling per O8), the H1 principles shipped in the generator's docs the way `nextjs-app` ships its own. A Flutter project lives on pubspec and the Dart toolchain, not npm — how it wires into the Nx workspace is O7, settled before this slice starts. *Accept:* generation + compilation tiers per the verification contract; scaffolding a registry with a mobile surface produces the app; single-surface web products are untouched.

**H3 — `system-test-runner` Flutter medium.**
Surface fixture driving `integration_test` (Patrol where native automation is required) against an emulator/simulator, registered in B6's `surfaces` fixture map. The prove-once principle does the heavy lifting here: surface tests assert wiring and rendering only, so the expensive emulator loop stays thin. *Accept:* generated conftest for a product with a mobile surface exposes the fixture; `./dev test generation` covers the combination.

**H4 — `groundwork-flutter-engineer` skill.**
Hidden engineer skill auto-installed alongside `flutter-app` output (the established pattern of the three existing engineer skills): `SKILL.md` router + `references/` split by domain (mirroring the nextjs skill's per-domain reference files) + `sync-anchor.md` pinning the H1 principle files with SHA-256 hashes so CI catches drift. *Accept:* skill ships hidden; sync anchor verifies; install flow places it next to generated Flutter apps.

**H5 — Electron stack principles.**
`docs/principles/stack/electron/`: `index.md` (survey date + sources), `process-model.md` (main/renderer split, sandboxing, what runs where), `ipc-contracts.md` (typed IPC as a contract boundary — the same contract discipline the core enforces, applied to the process seam), `security.md` (the Electron checklist as enforced defaults, not advice), `packaging-and-updates.md`. Renderer-side component idiom is **not** duplicated — it defers to the existing `typescript/frontend.md`; the Electron set owns only what the desktop shell adds. *Accept:* files exist; no overlap with the typescript set beyond explicit deferral links; `llms.txt` indexed.

**H6 — `electron-app` generator.**
Main/renderer scaffold with the renderer on the same React/TS stack as `nextjs-app` (brand tokens flow through the existing Tailwind path), typed IPC boundary generated, security defaults from H5 baked in, `./dev` integration. *Accept:* generation + compilation tiers; a Playwright `_electron` smoke boots the generated app.

**H7 — `system-test-runner` Electron medium.**
Playwright's `_electron` driver as the surface fixture — the strongest agent loop of any desktop option and the reason D10 chose this stack. *Accept:* conftest exposes the fixture; generation tests cover it.

**H8 — `groundwork-electron-engineer` skill.**
Hidden skill: deep on process model, IPC contracts, security, packaging; thin where shared with the nextjs engineer (component idiom defers to its references rather than copying them). Sync anchor pins the H5 set. *Accept:* skill ships hidden; sync anchor verifies; no duplicated reference content with the nextjs skill.

**H9 — Graphical-ui track gains platform-dimension subsections (executes D13).**
`groundwork-design-system/tracks/graphical-ui.md` gains the platform subsections D13 settled: web as the baseline, mobile in Flutter idiom, desktop in Electron idiom — subsections within the track, not sub-track files. The idiom content is sourced from H1/H5's surveys, so this slice follows them. Where platform idiom needs token support (touch-target minimums, desktop window chrome, motion), the Tier 2 visual block's schema is extended rather than forked — web and mobile keep sharing one visual block. *Accept:* track file carries the three subsections; a design-system run for a mobile surface produces guidance in Flutter vocabulary; the cli and agentic tracks are untouched.

---

## 11. Decisions

### Settled by this plan

| ID | Decision | Rationale |
|---|---|---|
| D1 | Vocabulary is **surface**, not frontend | A self-contained CLI and an MCP server front nothing; "frontend" smuggles the hosted-web shape back in |
| D2 | Type vs instance split; tracks per type, registry/ledger/fixtures per surface | Web + mobile share design vocabulary but not deployment, tests, or parity |
| D3 | Core is always present, always headless-validated; deployment (hosted/embedded) is an architecture decision | Unifies all five product shapes; no methodology fork |
| D4 | Ledger rows are bet-level capabilities, not endpoints | Readability; endpoints already have `docs/api/` promotion |
| D5 | `omitted` ≠ `n/a`; empty cells illegal once a row exists | Divergence must be a recorded decision; the two states have different futures |
| D6 | Capability milestone first in any bet introducing capability; headless delivery (no surface milestones) is legal and ledger-recorded | The user-visible rule is amended, not bent; the contract's consumer is named |
| D7 | Brownfield ledger starts empty | Honest unknown beats confident fiction |
| D8 | Five bet phases unchanged; no separate "backend bet" / "frontend bet" types | Surface scope in the pitch + milestone typing expresses every split a bet type could, without forking the lifecycle |
| D9 | Mobile surfaces standardize on **Flutter** | Single codebase with the most mature first-party test harness in mobile (`integration_test`/widget tests), strong corpus, capability ceiling reached via platform channels — which AI labor makes cheap (A5). Chosen over Expo/RN despite the TS-coherence cost: that cost is deliberate and recorded |
| D10 | Desktop surfaces standardize on **Electron**, built alongside mobile in WS-H | Playwright drives Electron natively — the strongest agent-closable loop of any desktop option; the renderer reuses the web stack and token projection wholesale. Flutter-desktop was considered and declined: the loop advantage and web-ecosystem maturity are decisive for desktop |
| D11 | Stack selection is principled (A5), not ad hoc | Three axes — training-set fluency, agent-closable loop, capability ceiling — with write-once portability explicitly demoted as a criterion in the AI era |
| D12 | Each new stack ships the full chain: principles → generator docs → engineer skill with sync anchor (WS-H) | Parity with the go/python/typescript stacks; a generator without principles and an engineer skill is half a solution type. Principles are authored from a dated survey of each ecosystem's current leaders, not the model's prior |
| D13 (was O2) | `graphical-ui` track gains platform-dimension subsections (web baseline; mobile in Flutter idiom; desktop in Electron idiom), landing as **H9** | Resolved by D9/D10 — the idioms are now known, so the sub-guidance can be written; still subsections, not sub-track files; H9 owns the edit |

### Open decisions

| ID | Question | Leaning |
|---|---|---|
| O1 | Single `docs/design-system.md` with per-type sections vs `docs/design-system/<type>.md` files | Single doc until a real product's doc proves unwieldy; splitting later is mechanical |
| O3 | Capability naming key for ledger rows (free slug vs derived from pitch slug) | `<bet-slug>/<capability-slug>` — stable, greppable, collision-free |
| O4 | Should `surfaces:` scope appear in `decomposition.json` per-slice or only as the slice `surface` field? | Slice field only; the pitch owns bet-level scope |
| O5 | Registry/ledger location: `docs/surfaces.md` vs folding into `docs/architecture.md` | Separate doc — it changes per-bet (ledger) at a different cadence than architecture |
| O6 | Principles directory name for the Electron set: `stack/electron/` (platform-named) vs folding under `stack/typescript/` | `stack/electron/` — the set owns the desktop shell (process model, IPC, packaging), which is platform knowledge, not language knowledge; renderer idiom already lives in `typescript/frontend.md`. The same rule names the Flutter set `stack/flutter/`, not `stack/dart/` (H1): language-named directories are for stacks where the language is the stack |
| O7 | Nx↔Flutter workspace integration: hand-rolled Nx executor wrapping the `flutter` CLI vs a community plugin (nxrocks) | Hand-rolled executor — consistent with how this repo builds its other generators, no third-party plugin dependency to track; revisit only if the executor surface grows past run/build/analyze/test |
| O8 | Dart typed-client generation over promoted contracts: codegen tool (e.g. openapi-generator's Dart output) vs a hand-rolled thin client | **Settled at H2 (2026-06-12): hand-rolled thin dio client** — one method per promoted-contract operation, typed models in `domain/models`, repositories as the seam. The lightest path while the contract surface is small, with no JVM codegen dependency in the toolchain. `openapi_generator`'s `dart-dio` output is the recorded opt-in once the promoted `openapi.yaml` grows past a handful of operations — the seam stays put, so nothing above the data layer changes |

---

## 12. Angles checked and folded in

The request asked what might be missing. These were found and shaped the plan:

1. **Self-contained products have a core too** → D3. Without it, the methodology forks at "is there a backend?", which is the wrong question.
2. **Surface birth is a lifecycle event** → WS-D. Keeping existing surfaces in sync was the stated problem; the *creation* of a new surface is where divergence actually starts, and the activation triage is the single highest-leverage moment to decide parity deliberately.
3. **The agentic surface is nearly free** → §0 idea 3, C2's neutrality stand-in, C3's consumer naming. The headless requirement is not just a validation discipline — it is a latent product surface, and increasingly the one agents consume.
4. **Anti-nag ledger design** → D5. A parity tracker that shames every gap gets ignored; one that records decisions gets maintained.
5. **Test-cost scaling** → §0 idea 1, C3 enforcement. The naive reading of "validate per frontend" multiplies the pyramid by N; the prove-once principle is what makes multi-surface affordable.
6. **Compat/versioning across independently deployed surfaces** → B3, G1. A mobile fleet that lags releases by months turns "we changed the contract" from a refactor into an incident; the stance must exist before the second surface ships.
7. **Cross-surface consistency vs platform idiom** → B2's foundation/track split. The foundation owns shared semantics and vocabulary; tracks own what is idiomatic per type; the ledger tracks capability parity, never pixel parity.
8. **BFF/gateway question** → B3. Per-surface access paths are an architecture decision the current phases never ask.

**How to pressure-test the reasoning before building:** shape-test every changed skill against the five product shapes (a self-contained CLI must never be asked for an OpenAPI file or a second consumer it doesn't have; a headless API must never be asked for a screen); dry-run the ledger on paper against a realistic three-surface, ten-capability product before F1 builds tooling for it; and run the G2 simulations before declaring the restructure done — the greenfield sim findings memory shows scaffold↔architecture drift is this repo's recurring weak spot, and B3→B4 (registry written by architecture, consumed by scaffold) is a new edge of exactly that kind.

---

## 13. Sequencing

```
WS-A (canon)  ──►  WS-B (setup phases)  ──►  WS-D (activation)
      │                    │
      │                    └──►  WS-H (Flutter + Electron: principles, generators, engineer skills)
      └──►  WS-C (bet loop) ──►  WS-F (tooling)
                   │
WS-E (brownfield) ─┴──►  WS-G (maturity, evals, docs)   ← last; evals gate "done"
```

- **A before everything** — every workstream references the registry/ledger contract and vocabulary; A5 is the rationale every WS-H slice cites.
- **B and C can interleave** — C2/C3 depend only on A1/A3, not on B. Land C behind the registry's existence check (a bet against a project with no `docs/surfaces.md` behaves exactly as today — single implicit surface), so the bet loop ships without waiting for setup-phase rework.
- **D after B2/B3** (it reuses the lazy track run and the registry).
- **H after B4/B6** — generators must plug into the registry-driven scaffold and multi-medium test runner, never the single-`interfaceMedium` flag. Within H, principles before generator before engineer skill per stack (H1→H2→H4; H5→H6→H8); the Flutter and Electron chains are independent and can interleave; H9 follows H1+H5 (it sources their surveys). O7 is settled before H2 starts.
- **G2 evals close the plan** — no "done" claim without a green multi-surface and headless simulation, per the verification-first lesson of the contract-grade plan. A WS-H stack is "done" when its three tiers in the verification contract (§10) are green on CI — generation, compilation, and the CI-feasible boot lane (headless Android emulator for Flutter, `xvfb` Playwright `_electron` for Electron) — and its surface fixture passes; local-only lanes (iOS simulator) never gate.

**Compatibility invariant held throughout:** a single-surface product experiences zero added ceremony. Every changed phase degrades to today's behaviour when the registry holds one surface — the restructure must be invisible to the product shape GroundWork already serves.
