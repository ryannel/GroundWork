# Changelog

All notable changes to GroundWork are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/). Entries that require action when upgrading an
existing installation are prefixed `[migration]` — `npx groundwork update` surfaces them
automatically when it detects a version jump.

## [Unreleased]

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
