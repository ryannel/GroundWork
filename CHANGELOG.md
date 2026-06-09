# Changelog

All notable changes to GroundWork are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/). Entries that require action when upgrading an
existing installation are prefixed `[migration]` — `npx groundwork update` surfaces them
automatically when it detects a version jump.

## [Unreleased]

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
- **Maturity steering (D8)**: the operating model for guiding existing systems toward
  GroundWork's target state — a maturity model with named dimensions, a living roadmap doc,
  and bet-loop integration (in progress).
- Root `README.md` and `docs/getting-started.md` (walkthrough with excerpts from a real
  greenfield simulation session).
- `Maintenance (anytime)` lifecycle mode in the operating contract, defining which protocols
  bind `groundwork-update` and `groundwork-check`.
- `contracts` CI job: dev-CLI bundle freshness, adopt-merge idempotency, workflow-index freshness.

### Changed

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
