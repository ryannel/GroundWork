# Changelog

All notable changes to GroundWork are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/). Entries that require action when upgrading an
existing installation are prefixed `[migration]` — `npx groundwork update` surfaces them
automatically when it detects a version jump.

## [Unreleased]

The framework upgrade path (design: `docs/plans/framework-upgrade-path.md`): every
installed artifact gets an owner and a provenance record, and every framework change
that touches installed projects ships with a migration — so no project is left behind
as the framework improves.

### Changed (resize work on worth + stakes, not effort, 2026-06-16)

Refines the unreleased product-principles corpus (plan: `docs/plans/appetite-stakes-resize.md`).
Reframes how GroundWork sizes work for an AI-native shop: appetite is re-denominated from
calendar time to **worth** (opportunity cost), and **stakes** (blast radius × reversibility ×
review/judgement load) is promoted to a first-class measure of a bet's size — effort/complexity
named as the axis AI deflated. No shipped surface has changed yet (the corpus is unreleased), so
no migration is involved.

- **`foundations/prioritization-and-appetite`**: re-denominated appetite (worth, not a
  time-budget — "N weeks" demoted to one optional lens); new principle **"Size is stakes, not
  effort"**; "Sizing by complexity" added to the anti-patterns.
- **`foundations/product-risks`** §6: stakes named as blast radius × reversibility × review load,
  cross-linked to the canonical definition; effort framing dropped.
- **`groundwork-product` references** (`shaping-and-appetite`, `scope-and-sequencing`) + sync-anchor
  re-pinned to the edited sources.
- **Bet artifacts**: pitch template gains a **Stakes** line and a worth-framed appetite; bet
  discovery + MVP workflows elicit worth + stakes; `bet-pitch` and `technical-design` review
  checklists verify stakes is sized and not confused with effort.
- **Vocabulary aligned** in `product-engineering` §3, `ways-of-working/units-of-work`, `docs/product.md`.

### Added (product-discipline persona + product-principles corpus, 2026-06-14) `[no-migration]`

The second discipline-expert persona (after `groundwork-architect`), with a first-class
product-principles corpus behind it (plan: `docs/plans/architecture-2026-refresh.md`
sibling — product wave). Modelled on the same persona-in-a-workflow-route pattern;
research-grounded against 2026 product practice (Cagan's four risks, Torres's continuous
discovery, AI-native product).

- **`groundwork-product` skill** (new hidden skill): a persistent product-discipline persona
  (Cagan/Torres/Bezos lineage) owning the **value + viability** risks. Persona header +
  operating contract + context routing + four-risk handoffs, with **7 self-contained
  `references/`** (discovery-and-opportunity, product-risks, requirements-and-specs,
  success-metrics-and-signals, shaping-and-appetite, scope-and-sequencing, ai-native-product)
  sync-anchored to the source pages. Ships on `init`; present in every project.
- **Product-principles corpus** (6 new first-class pages): `foundations/continuous-discovery`
  (opportunity-solution tree, problem space before solution), `foundations/product-risks`
  (the four risks + owner table), `foundations/success-metrics` (North Star, counter-metrics,
  signal before ship), `foundations/requirements-and-specs` (JTBD, journeys, stable-ID FRs,
  Given/When/Then), `foundations/prioritization-and-appetite` (the portfolio view: appetite,
  the bet, scoring frameworks in their place), and `ai-native/ai-native-product` (the AI-native
  loop, evals as a product responsibility, dual metrics, the three cost layers). `product-engineering`
  refreshed as the corpus anchor; 6 `llms.txt` entries added.
- **Persona wired into the lifecycle**: product-brief setup (`Step 0` activation), bet discovery
  (`01-discovery.md` — the pitch shaped as the persona, both tracks), bet validation
  (`05-validation.md` — product-brief refinements + re-pitch judgement). Architect's product
  handoff flipped from "(when available)" to active; the two personas now divide the product-risk
  space (product: value + viability · architect/engineers: feasibility · designer *planned*:
  usability). Orchestrator + contributor guide updated.

