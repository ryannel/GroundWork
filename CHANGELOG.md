# Changelog

All notable changes to GroundWork are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/). Entries that require action when upgrading an
existing installation are prefixed `[migration]` — `npx groundwork update` surfaces them
automatically when it detects a version jump.

## [Unreleased]

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

- [migration] Package renamed `groundwork` → `groundwork-method` — the binary stays `groundwork`; change any `npx groundwork …` invocations in your scripts to `npx groundwork-method …`.
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

## [0.9.0] - 2026-06-09

First tracked release. GroundWork adopts semver from `0.x` honestly — the framework is
feature-complete across both setup paths but its operational surface is still hardening.

### Added

- **Update engine**: `groundwork-update` rebuilt as a full maintenance skill — change-set
  resolution, three-pass code→doc mapping (path intersection, depwire impact analysis,
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
system-test runner; the bundled `./dev` workspace CLI; depwire MCP registration; the scaffold
test harness (generation/contracts/compilation/e2e) and the simulation harness with checkpoints.