### Added (architecture 2026 refresh — P0, 2026-06-14)

Research-driven refresh of the architecture guidance against 2026 best practices
(plan: `docs/plans/architecture-2026-refresh.md`). P0 — the AI/agentic cross-cut +
enforcement layer:

- **`agentic-systems` principle + architect reference** (new): architecting systems where
  AI agents are first-class actors — single-agent-first topology (naive multi-agent is the
  anti-pattern), the MCP + A2A + AG-UI protocol stack, context engineering + tiered memory,
  durable execution for long-running agents, the prompt-injection threat model + guardrails,
  least-agency + human-in/on-the-loop, and trace/eval-based reliability.
- **`evolutionary-architecture` principle + architect reference** (new): designing for change
  and governing it with **fitness functions** ("a record documents; a fitness function
  assures"), architecture-as-code, strangler-fig modernization, reversibility, and advisory
  governance (advice process / guild) over a review-board gate.
- **`ai-native-architecture` reference sharpened**: the agent protocol stack (A2A/AG-UI beside
  MCP, Resources vs Tools), the RAG pattern taxonomy (naive→advanced→agentic→adaptive,
  GraphRAG), and cost mechanism (model routing, semantic caching, AI gateway); topology/memory/
  durability/guardrails handed to `agentic-systems`.
- **AI-ops + 2026 cross-cut** woven through the operational principles + architect references:
  reliability (cell-based isolation, living burn-reviewed SLOs, AI semantic-failure + per-SLI
  budgets), observability (OTel GenAI conventions, eBPF/OBI auto-instrumentation, wide events),
  security (SPIFFE workload identity, Sigstore provenance/SLSA levels, prompt-injection + agent
  security as OWASP LLM01), performance (compute placement / edge / WebAssembly, KEDA event-driven
  scale-to-zero, model-routing + semantic-caching cost levers), platform/delivery (OpenTofu vs
  Terraform vs Pulumi, OpenFeature, GitOps rollout engines, AI gateway control plane, carbon-aware
  scheduling).
- **Enforcement/governance**: contract testing + `can-i-deploy` gate + Spectral linting + RFC 9457
  + protocol-selection added to API guidance; advice-process governance + fitness-function pairing
  added to decision records.
- **Three new structural principle pages + architect references** (P1): **`surface-architecture`**
  (surfaces as adapters over the core — the BFF seam, micro-frontend decomposition, render
  placement, design-system-as-contract), **`identity-and-access`** (authn/authz as architecture —
  OIDC/OAuth 2.1, SPIFFE workload identity, first-class agent identity + delegation, modelled
  authorization), and **`durable-execution`** (workflow-as-code — checkpointed long-running and
  multi-step processes, orchestration vs choreography, the reliability substrate for durable agents).
- **Topic improvements** (P2) to existing principles + references: integration (dead-letter handling,
  backoff-with-jitter, orchestration-vs-choreography, modern webhooks via JWKS/CloudEvents), data
  (CDC vs outbox, registry-enforced schema compatibility, the AI-era vector/RAG/feature-store layer,
  lakehouse + Iceberg), real-time (SSE as the per-direction default + LLM token-streaming pattern,
  CRDTs/local-first, WebTransport deferred), and boundaries (modular-monolith-default, the
  distributed-monolith smell + consolidation signal, Conway/Team-Topologies). Edge/WebAssembly +
  carbon-aware (P3) folded into performance/platform/cost rather than promoted to standalone pages.
- Tier-2 manifesto pages refresh on `update`; architect skill is clean-copied. `[no-migration]`.



- **`groundwork-architect`** (new hidden skill): a persistent architecture-discipline
  persona built on the engineer-skill anatomy (`SKILL.md` + `sync-anchor.md` +
  self-contained `references/`). It is adopted *within* the architecture setup workflow
  and the bet design phase (`groundwork-bet/workflows/02-design.md`) — bringing the
  house engineering principles (boundaries/hexagonal, contracts, integration,
  reliability, security, performance, observability, data, platform/delivery,
  AI-native, ADRs) to bear at every point an architecture decision is made. The
  principles are distilled into the skill's own `references/` and sync-anchored to
  `src/docs/principles/*`, which previously had no reader in the design flow.
  `[no-migration]` — skills are carried forward by clean-copy on `update`.
- **Architecture Decisions principle + governed ADR template**: a new first-class
  principle page (`docs/principles/system-design/architecture-decisions.md`) establishing
  the modern governed-decision standard — records carry **assumptions**, a **review
  trigger**, and an **owner**; they are immutable as records (superseded, never overwritten)
  and double as the decision-context layer humans and agents read before revisiting a
  choice. The shipped ADR template (`templates/adr.md`) and manifesto belief #7 are updated
  to match; the architecture commit phase now emits the governed fields. Tier-2 docs refresh
  on `update`; the template is framework-owned (clean-replaced).

### Added (upgrade path, 2026-06-12)

- **Install manifest**: init/update write `.groundwork/config/manifest.json` — every
  deployed tier-1/tier-2 file with source, package version, and SHA-256 at deploy;
  generators record provenance (name, version, options, file hashes) into the same
  ledger. Pre-manifest installs are backfilled on their next update (pristine vs
  `adopted` classification).
- **Migration registry**: `migrations/index.json` ships in the package. `cli`
  migrations (detect-first, idempotent, forward-only) run inside `update` and record
  completions in `state.json`; `agent` migrations are Detect/Transform/Accept briefs
  executed by the new skill. Changelog `[migration]` lines now reference registry ids.
- **Seeded docs stop fossilizing**: `update` hash-classifies `docs/` foundations,
  `AGENTS.md`, and `llms.txt` — pristine copies refresh to the current package, edited
  copies are queued for a skill-mediated merge, absent ones are copied as before.
- **The `./dev` bundle is framework-owned**: `update` clean-replaces `.dev/dev-bundle.js`
  and the `dev` launcher (a customized launcher is queued for judgment instead); the
  bundle embeds its version (`./dev --version`) and `./dev doctor` flags a bundle that
  trails the framework stamp.
- **`groundwork-upgrade`** (nineteenth hidden skill): executes the upgrade brief
  `update` compiles — one item, one explained proposal, one commit. Distinct from
  `groundwork-update` (project docs); the orchestrator surfaces an unconsumed brief at
  session start.
- **`update --dry-run`** prints the full plan (skill diff, tier-2 classification,
  pending migrations, brief contents) without writing; `groundwork check` gains a
  framework section (version gap, pending migrations, tier-1 corruption, unconsumed
  brief) that needs no network.
- **Upgrade-path tests**: frozen old-install fixtures (`tests/fixtures/installs/`),
  convergence/preservation/idempotency/detect-honesty contract tests, a
  migration-coverage gate in the contracts lane, and an `upgrade` simulation suite.
- [migration] Old installs never received `.groundwork/config/config.toml`; update now seeds the commented default (gw-seed-config-toml)
- [migration] Register the Serena code-intelligence MCP server in `.mcp.json` and remove the retired depwire server (gw-register-serena-mcp)
- [migration] Projects carrying `docs/ux-design.md` from before the Design System reframe need the rename and reference uplift (gw-design-system-rename)
- [migration] Products set up before the multi-surface restructure need the surface registry + capability ledger bootstrapped (gw-surfaces-registry-bootstrap)
- [migration] Code-coupled docs written before drift tracking need `last_reviewed`/`source_of_truth` frontmatter stamped (gw-drift-frontmatter-stamp)
- [migration] Bets opened before the bet-loop restructure need their tracking files uplifted to the current shape (gw-bet-shape-uplift)

Multi-surface restructure: every product is modelled as one headless **capability
core** plus zero or more **surfaces** (web, mobile, CLI, MCP), with parity tracked
per capability instead of presumed. A single-surface product pays zero added
ceremony — every phase degrades to its prior behaviour when the registry holds one
surface or none exists.

### Added (multi-surface, 2026-06-12)

- **Surface registry + capability ledger**: architecture (greenfield) and
  architecture-extract (brownfield) write `docs/surfaces.md` with a machine twin at
  `.groundwork/surfaces.json`; bet validation fills a capability × surface ledger row
  per delivered capability (`delivered`/`planned`/`omitted`/`n/a`; empty cells
  illegal; retired columns freeze).
- **The bet loop's core/surface spine**: pitches declare `surfaces:` scope and surface
  no-gos; technical designs split into Surface Design (per-surface, per-type
  vocabulary) and Capability Design (headless; the contract must serve every in-scope
  surface and presume none); milestones are typed capability-first vs surface, with
  prove-once enforcement (surface tests never re-prove core logic); headless delivery
  is legal and ledger-recorded.
- **`groundwork-surface-activation`** (eighteenth hidden skill): register → design
  (lazy track run) → scaffold → triage the ledger column → hand off; bootstraps the
  registry on pre-restructure products.
- **Two new solution types, full chains**: `flutter-app` (mobile) and `electron-app`
  (desktop) generators with survey-dated stack principles
  (`docs/principles/stack/{flutter,electron}/`), hidden engineer skills with
  hash-pinned sync anchors, brand-token theme projection, and toolchain guards that
  skip-with-reason (never silently green).
- **Multi-medium system tests**: `system-test-runner --surfaces` generates a
  `surfaces` fixture (slug → `{slug, medium, reach}`) with per-surface
  page/runner/client fixtures across five mediums; `frontend_base_url` survives as a
  deprecated alias for single-graphical-surface products.
- **Tooling**: `./dev surface status` renders the registry, ledger matrix, and
  planned-cell sync backlog; `groundwork-check` gains five surface signals (twin
  drift, empty cells, stale planned intent, untested active surface, missing
  registry).
- **Design system**: shared brand foundation runs once; tracks run per interface type
  in use; brand tokens carry per-type Tier-2 blocks (`terminal` + new `visual`, with
  platform ergonomics); the graphical-ui track gains web/mobile/desktop platform
  subsections.
- **Maturity + evals**: dimensions D8 (surface parity discipline) and D9 (contract
  compatibility); seeded `multi_surface` and `headless_api` simulation suites.
- Contract spec formats follow the core's deployment (OpenAPI/AsyncAPI hosted, proto
  for gRPC, typed module API embedded).

### Fixed (multi-surface, 2026-06-12)

- The brownfield eval fixture's `services/` tree was silently excluded by the repo
  `.gitignore` and never tracked; negation rules added and the fixture committed.

### Fixed (multi-surface live bake-out, 2026-06-12)

End-to-end sandbox run of the full chain — Go core + Flutter + Electron scaffolds
booted together, both surfaces proven live against the running core (real SDKs:
Flutter 3.44.2, Electron via Playwright `_electron`):

- **Flutter wiring proof now true out of the box**: the scaffold's `ApiClient`
  probed `/api/healthz` (the Next.js BFF route) while Go/Python cores serve
  `/health` — a freshly scaffolded mobile app rendered "unreachable" against its
  own healthy core. The client now probes `/health` (BFF variance documented).
- **Electron surface actually wired to the core**: the scaffold never consumed the
  `API_BASE_URL` the test harness passes. New `src/main/core-client.ts` seam (main
  fetches the gateway; the CSP-sandboxed renderer rides the typed `core:health`
  channel), rendered as a wiring-proof line in the home view, asserted in the
  Playwright smoke, unit-tested with injected fetch.
- **Auth seams on both surfaces**: Flutter gains `authTokenProvider` + a tested
  Bearer interceptor; Electron's core client exposes `coreAuthHeaders` —
  unauthenticated by default, identity-provider wiring documented at the seam.
- **`flutter create` pollution at bootstrap**: the platform-shell bootstrap now uses
  `--empty`, keeping the counter-app sample `widget_test.dart` (which references a
  `MyApp` the scaffold doesn't have) from breaking analyze/test post-bootstrap.
- **Re-running `workspace-dev-cli` no longer resets docker-compose.yml**: the
  topology accreted by service generators is preserved verbatim (a re-run erased
  the core's registration, and `./dev migrate` silently migrated nothing).
- **`./dev` lifecycle commands no longer treat surfaces as backends**: app services
  are now the `services/` directories wired into compose, so migrate/start/doctor
  skip mobile/desktop surface apps instead of creating phantom databases for them.
- **Flutter runner device probe counts only android/ios devices**: host "devices"
  (macOS, Chrome) no longer turn the intended skip into a hard no-devices failure;
  the skip names the missing device class.
- All of the above locked in by new generation tests (core-access seam wiring,
  `--empty` bootstrap, auth seams, compose preservation, device-probe filter).

Contract-grade delivery: the bet loop's design → tests → delivery chain becomes
machine-enforced end to end. Design emits specs, the proof suite is reviewed
assertion-by-assertion and sealed by hash manifest, delivery is tracked per-slice in a
machine-readable manifest, and the loop closes with a retrospective. Plus the package
rename and the BMAD delivery-loop adoptions. Also includes the second-pass quality
sweep over the 0.9.0 surface.

### Added (contract-grade delivery, 2026-06-10)

- **Specs at design time**: Design Foundations writes `docs/bets/<slug>/contracts/`
  (`openapi.yaml`, `asyncapi.yaml`, `schema.sql`); decomposition tests derive every shape
  from the specs; validation promotes them to `docs/api/<service>/` as the canonical record.
- **The signing gate**: a generated `test-review.md` puts every test's verbatim assertions
  and traceability in front of the user at Proof of Work; on approval `./dev bet sign`
  seals the suite with a SHA-256 manifest. `./dev test bet` refuses a tampered suite; the
  delivery workflow forbids test edits; a wrong test routes through the Amendment Protocol
  with user sign-off and a re-seal.
- **The progress surface**: `.groundwork/bets/<slug>/decomposition.json` mirrors the
  decomposition machine-readably; delivery records per-slice status, baseline/delivered
  commits, file lists, and notes; `./dev bet status [--json]` renders the milestone/slice
  board with seal verification.
- **Delivery-loop mechanics adopted from BMAD**: per-slice context capsule (read every file
  the slice modifies before changing it), three-lens slice review (blind reviewer, edge-case
  tracer, acceptance auditor against the specs) with decision/patch/defer/dismiss triage
  wired to the maturity ledger, the bet retrospective (slice-record mining, previous-retro
  follow-through audit, significant-discovery detection, readiness exploration), and Change
  Navigation with written before/after change proposals.
- **`groundwork-patch`**: the small-change lane — one bounded user-facing goal, tested,
  Living-Documents-passed, logged to `docs/bets/patch-ledger.md`; clustering patches surface
  as a bet signal in discovery. Contract/schema changes never qualify.
- **Generated test surface**: contract-conformance system test (served spec vs promoted
  spec), Playwright page-object scaffold + axe a11y smoke for graphical-ui projects, and a
  per-stack "Bet Slice Rollout" permanent-test taxonomy in the engineer skills.
- **1.0 criteria** written down in `docs/plans/contract-grade-delivery.md` §9.5.

### Changed (contract-grade delivery, 2026-06-10)

- [migration] Package renamed `groundwork` → `groundwork-method` — the binary stays `groundwork`; change any `npx groundwork …` invocations in your scripts to `npx groundwork-method …` (gw-package-rename-invocations)
- Rename context: the bare npm name is held by an unrelated package, and the `-method` suffix matches the methodology-package convention.
- Release workflow publishes for real (dry-run gate removed); requires the `NPM_TOKEN` secret.
- Infra images pinned (`postgres:16`, `redis:7`); `groundwork check` exit codes documented.
- `docs/groundwork-vs-bmad.md` corrected: BMAD does deliver (full implementation phase);
  GroundWork's differentiators are the executable layer and the sealed design-locked test
  contract, not "they stop at documents."

### Added

- **`groundwork-elicit`**: structured elicitation as an anytime utility skill — diagnoses a
  weak draft section, proposes the one best-fit technique (24 curated methods, loaded only at
  invocation), executes it conversationally, and applies the strengthened section to the open
  draft with the review gate re-run before commit. Offered from the draft walkthroughs of
  product brief, architecture, the design-system tracks, and bet design.
- **Operating contract Protocol 9 (Review Invocation)**: the review-dispatch mechanics and the
  failure procedure now live in one place. A review that errors, hangs, or returns no verdict
  stops the phase — never a silent self-review; an inline self-review requires explicit user
  authorisation and is loudly labelled as not satisfying the gate. Additive; contract stays v1.

### Changed

- **Per-phase step files**: `groundwork-architecture` and `groundwork-scaffold` (31KB each)
  split into slim entries plus `phases/NN-*.md` loaded at each phase's start — a session in a
  late phase no longer carries every earlier phase's instructions. Content-preserving move.
- **Extract-path consistency**: Adopt/Upgrade detection is one structural rule stated
  identically across all three extract skills; `brand-tokens.json` is preserved when valid;
  state recording and frontmatter exemptions are stated as intent instead of left implicit;
  infra-adopt halts on a service-count mismatch and records a gap row.
- **Greenfield lifecycle gaps**: product-brief gains the sibling resume protocol; MVP defines
  its post-review refine path; scaffold flags unverified output with a Verification Status
  section; the reversal-protocol sentence is aligned across all phases.
- **Registered-skill context cost**: persona description cut 77→36 words; check loses its
  duplicated description and dead reference; orchestrator anchors the operating contract and
  explains its rules.
- `groundwork check` prints a friendly guard when run outside a git repository; the seeded
  `llms.txt` states that setup-phase docs appear as each phase commits.

### Removed

- The in-repo `BMAD/` reference clone (the analysis it informed is committed; the clone lives
  outside the repo). Stale `main` field in package.json and stale `.npmignore` entries.

### Fixed (full-corpus skill audit, 2026-06-12)

Every SKILL.md, instructions file, template, and checklist in the shipped corpus was
read and ~1,076 cross-references mechanically verified; the findings ledger executed:

- **Security**: `package.json` gains a `files` allowlist — a local `npm pack` previously
  shipped the repo's `.env` (live API keys), `.nx/` caches, and stray workspaces
  (2,832 files → 482). The CI release path was never affected. [no-migration]
- **Sandbox leak scrubbed from the Next.js engineer skill**: 12 live `wordloop.app`/
  cloudinary identifiers replaced with generic hosts, 14 "the the Next.js application"
  find/replace artifacts repaired across 8 reference files, and an invalid
  attribute-position JSX comment fixed in `mutations-and-forms.md`. [no-migration]
- **infra-adopt joins the multi-surface seam**: Phase 2 now runs
  `system-test-runner --surfaces` from `.groundwork/surfaces.json` instead of the
  deprecated single-surface `--interfaceMedium` alias — brownfield always has a
  registry by then, and the alias produced a fixture-less harness plus false
  groundwork-check warnings. [no-migration]
- **Broken shipped paths**: scaffold Phase 2's missing-skill fallback pointed at the
  repo-internal `src/hidden-skills/` (now `.agents/groundwork/skills/`);
  groundwork-writer's document-type table caught up with the canon
  (`docs/services/<service>.md`, `docs/decisions/`, `docs/api/<service>.md`, root
  `llms.txt`, new Domain Entity row). [no-migration]
- **Engineer-skill contract drift**: Go validation responses unified on 422 across
  SKILL.md, `api-design.md`, and `http-handlers.md` (matching the Python skill and
  huma's default); the insecure `tempfile.mktemp` exemplar (CWE-377) replaced with
  `mkstemp`; the "flat package layout" claim corrected to the nested `internal/`
  layout the generator actually scaffolds (fixed in the pinned principle and
  re-anchored); the phantom `--run-integration` pytest flag replaced with real
  `-m live` marker selection. [no-migration]
- **Protocol-list drift**: all bet workflow headers now carry the contract's
  Continuous Bet set (Protocols 1, 2, 4, 8, 9); the contract's Maintenance mode
  gains `groundwork-upgrade`; update/upgrade headers name Protocol 9. [no-migration]
- **Bet activation**: routes added for `status: discovery` (resume into design) and
  `status: delivered` (terminal — next work is a new bet), plus multi-pitch
  disambiguation when several active pitches exist. [no-migration]
- **Scan digest schema**: four new fields (`inferred_users`, `licensing_signals`,
  `theme_framework`, `interaction_a11y`) and routing so the brownfield extracts'
  findings-template sections (Inferred Users, Licensing, Product Surface, Theme &
  Framework, Interaction/A11y) are actually populated by the scan. [no-migration]
- **Governance (repo-side)**: engineer-skill mirror rule documented (canon =
  `src/hidden-skills/`, `.agents/skills/` copies are read-only) and enforced by two
  new gates in `./dev test contracts` (mirror byte-identity + sync-anchor hash
  verification — the anchors' "CI verifies" claim is now true); CLAUDE.md routes Go
  work to `groundwork-go-engineer` (was the vendored `golang-pro`) and gains a Python
  route; `skills-lock.json` hashes recomputed against the vendored files with the
  recipe documented; the contributor guide's repo map lists all eight dev skills and
  its phantom `./dev check contracts` reference now names the real conformance path.
- **Minors**: MVP phases renumbered contiguously (1–4); maturity prose reconciled
  with its four-row table (`n/a` is a precondition marker, not a state); `dormant`
  surfaces keep their recorded `testMedium` (exercised only while `active`); three
  electron cross-skill reference paths qualified; "Workstream F" plan leak removed
  from bet decomposition; scripted discovery questions converted to intent; dead
  `last_reviewed` dropped from the pitch template; groundwork-check's dimension
  range updated for D8/D9. [no-migration]
- **Audit backlog sweep** (second pass, same day): the Next.js engineer SKILL.md
  rejoined its family template (capability-core clause, named principle path, real
  reference files behind every Task Routing entry, hedge-free safety gates); sandbox
  `Story*` identifiers generalized out of the Python database reference; Python DI
  exemplar re-typed against the gateway Protocol; idempotency-key scope unified on
  POST/PATCH with PUT's HTTP-semantics exemption stated; stale Go 1.22 loop-var
  idiom removed and the provider-boundary `%v` wrap given its rationale; snapshot
  testing scoped to genuinely opaque artefacts (matching the Go rule); electron's
  sync-anchor now pins its `typescript/frontend.md` deferral target; the review
  skill documents `implementation-readiness.md` as deliberately outside the
  `document_type` enum and its upstream chain includes `decomposition`; digest
  routing labels exact-match the `## Service / Partition Map` header; the engineer
  two-family SKILL.md split and the vendored-skill style policy are now recorded in
  the contributor guide; scaffold-designer's checklists carry a summaries-not-canon
  caveat and its stale `workspace.json` claim is gone. [no-migration]

### Fixed (production-readiness pass, 2026-06-12)

- **`update` fails closed on copy errors**: the mechanical lane (skill trees,
  generators config, tier-2 docs, dev bundle) now aborts on any I/O failure
  *before* the version stamp and manifest advance — a partial apply reads as
  "update failed, re-run", never as a clean update whose half-copied files
  classify as user edits on the next run. `init` likewise aborts instead of
  printing success over a failed skill install. [no-migration]
- **Bet workflows pin the contract version**: all five `groundwork-bet`
  workflow headers now reference the operating contract as `(contract v1)`,
  matching every other methodology skill. [no-migration]
- **License metadata**: `package.json` declared ISC while the LICENSE file is
  MIT; the manifest now says MIT. [no-migration]
- **Repo hygiene** (dev-only): nine committed scratch scripts (Gemini SDK
  explorations) and an accidentally committed session lock file removed from
  the repo root; the lock path is now gitignored. The contributor guide's
  release section no longer claims the publish workflow is dry-run gated.

## [0.9.0] - 2026-06-09

First tracked release. GroundWork adopts semver from `0.x` honestly — the framework is
feature-complete across both setup paths but its operational surface is still hardening.

### Added

- **Update engine**: `groundwork-update` rebuilt as a full maintenance skill — change-set
  resolution, three-pass code→doc mapping (path intersection, Serena impact analysis,
  semantic mapping), surgical edits under the Living Documents protocol, fail-closed review
  gate per mutated doc.
- **Real CLI `update` and `check`**: `update` diffs installed skills against the package and
  refreshes them (preserving `.groundwork/config`, cache, and docs); `check` runs deterministic
  doc-drift detection (git history vs `last_reviewed`/`source_of_truth` frontmatter), CI-ready
  with meaningful exit codes.
- **Version stamping**: init/update write `groundwork.version` into `.groundwork/config/state.json`;
  the operating contract carries a contract version; the CLI warns on mismatch and prints the
  changelog slice between installed and current versions on update.
- **Help surface**: a workflow index generated from the orchestrator routing tables
  (`npm run gen:workflow-index`), served by the orchestrator's help intent and `npx groundwork help`;
  freshness is CI-gated.
- **Maturity steering (D8)**: a seven-dimension maturity model defining GroundWork's target
  state, a living `docs/maturity.md` (assessment + tracked gap roadmap) written by both setup
  paths, bet-loop steering (discovery proposes pulling gaps in, validation closes rows), and
  continuous re-assessment in `groundwork-check`. Supersedes the one-shot onboarding report.
- **Shipped review checklists**: per-document-type named-failure-mode checklists under
  `groundwork-review/checklists/`, cited by item name in review findings.
- **Skill conformance linter**: `./dev lint skills` (CI-gated) — frontmatter, versioned
  contract references, fail-closed review-gate blocks, canonical discovery-notes headers,
  routing↔filesystem agreement, llms.txt links, skill↔doc pairs, workflow-index freshness.
- **User config surface**: `.groundwork/config/config.toml` seeded once at init —
  `[defaults]` proposals (stack, models, generator flags) read by architecture/scaffold,
  `[skills]` custom routing merged after the built-in table.
- **CLI contract tests**: `./dev test cli` (CI-gated) covering init/update/check semantics;
  exposed and fixed a self-copy guard bug that could have deleted the source repo's own skills.
- **Adversarial simulation suites**: ambiguous, terse, mid-flow-reversal, and scope-creep
  personas for the simulation harness.
- **Host support statement** (`docs/host-support.md`), a greenfield output showcase
  (`docs/examples/greenfield-verse.md`), and BMAD-artifact ingestion named explicitly in all
  three brownfield extract skills (Adopt/Upgrade mode).
- Root `README.md` and `docs/getting-started.md` (walkthrough with excerpts from a real
  greenfield simulation session).
- `Maintenance (anytime)` lifecycle mode in the operating contract, defining which protocols
  bind `groundwork-update` and `groundwork-check`.
- `contracts` CI job: dev-CLI bundle freshness, adopt-merge idempotency, workflow-index freshness.

### Changed

- [migration] Installs made before 0.9.0 carry no version stamp — run `npx groundwork update` once to stamp `groundwork.version` into `.groundwork/config/state.json` and enable migration notes for future upgrades.
- `groundwork-persona` editorial pass to the skill-writer standard (stays registered — always-on
  conversational posture cannot load on demand).
- Lifecycle docs cover the brownfield path (scan → extract ×3 → infra adoption) and Adopt/Upgrade
  mode; `docs/lifecycle/index.md` no longer claims greenfield-only.

### Pre-history

Before 0.9.0 the package was unversioned (hardcoded `1.0.0`, no releases). Major capabilities
built in that period: the two-layer skill architecture and orchestrator routing; greenfield setup
phases (product brief, design system, architecture, scaffold, MVP); the brownfield track (scan,
three extract phases, infra adoption, gap ledger); the operating contract (discovery notes,
living documents, phase lifecycle, summaries, hand-off cache, cache isolation, review gate);
Nx generators for Go/Python microservices, Next.js apps, CLI apps, docs sites, and the
system-test runner; the bundled `./dev` workspace CLI; Serena MCP registration; the scaffold
test harness (generation/contracts/compilation/e2e) and the simulation harness with checkpoints.
